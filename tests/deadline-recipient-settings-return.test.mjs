import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../Frontend/public/assets/js/modules/scadenze/', import.meta.url);
const source = await readFile(new URL('deadline-editor-return-draft.js', root), 'utf8');
const {
    DEADLINE_EDITOR_RETURN_DRAFT_KEY,
    consumeDeadlineEditorReturnDraft,
    createDeadlineEditorReturnDraft,
    deadlineEditorReturnTarget
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
}

test('limita il ritorno della rubrica al modulo Scadenza corrente', () => {
    assert.equal(deadlineEditorReturnTarget({pathname: '/aggiungi_scadenza.html', search: '?profileDocumentId=doc-1'}), 'aggiungi_scadenza.html?profileDocumentId=doc-1');
    assert.equal(deadlineEditorReturnTarget({pathname: '/gestione_destinatari.html', search: ''}), '');
});

test('ripristina una sola volta campi e destinatari per lo stesso utente e URL', () => {
    const draft = createDeadlineEditorReturnDraft({
        ownerUid: 'user-1',
        returnTarget: 'aggiungi_scadenza.html?profileDocumentId=doc-1',
        mode: 'documenti',
        fields: {notice: 30, frequency: 7, notes: 'Promemoria'},
        recipients: [{email: 'maria@example.it', sendEmail: true, sendPush: false, canManage: true}],
        savedAt: 1000
    });
    const storage = memoryStorage({[DEADLINE_EDITOR_RETURN_DRAFT_KEY]: JSON.stringify(draft)});
    assert.deepEqual(consumeDeadlineEditorReturnDraft(storage, {
        ownerUid: 'user-1',
        returnTarget: 'aggiungi_scadenza.html?profileDocumentId=doc-1',
        now: 2000
    }), draft);
    assert.equal(consumeDeadlineEditorReturnDraft(storage, {
        ownerUid: 'user-1',
        returnTarget: 'aggiungi_scadenza.html?profileDocumentId=doc-1',
        now: 2000
    }), null);
});

test('scarta bozze di altro utente, altro URL o troppo vecchie', () => {
    const draft = createDeadlineEditorReturnDraft({
        ownerUid: 'user-1', returnTarget: 'aggiungi_scadenza.html?id=deadline-1', savedAt: 1000
    });
    for (const request of [
        {ownerUid: 'user-2', returnTarget: draft.returnTarget, now: 2000},
        {ownerUid: 'user-1', returnTarget: 'aggiungi_scadenza.html?id=deadline-2', now: 2000},
        {ownerUid: 'user-1', returnTarget: draft.returnTarget, now: 31 * 60 * 1000}
    ]) {
        const storage = memoryStorage({[DEADLINE_EDITOR_RETURN_DRAFT_KEY]: JSON.stringify(draft)});
        assert.equal(consumeDeadlineEditorReturnDraft(storage, request), null);
    }
});

test('il controller delega la navigazione al salvataggio della bozza', async () => {
    const controller = await readFile(new URL('deadline-recipient-controller.js', root), 'utf8');
    const editor = await readFile(new URL('aggiungi_scadenza.js', root), 'utf8');
    const contacts = await readFile(new URL('../shared/gestione-destinatari.js', root), 'utf8');
    assert.match(controller, /createDeadlineRecipientController\(\{ onManageContacts \} = \{\}\)/);
    assert.match(controller, /await onManageContacts\(returnTo\)/);
    assert.match(controller, /canManage: recipient\.canManage \|\| isOwner\(recipient\)/);
    assert.match(controller, /\.\.\.\(owner \? \[\] : \[createElement\('label'/);
    assert.match(editor, /sessionStorage\.setItem\(DEADLINE_EDITOR_RETURN_DRAFT_KEY/);
    assert.match(editor, /recipientController\.init\(user\.email\)/);
    assert.match(editor, /restoreDeadlineEditorAfterRecipientManagement\(\)/);
    assert.match(contacts, /ALLOWED_RETURN_PAGES/);
    assert.match(contacts, /safeReturnTarget\(new URLSearchParams/);
    assert.match(contacts, /title: contact\.active === false \? 'Riattiva' : 'Disattiva'/);
    assert.match(contacts, /textContent: contact\.active === false \? 'person_off' : 'person_check'/);
    assert.match(editor, /contactsById\.get\(recipient\.contactId\)/);
});
