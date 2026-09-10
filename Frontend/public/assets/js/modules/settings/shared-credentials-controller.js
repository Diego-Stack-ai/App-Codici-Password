import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showConfirmModal, showToast} from '../../ui-core-v129.js';
import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    listCompanies, listCompanyAccounts, listPrivateAccounts,
    listSharedVaultData, listSharedVaultDataConfirmed,
    listSharedVaultLinks, listSharedVaultLinksConfirmed
} from '../data/vault-repository.js';
import {
    createSharedCredential,
    deleteSharedCredential,
    linkSharedCredential,
    unlinkSharedCredential,
    updateSharedCredential
} from '../data/shared-vault-data-client.js';

function modalShell(title, close) {
    const overlay = createElement('div', {className: 'modal-overlay active'});
    const body = createElement('div', {className: 'shared-credentials-body'});
    const box = createElement('section', {className: 'modal-box shared-credentials-modal', role: 'dialog', 'aria-modal': 'true'});
    setChildren(box, [
        createElement('div', {className: 'shared-credentials-heading'}, [
            createElement('h2', {className: 'modal-title', textContent: title}),
            createElement('button', {
                type: 'button', className: 'shared-credentials-icon-button',
                'aria-label': 'Chiudi', onclick: close
            }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'close'})])
        ]),
        body
    ]);
    overlay.appendChild(box);
    return {overlay, body};
}

function fieldEditor(field = {}) {
    const row = createElement('div', {className: 'shared-credential-field'});
    const label = createElement('input', {
        className: 'shared-credentials-input', type: 'text', maxlength: 120,
        placeholder: 'Nome del campo', value: field.label || '', 'aria-label': 'Nome del campo'
    });
    const value = createElement('input', {
        className: 'shared-credentials-input', type: 'text', maxlength: 10000,
        placeholder: 'Valore', value: field.value || '', 'aria-label': 'Valore del campo'
    });
    const sensitive = createElement('label', {className: 'shared-credentials-sensitive'}, [
        createElement('input', {type: 'checkbox', checked: field.encrypted !== false}),
        createElement('span', {textContent: 'Dato sensibile cifrato'})
    ]);
    const remove = createElement('button', {
        type: 'button', className: 'shared-credentials-remove', 'aria-label': 'Rimuovi campo',
        onclick: () => row.remove()
    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'delete'})]);
    setChildren(row, [label, value, sensitive, remove]);
    row.getValue = () => ({
        id: field.id || crypto.randomUUID(),
        label: label.value,
        value: value.value,
        type: sensitive.firstElementChild.checked ? 'sensitive' : 'text',
        encrypted: sensitive.firstElementChild.checked
    });
    return row;
}

async function editableFields(record) {
    if (!record) return [{}];
    const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
    return Promise.all((record.fields || []).map(async field => ({
        ...field,
        value: field.encrypted && field.valueEnc
            ? await decrypt(field.valueEnc, vaultKeyMaterial)
            : field.value ?? ''
    })));
}

async function accountChoices(uid) {
    const [privateAccounts, companies] = await Promise.all([
        listPrivateAccounts(uid), listCompanies(uid)
    ]);
    const companyGroups = await Promise.all(companies.map(async company => ({
        company,
        accounts: await listCompanyAccounts(uid, company.id)
    })));
    return [
        ...privateAccounts.filter(account => !account.isArchived).map(account => ({
            context: 'private', accountId: account.id,
            label: account.nomeAccount || 'Account privato', group: 'Privato'
        })),
        ...companyGroups.flatMap(({company, accounts}) => accounts.filter(account => !account.isArchived).map(account => ({
            context: 'company', companyId: company.id, accountId: account.id,
            label: account.nomeAccount || 'Account aziendale',
            group: company.ragioneSociale || company.nome || 'Azienda'
        })))
    ];
}

function sameLink(link, account) {
    return link.context === account.context && link.accountId === account.accountId &&
        (account.context !== 'company' || link.companyId === account.companyId);
}

async function openLinkManager(record, user, refreshParent) {
    let overlay;
    const close = () => overlay.remove();
    const shell = modalShell(`Collegamenti · ${record.title || 'Credenziale'}`, close);
    overlay = shell.overlay;
    const accounts = await accountChoices(user.uid);
    let revision = Number(record.revision || 0);
    let links = (await listSharedVaultLinksConfirmed(user.uid)).filter(link => link.sharedDataId === record.id);
    let searchQuery = '';
    const render = () => {
        clearElement(shell.body);
        shell.body.classList.add('shared-credentials-link-manager-body');
        shell.body.appendChild(createElement('p', {
            className: 'modal-text',
            textContent: 'Collega lo stesso dato centrale agli Account che lo utilizzano. Ogni modifica futura sarà visibile da tutti i collegamenti.'
        }));
        const normalizedQuery = searchQuery.trim().toLocaleLowerCase('it');
        const visibleAccounts = accounts
            .filter(account => `${account.label} ${account.group}`.toLocaleLowerCase('it').includes(normalizedQuery))
            .sort((left, right) => {
                const leftLinked = links.some(link => sameLink(link, left));
                const rightLinked = links.some(link => sameLink(link, right));
                if (leftLinked !== rightLinked) return leftLinked ? -1 : 1;
                return left.label.localeCompare(right.label, 'it', {sensitivity: 'base'});
            });
        const search = createElement('input', {
            className: 'shared-credentials-input shared-credential-account-search',
            type: 'search', value: searchQuery,
            placeholder: 'Cerca Account o azienda…',
            'aria-label': 'Cerca tra gli Account'
        });
        search.addEventListener('input', () => {
            searchQuery = search.value;
            render();
            const nextSearch = shell.body.querySelector('.shared-credential-account-search');
            nextSearch?.focus();
            nextSearch?.setSelectionRange(searchQuery.length, searchQuery.length);
        });
        shell.body.appendChild(search);
        const list = createElement('div', {className: 'shared-credential-account-list'});
        if (!accounts.length) list.appendChild(createElement('p', {className: 'shared-credentials-empty', textContent: 'Nessun Account disponibile.'}));
        else if (!visibleAccounts.length) list.appendChild(createElement('p', {className: 'shared-credentials-empty', textContent: 'Nessun Account corrisponde alla ricerca.'}));
        for (const account of visibleAccounts) {
            const existing = links.find(link => sameLink(link, account));
            const button = createElement('button', {
                type: 'button', className: `shared-credential-account${existing ? ' linked' : ''}`
            }, [
                createElement('span', {className: 'material-symbols-outlined', textContent: existing ? 'link' : 'add_link'}),
                createElement('span', {className: 'shared-credential-account-copy'}, [
                    createElement('strong', {textContent: account.label}),
                    createElement('small', {textContent: account.group})
                ]),
                createElement('span', {textContent: existing ? 'Collegato' : 'Collega'})
            ]);
            button.onclick = async () => {
                if (!navigator.onLine) {
                    showToast('La gestione dei collegamenti richiede internet.', 'warning');
                    return;
                }
                button.disabled = true;
                try {
                    const payload = {...account, order: existing?.order || links.length, collapsed: false};
                    delete payload.label;
                    delete payload.group;
                    const result = existing
                        ? await unlinkSharedCredential(record.id, revision, payload)
                        : await linkSharedCredential(record.id, revision, payload);
                    revision = Number(result.revision || revision + 1);
                    if (existing) links = links.filter(link => link.id !== existing.id);
                    else links = (await listSharedVaultLinksConfirmed(user.uid)).filter(link => link.sharedDataId === record.id);
                    render();
                    showToast(existing ? 'Account scollegato.' : 'Account collegato.', 'success');
                } catch (error) {
                    showToast(error.message || 'Collegamento non aggiornato.', 'error');
                    button.disabled = false;
                }
            };
            list.appendChild(button);
        }
        shell.body.appendChild(list);
        shell.body.appendChild(createElement('div', {className: 'modal-actions shared-credential-account-actions'}, [
            createElement('button', {
                type: 'button', className: 'btn-modal btn-primary', textContent: 'Fine',
                onclick: async () => { close(); await refreshParent(true); }
            })
        ]));
    };
    document.body.appendChild(overlay);
    render();
}

async function openEditor(record, refresh) {
    const fields = await editableFields(record);
    let overlay;
    const close = () => overlay.remove();
    const shell = modalShell(record ? 'Modifica Credenziale comune' : 'Nuova Credenziale comune', close);
    overlay = shell.overlay;
    const form = createElement('form', {className: 'shared-credentials-form'});
    const title = createElement('input', {
        className: 'shared-credentials-input', type: 'text', maxlength: 120, required: true,
        placeholder: 'Titolo, per esempio Codice app Legal Mail', value: record?.title || ''
    });
    const description = createElement('textarea', {
        className: 'shared-credentials-input shared-credentials-textarea', maxlength: 500,
        placeholder: 'Descrizione facoltativa', value: record?.description || ''
    });
    const fieldList = createElement('div', {className: 'shared-credentials-fields'});
    fields.forEach(field => fieldList.appendChild(fieldEditor(field)));
    const addField = createElement('button', {
        type: 'button', className: 'btn-modal shared-credentials-add',
        onclick: () => fieldList.appendChild(fieldEditor())
    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'add'}), 'Aggiungi campo']);
    const save = createElement('button', {type: 'submit', className: 'btn-modal btn-primary', textContent: 'Salva'});
    const actions = [createElement('button', {type: 'button', className: 'btn-modal', textContent: 'Annulla', onclick: close})];
    if (record) actions.unshift(createElement('button', {
        type: 'button', className: 'btn-modal shared-credentials-delete', textContent: 'Elimina',
        onclick: async () => {
            const confirmed = await showConfirmModal(
                'Elimina Credenziale comune',
                'La cancellazione sarà consentita solo se non è collegata ad alcun Account.',
                'Elimina', 'Annulla'
            );
            if (!confirmed) return;
            try {
                await deleteSharedCredential(record.id, Number(record.revision || 0));
                close();
                await refresh(true);
                showToast('Credenziale comune eliminata.', 'success');
            } catch (error) {
                showToast(error.message || 'Eliminazione non riuscita.', 'error');
            }
        }
    }));
    actions.push(save);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const rows = [...fieldList.children];
        if (!rows.length) {
            showToast('Aggiungi almeno un campo.', 'warning');
            return;
        }
        save.disabled = true;
        try {
            const data = {title: title.value, description: description.value, fields: rows.map(row => row.getValue())};
            if (record) await updateSharedCredential(record.id, Number(record.revision || 0), data);
            else await createSharedCredential(data);
            close();
            await refresh(true);
            showToast(record ? 'Credenziale comune aggiornata.' : 'Credenziale comune creata.', 'success');
        } catch (error) {
            showToast(error.message || 'Salvataggio non riuscito.', 'error');
        } finally {
            save.disabled = false;
        }
    });
    setChildren(form, [
        createElement('p', {className: 'modal-text', textContent: 'Questi dati restano separati dagli Account e possono essere collegati dalla scheda centrale o dal dettaglio Account.'}),
        title, description, fieldList, addField,
        createElement('div', {className: 'modal-actions'}, actions)
    ]);
    shell.body.appendChild(form);
    document.body.appendChild(overlay);
    title.focus();
}

export async function openSharedCredentialsSettings(user) {
    if (!user?.uid) throw new Error('Accesso richiesto.');
    let overlay;
    const close = () => overlay.remove();
    const shell = modalShell('Credenziali comuni', close);
    overlay = shell.overlay;
    const render = async (serverConfirmed = false) => {
        clearElement(shell.body);
        const loading = createElement('p', {className: 'modal-text', textContent: 'Caricamento…'});
        shell.body.appendChild(loading);
        const readData = serverConfirmed ? listSharedVaultDataConfirmed : listSharedVaultData;
        const readLinks = serverConfirmed ? listSharedVaultLinksConfirmed : listSharedVaultLinks;
        const [records, links] = await Promise.all([readData(user.uid), readLinks(user.uid)]);
        clearElement(shell.body);
        shell.body.appendChild(createElement('p', {
            className: 'modal-text',
            textContent: navigator.onLine
                ? 'Ogni valore esiste una sola volta e potrà essere richiamato da più Account.'
                : 'Modalità offline: puoi consultare i dati già sincronizzati, ma non modificarli.'
        }));
        const list = createElement('div', {className: 'shared-credentials-list'});
        if (!records.length) list.appendChild(createElement('p', {className: 'shared-credentials-empty', textContent: 'Nessuna Credenziale comune presente.'}));
        for (const record of records) {
            const linkCount = links.filter(link => link.sharedDataId === record.id).length;
            list.appendChild(createElement('article', {className: 'shared-credentials-card'}, [
                createElement('span', {className: 'material-symbols-outlined', textContent: record.icon || 'key'}),
                createElement('span', {className: 'shared-credentials-card-copy'}, [
                    createElement('strong', {textContent: record.title || 'Credenziale comune'}),
                    createElement('small', {textContent: `${record.fields?.length || 0} campi · ${linkCount} Account collegati`})
                ]),
                createElement('span', {className: 'shared-credentials-card-actions'}, [
                    createElement('button', {
                        type: 'button', className: 'shared-credentials-action', disabled: !navigator.onLine,
                        'aria-label': 'Gestisci collegamenti', onclick: () => openLinkManager(record, user, render)
                    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'account_tree'})]),
                    createElement('button', {
                        type: 'button', className: 'shared-credentials-action', disabled: !navigator.onLine,
                        'aria-label': 'Modifica credenziale', onclick: () => openEditor(record, render)
                    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'edit'})])
                ])
            ]));
        }
        shell.body.appendChild(list);
        shell.body.appendChild(createElement('div', {className: 'modal-actions'}, [
            createElement('button', {type: 'button', className: 'btn-modal', textContent: 'Chiudi', onclick: close}),
            createElement('button', {
                type: 'button', className: 'btn-modal btn-primary', disabled: !navigator.onLine,
                textContent: 'Nuova credenziale', onclick: () => openEditor(null, render)
            })
        ]));
    };
    document.body.appendChild(overlay);
    await render();
}
