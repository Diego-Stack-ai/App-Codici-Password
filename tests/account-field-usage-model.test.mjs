import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const modelSource = await readFile(
    new URL('../Frontend/public/assets/js/modules/settings/account-field-usage-model.js', import.meta.url),
    'utf8'
);
const {buildAccountFieldUsageReport} = await import(
    `data:text/javascript;base64,${Buffer.from(modelSource).toString('base64')}`
);

function fields(values = {}) {
    return new Proxy(values, {get: (target, key) => key in target ? target[key] : false});
}

test('conta separatamente campi privati e aziendali realmente compilati', () => {
    const report = buildAccountFieldUsageReport({records: [
        {area: 'privato', accountKey: 'privato:p1', fields: fields({nomeAccount: true, username: true})},
        {area: 'azienda', accountKey: 'azienda:a1:c1', fields: fields({nomeAccount: true, username: false})}
    ]});
    const username = report.fields.find(row => row.key === 'username');
    assert.deepEqual(
        {privateUsed: username.privateUsed, companyUsed: username.companyUsed, used: username.used, eligible: username.eligible},
        {privateUsed: 1, companyUsed: 0, used: 1, eligible: 2}
    );
    assert.equal(username.status, 'Usato una volta');
});

test('distingue campi mai usati, occasionali e frequenti', () => {
    const report = buildAccountFieldUsageReport({records: Array.from({length: 10}, (_, index) => ({
        area: 'privato',
        accountKey: `privato:${index}`,
        fields: fields({
            nomeAccount: true,
            username: index < 6,
            url: index < 2,
            note: false
        })
    }))});
    assert.equal(report.fields.find(row => row.key === 'username').recommendation, 'Promuovi a campo primario');
    assert.equal(report.fields.find(row => row.key === 'url').recommendation, 'Mantieni o trasforma in widget');
    assert.equal(report.fields.find(row => row.key === 'note').status, 'Mai usato');
});

test('non tratta un valore non leggibile come campo vuoto', () => {
    const report = buildAccountFieldUsageReport({records: [
        {area: 'privato', accountKey: 'privato:p1', fields: fields({nomeAccount: true, password: null})}
    ]});
    const password = report.fields.find(row => row.key === 'password');
    assert.equal(password.eligible, 0);
    assert.equal(password.unavailable, 1);
});

test('riunisce le etichette widget equivalenti senza contare i valori vuoti', () => {
    const report = buildAccountFieldUsageReport({
        records: [
            {area: 'privato', accountKey: 'privato:p1', fields: fields({nomeAccount: true})},
            {area: 'azienda', accountKey: 'azienda:a1:c1', fields: fields({nomeAccount: true})}
        ],
        widgetEntries: [
            {accountKey: 'privato:p1', label: 'Codice sblocco', filled: true},
            {accountKey: 'azienda:a1:c1', label: '  codice sblocco ', filled: false}
        ]
    });
    assert.equal(report.widgets.length, 1);
    assert.equal(report.widgets[0].used, 1);
    assert.equal(report.widgets[0].privateUsed, 1);
});
