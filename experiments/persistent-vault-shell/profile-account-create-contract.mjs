import {profileLinkSource} from './profile-link-contract.mjs';

const fail = () => { throw Error('PROFILE_ACCOUNT_CREATE_INVALID'); };
const object = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const cipher = value => typeof value === 'string' && value.length >= 30 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));

export function validateProfileAccountCreateRequest(value) {
    const keys = ['source', 'scope', 'name', 'username', 'password', 'transferLegacyPassword', 'expectedLegacyPassword',
        'expectedFingerprint', 'expectedRevision', 'operationId', 'expectedOwnerUid'];
    if (!exact(value, keys) || !id(value.operationId) || !id(value.expectedOwnerUid) ||
        typeof value.name !== 'string' || !value.name.trim() || value.name.length > 240 ||
        typeof value.username !== 'string' || value.username.length > 4000 ||
        typeof value.password !== 'string' || (value.password && !cipher(value.password)) ||
        typeof value.transferLegacyPassword !== 'boolean' ||
        typeof value.expectedLegacyPassword !== 'string' || (value.expectedLegacyPassword && !cipher(value.expectedLegacyPassword)) ||
        typeof value.expectedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.expectedFingerprint) ||
        !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0) fail();
    const source = profileLinkSource(value.source);
    if (!object(value.scope) || !['private', 'company'].includes(value.scope.domain) ||
        !exact(value.scope, value.scope.domain === 'private' ? ['domain'] : ['domain', 'companyId']) ||
        (value.scope.domain === 'company' && !id(value.scope.companyId))) fail();
    if (value.transferLegacyPassword !== Boolean(value.expectedLegacyPassword) ||
        (value.transferLegacyPassword && value.password !== value.expectedLegacyPassword)) fail();
    return Object.freeze({...value, source, scope: Object.freeze({...value.scope})});
}

export function minimalCreatedAccount({uid, accountId, request, timestamp}) {
    if (!id(uid) || !id(accountId)) fail();
    return Object.freeze({id: accountId, ownerId: uid, type: 'account', visibility: 'private', _encrypted: true,
        nomeAccount: request.name, username: request.username, account: '', password: request.password, url: '', note: '',
        isBanking: false, banking: [], sharedWith: {}, sharedWithUids: [], acceptedCount: 0,
        schemaVersion: 1, revision: 0, createdAt: timestamp, updatedAt: timestamp});
}
