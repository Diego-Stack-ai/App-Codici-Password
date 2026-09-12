import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const modalSource = await readFile(new URL('../Frontend/public/assets/js/modules/privato/profilo-modal.js', import.meta.url), 'utf8');
const contactsSource = await readFile(new URL('../Frontend/public/assets/js/modules/privato/profilo-phones-emails.js', import.meta.url), 'utf8');

test('il modal usa configKey per aggiungere, rinominare ed eliminare etichette', () => {
    assert.match(modalSource, /f\.configKey/);
    assert.match(modalSource, /Aggiungi etichetta/);
    assert.match(modalSource, /Rinomina etichetta/);
    assert.match(modalSource, /Elimina etichetta/);
});

test('email e telefoni collegano il gestore alla configurazione corretta', () => {
    assert.match(contactsSource, /configKey: 'emailLabels', onOptionsChanged: _callbacks\.updateProfileLabelOptions/);
    assert.match(contactsSource, /configKey: 'phoneLabels', onOptionsChanged: _callbacks\.updateProfileLabelOptions/);
});
