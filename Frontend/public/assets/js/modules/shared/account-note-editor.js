import {auth, db} from '../../firebase-config.js?v=1.2.128';
import {doc, runTransaction, onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';
import {ensureVaultKeyMaterial, encrypt, decrypt} from '../core/security-manager.js';
import {createElement} from '../../dom-utils.js';
import {showToast} from '../../ui-core-v129.js';

const mounted = new WeakMap();
const failure = code => Object.assign(new Error(code), {code});
const revisionOf = value => {
    if (value === undefined) return 0;
    if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) throw failure('NOTE_REVISION_INVALID');
    return value;
};

export async function saveAccountNote({ownerId, accountId, companyId = null, expectedRevision, expectedNote, note,
    isActive = () => true, signal}) {
    const check = () => {
        if (signal?.aborted || !isActive() || auth.currentUser?.uid !== ownerId) throw failure('NOTE_SESSION_CHANGED');
    };
    check();
    if (typeof note !== 'string' || note.length > 100000) throw failure('NOTE_INVALID');
    const revision = revisionOf(expectedRevision);
    const key = await ensureVaultKeyMaterial(); check();
    const value = note.trim() ? note : '';
    const ciphertext = await encrypt(value, key); check();
    const reference = companyId ? doc(db, 'users', ownerId, 'aziende', companyId, 'accounts', accountId)
        : doc(db, 'users', ownerId, 'accounts', accountId);
    await runTransaction(db, async transaction => {
        check();
        const snapshot = await transaction.get(reference); check();
        if (!snapshot.exists()) throw failure('NOTE_MISSING');
        const current = snapshot.data();
        if (current._encrypted !== true) throw failure('NOTE_LEGACY_ACCOUNT');
        if (current.isArchived || revisionOf(current.revision) !== revision || (current.note || '') !== (expectedNote || '')) {
            throw failure('NOTE_CONFLICT');
        }
        transaction.update(reference, {note: ciphertext, revision: revision + 1, updatedAt: new Date().toISOString()});
    });
    check();
    return {note: value, storedNote: ciphertext, revision: revision + 1};
}

export function initAccountNoteEditor({account, storedNote, ownerId, accountId, companyId = null, readOnly = false,
    isActive = () => true, signal}) {
    const button = document.getElementById('btn-edit-account-note');
    if (!button) return;
    const editButton = document.getElementById('btn-modify-account-note');
    const deleteButton = document.getElementById('btn-delete-account-note');
    mounted.get(button)?.();
    let disposed = false, busy = false, modal = null, input = null;
    let unsubscribe = () => {};
    let revision = account.revision, expectedNote = storedNote;
    const active = () => !disposed && !signal?.aborted && isActive() && auth.currentUser?.uid === ownerId;
    const close = () => { if (input) input.value = ''; input = null; modal?.remove(); modal = null; };
    const dispose = () => {
        if (disposed) return;
        disposed = true; close(); button.onclick = null; button.classList.add('hidden'); unsubscribe();
        for (const action of [editButton, deleteButton]) {
            if (action) { action.onclick = null; action.classList.add('hidden'); }
        }
        signal?.removeEventListener('abort', dispose);
        globalThis.removeEventListener?.('vault-session-locked', dispose);
        globalThis.removeEventListener?.('pagehide', dispose);
    };
    mounted.set(button, dispose);
    if (readOnly || !active()) { dispose(); return; }
    unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== ownerId) dispose(); });
    if (disposed) { unsubscribe(); return; }
    signal?.addEventListener('abort', dispose, {once: true});
    globalThis.addEventListener?.('vault-session-locked', dispose);
    globalThis.addEventListener?.('pagehide', dispose);
    const refresh = note => {
        if (!active()) return;
        const present = Boolean(note?.trim());
        document.getElementById('section-notes')?.classList.toggle('hidden', !present);
        const text = document.getElementById('detail-note'); if (text) text.textContent = note || '';
        button.textContent = 'Aggiungi nota';
        button.classList.toggle('hidden', present);
        for (const action of [editButton, deleteButton]) action?.classList.toggle('hidden', !present);
    };
    refresh(account.note);
    const focusAction = () => (account.note?.trim() ? editButton : button)?.focus();
    const openEditor = async (deleting = false) => {
        if (!active() || busy || modal) return;
        busy = true;
        try {
            const key = await ensureVaultKeyMaterial();
            if (!active()) return;
            const clear = account._encrypted ? await decrypt(expectedNote || '', key) : String(expectedNote || '');
            if (!active()) return;
            if (clear === '--ERRORE--') throw failure('NOTE_UNREADABLE');
            input = createElement('textarea', {id: 'inline-account-note', className: 'inline-note-input',
                value: clear || '', readOnly: deleting, maxLength: 100000, autocomplete: 'off', 'data-form-type': 'other',
                'data-1p-ignore': 'true', 'data-lpignore': 'true', 'aria-label': 'Nota Account'});
            const errorText = createElement('p', {className: 'modal-text', role: 'status'});
            const save = createElement('button', {type: 'button', className: 'btn-modal btn-primary', textContent: deleting ? 'Elimina nota' : 'Salva'});
            const cancel = createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: 'Annulla'});
            cancel.onclick = () => { if (!busy) { close(); focusAction(); } };
            modal = createElement('div', {className: 'modal-overlay active', role: 'dialog', 'aria-modal': 'true',
                'aria-labelledby': 'inline-note-title'}, [createElement('div', {className: 'modal-box inline-note-dialog'}, [
                createElement('h3', {id: 'inline-note-title', className: 'modal-title', textContent: deleting ? 'Eliminare questa nota?' : 'Nota Account'}), input,
                errorText, createElement('div', {className: 'modal-actions'}, [cancel, save])])]);
            modal.addEventListener('keydown', event => {
                if (event.key === 'Escape' && !busy) { close(); focusAction(); }
                if (event.key === 'Tab') {
                    const controls = [input, cancel, save].filter(node => node && !node.disabled);
                    const index = controls.indexOf(document.activeElement);
                    if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus(); }
                    else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0]?.focus(); }
                }
            });
            save.onclick = async () => {
                if (!active() || busy) return;
                busy = true; save.disabled = true; cancel.disabled = true; input.readOnly = true;
                try {
                    const result = await saveAccountNote({ownerId, accountId, companyId, expectedRevision: revision,
                        expectedNote, note: deleting ? '' : input.value, isActive: active, signal});
                    if (!active()) return;
                    revision = result.revision; expectedNote = result.storedNote;
                    account.note = result.note; account.revision = result.revision;
                    refresh(result.note); close(); focusAction(); showToast(deleting ? 'Nota eliminata.' : 'Nota salvata.', 'success');
                } catch (error) {
                    if (!active()) return;
                    errorText.textContent = error.code === 'NOTE_CONFLICT' ? 'L’Account è cambiato. Copia la bozza e riapri la pagina prima di salvare.'
                        : error.code === 'NOTE_LEGACY_ACCOUNT' ? 'Questo Account usa il formato precedente. Salvalo prima da Modifica Account.'
                            : 'Nota non salvata. La bozza è ancora qui: puoi riprovare.';
                } finally {
                    busy = false;
                    if (active() && input) { save.disabled = false; cancel.disabled = false; input.readOnly = deleting; }
                }
            };
            document.body.appendChild(modal); input.focus();
        } catch {
            if (active()) showToast('Impossibile aprire la nota. Verifica lo sblocco del Vault.', 'error');
        } finally { busy = false; }
    };
    button.onclick = () => openEditor();
    if (editButton) editButton.onclick = () => openEditor();
    if (deleteButton) deleteButton.onclick = () => openEditor(true);
    return {destroy: dispose};
}
