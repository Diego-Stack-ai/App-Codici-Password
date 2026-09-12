import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showConfirmModal, showToast} from '../../ui-core-v129.js';
import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    listAccountWidgets, listAccountWidgetsConfirmed,
    listSharedVaultData, listSharedVaultDataConfirmed
} from '../data/vault-repository.js';
import {linkSharedCredential, unlinkSharedCredential, updateSharedCredential} from '../data/shared-vault-data-client.js';
import {auth} from '../../firebase-config.js?v=1.2.115';

let mountVersion = 0;

async function editCredential(record, context, refresh) {
    if (!context.active() || !context.editable || context.readOnly) return;
    let rows = [], overlay, closed = false;
    const close = () => {
        closed = true;
        rows.forEach(({input}) => { input.value = ''; });
        overlay?.remove();
    };
    try {
        const key = await ensureVaultKeyMaterial({promptImmediately: true});
        if (!context.active()) return;
        if (!key) throw new Error('Vault locked');
        const values = await Promise.all(record.fields.map(field => field.encrypted
            ? decrypt(field.valueEnc, key) : field.value ?? ''));
        if (record.fields.some((field, index) => field.encrypted &&
            (typeof values[index] !== 'string' || values[index] === '--ERRORE--' || values[index] === field.valueEnc))) {
            throw new Error('Unreadable field');
        }
        if (!context.active()) return;
        rows = record.fields.map((field, index) => {
            const input = createElement('input', {
                type: 'text', className: `account-widget-inline-input${field.encrypted ? ' local-data-masked' : ''}`,
                value: String(values[index]), autocomplete: 'off', 'data-form-type': 'other',
                'data-lpignore': 'true', 'data-1p-ignore': 'true', 'aria-label': field.label || 'Campo'
            });
            const controls = [input];
            if (field.encrypted) controls.push(createElement('button', {
                type: 'button', className: 'shared-account-reveal', 'aria-label': 'Mostra o nascondi valore',
                onclick: () => input.classList.toggle('local-data-masked')
            }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'visibility'})]));
            return {field, input, element: createElement('label', {}, [
                createElement('strong', {textContent: field.label || 'Campo'}),
                createElement('div', {className: 'account-widget-inline-control'}, controls)
            ])};
        });
        values.fill('');
        const save = createElement('button', {
            type: 'button', className: 'btn-modal btn-primary', textContent: 'Salva modifica comune',
            onclick: async () => {
                if (closed || !context.active()) return close();
                if (save.disabled) return;
                save.disabled = true;
                try {
                    const confirmed = await showConfirmModal('Modifica Credenziale comune',
                        'La modifica sarà visibile in tutti gli Account collegati. Confermi il salvataggio?', 'Salva per tutti', 'Annulla');
                    if (closed || !context.active()) return close();
                    if (!confirmed) return;
                    await updateSharedCredential(record.id, record.revision, {
                        ...record, fields: rows.map(({field, input}) => ({...field,
                            value: !field.encrypted && input.value === String(field.value ?? '') ? field.value : input.value
                        }))
                    });
                    close();
                    if (!context.active()) return;
                    await refresh(true);
                    if (context.active()) showToast('Credenziale comune aggiornata.', 'success');
                } catch {
                    if (context.active() && !closed) showToast('Modifica non completata. I valori inseriti restano disponibili: verifica e riprova.', 'error');
                    else close();
                } finally { save.disabled = false; }
            }
        });
        overlay = createElement('div', {className: 'modal-overlay active'}, [
            createElement('section', {className: 'modal-box account-widget-editor-modal', role: 'dialog', 'aria-modal': 'true'}, [
                createElement('h2', {className: 'modal-title', textContent: 'Modifica Credenziale comune'}),
                createElement('p', {className: 'modal-text', textContent: 'Questi valori sono condivisi: ogni Account collegato vedrà la modifica.'}),
                createElement('div', {className: 'account-widget-editor-fields'}, rows.map(row => row.element)),
                createElement('div', {className: 'modal-actions account-widget-editor-actions'}, [
                    createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: 'Annulla', onclick: close}), save
                ])
            ])
        ]);
        document.body.appendChild(overlay);
    } catch {
        close();
        if (context.active()) showToast('Impossibile aprire i valori della Credenziale comune. Sblocca la Vault e riprova.', 'warning');
    }
}

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
    const valueElement = button.previousElementSibling;
    const icon = button.querySelector('.material-symbols-outlined');
    if (button.dataset.revealed === 'true') {
        valueElement.textContent = '••••••••';
        button.dataset.revealed = 'false';
        if (icon) icon.textContent = 'visibility';
        button.setAttribute('aria-label', `Mostra ${field.label || 'dato'}`);
        return;
    }
    try {
        const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
        const value = field.encrypted ? await decrypt(field.valueEnc, vaultKeyMaterial) : String(field.value ?? '');
        valueElement.textContent = value || '—';
        button.dataset.revealed = 'true';
        if (icon) icon.textContent = 'visibility_off';
        button.setAttribute('aria-label', `Nascondi ${field.label || 'dato'}`);
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
    if (context.editable && !context.readOnly) cardChildren.push(createElement('button', {
        type: 'button', className: 'shared-account-unlink', textContent: 'Modifica Credenziale comune',
        onclick: () => editCredential(record, context, refresh)
    }));
    if (context.editable && !context.readOnly) cardChildren.push(createElement('button', {
        type: 'button', className: 'shared-account-unlink', textContent: 'Scollega da questo Account',
        onclick: async () => {
            const confirmed = await showConfirmModal(
                'Scollega Credenziale comune',
                'Il dato centrale non verrà eliminato e resterà disponibile negli altri Account.',
                'Scollega', 'Annulla'
            );
            if (!confirmed || !context.active()) return;
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

export function initNewAccountSharedCredentials({saveButtonId}) {
    const section = document.getElementById('shared-credentials-section');
    const add = document.getElementById('btn-link-shared-credential');
    if (!section || !add) return;
    section.classList.remove('hidden');
    add.textContent = 'Salva Account e collega credenziale';
    add.onclick = () => {
        if (!navigator.onLine) return showToast('Salva online l’Account prima di collegare una credenziale comune.', 'warning');
        const save = document.getElementById(saveButtonId);
        if (!save || save.disabled) return;
        save.dataset.openSharedCredentials = 'true';
        save.click();
    };
}

export async function initAccountSharedCredentials(context) {
    const version = ++mountVersion;
    context = {...context, active: () => version === mountVersion && auth.currentUser?.uid === context.uid};
    const section = document.getElementById('shared-credentials-section');
    const list = document.getElementById('shared-credentials-list');
    const add = document.getElementById('btn-link-shared-credential');
    if (!section || !list || !context?.uid || !context.accountId) return;
    const refresh = async (serverConfirmed = false) => {
        const readWidgets = serverConfirmed ? listAccountWidgetsConfirmed : listAccountWidgets;
        const readData = serverConfirmed ? listSharedVaultDataConfirmed : listSharedVaultData;
        const [allWidgets, records] = await Promise.all([readWidgets(context.uid), readData(context.uid)]);
        if (!context.active()) return;
        const widgets = allWidgets.filter(widget => belongsToAccount(widget, context)).sort((a, b) => a.order - b.order);
        const recordsById = new Map(records.map(record => [record.id, record]));
        clearElement(list);
        for (const widget of widgets) {
            const record = recordsById.get(widget.sharedDataId);
            if (record) list.appendChild(credentialCard(record, widget, context, refresh));
        }
        section.classList.toggle('hidden', (!context.editable || context.readOnly) && !list.children.length);
        if (add) { add.classList.toggle('hidden', !context.editable || context.readOnly); add.onclick = null; }
        if (add && context.editable && !context.readOnly) {
            add.onclick = () => {
                if (!context.active()) return;
                if (!navigator.onLine) {
                    showToast('Il collegamento richiede la connessione internet.', 'warning');
                    return;
                }
                const linkedIds = new Set(widgets.map(widget => widget.sharedDataId));
                const available = records.filter(record => !linkedIds.has(record.id));
                const close = overlay => overlay.remove();
                const modal = selectorModal(available, close, async (record, overlay) => {
                    try {
                        if (!context.active()) return close(overlay);
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
    await refresh(context.editable && navigator.onLine);
    if (context.editable && !context.readOnly && context.active() && new URLSearchParams(globalThis.location?.search || '').get('linkShared') === '1') {
        const url = new URL(globalThis.location.href);
        url.searchParams.delete('linkShared');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
        add?.click();
    }
}
