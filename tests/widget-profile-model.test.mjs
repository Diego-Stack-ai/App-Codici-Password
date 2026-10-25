import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/shared/widget-profile-model.js', import.meta.url), 'utf8');
const {profilesForCategory, profileFieldSummary, isProfileAlreadyInserted, isWidgetTemplateAlreadyInserted,
    legacyAccountWidgetTemplates, structuralTitleCase, widgetTemplateSignature} =
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

test('i widget generici legacy entrano nel menu senza includere quelli bancari', () => {
    const widgets = [
        {id: 'legacy-account', kind: 'embedded', title: 'ACCESSO FORNITORE', fields: [
            {id: 'value-a', label: 'utente', type: 'text', encrypted: false, value: 'mario', order: 0},
            {id: 'value-b', label: 'password', type: 'sensitive', encrypted: true, valueEnc: 'cipher', order: 1}
        ]},
        {id: 'legacy-copy', kind: 'embedded', title: 'Accesso Fornitore', fields: [
            {id: 'copy-a', label: 'Utente', type: 'text', encrypted: false, value: 'luigi', order: 0},
            {id: 'copy-b', label: 'Password', type: 'sensitive', encrypted: true, valueEnc: 'cipher-2', order: 1}
        ]},
        {id: 'legacy-bank', kind: 'embedded', bankId: 'bank-1', title: 'Codici Banca', fields: [
            {id: 'bank-a', label: 'Pin', type: 'sensitive', encrypted: true, valueEnc: 'cipher-3', order: 0}
        ]},
        {id: 'linked', kind: 'embedded', profileId: 'profile-a', profileCategory: 'account',
            title: 'Collegato', fields: [{id: 'linked-a', label: 'Dato', type: 'text', encrypted: false, order: 0}]}
    ];
    const templates = legacyAccountWidgetTemplates(widgets, []);
    assert.equal(templates.length, 1);
    assert.equal(templates[0].title, 'Accesso Fornitore');
    assert.deepEqual(templates[0].fields.map(field => field.label), ['Utente', 'Password']);
    assert.equal(JSON.stringify(templates).includes('mario'), false);
    assert.equal(JSON.stringify(templates).includes('cipher'), false);
});

test('un profilo persistito prevale sul modello legacy equivalente', () => {
    const legacy = {id: 'legacy', kind: 'embedded', title: 'Accesso', fields: [
        {id: 'legacy-field', label: 'Codice', type: 'sensitive', encrypted: true, valueEnc: 'cipher', order: 0}
    ]};
    const profile = {id: 'profile', kind: 'widget-profile', category: 'account', title: 'Accesso', fields: [
        {id: 'profile-field', label: 'Codice', type: 'sensitive', encrypted: true, order: 0}
    ]};
    assert.equal(widgetTemplateSignature(legacy), widgetTemplateSignature(profile));
    assert.deepEqual(legacyAccountWidgetTemplates([legacy], [profile]), []);
});

test('il modello legacy è considerato già inserito solo nella stessa destinazione', () => {
    const widget = {id: 'legacy', kind: 'embedded', title: 'Accesso', fields: [
        {id: 'field', label: 'Codice', type: 'text', encrypted: false, value: '123', order: 0}
    ]};
    const [template] = legacyAccountWidgetTemplates([widget], []);
    assert.equal(isWidgetTemplateAlreadyInserted([widget], template), true);
    assert.equal(isWidgetTemplateAlreadyInserted([widget], template, 'bank-1'), false);
});
