import {createCompanyQrEditorSource} from './company-qr-editor-source.mjs';
import {prepareCompanyQrSelection, normalizeCompanyQrExpectedConfig, readCompanyQrSelection} from './company-qr-selection-contract.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';
import {mountQrSelectionEditor} from './qr-selection-editor-view.mjs';

export function createCompanyQrRequest(prepared, operationId) {
    if (typeof prepared.companyId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(prepared.companyId)) throw Error('COMPANY_INVALID');
    const selection = prepareCompanyQrSelection(prepared.selection);
    const expectedConfig = normalizeCompanyQrExpectedConfig(prepared.expectedConfig);
    const revision = readCompanyQrSelection(expectedConfig === null ? {} : {qrConfig: expectedConfig}).revision;
    if (prepared.expectedRevision !== revision) throw Error('REVISION_INVALID');
    return Object.freeze({companyId: prepared.companyId, selection, expectedConfig, operationId});
}

export async function mountCompanyQrEditor(root, context, {getUser, source, submit, isOnline}) {
    if (typeof submit !== 'function') throw Error('QR_WRITER_UNAVAILABLE');
    const editorSource = createCompanyQrEditorSource({context, getUser, source, isOnline});
    try {
        const cleanup = await mountQrSelectionEditor(root, context, {domain: 'company', load: () => editorSource.load(),
            createController: ({onState}) => createQrSelectionSaveController({context, getUser, submit,
                prepare: selection => editorSource.prepare(selection), createRequest: createCompanyQrRequest, onState})});
        return () => {try {cleanup();} finally {editorSource.dispose();}};
    } catch (error) {editorSource.dispose(); throw error;}
}
