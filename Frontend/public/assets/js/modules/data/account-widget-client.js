import {functions} from '../../firebase-config.js?v=1.2.101';
import {httpsCallable} from '/assets/js/vendor/firebase-runtime.js';
import {encrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    createEmbeddedWidgetIdentifiers,
    prepareEmbeddedAccountWidget
} from './shared-vault-data-model.js';

const manageAccountWidget = httpsCallable(functions, 'manageAccountWidget');

async function send(command) {
    if (!navigator.onLine) throw new Error('I Widget Account si modificano soltanto online.');
    const response = await manageAccountWidget(command);
    if (response.data?.status !== 'applied') {
        const error = new Error(response.data?.status === 'conflict'
            ? 'Il Widget è stato modificato altrove. Aggiorna e riprova.'
            : 'Operazione sul Widget non completata.');
        error.result = response.data;
        throw error;
    }
    return response.data;
}

async function prepare(data, account) {
    const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
    return prepareEmbeddedAccountWidget(data, account, value => encrypt(value, vaultKeyMaterial));
}

function contextFields(widget) {
    return {
        context: widget.context,
        accountId: widget.accountId,
        ...(widget.context === 'company' ? {companyId: widget.companyId} : {})
    };
}

export async function createAccountWidget(data, account, widgetId) {
    const ids = createEmbeddedWidgetIdentifiers(widgetId);
    const widget = await prepare(data, account);
    const result = await send({...ids, action: 'create', ...contextFields(widget), data: widget});
    return {...result, widgetId: ids.widgetId};
}

export async function updateAccountWidget(widgetId, expectedRevision, data, account) {
    const ids = createEmbeddedWidgetIdentifiers(widgetId);
    const widget = await prepare({...data, revision: expectedRevision}, account);
    return send({
        ...ids, action: 'update', expectedRevision,
        ...contextFields(widget), data: widget
    });
}

export async function deleteAccountWidget(widget) {
    const ids = createEmbeddedWidgetIdentifiers(widget.id);
    return send({
        ...ids, action: 'delete', expectedRevision: Number(widget.revision || 0),
        ...contextFields(widget)
    });
}
