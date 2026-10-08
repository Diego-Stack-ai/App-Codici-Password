import {createProfileTextEditorSource} from './profile-text-editor-source.mjs';
import {mountProfileTextEditor} from './profile-text-editor-view.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';
import {validateProfileTextRequest} from './profile-text-contract.mjs';

export async function mountProfileTextEditorProvider(root, context, options) {
    if (typeof options.submit !== 'function') throw Error('PROFILE_WRITER_UNAVAILABLE');
    const source = createProfileTextEditorSource({context, ...options});
    try {
        const cleanup = await mountProfileTextEditor(root, context, {load: () => source.load(), onSaved: options.onSaved, onCancel: options.onCancel,
            createController: ({onState}) => createQrSelectionSaveController({context, getUser: options.getUser, onState,
                prepare: (changes, id) => source.prepare(changes, id), submit: options.submit,
                createRequest: (prepared, operationId) => {
                    if (prepared.operationId !== operationId) throw Error('OPERATION_CHANGED');
                    return validateProfileTextRequest(prepared);
                }})});
        return () => {try {cleanup();} finally {source.dispose();}};
    } catch (error) {source.dispose(); throw error;}
}
