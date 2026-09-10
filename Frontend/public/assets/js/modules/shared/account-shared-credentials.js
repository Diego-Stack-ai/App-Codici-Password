import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showConfirmModal, showToast} from '../../ui-core-v129.js';
import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    listAccountWidgets, listAccountWidgetsConfirmed,
    listSharedVaultData, listSharedVaultDataConfirmed
} from '../data/vault-repository.js';
import {linkSharedCredential, unlinkSharedCredential} from '../data/shared-vault-data-client.js';

function belongsToAccount(widget, context) {
    return widget.kind === 'shared-reference' &&
        widget.context === context.context && widget.accountId === context.accountId &&
        (context.context !== 'company' || widget.companyId === context.companyId);
}

function linkPayload(context, order = 0) {
    return {
        context: context.context,
        accountId: context.accountId,
        ...(context.context === 'company' ? {companyId: context.companyId} : {}),
        order,
        collapsed: false
    };
}

async function revealField(button, field) {
    try {
        const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
        const value = field.encrypted ? await decrypt(field.valueEnc, vaultKeyMaterial) : String(field.value ?? '');
        button.previousElementSibling.textContent = value || '—';
        button.remove();
    } catch {
        showToast('Sblocca la Vault per visualizzare il dato.', 'warning');
    }
}

function credentialCard(record, widget, context, refresh) {
    const fields = createElement('div', {className: 'shared-account-fields'});
    for (const field of [...(record.fields || [])].sort((a, b) => a.order - b.order)) {
        const value = createElement('span', {
            className: 'shared-account-value',
            textContent: field.encrypted ? '••••••••' : String(field.value ?? '—')
        });
        const children = [
            createElement('strong', {textContent: field.label || 'Campo'}),
            value
        ];
        if (field.encrypted) children.push(createElement('button', {
            type: 'button', className: 'shared-account-reveal', 'aria-label': `Mostra ${field.label || 'dato'}`,
            onclick: event => revealField(event.currentTarget, field)
        }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'visibility'})]));
        fields.appendChild(createElement('div', {className: 'shared-account-field'}, children));
    }
    const cardChildren = [
        createElement('div', {className: 'shared-account-card-heading'}, [
            createElement('span', {className: 'material-symbols-outlined', textContent: record.icon || 'key'}),
            createElement('strong', {textContent: record.title || 'Credenziale comune'})
        ]),
        fields
    ];
    if (!context.readOnly) cardChildren.push(createElement('button', {
        type: 'button', className: 'shared-account-unlink', textContent: 'Scollega da questo Account',
        onclick: async () => {
            const confirmed = await showConfirmModal(
                'Scollega Credenziale comune',
                'Il dato centrale non verrà eliminato e resterà disponibile negli altri Account.',
                'Scollega', 'Annulla'
            );
            if (!confirmed) return;
            try {
                await unlinkSharedCredential(record.id, Number(record.revision || 0), linkPayload(context, widget.order));
                await refresh(true);
                showToast('Credenziale scollegata.', 'success');
            } catch (error) {
                showToast(error.message || 'Scollegamento non riuscito.', 'error');
            }
        }
    }));
    return createElement('article', {className: 'shared-account-card'}, cardChildren);
}

function selectorModal(records, close, onSelect) {
    const overlay = createElement('div', {className: 'modal-overlay active'});
    const credentialSelect = createElement('select', {
        className: 'shared-account-select-control',
        disabled: !records.length,
        'aria-label': 'Credenziale comune da collegare'
    }, [
        createElement('option', {value: '', textContent: records.length ? 'Seleziona una credenziale…' : 'Nessuna credenziale disponibile'}),
        ...records.map(record => createElement('option', {
            value: record.id,
            textContent: `${record.title || 'Credenziale comune'} · ${record.fields?.length || 0} campi`
        }))
    ]);
    const confirm = createElement('button', {
        type: 'button', className: 'btn-modal btn-primary', textContent: 'Collega', disabled: true,
        onclick: () => {
            const record = records.find(item => item.id === credentialSelect.value);
            if (record) onSelect(record, overlay);
        }
    });
    credentialSelect.addEventListener('change', () => { confirm.disabled = !credentialSelect.value; });
    setChildren(overlay, createElement('section', {className: 'modal-box shared-account-selector', role: 'dialog', 'aria-modal': 'true'}, [
        createElement('h2', {className: 'modal-title', textContent: 'Collega Credenziale comune'}),
        createElement('p', {className: 'modal-text', textContent: records.length ? 'Scegli un dato centrale esistente.' : 'Non ci sono altre Credenziali comuni disponibili. Creane una dalle Impostazioni.'}),
        credentialSelect,
        createElement('div', {className: 'modal-actions'}, [
            createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: 'Annulla', onclick: () => close(overlay)}),
            confirm
        ])
    ]));
    return overlay;
}

export async function initAccountSharedCredentials(context) {
    const section = document.getElementById('shared-credentials-section');
    const list = document.getElementById('shared-credentials-list');
    const add = document.getElementById('btn-link-shared-credential');
    if (!section || !list || !context?.uid || !context.accountId) return;
    const refresh = async (serverConfirmed = false) => {
        const readWidgets = serverConfirmed ? listAccountWidgetsConfirmed : listAccountWidgets;
        const readData = serverConfirmed ? listSharedVaultDataConfirmed : listSharedVaultData;
        const [allWidgets, records] = await Promise.all([readWidgets(context.uid), readData(context.uid)]);
        const widgets = allWidgets.filter(widget => belongsToAccount(widget, context)).sort((a, b) => a.order - b.order);
        const recordsById = new Map(records.map(record => [record.id, record]));
        clearElement(list);
        for (const widget of widgets) {
            const record = recordsById.get(widget.sharedDataId);
            if (record) list.appendChild(credentialCard(record, widget, context, refresh));
        }
        section.classList.toggle('hidden', context.readOnly && !list.children.length);
        if (add) add.classList.toggle('hidden', context.readOnly);
        if (add && !context.readOnly) {
            add.onclick = () => {
                if (!navigator.onLine) {
                    showToast('Il collegamento richiede la connessione internet.', 'warning');
                    return;
                }
                const linkedIds = new Set(widgets.map(widget => widget.sharedDataId));
                const available = records.filter(record => !linkedIds.has(record.id));
                const close = overlay => overlay.remove();
                const modal = selectorModal(available, close, async (record, overlay) => {
                    try {
                        await linkSharedCredential(record.id, Number(record.revision || 0), linkPayload(context, widgets.length));
                        close(overlay);
                        await refresh(true);
                        showToast('Credenziale comune collegata.', 'success');
                    } catch (error) {
                        showToast(error.message || 'Collegamento non riuscito.', 'error');
                    }
                });
                document.body.appendChild(modal);
            };
        }
    };
    await refresh();
}
