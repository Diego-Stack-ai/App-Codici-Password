import {createQrSelectionEditorSource} from './qr-selection-editor-source.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';
import {mountQrSelectionEditor} from './qr-selection-editor-view.mjs';

// No fallback writer. Bootstrap must explicitly provide the trusted adapter
// after the candidate backend/Rules transition has been validated.
export async function mountPrivateQrEditor(root, context, {getUser, repository, isEncryptedValue, submit, isOnline}) {
    if (typeof submit !== 'function') throw Error('QR_WRITER_UNAVAILABLE');
    const source = createQrSelectionEditorSource({context, getUser, repository, isEncryptedValue, isOnline});
    try {
        const cleanup = await mountQrSelectionEditor(root, context, {load: () => source.load(),
            createController: ({onState}) => createQrSelectionSaveController({context, getUser, submit,
                prepare: selection => source.prepare(selection), onState})});
        return () => {try {cleanup();} finally {source.dispose();}};
    } catch (error) {source.dispose(); throw error;}
}
