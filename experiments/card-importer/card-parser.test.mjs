import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCode, parseBusinessCard, parseGenericCard, parsePaymentCard, passesLuhn } from './card-parser.mjs';

test('valida una carta soltanto tramite Luhn e non estrae il CVV', () => {
    assert.equal(passesLuhn('4111 1111 1111 1111'), true);
    const result = parsePaymentCard('4111 1111 1111 1111 09/29 123');
    assert.equal(result.number, '4111111111111111');
    assert.equal(result.expiryMonth, '09');
    assert.equal(result.expiryYear, '29');
    assert.equal(result.cvv, null);
    assert.equal(result.requiresConfirmation, true);
});

test('propone i campi principali di un biglietto da visita', () => {
    const result = parseBusinessCard('Maria Rossi\nStudio Rossi\nCommercialista\nmaria@example.it\n+39 0444 123456\nwww.example.it');
    assert.equal(result.displayName, 'Maria Rossi');
    assert.equal(result.organization, 'Studio Rossi');
    assert.equal(result.email, 'maria@example.it');
    assert.match(result.phone, /0444/);
});

test('un QR URL non viene mai aperto automaticamente', () => {
    assert.deepEqual(classifyCode('https://example.test/path'), {
        type: 'url', value: 'https://example.test/path', requiresConfirmation: true, autoOpen: false
    });
});

test('la card generica conserva righe modificabili', () => {
    assert.deepEqual(parseGenericCard('Codice cliente\n AB-123 ').lines, ['Codice cliente', 'AB-123']);
});

