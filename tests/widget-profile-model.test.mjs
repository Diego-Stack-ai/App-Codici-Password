import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/shared/widget-profile-model.js', import.meta.url), 'utf8');
const {profilesForCategory, profileFieldSummary, isProfileAlreadyInserted, structuralTitleCase} =
    await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const profiles = [
    {id: 'a', kind: 'widget-profile', category: 'account', fields: [{label: 'Utente'}, {label: 'Password'}]},
    {id: 'b', kind: 'widget-profile', category: 'bank', fields: [{label: 'Codice cliente'}]}
];

test('cataloghi Account e Banca restano separati e mostrano i campi', () => {
    assert.deepEqual(profilesForCategory(profiles, 'account').map(profile => profile.id), ['a']);
    assert.deepEqual(profilesForCategory(profiles, 'bank').map(profile => profile.id), ['b']);
    assert.equal(profileFieldSummary(profiles[0]), 'Utente, Password');
});

test('i testi strutturali applicano iniziale maiuscola a ogni parola', () => {
    assert.equal(structuralTitleCase('  REFERENTE banca 2 '), 'Referente Banca 2');
    assert.equal(structuralTitleCase('iban conto'), 'Iban Conto');
    assert.equal(structuralTitleCase('carta d’identità'), 'Carta D’Identità');
});

test('lo stesso profilo è duplicato solo nella stessa destinazione', () => {
    const widgets = [{profileId: 'a'}, {profileId: 'b', bankId: 'bank-1'}];
    assert.equal(isProfileAlreadyInserted(widgets, 'a'), true);
    assert.equal(isProfileAlreadyInserted(widgets, 'a', 'bank-1'), false);
    assert.equal(isProfileAlreadyInserted(widgets, 'b', 'bank-1'), true);
    assert.equal(isProfileAlreadyInserted(widgets, 'b', 'bank-2'), false);
});
