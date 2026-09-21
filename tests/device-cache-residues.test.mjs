import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readdir, readFile} from 'node:fs/promises';

// M7-T23 — Residui della cache del dispositivo dopo logout e dopo purge.
//
// Censimento + prova con dati sintetici di **che cosa resta materialmente** sul
// dispositivo, distinguendo:
//   1. cancellazione locale (l'archivio viene svuotato);
//   2. sola invalidazione della UI (la sessione si chiude, ma i byte restano);
//   3. dato ancora presente e leggibile (IndexedDB, Cache Storage, localStorage).
//
// Cosa è **reale**: i moduli di produzione del logout (`logout-session.js`), della
// sessione Vault (`vault-session.js`), della coda offline
// (`offline-mutation-queue.js`) e il service worker (`sw.js`).
// Cosa è **simulato**: `window`, `sessionStorage`, `localStorage`, `caches`,
// IndexedDB e `fetch`, che in Node non esistono. Nessun browser è stato usato:
// i limiti sono dichiarati nel rapporto e nel censimento.
const root = new URL('../Frontend/public/', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');

const logoutSource = strip(await read('assets/js/logout-session.js'));
const vaultSessionSource = strip(await read('assets/js/modules/core/vault-session.js'));
const queueSource = await read('assets/js/modules/data/offline-mutation-queue.js');
const queue = await import(`data:text/javascript;base64,${Buffer.from(queueSource).toString('base64')}`);
const swSource = await read('sw.js');

// ── 1. Logout: che cosa viene azzerato e che cosa no ────────────────────────

function logoutFixture({signOutFails = false} = {}) {
    const session = new Map(), local = new Map(), calls = [], events = [];
    session.set('vault_session_v1', JSON.stringify({version: 1, uid: 'A', ciphertext: 'synthetic'}));
    session.set('codex_vault_session_wrapping_key_v1', 'synthetic-wrapping-key');
    session.set('vault_s_key', 'synthetic');
    session.set('vault_s_expiry', '123');
    session.set('profile-account-link-draft', JSON.stringify({accountId: 'account-1'}));
    local.set('codex_vault_envelope_A', '{"synthetic":"envelope"}');
    local.set('codex_vault_verifier_A', '{"synthetic":"verifier"}');
    local.set('codex_profile_avatar_A', 'https://example.invalid/avatar.jpg');
    local.set('codex_theme', 'dark');
    local.set('codex_push_active_scopes', '["private"]');
    const storage = (map, kind) => ({
        getItem: key => map.get(key) ?? null,
        setItem: (key, value) => { calls.push([`${kind}.setItem`, key]); map.set(key, String(value)); },
        removeItem: key => { calls.push([`${kind}.removeItem`, key]); map.delete(key); },
        clear: () => { calls.push([`${kind}.clear`]); map.clear(); }
    });
    const context = vm.createContext({
        console: {warn() {}}, crypto, TextEncoder, TextDecoder, Date, Event: class {constructor(type) { this.type = type; }},
        setTimeout, clearTimeout,
        sessionStorage: storage(session, 'sessionStorage'), localStorage: storage(local, 'localStorage'),
        window: {privateAuthGate: {block: () => calls.push(['gate.block'])},
            dispatchEvent: event => { events.push(event.type); return true; },
            location: {replace: url => calls.push(['location.replace', url])}}
    });
    vm.runInContext(`${vaultSessionSource}\n${logoutSource}\n`
        + 'globalThis.logoutWithCleanup = logoutWithCleanup;\nglobalThis.clearVaultSession = clearVaultSession;', context);
    return {context, session, local, calls, events,
        logout: (redirect = '/login-v115.html') => context.logoutWithCleanup(async () => {
            calls.push(['signOut']);
            if (signOutFails) throw new Error('synthetic signOut failure');
        }, redirect)};
}

test('T-23: il logout azzera la sessione Vault e non tocca gli archivi persistenti', async () => {
    const f = logoutFixture();
    await f.logout();

    // Sessione Vault: cancellata (era in sessionStorage, per-scheda).
    for (const key of ['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry']) {
        assert.equal(f.session.has(key), false, `${key} doveva essere rimosso`);
    }
    // Il marcatore di diniego resta: è la protezione che impedisce la riadozione.
    assert.equal(f.session.get('codex_explicit_logout'), '1');
    // I dati utente in sessionStorage non vengono azzerati: bozze comprese.
    assert.equal(f.session.has('profile-account-link-draft'), true,
        'una bozza utente in sessionStorage sopravvive al logout nella stessa scheda');

    // Archivi persistenti: intatti, byte per byte.
    assert.deepEqual([...f.local.keys()].sort(), ['codex_profile_avatar_A', 'codex_push_active_scopes',
        'codex_theme', 'codex_vault_envelope_A', 'codex_vault_verifier_A']);
    assert.equal(f.local.get('codex_vault_envelope_A'), '{"synthetic":"envelope"}');

    // Nessuna primitiva di cancellazione degli archivi viene nemmeno tentata.
    const destructive = f.calls.filter(([name]) => /clear|delete/i.test(name));
    assert.deepEqual(destructive, [], `nessuna cancellazione: ${JSON.stringify(f.calls)}`);
    // Il gate viene bloccato, l'evento di blocco emesso e il redirect eseguito.
    assert.ok(f.calls.some(([name]) => name === 'gate.block'));
    assert.deepEqual(f.events, ['private-auth-blocked']);
    assert.deepEqual(f.calls.find(([name]) => name === 'location.replace'), ['location.replace', '/login-v115.html']);
    assert.equal(f.calls.filter(([name]) => name === 'signOut').length, 1);
});

test('T-23: anche con signOut fallito il blocco locale e il redirect restano', async () => {
    const f = logoutFixture({signOutFails: true});
    await f.logout();
    assert.equal(f.session.has('vault_session_v1'), false, 'la sessione Vault è comunque cancellata');
    assert.equal(f.session.get('codex_explicit_logout'), '1', 'il marcatore di diniego resta');
    assert.ok(f.calls.some(([name]) => name === 'location.replace'), 'il redirect avviene comunque');
    assert.deepEqual(f.calls.filter(([name]) => /clear|delete/i.test(name)), []);
});

// ── 2. Censimento statico: nessun percorso cancella gli archivi ─────────────

async function frontendSources() {
    const files = new Map();
    const walk = async directory => {
        for (const entry of await readdir(directory, {withFileTypes: true})) {
            const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
            if (entry.isDirectory()) {
                if (entry.name !== 'vendor') await walk(url);
            } else if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs')) {
                files.set(url.pathname.split('/public/')[1], await readFile(url, 'utf8'));
            }
        }
    };
    await walk(root);
    files.set('sw.js', swSource);
    return [...files].map(([path, text]) => ({path, text}));
}

test('T-23: nel runtime del client non esiste alcuna cancellazione degli archivi', async () => {
    const sources = await frontendSources();
    assert.ok(sources.length > 150, `il censimento deve coprire l’intero runtime del client (trovati ${sources.length})`);
    const forbidden = ['clearIndexedDbPersistence', 'indexedDB.deleteDatabase', 'localStorage.clear(',
        'sessionStorage.clear('];
    for (const needle of forbidden) {
        const hits = sources.filter(file => file.text.includes(needle)).map(file => file.path);
        assert.deepEqual(hits, [], `${needle} non deve comparire nel runtime (trovato in ${hits.join(', ')})`);
    }
    // `caches.delete` esiste solo nel service worker, e solo per le proprie cache
    // di shell (`codex-*`) diverse da quella corrente.
    const cacheDeleters = sources.filter(file => file.text.includes('caches.delete')).map(file => file.path);
    assert.deepEqual(cacheDeleters, ['sw.js'], 'solo il service worker cancella cache');
    assert.match(swSource, /filter\(name => name\.startsWith\(APP_CACHE_PREFIX\) && name !== CACHE_NAME\)/,
        'la cancellazione è limitata alle cache di shell proprie e non correnti');
    assert.match(swSource, /const APP_CACHE_PREFIX = 'codex-'/);
});

// ── 3. Cache Storage: che cosa il service worker conserva davvero ───────────

function serviceWorkerFixture(shell = ['home_page.html', 'assets/js/modules/privato/profilo-ui.js']) {
    const put = [], deleted = [], opened = [];
    const caches = {
        keys: async () => ['codex-shell-v1.2.126', 'codex-shell-v1.2.127', 'workbox-precache-v2'],
        delete: async name => { deleted.push(name); return true; },
        open: async name => {
            opened.push(name);
            return {put: async (request, response) => put.push({key: typeof request === 'string' ? request : request.url, response}),
                match: async () => undefined};
        },
        match: async () => undefined
    };
    const listeners = new Map();
    const fetched = [];
    const context = vm.createContext({
        URL, console, Response: {error: () => ({error: true})},
        caches, fetch: async request => { fetched.push(request.url); return {ok: true, clone() { return this; }}; },
        importScripts() {},
        self: {__OFFLINE_ASSETS: shell, skipWaiting() {}, clients: {claim: async () => {}},
            location: {origin: 'https://appcodici-password.web.app'},
            addEventListener: (type, handler) => listeners.set(type, handler)}
    });
    vm.runInContext(swSource, context);
    return {put, deleted, opened, fetched, listeners};
}

function fetchEvent(fixture, {url, mode = 'no-cors', method = 'GET'}) {
    let responded = null;
    const event = {request: {url, mode, method}, respondWith: promise => { responded = promise; }};
    fixture.listeners.get('fetch')(event);
    return responded;
}

test('T-23: il service worker conserva solo la shell stessa-origine, mai risposte del backend', async () => {
    const f = serviceWorkerFixture();
    // Richieste verso Firestore/Storage/Functions: cross-origin, mai intercettate.
    for (const url of ['https://firestore.googleapis.com/v1/projects/x/databases/(default)/documents/users/A',
        'https://firebasestorage.googleapis.com/v0/b/appcodici-password.firebasestorage.app/o/users%2FA%2Favatar_x?alt=media',
        'https://europe-west1-appcodici-password.cloudfunctions.net/purgeArchivedAccount']) {
        const responded = fetchEvent(f, {url});
        assert.equal(responded, null, `nessuna intercettazione per ${url}`);
    }
    // Stessa origine ma fuori dalla shell dichiarata: non entra in cache.
    assert.equal(fetchEvent(f, {url: 'https://appcodici-password.web.app/assets/js/modules/non-in-shell.js'}), null);
    // Cross-origin con **percorso identico** a una risorsa di shell: è il caso che
    // il controllo di origine deve fermare, altrimenti una risposta del backend
    // finirebbe nella Cache API sotto un nome di shell.
    assert.equal(fetchEvent(f, {url: 'https://firestore.googleapis.com/assets/js/modules/privato/profilo-ui.js'}), null,
        'una risposta cross-origin non entra in cache nemmeno con un percorso di shell');
    assert.equal(fetchEvent(f, {url: 'https://appcodici-password.web.app.evil.example/home_page.html',
        mode: 'navigate'}), null, 'un host che imita il dominio non è la stessa origine');
    assert.deepEqual(f.put, [], 'a questo punto nulla è stato messo in cache');
    // Contenuto protetto: escluso esplicitamente.
    assert.equal(fetchEvent(f, {url: 'https://appcodici-password.web.app/protected-media/presentation'}), null);
    // Risorsa di shell: rete prima, poi cache.
    await fetchEvent(f, {url: 'https://appcodici-password.web.app/assets/js/modules/privato/profilo-ui.js'});
    assert.deepEqual(f.put.map(entry => entry.key),
        ['https://appcodici-password.web.app/assets/js/modules/privato/profilo-ui.js']);
    assert.equal(f.put[0].response.ok, true);
});

test('T-23: le chiavi della cache conservano la query string, ma solo per la shell', async () => {
    const f = serviceWorkerFixture(['home_page.html']);
    const navigation = {url: 'https://appcodici-password.web.app/home_page.html?id=account-1', mode: 'navigate'};
    await fetchEvent(f, navigation);
    assert.deepEqual(f.put.map(entry => entry.key),
        ['https://appcodici-password.web.app/home_page.html?id=account-1'],
        'la chiave di cache conserva la query: il nome dell’Account resta nel dispositivo, non il suo contenuto');
    // L'attivazione cancella solo le cache di shell proprie e non correnti.
    let activation = null;
    f.listeners.get('activate')({waitUntil: promise => { activation = promise; }});
    await activation;
    assert.deepEqual(f.deleted, ['codex-shell-v1.2.126'],
        'le cache estranee e quella corrente non vengono toccate');
});

// ── 4. Coda offline: presente dopo il logout, ma cifrata ───────────────────

// Frontiera IndexedDB in memoria (stessa forma del banco della coda offline):
// richieste, transazioni seriali e rollback su abort.
function indexedFixture() {
    const data = new Map();
    let tail = Promise.resolve();
    const database = {
        close() {},
        transaction(_store, mode) {
            const requests = [];
            const tx = {aborted: false, abort() { this.aborted = true; }, objectStore: () => store};
            const request = (action, key, value) => { const req = {}; requests.push({action, key, value, req}); return req; };
            const store = {
                get: key => request('get', key), put: value => request('put', value.id, value),
                add: value => request('add', value.id, value), delete: key => request('delete', key),
                index: () => ({getAll: () => request('all')})
            };
            tail = tail.then(() => new Promise(resolve => setImmediate(async () => {
                const draft = new Map(data);
                while (requests.length && !tx.aborted) {
                    const {action, key, value, req} = requests.shift();
                    try {
                        if (action === 'get') req.result = structuredClone(draft.get(key));
                        if (action === 'all') req.result = [...draft.values()].map(item => structuredClone(item));
                        if (action === 'delete') draft.delete(key);
                        if (action === 'put' || action === 'add') draft.set(key, structuredClone(value));
                        req.onsuccess?.();
                    } catch (error) { tx.error = error; tx.aborted = true; req.error = error; req.onerror?.(); }
                }
                if (!tx.aborted && mode === 'readwrite') { data.clear(); for (const [key, value] of draft) data.set(key, value); }
                await Promise.resolve();
                if (tx.aborted) tx.onabort?.(); else tx.oncomplete?.();
                resolve();
            })));
            return tx;
        }
    };
    return {data, indexedDb: {open: () => { const req = {}; setImmediate(() => { req.result = database; req.onsuccess?.(); }); return req; }}};
}

test('T-23: la coda offline resta in IndexedDB dopo il logout, ma solo in forma cifrata', async () => {
    const idb = indexedFixture();
    const secret = 'SYNTHETIC-PLAINTEXT-SECRET';
    const operation = {uid: 'owner-a', operationId: 'device:1', recordId: 'account-1', expectedRevision: 1,
        record: {nomeAccount: 'Sintetico', password: secret}};
    const queueInstance = await queue.createOfflineMutationQueue({uid: 'owner-a',
        vaultKeyMaterial: 'SYNTHETIC-VAULT-KEY', indexedDb: idb.indexedDb});
    await queueInstance.enqueue(operation);
    queueInstance.close();

    // Il contenitore in IndexedDB non contiene il segreto in chiaro.
    const [container] = [...idb.data.values()];
    assert.equal(container.uid, 'owner-a');
    assert.equal(container.schemaVersion, 1);
    assert.equal(typeof container.ciphertext, 'string');
    assert.equal(JSON.stringify(container).includes(secret), false,
        'il contenuto della coda è sigillato: nessun plaintext nel record');
    assert.equal(JSON.stringify(container).includes('Sintetico'), false,
        'nemmeno i metadati leggibili del record restano in chiaro');

    // Il logout non tocca questo archivio.
    const before = JSON.stringify([...idb.data.entries()]);
    const f = logoutFixture();
    await f.logout();
    assert.equal(JSON.stringify([...idb.data.entries()]), before, 'il logout non modifica la coda');

    // Riaprendo con la chiave del Vault l'operazione torna leggibile: il residuo
    // è materiale e recuperabile da chi possiede la Vault Key.
    const reopened = await queue.createOfflineMutationQueue({uid: 'owner-a',
        vaultKeyMaterial: 'SYNTHETIC-VAULT-KEY', indexedDb: idb.indexedDb});
    assert.deepEqual(await reopened.list(), [operation]);
    reopened.close();

    // Senza la chiave giusta il contenitore non è apribile.
    const wrongKey = await queue.deriveOfflineQueueKey('ALTRA-CHIAVE', 'owner-a');
    await assert.rejects(queue.openOfflineOperation([...idb.data.values()][0], wrongKey, 'owner-a'));
});

// ── 5. Purge: nessun percorso client ───────────────────────────────────────

test('T-23: il purge è un percorso del backend e il client non evacua la cache locale', async () => {
    const archive = await read('assets/js/modules/settings/archive-account-service.js');
    const deletion = archive.slice(archive.indexOf('export async function executeArchiveDeletion'),
        archive.indexOf('export async function deleteArchivedAccount'));
    assert.match(deletion, /httpsCallable\(functions, 'purgeArchivedAccount'\)/,
        'il client invoca la callable del purge');
    for (const eviction of ['deleteDoc', 'clearIndexedDbPersistence', 'indexedDB', 'caches.delete']) {
        assert.equal(deletion.includes(eviction), false,
            `la cancellazione dal dispositivo non passa da ${eviction}`);
    }
    // Nessun modulo del client ascolta un esito di purge per svuotare la cache.
    const sources = await frontendSources();
    const listeners = sources.filter(file => /purgeArchivedAccount/.test(file.text)).map(file => file.path);
    assert.deepEqual(listeners, ['assets/js/modules/settings/archive-account-service.js'],
        'la callable del purge compare solo nel servizio che la invoca');
});
