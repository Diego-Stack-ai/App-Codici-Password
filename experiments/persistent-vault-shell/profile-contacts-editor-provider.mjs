import {createProfileContactsEditorSource} from './profile-contacts-editor-source.mjs';
import {mountProfileContactsEditor} from './profile-contacts-editor-view.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';

export async function mountProfileContactsEditorProvider(root, context, options) {
    if (typeof options.submit !== 'function' || typeof options.createId !== 'function') throw Error('PROFILE_WRITER_UNAVAILABLE');
    const source = createProfileContactsEditorSource({context, ...options});
    try {
        const cleanup = await mountProfileContactsEditor(root, context, {load: () => source.load(),
            createId: collection => source.createId(collection), onSaved: options.onSaved, onCancel: options.onCancel,
            createController: ({onState}) => createQrSelectionSaveController({context, getUser: options.getUser, onState,
                prepare: (draft, id) => source.prepare(draft, id), submit: options.submit,
                createRequest: (prepared, operationId) => {
                    if (prepared.operationId !== operationId) throw Error('OPERATION_CHANGED');
                    return prepared;
                }})});
        return () => {try {cleanup();} finally {source.dispose();}};
    } catch (error) {source.dispose(); throw error;}
}
