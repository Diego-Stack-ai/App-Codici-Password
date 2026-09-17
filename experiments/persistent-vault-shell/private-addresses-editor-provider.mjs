import {createPrivateAddressesEditorSource} from './private-addresses-editor-source.mjs';
import {mountAddressesEditor} from './addresses-editor-view.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';

export async function mountPrivateAddressesEditorProvider(root, context, options) {
    if (typeof options.submit !== 'function' || typeof options.createId !== 'function') throw Error('PROFILE_WRITER_UNAVAILABLE');
    const source = createPrivateAddressesEditorSource({context, ...options});
    try {
        const cleanup = await mountAddressesEditor(root, context, {load: () => source.load(), createId: () => source.createId(),
            onSaved: options.onSaved, onCancel: options.onCancel,
            createController: ({onState}) => createQrSelectionSaveController({context, getUser: options.getUser, onState,
                prepare: (draft, id) => source.prepare(draft, id), submit: options.submit,
                createRequest: (prepared, operationId) => {
                    if (prepared.operationId !== operationId) throw Error('OPERATION_CHANGED');
                    return prepared;
                }})});
        return () => {try {cleanup();} finally {source.dispose();}};
    } catch (error) {source.dispose(); throw error;}
}
