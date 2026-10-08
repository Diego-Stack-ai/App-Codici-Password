import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// M7-T28 — Cambio avatar: che fine fa il **vecchio** oggetto Storage.
//
// Il banco esegue il modulo reale del profilo (`profilo-ui.js`, `setupAvatarEdit`)
// e l'helper reale di validazione (`attachment-security.js`) su un modello in
// memoria di bucket Storage, documento `users/{uid}` e cache locale. Serve a
// distinguere caricamento del nuovo avatar, aggiornamento del riferimento,
// eventuale cancellazione del vecchio, errori parziali e cambio di sessione.
//
// Cosa è **reale**: il percorso di produzione del cambio avatar (validazione
// immagine, nome oggetto casuale, upload, URL, `updateDoc`, cache, messaggi).
// Cosa è **simulato**: Storage e Firestore. Che i byte del vecchio oggetto
// restino davvero nell'emulatore è provato da
// `tests/avatar-change-residues.emulator.test.mjs`.
const BUCKET = 'appcodici-password.firebasestorage.app';
const urlOf = path => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=synthetic`;
const pathOf = url => decodeURIComponent(String(url).split('/o/')[1].split('?')[0]);
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const avatarModule = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/privato/profilo-ui.js', import.meta.url), 'utf8'))
    .replace("import('../shared/attachment-security.js')", 'Promise.resolve({createStorageObjectName, MAX_AVATAR_BYTES, validateAttachmentFile})');
const securityModule = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/shared/attachment-security.js', import.meta.url), 'utf8'));

function fixture({previous = null, uid = 'A'} = {}) {
    const events = new EventTarget();
    const bucket = new Map(previous ? [[previous, Uint8Array.from([1, 2, 3])]] : []);
    const users = new Map([[uid, {}]]);
    if (previous) users.get(uid).photoURL = urlOf(previous);
    const cache = new Map();
    const operations = [], writes = [], toasts = [], errors = [], hooks = {};
    let currentUid = uid;
    const nodes = {
        'avatar-input': {value: 'synthetic', files: [], onchange: null},
        'profile-avatar': {src: '', classList: {remove() {}}}
    };
    const context = vm.createContext({
        addEventListener: events.addEventListener.bind(events),
        File, crypto, TextEncoder, TextDecoder, console: {warn() {}}, Date, localStorage: {
            setItem: (key, value) => cache.set(key, value),
            getItem: key => cache.get(key) ?? null,
            removeItem: key => cache.delete(key)
        },
        document: {getElementById: id => nodes[id] || null},
        db: {}, storage: {}, auth: {get currentUser() {return {uid: currentUid};}},
        ref: (_storage, path) => path,
        doc: (_db, ...path) => path.join('/'),
        uploadBytes: async (path, data) => {
            if (hooks.uploadBytes) return hooks.uploadBytes(path, data);
            operations.push(['put', path]);
            bucket.set(path, Uint8Array.from(data.bytes ?? [7]));
            return {ref: path};
        },
        getDownloadURL: async path => {
            if (hooks.getDownloadURL) return hooks.getDownloadURL(path);
            return urlOf(path);
        },
        updateDoc: async (reference, patch) => {
            if (hooks.updateDoc) return hooks.updateDoc(reference, patch);
            writes.push([reference, patch]);
            Object.assign(users.get(reference.split('/')[1]), patch);
        },
        showToast: (...args) => toasts.push(args),
        showConfirmModal: async () => true, showInputModal: async () => null, t: value => value,
        logError: (...args) => errors.push(args),
        createElement: (tag, props = {}, children = []) => ({tag, ...props, children}),
        clearElement: node => { node.children = []; }
    });
    // Un solo script: `strip` toglie gli `export`, quindi i legami fra helper di
    // sicurezza e modulo del profilo devono restare nello stesso ambito lessicale.
    vm.runInContext(`${securityModule}\n${avatarModule}\n`
        + 'globalThis.initUIModule = initUIModule;\nglobalThis.setupAvatarEdit = setupAvatarEdit;', context);
    context.initUIModule(() => ({currentUserUid: currentUid, profileLabels: []}));
    context.setupAvatarEdit();

    const file = (name = 'avatar.jpg', type = 'image/jpeg') =>
        new File([Uint8Array.from([4, 5, 6])], name, {type});
    return {context, nodes, bucket, users, cache, operations, writes, toasts, errors, hooks, urlOf, pathOf,
        dispatch: name => events.dispatchEvent(new Event(name)),
        upload: async (name, type) => {
            nodes['avatar-input'].value = 'synthetic';
            const handle = nodes['avatar-input'].onchange;
            return handle({target: {files: [file(name, type)]}});
        },
        photoURL: () => users.get(uid).photoURL,
        setUid: value => { currentUid = value; },
        referencedPaths: () => new Set([...users.values()].map(user => user.photoURL).filter(Boolean).map(pathOf)),
        orphans: () => [...bucket.keys()].filter(path => ![...users.values()]
            .some(user => user.photoURL && pathOf(user.photoURL) === path))};
}

test('T-28: il modulo del cambio avatar non ha alcun percorso di cancellazione', () => {
    assert.doesNotMatch(avatarModule, /deleteObject|deleteAll|removeObject/,
        'il cambio avatar non importa né invoca primitive di cancellazione');
});

test('T-28: primo caricamento, il riferimento segue il nuovo oggetto senza cancellare nulla', async () => {
    const f = fixture();
    await f.upload();
    assert.deepEqual(f.operations.map(([operation]) => operation), ['put'], 'nessuna operazione di cancellazione');
    const [, path] = f.operations[0];
    assert.match(path, /^users\/A\/avatar_\d+_[0-9a-f-]+\.jpg$/, 'nome oggetto casuale sotto il prefisso del proprietario');
    assert.equal(f.photoURL(), urlOf(path), 'il documento punta al nuovo oggetto');
    assert.equal(f.cache.get('codex_profile_avatar_A'), urlOf(path), 'la cache locale punta al nuovo oggetto');
    assert.equal(f.nodes['profile-avatar'].src, urlOf(path));
    assert.deepEqual(f.orphans(), [], 'nessun oggetto resta senza riferimento');
    assert.equal(f.errors.length, 0);
    assert.ok(f.toasts.some(([message]) => message === 'avatar_updated'));
});

test('T-28: al cambio avatar il precedente resta orfano e si accumula', async () => {
    const previous = 'users/A/avatar_1700000000000_old.jpg';
    const f = fixture({previous});
    await f.upload();
    const [, first] = f.operations[0];
    assert.equal(f.bucket.has(previous), true, 'il vecchio oggetto non viene eliminato');
    assert.equal(f.operations.filter(([operation]) => operation !== 'put').length, 0,
        'nessuna cancellazione viene nemmeno tentata');
    assert.deepEqual(f.orphans(), [previous], 'il vecchio avatar resta non referenziato');
    assert.equal(JSON.stringify([...f.users.values()]).includes(previous), false,
        'il vecchio percorso non è più nel documento del profilo');
    assert.equal([...f.cache.values()].some(value => String(value).includes('old.jpg')), false,
        'la cache locale non conserva il vecchio percorso');

    // Un secondo cambio lascia **due** oggetti non referenziati: il residuo cresce
    // a ogni cambio e nessuna riga lo recupera.
    f.operations.length = 0;
    await f.upload('second.jpg');
    const [, second] = f.operations[0];
    assert.notEqual(second, first);
    assert.deepEqual(f.orphans().sort(), [previous, first].sort());
    assert.equal(f.bucket.size, 3, 'tre oggetti caricati, uno solo referenziato');
    assert.equal(f.referencedPaths().size, 1);
});

test('T-28: un errore parziale lascia il riferimento vecchio e può creare un orfano in più', async () => {
    const previous = 'users/A/avatar_1700000000000_old.jpg';
    for (const stage of ['upload', 'url', 'reference']) {
        const f = fixture({previous});
        if (stage === 'upload') f.hooks.uploadBytes = async () => { throw new Error('synthetic upload failure'); };
        if (stage === 'url') f.hooks.getDownloadURL = async () => { throw new Error('synthetic url failure'); };
        if (stage === 'reference') f.hooks.updateDoc = async () => { throw new Error('synthetic update failure'); };
        await f.upload();

        assert.equal(f.photoURL(), urlOf(previous), `${stage}: il profilo continua a puntare al vecchio avatar`);
        assert.equal(f.bucket.has(previous), true, `${stage}: il vecchio oggetto è intatto`);
        assert.equal(f.errors.length, 1, `${stage}: errore registrato`);
        assert.ok(f.toasts.some(([message]) => message === 'error_upload'), `${stage}: errore mostrato`);
        if (stage === 'upload') {
            assert.deepEqual(f.operations, [], 'nessun byte scritto');
            assert.deepEqual(f.orphans(), [], 'nessun orfano nuovo');
        } else {
            assert.deepEqual(f.orphans(), [f.operations[0][1]],
                `${stage}: l'oggetto nuovo resta senza riferimento`);
        }
    }
});

test('avatar: cambio di sessione durante upload impedisce riferimento, cache e UI tardivi', async () => {
    const previous = 'users/A/avatar_1700000000000_old.jpg';
    const f = fixture({previous});
    let release;
    f.hooks.uploadBytes = async (path, data) => {
        f.operations.push(['put', path]);
        f.bucket.set(path, Uint8Array.from([8]));
        await new Promise(done => { release = done; });
        return {ref: path};
    };
    const pending = f.upload();
    await new Promise(setImmediate);
    // La richiesta già partita può terminare; i passi successivi devono fermarsi.
    f.setUid('B');
    release();
    await pending;

    const [, path] = f.operations[0];
    assert.match(path, /^users\/A\//, 'l’oggetto è stato caricato sotto il proprietario iniziale');
    assert.deepEqual(f.writes, []);
    assert.equal(f.photoURL(), urlOf(previous));
    assert.equal(f.cache.size, 0);
    assert.equal(f.nodes['profile-avatar'].src, '');
    assert.equal(f.toasts.some(([message]) => message === 'avatar_updated'), false);
    assert.equal([...f.bucket.keys()].some(key => key.startsWith('users/B/')), false,
        'nessun oggetto creato sotto il proprietario nuovo');
    assert.deepEqual(f.orphans(), [path], 'upload già completato: pulizia non introdotta implicitamente');
});

for (const stage of ['getDownloadURL', 'updateDoc']) {
    test(`avatar: cambio UID durante ${stage} non aggiorna cache o vista`, async () => {
        const f = fixture();
        let release;
        f.hooks[stage] = async () => new Promise(resolve => { release = resolve; });
        const pending = f.upload();
        await new Promise(setImmediate);
        assert.equal(typeof release, 'function');
        f.setUid('B');
        release(urlOf('users/A/avatar_synthetic.jpg'));
        await pending;
        assert.equal(f.cache.size, 0);
        assert.equal(f.nodes['profile-avatar'].src, '');
        assert.equal(f.toasts.some(([message]) => message === 'avatar_updated'), false);
        assert.deepEqual(f.writes, []);
    });
}

test('avatar: rimontaggio durante upload invalida il completamento anche con stesso UID', async () => {
    const f = fixture();
    let release;
    f.hooks.uploadBytes = async () => new Promise(resolve => { release = resolve; });
    const pending = f.upload();
    await new Promise(setImmediate);
    f.context.setupAvatarEdit();
    release();
    await pending;
    assert.deepEqual(f.writes, []);
    assert.equal(f.cache.size, 0);
    assert.equal(f.nodes['profile-avatar'].src, '');
});

test('avatar: lock e uscita interrompono completamenti in attesa anche con UID invariato', async () => {
    for (const event of ['vault-session-locked', 'pagehide']) {
        for (const stage of ['uploadBytes', 'getDownloadURL', 'updateDoc']) {
            const f = fixture(); let release;
            f.hooks[stage] = async () => new Promise(resolve => { release = resolve; });
            const pending = f.upload(); await new Promise(setImmediate);
            f.dispatch(event); release(urlOf('users/A/avatar_synthetic.jpg')); await pending;
            assert.equal(f.cache.size, 0, `${event}/${stage}`);
            assert.equal(f.nodes['profile-avatar'].src, '');
            assert.equal(f.toasts.some(([message]) => message === 'avatar_updated'), false);
            assert.deepEqual(f.writes, []);
        }
    }
});

test('T-28: un file non immagine non tocca né Storage né documento', async () => {
    const f = fixture({previous: 'users/A/avatar_1700000000000_old.jpg'});
    await f.upload('documento.pdf', 'application/pdf');
    assert.deepEqual(f.operations, [], 'nessun caricamento');
    assert.deepEqual(f.writes, [], 'nessuna scrittura sul profilo');
    assert.deepEqual(f.errors, [], 'il rifiuto non è un errore imprevisto');
    assert.ok(f.toasts.some(([message]) => message === 'Formato file non consentito.'));
    assert.equal(f.nodes['avatar-input'].value, '', 'l’input viene svuotato');
    assert.deepEqual(f.orphans(), [], 'nessun orfano');
});
