import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);

test('la revoca per ciclo resta nei due form writer', async () => {
    for (const file of ['privato/form-privato-save.js', 'azienda/form-azienda-save.js']) {
        const source = await readFile(new URL(file, modules), 'utf8');
        assert.match(source, /transaction\.delete\(doc\(db, "invites", inviteIdForGuest\(targetId,/);
        assert.match(source, /sharingCycleOf\(/);
        assert.match(source, /finalData\.sharedWithUids = Object\.values\(finalData\.sharedWith\)/);
        assert.match(source, /status === 'rejected' \|\| existingGuest\.status === 'suspended'/);
    }
});

test('i dettagli non costruiscono ID invito e non revocano accessi', async () => {
    for (const file of ['privato/dettaglio-privato-sharing.js', 'azienda/dettaglio-azienda-sharing.js']) {
        const source = await readFile(new URL(file, modules), 'utf8');
        assert.doesNotMatch(source, /inviteIdForGuest|runTransaction|revokeRecipient|deleteDoc|updateDoc/);
    }
});
