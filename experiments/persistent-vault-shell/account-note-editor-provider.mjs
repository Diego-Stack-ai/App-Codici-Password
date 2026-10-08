import {createAccountNoteEditorSource} from './account-note-editor-source.mjs';
import {validateAccountNoteRequest} from './account-note-contract.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';
import {mountProfileTextEditor} from './profile-text-editor-view.mjs';
import {profileLinkAccount} from './profile-link-contract.mjs';

// Separate online-only editor. Bootstrap must resolve any pre-existing M6 queue
// before offering this provider; this module never opens or rewrites that queue.
export async function mountAccountNoteEditorProvider(root, context, options) {
    if (typeof options.submit !== 'function' || typeof options.assertNoPendingMutation !== 'function') throw Error('NOTE_WRITER_UNAVAILABLE');
    const scope = Object.freeze({uid: context.user?.uid, account: profileLinkAccount(options.account), signal: context.signal});
    let cleanup, closed = false;
    const checkQueue = async () => {
        // Trusted bootstrap, scoped to UID/domain/company/record and current
        // lifetime. Return explicit evidence, never treat absence as clearance.
        const clear = await options.assertNoPendingMutation(scope);
        if (context.signal.aborted || options.getUser()?.uid !== scope.uid) throw Error('VIEW_DISPOSED');
        context.assertUnlocked(); if (clear !== true) throw Error('NOTE_PENDING_MUTATION');
    };
    const source = createAccountNoteEditorSource({context, ...options});
    const dispose = () => {if (closed) return; closed = true; try {cleanup?.();} finally {source.dispose();}};
    try {
        await checkQueue();
        cleanup = await (options.mountEditor || mountProfileTextEditor)(root, context, {
            load: () => source.load(), labels: {save: 'Salva nota', saved: 'Nota salvata.',
                invalid: 'Nota cambiata o salvataggio non disponibile. Riapri la nota.', unavailable: 'Operazione non disponibile. Riapri la nota.',
                offline: 'Nota disponibile offline in sola consultazione.'},
            onSaved: async () => {dispose(); await options.onSaved();}, onCancel: () => {dispose(); options.onCancel();},
            createController: ({onState}) => createQrSelectionSaveController({context, getUser: options.getUser, onState,
                prepare: async (changes, operationId) => {
                    await checkQueue();
                    if (!changes || Object.keys(changes).length !== 1 || !Object.hasOwn(changes, 'note')) throw Error('NOTE_PATCH_INVALID');
                    return source.prepare(changes.note, operationId);
                }, submit: options.submit,
                createRequest: (prepared, operationId) => {
                    if (prepared.operationId !== operationId) throw Error('OPERATION_CHANGED');
                    return validateAccountNoteRequest(prepared);
                }})});
        if (closed || context.signal.aborted) cleanup?.();
        return dispose;
    } catch (error) {dispose(); throw error;}
}
