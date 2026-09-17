import {createPrivateAddressesEditorSource} from './private-addresses-editor-source.mjs';
import {mountAddressesEditor} from './addresses-editor-view.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';
import {mountPrivateUtilitiesEditorProvider} from './private-utilities-editor-provider.mjs';

export async function mountPrivateAddressesEditorProvider(root, context, options) {
    if (typeof options.submit !== 'function' || typeof options.createId !== 'function') throw Error('PROFILE_WRITER_UNAVAILABLE');
    const source = createPrivateAddressesEditorSource({context, ...options});
    try {
        const cleanup = await mountAddressesEditor(root, context, {load: () => source.load(), createId: () => source.createId(),
            onSaved: options.onSaved, onCancel: options.onCancel,
            mountUtilities: options.mountUtilities === false ? undefined : (target, parentAddressId) => {
                const nested = new AbortController();
                context.signal.addEventListener('abort', () => nested.abort(), {once: true});
                return mountPrivateUtilitiesEditorProvider(target, {...context, signal: nested.signal}, {...options,
                    parentAddressId, submit: options.submitUtilities ?? options.submit,
                    onSaved: options.onSaved, onLink: options.onUtilityLink});
            },
            createController: ({onState}) => createQrSelectionSaveController({context, getUser: options.getUser, onState,
                prepare: (draft, id) => source.prepare(draft, id), submit: options.submit,
                createRequest: (prepared, operationId) => {
                    if (prepared.operationId !== operationId) throw Error('OPERATION_CHANGED');
                    return prepared;
                }})});
        return () => {try {cleanup();} finally {source.dispose();}};
    } catch (error) {source.dispose(); throw error;}
}
