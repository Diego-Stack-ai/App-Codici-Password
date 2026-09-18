import {createCompanyContactsEditorSource} from './company-contacts-editor-source.mjs';
import {mountCompanyContactsEditor} from './company-contacts-editor-view.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';

export async function mountCompanyContactsEditorProvider(root, context, options) {
    if (typeof options.submit !== 'function' || typeof options.createId !== 'function' ||
        !options.source || options.source.domain !== 'company') throw Error('COMPANY_WRITER_UNAVAILABLE');
    const source = createCompanyContactsEditorSource({context, ...options});
    try {
        const cleanup = await mountCompanyContactsEditor(root, context, {load: () => source.load(),
            createId: () => source.createId(), onSaved: options.onSaved, onCancel: options.onCancel,
            createController: ({onState}) => createQrSelectionSaveController({context, getUser: options.getUser, onState,
                prepare: (draft, id) => source.prepare(draft, id), submit: options.submit,
                createRequest: (prepared, operationId) => {
                    if (prepared.operationId !== operationId) throw Error('OPERATION_CHANGED');
                    return prepared;
                }})});
        return () => {try {cleanup();} finally {source.dispose();}};
    } catch (error) {source.dispose(); throw error;}
}
