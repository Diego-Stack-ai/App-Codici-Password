import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = (await readFile(new URL('../Frontend/public/assets/js/modules/azienda/company-list-service.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
function fixture(read = async () => ({empty: false})) {
    const auth = {currentUser: {uid: 'owner'}}, paths = [], writes = [];
    const service = new Function('auth', 'db', 'collection', 'getDocsFromServer', 'limit', 'query', 'doc', 'updateDoc', 'deleteDoc',
        `${source}; return {deleteCompany, companyDeletionMessage};`)(auth, {},
        (_db, ...path) => {paths.push(path); return path;}, read, n => n, (...args) => args,
        () => {}, (...args) => writes.push(args), (...args) => writes.push(args));
    return {...service, auth, paths, writes};
}
test('nonempty company including archived accounts: refuses without writes', async () => {
    const f = fixture();
    await assert.rejects(f.deleteCompany('owner', 'company'), {code: 'COMPANY_NOT_EMPTY'});
    assert.deepEqual(f.paths, [['users', 'owner', 'aziende', 'company', 'accounts']]);
    assert.deepEqual(f.writes, []);
});
test('empty company does not bypass the unfinished concurrency protocol', async () => {
    const f = fixture(async () => ({empty: true}));
    await assert.rejects(f.deleteCompany('owner', 'company'), {code: 'COMPANY_DELETE_PROTOCOL_REQUIRED'});
    assert.deepEqual(f.writes, []);
});
test('server read failure is not interpreted as an empty company', async () => {
    const failure = new Error('offline'), f = fixture(async () => {throw failure;});
    await assert.rejects(f.deleteCompany('owner', 'company'), error => error === failure);
    assert.deepEqual(f.writes, []);
});
test('changed identity before or during server read cannot delete', async () => {
    const f = fixture(async () => {f.auth.currentUser = {uid: 'other'}; return {empty: true};});
    await assert.rejects(f.deleteCompany('owner', 'company'), {code: 'COMPANY_DELETE_SESSION_CHANGED'});
    const g = fixture(); g.auth.currentUser = null;
    await assert.rejects(g.deleteCompany('owner', 'company'), {code: 'COMPANY_DELETE_SESSION_CHANGED'});
    assert.equal(g.paths.length, 0);
    assert.deepEqual(f.writes, []);
});
test('invalid company path is rejected before access', async () => {
    const f = fixture();
    await assert.rejects(f.deleteCompany('owner', 'a/accounts/b'), {code: 'COMPANY_DELETE_INVALID_ID'});
    assert.equal(f.paths.length, 0);
});
test('messages are controlled and do not expose backend errors', () => {
    const f = fixture();
    assert.match(f.companyDeletionMessage({code: 'COMPANY_NOT_EMPTY'}), /archiviati/);
    assert.match(f.companyDeletionMessage({code: 'COMPANY_DELETE_PROTOCOL_REQUIRED'}), /non è stata eliminata/);
    assert.equal(f.companyDeletionMessage(new Error('PRIVATE_BACKEND_DETAIL')).includes('PRIVATE_BACKEND_DETAIL'), false);
});
