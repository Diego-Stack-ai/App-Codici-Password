import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../Frontend/public/assets/js/modules/data/', import.meta.url);
const repositorySource = await readFile(new URL('vault-repository.js', root), 'utf8');
const coordinatorSource = await readFile(new URL('request-coordinator.js', root), 'utf8');
const entryPoints = ['getPrivateAccount', 'getPrivateAccountConfirmed', 'listPrivateAccounts',
    'listPrivateAccountsConfirmed', 'getFirstPrivateAccount', 'findPrivateAccountByLegacyId'];

function fixture(payload = {id: 'payload-alias', password: 'ciphertext'}, canonicalId = 'firestore-record', exists = true) {
    const reads = [];
    // SDK data() materializes a new data object. Keep Firestore identity separate.
    const snapshot = {id: canonicalId, exists: () => exists, data: () => structuredClone(payload)};
    const querySnapshot = {empty: !exists, docs: exists ? [snapshot] : []};
    const read = (kind, result) => async reference => { reads.push({kind, reference}); return result; };
    const context = vm.createContext({db: {},
        doc: (_, ...path) => ({path: path.join('/')}),
        collection: (_, ...path) => ({path: path.join('/')}),
        query: (collection, ...constraints) => ({...collection, constraints}),
        where: (field, operator, value) => ({field, operator, value}), limit: value => ({limit: value}),
        orderBy: (...args) => ({orderBy: args}),
        getDocSmart: read('doc', snapshot), getDocServerConfirmed: read('doc-confirmed', snapshot),
        getDocsSmart: read('query', querySnapshot), getDocsServerConfirmed: read('query-confirmed', querySnapshot)
    });
    vm.runInContext(coordinatorSource.replace(/^export /gm, ''), context);
    vm.runInContext(repositorySource.replace(/^import[\s\S]*?;\r?$/gm, '').replace(/^export /gm, '') +
        `\nglobalThis.repository = {${entryPoints.join(',')}};`, context);
    return {repository: context.repository, reads, payload};
}

const invoke = (repository, name) => name === 'findPrivateAccountByLegacyId'
    ? repository[name]('uid-fixture', 'payload-alias')
    : repository[name]('uid-fixture', 'firestore-record');
const unwrap = value => Array.isArray(value) ? value[0] : value;

for (const name of entryPoints) {
    test(`${name}: Firestore ID wins over missing, mismatching and malformed payload IDs`, async () => {
        for (const embedded of ['payload-alias', '../other-account', null, false, '', undefined, {path: 'other-account'}]) {
            const payload = {id: embedded, password: 'ciphertext', metadata: {revision: 1}};
            const {repository} = fixture(payload);
            const result = unwrap(await invoke(repository, name));
            assert.equal(result.id, 'firestore-record');
            assert.equal(result.password, 'ciphertext');
            assert.deepEqual(payload.id, embedded, 'read normalization must not rewrite stored data');
        }
        const {repository} = fixture({password: 'ciphertext'});
        assert.equal(unwrap(await invoke(repository, name)).id, 'firestore-record');
    });

    test(`${name}: concurrent consumers receive independent records`, async () => {
        const {repository, payload, reads} = fixture({id: 'payload-alias', password: 'ciphertext', metadata: {revision: 1}});
        const [firstResult, secondResult] = await Promise.all([invoke(repository, name), invoke(repository, name)]);
        const first = unwrap(firstResult), second = unwrap(secondResult);
        assert.notEqual(first, second);
        first.id = 'mutated'; first.password = 'decrypted-for-one-view'; first.metadata.revision = 2;
        assert.equal(second.id, 'firestore-record');
        assert.equal(second.password, 'ciphertext');
        assert.equal(second.metadata.revision, 1);
        assert.equal(payload.id, 'payload-alias');
        assert.equal(payload.password, 'ciphertext');
        assert.equal(payload.metadata.revision, 1);
        if (!name.endsWith('Confirmed')) assert.equal(reads.length, 1, 'the underlying concurrent read stays coalesced');
    });

    test(`${name}: missing documents and empty collections preserve the existing result shape`, async () => {
        const {repository} = fixture({}, 'missing', false);
        const result = await invoke(repository, name);
        if (name.startsWith('list')) assert.equal(result.length, 0);
        else assert.equal(result, null);
    });
}

test('legacy lookup queries the original stored alias but returns the physical document identity', async () => {
    const {repository, reads, payload} = fixture();
    const result = await repository.findPrivateAccountByLegacyId('owner-fixture', 'payload-alias');
    assert.equal(result.id, 'firestore-record');
    assert.equal(payload.id, 'payload-alias');
    assert.equal(reads.length, 1);
    assert.equal(reads[0].reference.path, 'users/owner-fixture/accounts');
    assert.deepEqual(reads[0].reference.constraints, [
        {field: 'id', operator: '==', value: 'payload-alias'}, {limit: 1}
    ]);
});
