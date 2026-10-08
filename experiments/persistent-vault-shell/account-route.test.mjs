import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAccountDestination} from './account-route.mjs';

const privateUrl = 'dettaglio_account_privato.html';
const companyUrl = 'dettaglio_account_azienda.html';
const context = {uid: 'user-A'};
const parse = url => parseAccountDestination(url, context);
const rejects = (url, code) => assert.throws(() => parse(url), {message: code});

test('canonical private routes return an immutable descriptor with no company scope', () => {
    for (const url of [`${privateUrl}?id=alfa`, `${privateUrl}?ownerId=user-A&id=alfa`]) {
        const result = parse(url);
        assert.deepEqual(result, {domain: 'private', id: 'alfa'});
        assert.equal(Object.isFrozen(result), true);
    }
});

test('canonical company routes bind the configured company and owner', () => {
    const result = parse(`${companyUrl}?id=zeta&aziendaId=company&ownerId=user-A`);
    assert.deepEqual(result, {domain: 'company', id: 'zeta', companyId: 'company'});
    assert.equal(Object.isFrozen(result), true);
    assert.deepEqual(parseAccountDestination(`${companyUrl}?aziendaId=another&id=alfa`, {...context, companyId: 'another'}),
        {domain: 'company', id: 'alfa', companyId: 'another'});
});

test('query values are decoded exactly once using query-string semantics', () => {
    assert.equal(parse(`${privateUrl}?id=caf%C3%A9%2Buno`).id, 'café+uno');
    assert.equal(parse(`${privateUrl}?id=alfa+beta`).id, 'alfa beta');
    for (const value of ['%252F', '%252E%252E', '%25', '%255c']) {
        rejects(`${privateUrl}?id=${value}`, 'INVALID_RECORD_ID');
    }
});

test('absolute URLs, origins, protocols, path variants and fragments are rejected', () => {
    for (const url of [null, {}, '', privateUrl, `${privateUrl}?`,
        `https://example.invalid/${privateUrl}?id=alfa`, `http://127.0.0.1:4188/${privateUrl}?id=alfa`,
        `//example.invalid/${privateUrl}?id=alfa`, `/${privateUrl}?id=alfa`, `./${privateUrl}?id=alfa`,
        `../${privateUrl}?id=alfa`, `javascript:${privateUrl}?id=alfa`,
        `${privateUrl}?id=alfa#`, `${privateUrl}?id=alfa#details`,
        ` ${privateUrl}?id=alfa`, `${privateUrl}?id=alfa\n`, `${privateUrl}?id=alfa\\beta`,
        'form_account_privato.html?id=alfa', `${privateUrl}?id=alfa?ownerId=user-A`]) {
        rejects(url, 'INVALID_ACCOUNT_DESTINATION');
    }
});

test('duplicate, unknown, missing or malformed parameters are rejected', () => {
    for (const url of [`${privateUrl}?id=alfa&id=zeta`, `${privateUrl}?id=alfa&ownerId=user-A&ownerId=user-A`,
        `${companyUrl}?id=alfa&aziendaId=company&aziendaId=company`, `${privateUrl}?id=alfa&extra=x`,
        `${privateUrl}?id=alfa&aziendaId=company`, `${privateUrl}?ownerId=user-A`,
        `${companyUrl}?id=alfa`, `${privateUrl}?id=alfa&`, `${privateUrl}?id=alfa&&ownerId=user-A`,
        `${privateUrl}?id`, `${privateUrl}?%69d=alfa`, `${privateUrl}?id=%`,
        `${privateUrl}?id=%GG`, `${privateUrl}?id=%C3%28`]) {
        rejects(url, 'INVALID_ROUTE_PARAMETERS');
    }
});

test('invalid decoded record identifiers are rejected before returning a route', () => {
    for (const id of ['', '.', '..', '%2e', '%2E%2e', 'a/b', 'a%2Fb', 'a%5Cb', '%00', '%0A', '%7f', '%20', '+']) {
        rejects(`${privateUrl}?id=${id}`, 'INVALID_RECORD_ID');
    }
    rejects(`${companyUrl}?id=alfa&aziendaId=..`, 'INVALID_RECORD_ID');
    rejects(`${privateUrl}?id=alfa&ownerId=`, 'INVALID_RECORD_ID');
});

test('ownership and company scope cannot be switched through a destination', () => {
    rejects(`${privateUrl}?id=alfa&ownerId=user-B`, 'OWNER_MISMATCH');
    rejects(`${companyUrl}?id=alfa&aziendaId=company&ownerId=user-B`, 'OWNER_MISMATCH');
    rejects(`${companyUrl}?id=alfa&aziendaId=other`, 'COMPANY_MISMATCH');
    assert.throws(() => parseAccountDestination(`${companyUrl}?id=alfa&aziendaId=company`, {...context, companyId: '..'}),
        {message: 'INVALID_RECORD_ID'});
});

test('an authenticated UID is required even when ownerId is absent', () => {
    for (const uid of [undefined, '', '.', '..', 'a/b', 'a%2Fb', '   ']) {
        assert.throws(() => parseAccountDestination(`${privateUrl}?id=alfa`, {uid}), {message: 'AUTH_REQUIRED'});
    }
    assert.throws(() => parseAccountDestination(`${privateUrl}?id=alfa`), {message: 'AUTH_REQUIRED'});
});
