import {createAccountStandardEditorSource} from './account-standard-editor-source.mjs';
import {mountAccountStandardEditor} from './account-standard-editor-view.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';

export async function mountAccountStandardEditorProvider(root, context, options) {
    if (typeof options.submit !== 'function' || typeof options.assertNoPendingMutation !== 'function') throw Error('ACCOUNT_STANDARD_WRITER_UNAVAILABLE');
    const source = createAccountStandardEditorSource({context, ...options}); let cleanup, controller, closed = false;
    const scope = Object.freeze({uid: context.user?.uid, account: options.account, signal: context.signal});
    const clearQueue = async () => {const clear = await options.assertNoPendingMutation(scope); if (clear !== true) throw Error('ACCOUNT_STANDARD_PENDING_MUTATION');};
    const dispose = () => {if (closed) return; closed = true; try {cleanup?.(); controller?.dispose();} finally {source.dispose();}};
    try {
        await clearQueue(); controller = createQrSelectionSaveController({context, getUser: options.getUser, onState() {},
            prepare: async (changes, operationId) => {await clearQueue(); return source.prepare(changes, operationId);}, submit: options.submit,
            createRequest: prepared => prepared});
        cleanup = await (options.mountEditor || mountAccountStandardEditor)(root, context, {load: () => source.load(),
            save: changes => controller.save(changes), onSaved: async () => {dispose(); await options.onSaved();}, onCancel: () => {dispose(); options.onCancel();}});
        return dispose;
    } catch (error) {dispose(); throw error;}
}
