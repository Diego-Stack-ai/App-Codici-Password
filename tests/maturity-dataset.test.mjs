import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fixtureUrl = new URL('./fixtures/maturity-dataset.json', import.meta.url);
const data = JSON.parse(await readFile(fixtureUrl, 'utf8'));

function collectStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectStrings(item, output));
  return output;
}

test('il dataset M0 copre i domini principali senza dati reali', () => {
  assert.equal(data.fixture, true);
  assert.ok(data.owner && data.contacts.length && data.companies.length);
  assert.ok(data.privateAccounts.length >= 2 && data.deadlines.length && data.notifications.length);
});

test('tutte le email del dataset usano il dominio riservato .invalid', () => {
  const emails = collectStrings(data).filter(value => value.includes('@'));
  assert.ok(emails.length >= 4);
  assert.ok(emails.every(email => email.toLowerCase().endsWith('.invalid')));
});

test('le password di prova sono marcate esplicitamente come non segreti', () => {
  const accounts = [...data.privateAccounts, ...data.companies.flatMap(company => company.accounts || [])];
  const passwords = accounts.map(account => account.password).filter(Boolean);
  assert.ok(passwords.length >= 2);
  assert.ok(passwords.every(password => password.startsWith('FIXTURE-NON-SEGRETO-')));
});

test('il modello destinatari copre canali attivi e destinatario sospeso', () => {
  const recipients = data.deadlines.flatMap(deadline => deadline.recipients || []);
  assert.ok(recipients.some(item => item.sendEmail && item.sendPush));
  assert.ok(recipients.some(item => !item.sendEmail && !item.sendPush));
});
