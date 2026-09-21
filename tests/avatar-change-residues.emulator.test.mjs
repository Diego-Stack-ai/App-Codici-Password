import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc} from 'firebase/firestore';
import {getBytes, getDownloadURL, listAll, ref, uploadBytes} from 'firebase/storage';

// M7-T28 — Prova sull'**emulatore reale** del cambio avatar: il vecchio oggetto
// resta davvero in Storage dopo che il riferimento è stato aggiornato?
//
// Il modulo di produzione del profilo viene eseguito con i veri SDK web contro
// Firestore e Storage emulati e con le Rules di produzione; la verifica finale
// legge l'emulatore (elenco della cartella e byte dell'oggetto vecchio), non un
// registro di chiamate.
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const avatarModule = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/privato/profilo-ui.js', import.meta.url), 'utf8'));
const securityModule = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/shared/attachment-security.js', import.meta.url), 'utf8'));

const PROJECT_ID = 'codici-password-avatar-residues';
const OWNER = 'avatar-owner';
const BYTES = Uint8Array.from([4, 5, 6]);
const pathOf = url => decodeURIComponent(String(url).split('/o/')[1].split('?')[0]);
const nameOf = url => pathOf(url).split('/').pop();
let testEnv;

function mount({uid = OWNER} = {}) {
    const client = testEnv.authenticatedContext(uid);
    const db = client.firestore(), storage = client.storage();
    const cache = new Map(), toasts = [], errors = [];
    const nodes = {
        'avatar-input': {value: 'synthetic', files: [], onchange: null},
        'profile-avatar': {src: '', classList: {remove() {}}}
    };
    // Il modulo è montato con `new Function`, quindi **nello stesso realm** degli
    // SDK: un oggetto creato in un realm `vm` verrebbe rifiutato da `updateDoc`
    // («custom Object»), che è un artefatto del banco e non del percorso reale.
    const factory = new Function('document', 'localStorage', 'db', 'storage', 'ref', 'uploadBytes', 'getDownloadURL',
        'doc', 'updateDoc', 'showToast', 'showConfirmModal', 'showInputModal', 't', 'logError', 'createElement',
        'clearElement', 'File', 'crypto', 'TextEncoder', 'console',
        `${securityModule}\n${avatarModule}\nreturn {initUIModule, setupAvatarEdit};`);
    const module = factory(
        {getElementById: id => nodes[id] || null},
        {setItem: (key, value) => cache.set(key, value), getItem: key => cache.get(key) ?? null,
            removeItem: key => cache.delete(key)},
        db, storage, ref, uploadBytes, getDownloadURL, doc, updateDoc,
        (...args) => toasts.push(args), async () => true, async () => null, value => value,
        (...args) => errors.push(args), (tag, props = {}, children = []) => ({tag, ...props, children}),
        node => { node.children = []; }, File, crypto, TextEncoder, {warn() {}});
    module.initUIModule(() => ({currentUserUid: uid, profileLabels: []}));
    module.setupAvatarEdit();
    return {db, storage, cache, toasts, errors, nodes,
        upload: async name => nodes['avatar-input'].onchange({
            target: {files: [new File([BYTES], name, {type: 'image/jpeg'})]}})};
}

const photoURL = async (db, uid) => (await getDoc(doc(db, 'users', uid))).data()?.photoURL ?? null;
const objectNames = async (storage, uid) =>
    (await listAll(ref(storage, `users/${uid}`))).items.map(item => item.name).sort();

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')},
        storage: {rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8')}
    });
});
beforeEach(async () => { await testEnv.clearFirestore(); await testEnv.clearStorage(); });
after(async () => testEnv?.cleanup());

// Ogni caso usa un proprietario diverso: `clearStorage()` non è affidabile su
// questo emulatore e i residui di un caso non devono entrare nelle asserzioni.
test('T-28 su emulatore: il primo avatar è caricato e referenziato', async () => {
    const uid = 'avatar-owner-first';
    await setDoc(doc(testEnv.authenticatedContext(uid).firestore(), 'users', uid), {nome: 'Synthetic'});
    const f = mount({uid});
    await f.upload('first.jpg');
    assert.deepEqual(f.errors, [], `il percorso non deve registrare errori: ${f.toasts.flat().join(' | ')}`);

    const url = await photoURL(f.db, uid);
    assert.ok(url, 'il documento porta `photoURL`');
    assert.match(pathOf(url), new RegExp(`^users/${uid}/avatar_\\d+_[0-9a-f-]+\\.jpg$`));
    assert.deepEqual(await objectNames(f.storage, uid), [nameOf(url)], 'un solo oggetto in Storage');
    assert.deepEqual(new Uint8Array(await getBytes(ref(f.storage, pathOf(url)))), BYTES,
        'i byte dell’avatar sono quelli caricati');
    assert.equal(f.cache.get(`codex_profile_avatar_${uid}`), url);
    assert.equal(f.errors.length, 0);
});

test('T-28 su emulatore: cambiando avatar il vecchio oggetto resta in Storage, non più referenziato', async () => {
    const uid = 'avatar-owner-change';
    await setDoc(doc(testEnv.authenticatedContext(uid).firestore(), 'users', uid), {nome: 'Synthetic'});
    const f = mount({uid});
    await f.upload('first.jpg');
    const firstURL = await photoURL(f.db, uid);
    const firstPath = pathOf(firstURL);

    await f.upload('second.jpg');
    const secondURL = await photoURL(f.db, uid);

    assert.notEqual(secondURL, firstURL, 'il riferimento è stato aggiornato');
    assert.deepEqual(await objectNames(f.storage, uid), [nameOf(firstURL), nameOf(secondURL)].sort(),
        'i due oggetti convivono nello Storage');
    // La prova del residuo: il vecchio oggetto è ancora leggibile con i suoi byte.
    assert.deepEqual(new Uint8Array(await getBytes(ref(f.storage, firstPath))), BYTES,
        'il vecchio avatar è ancora presente e leggibile sull’emulatore');
    // E il profilo non lo nomina più: è un orfano, non un riferimento conservato.
    const document = JSON.stringify((await getDoc(doc(f.db, 'users', uid))).data());
    assert.equal(document.includes(nameOf(firstURL)), false,
        'il vecchio percorso non compare più nel documento del profilo');
    assert.equal(f.cache.get(`codex_profile_avatar_${uid}`), secondURL);
    assert.equal(f.errors.length, 0);
    assert.ok(f.toasts.some(([message]) => message === 'avatar_updated'));
});
