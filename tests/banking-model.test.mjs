import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../Frontend/public/assets/js/modules/shared/banking-model.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { hasRealBankingData, normalizeBankingAccounts } = await import(moduleUrl);

test('mantiene il formato canonico banking[]', () => {
    const banking = [{ iban: 'IT00 A000 0000' }];
    assert.deepEqual(normalizeBankingAccounts({ banking }), banking);
    assert.equal(hasRealBankingData({ banking }), true);
});

test('legge il vecchio oggetto banking singolo', () => {
    const account = { banking: { passwordDispositiva: 'segreto' } };
    assert.deepEqual(normalizeBankingAccounts(account), [account.banking]);
    assert.equal(hasRealBankingData(account), true);
});

test('normalizza i campi bancari storici alla radice', () => {
    const account = {
        iban: ' IT01 ',
        cards: [{ cardType: 'Visa' }],
        referenteTelefono: '0444 000000'
    };
    const [bank] = normalizeBankingAccounts(account);
    assert.equal(bank.iban, ' IT01 ');
    assert.deepEqual(bank.cards, account.cards);
    assert.equal(bank.referenteTelefono, account.referenteTelefono);
    assert.equal(hasRealBankingData(account), true);
});

test('non considera reali strutture vuote o campi non significativi', () => {
    assert.equal(hasRealBankingData({}), false);
    assert.equal(hasRealBankingData({ banking: [] }), false);
    assert.equal(hasRealBankingData({ banking: [{ iban: '  ', cards: [{}] }] }), false);
    assert.equal(hasRealBankingData({ referenteNome: 'Referente senza recapiti' }), false);
});

test('riconosce i dati reali delle carte nei formati compatibili', () => {
    assert.equal(hasRealBankingData({ banking: [{ cards: [{ type: 'Mastercard' }] }] }), true);
    assert.equal(hasRealBankingData({ cards: [{ pin: '1234' }] }), true);
});
