import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../Frontend/public/assets/js/modules/shared/cached-account-access.js', import.meta.url), 'utf8');
const {canReadCachedAccount} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const user = {uid: 'guest', email: 'guest@example.test', emailVerified: true};
const record = {sharedWithUids: ['guest'], sharedWithEmailByUid: {guest: 'GUEST@example.test'}};
test('owner retains access to its archived offline records', () => {
    assert.equal(canReadCachedAccount({isArchived: true}, {uid: 'owner'}, 'owner'), true);
    assert.equal(canReadCachedAccount(record, user, 'owner'), true);
});
test('cached bindings require both a verified email and the current UID', () => {
    for (const viewer of [null, {...user, uid: 'other'}, {...user, email: 'new@example.test'},
        {...user, emailVerified: false}, {...user, emailVerified: undefined}]) {
        assert.equal(canReadCachedAccount(record, viewer, 'owner'), false);
    }
});
test('malformed or archived grants fail closed; missing legacy archive field remains false', () => {
    for (const change of [{isArchived: true}, {isArchived: 'false'}, {isArchived: null},
        {sharedWithUids: 'guest'}, {sharedWithUids: ['other']}, {sharedWithEmailByUid: []},
        {sharedWithEmailByUid: {guest: 42}}, {sharedWithEmailByUid: Object.create({guest: user.email})}]) {
        assert.equal(canReadCachedAccount({...record, ...change}, user, 'owner'), false);
    }
});
