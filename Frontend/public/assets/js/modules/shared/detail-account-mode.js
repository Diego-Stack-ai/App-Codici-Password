import { auth, db } from '../../firebase-config.js?v=1.2.132';
import { doc, increment, runTransaction } from '/assets/js/vendor/firebase-runtime.js';
import { clearElement, createElement } from '../../dom-utils.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { inviteIdForGuest, sanitizeEmail, sharingCycleOf } from '../../utils.js';
import { listContacts } from '../data/vault-repository.js';
import { accountModeFromRecord, hasAccountCredentials, validateAccountMode } from './account-mode-model.js';

const fullName = contact => [contact?.nome, contact?.cognome].filter(Boolean).join(' ').trim() || contact?.email || '';
const normalizeEmail = email => String(email || '').trim().toLowerCase();

export async function initDetailAccountMode({ account, ownerId, accountId, aziendaId = null, readOnly = false, compactView = false, onReload, isActive = () => true, signal, confirm: confirmAction = showConfirmModal }) {
    const active = () => !signal?.aborted && isActive();
    if (!active()) return;
    const section = document.getElementById('account-mode-section');
    const options = document.getElementById('account-mode-options');
    const contactArea = document.getElementById('account-mode-contacts');
    const contactList = document.getElementById('account-mode-contact-list');
    const saveButton = document.getElementById('btn-save-account-mode');
    if (!section || !options || !contactArea || !contactList || !saveButton) return;

    if (readOnly || compactView) {
        section.classList.add('hidden');
        saveButton.onclick = null;
        clearElement(options);
        clearElement(contactList);
        // A received account does not grant access to its owner's address book.
        if (readOnly) return;
    } else {
        section.classList.remove('hidden');
    }
    const initialMode = accountModeFromRecord(account);
    let selectedMode = initialMode;
    let selectedEmails = new Set(Object.values(account.sharedWith || {}).filter(g => g?.status !== 'rejected' && g?.status !== 'suspended').map(g => normalizeEmail(g.email)).filter(Boolean));
    let contacts = [];
    try {
        contacts = (await listContacts(ownerId))
            .filter(item => item.active !== false && normalizeEmail(item.email))
            .sort((a, b) => fullName(a).localeCompare(fullName(b), 'it'));
    } catch (error) {
        if (!active()) return;
        console.warn('[AccountMode] Rubrica non disponibile', error);
    }

    if (!active()) return;
    if (compactView) return new Map(contacts.map(contact => [normalizeEmail(contact.email), fullName(contact)]));
    const definitions = [
        ['account-private', 'Account', 'lock'],
        ['account-shared', 'Account condiviso', 'group'],
        ['memo-private', 'Memorandum', 'description'],
        ['memo-shared', 'Memorandum condiviso', 'group_work']
    ];

    const hasCredentials = () => hasAccountCredentials(account);
    const render = () => {
        if (!active()) return;
        clearElement(options);
        definitions.forEach(([key, label, icon]) => {
            options.appendChild(createElement('button', {
                type: 'button',
                className: `account-mode-option${selectedMode === key ? ' is-active' : ''}`,
                dataset: { mode: key },
                onclick: () => {
                    if (!active()) return;
                    const validation = validateAccountMode(key, account);
                    if (validation.reason === 'memo-has-credentials') {
                        showToast('Per passare a Memorandum apri Modifica e cancella manualmente Utente, Account/Codice e Password.', 'warning');
                        return;
                    }
                    if (validation.reason === 'shared-account-without-credentials') {
                        showToast('Un Account condiviso deve contenere almeno una credenziale tra Utente, Account/Codice e Password.', 'warning');
                        return;
                    }
                    selectedMode = key;
                    render();
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: icon }),
                createElement('span', { textContent: label })
            ]));
        });

        const isShared = selectedMode.endsWith('-shared');
        contactArea.classList.toggle('hidden', !isShared);
        clearElement(contactList);
        if (isShared) {
            if (!contacts.length) {
                contactList.appendChild(createElement('p', { className: 'account-mode-empty', textContent: 'Nessun destinatario in rubrica. Usa “Gestisci destinatari” per aggiungerne uno.' }));
            } else {
                contacts.forEach(contact => {
                    const email = normalizeEmail(contact.email);
                    const checked = selectedEmails.has(email);
                    const checkbox = createElement('input', { type: 'checkbox', checked });
                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) selectedEmails.add(email); else selectedEmails.delete(email);
                        render();
                    });
                    contactList.appendChild(createElement('label', { className: 'account-mode-contact' }, [
                        checkbox,
                        createElement('span', { className: 'account-mode-contact-copy' }, [
                            createElement('strong', { textContent: fullName(contact) }),
                            createElement('small', { textContent: email })
                        ])
                    ]));
                });
            }
        }
        const emailsChanged = [...selectedEmails].sort().join('|') !== Object.values(account.sharedWith || {}).filter(g => g?.status !== 'rejected' && g?.status !== 'suspended').map(g => normalizeEmail(g.email)).filter(Boolean).sort().join('|');
        saveButton.classList.toggle('hidden', selectedMode === initialMode && !emailsChanged);
    };

    const manageButton = document.getElementById('btn-manage-account-mode-contacts');
    if (manageButton) manageButton.onclick = () => {
        const returnTo = `${location.pathname.split('/').pop()}${location.search}`;
        location.href = `gestione_destinatari.html?return=${encodeURIComponent(returnTo)}`;
    };

    saveButton.onclick = async () => {
        if (!active()) return;
        const isShared = selectedMode.endsWith('-shared');
        const isMemo = selectedMode.startsWith('memo-');
        if (isMemo && hasCredentials()) return showToast('Cancella manualmente le tre credenziali dal form Modifica prima di usare Memorandum.', 'warning');
        if (isShared && !selectedEmails.size) return showToast('Seleziona almeno un destinatario per la condivisione.', 'warning');
        if (!isShared && Object.keys(account.sharedWith || {}).length) {
            const ok = await confirmAction('Interrompere la condivisione?', 'Gli accessi attivi e gli inviti pendenti saranno revocati.', 'Continua');
            if (!active() || !ok) return;
        }

        saveButton.disabled = true;
        try {
            const path = aziendaId
                ? ['users', ownerId, 'aziende', aziendaId, 'accounts', accountId]
                : ['users', ownerId, 'accounts', accountId];
            const accountRef = doc(db, ...path);
            if (!active()) return;
            await runTransaction(db, async transaction => {
                if (!active()) throw new Error('DETAIL_VIEW_DISPOSED');
                const snap = await transaction.get(accountRef);
                if (!active()) throw new Error('DETAIL_VIEW_DISPOSED');
                if (!snap.exists()) throw new Error('Account non trovato');
                const stored = snap.data();
                // M7-R7C-1: il ciclo identifica la generazione degli inviti. Un
                // valore malformato chiude il salvataggio invece di scrivere su un
                // ID incerto.
                const cycle = sharingCycleOf(stored);
                if (cycle === null) throw new Error('CICLO_DI_CONDIVISIONE_NON_VALIDO');
                const sharedWith = { ...(stored.sharedWith || {}) };
                const requestedKeys = new Set([...selectedEmails].map(sanitizeEmail));

                for (const key of Object.keys(sharedWith)) {
                    if (!isShared || !requestedKeys.has(key)) {
                        delete sharedWith[key];
                        transaction.delete(doc(db, 'invites', inviteIdForGuest(accountId, key, cycle)));
                        // Notifica all'ospite: richiede un backend dedicato, non implementata.
                    }
                }

                if (isShared) {
                    for (const email of selectedEmails) {
                        const key = sanitizeEmail(email);
                        // `suspended` è reinvitabile solo perché l'utente lo ha
                        // riselezionato: gli ospiti sospesi non sono preselezionati.
                        if (!sharedWith[key] || sharedWith[key].status === 'rejected' || sharedWith[key].status === 'suspended') {
                            sharedWith[key] = { email, status: 'pending', uid: null };
                            const invite = {
                                inviteId: inviteIdForGuest(accountId, key, cycle),
                                // M7-AUDIT-5C: base opaca dell'istanza di invito, nuova a
                                // ogni creazione e a ogni reinvito. L'id dell'evento di
                                // registro si deriva solo da qui, mai dall'email, dalla
                                // sua chiave sanificata o dall'id del documento.
                                auditRef: crypto.randomUUID(),
                                accountId, ownerId, senderId: ownerId,
                                senderEmail: auth.currentUser?.email || '', recipientEmail: email,
                                accountName: stored.nomeAccount || '', type: isMemo ? 'memo' : 'account',
                                notifyPush: document.getElementById('account-mode-notify-push')?.checked === true,
                                notifyEmail: document.getElementById('account-mode-notify-email')?.checked === true,
                                status: 'pending', cycle, createdAt: new Date().toISOString()
                            };
                            if (aziendaId) invite.aziendaId = aziendaId;
                            transaction.set(doc(db, 'invites', invite.inviteId), invite);
                        }
                    }
                }

                transaction.update(accountRef, {
                    type: isMemo ? 'memo' : 'account', visibility: isShared ? 'shared' : 'private',
                    isExplicitMemo: isMemo, sharedWith,
                    sharedWithUids: Object.values(sharedWith).filter(g => g.status === 'accepted' && g.uid).map(g => g.uid),
                    acceptedCount: Object.values(sharedWith).filter(g => g.status === 'accepted').length,
                    revision: increment(1),
                    updatedAt: new Date().toISOString()
                });
            });
            if (!active()) return;
            showToast('Tipologia e condivisione aggiornate.');
            await onReload?.();
        } catch (error) {
            if (!active()) return;
            console.error('[AccountMode] Salvataggio fallito', error);
            showToast('Impossibile salvare la modifica.', 'error');
        } finally {
            if (active()) saveButton.disabled = false;
        }
    };

    render();
    return new Map(contacts.map(contact => [normalizeEmail(contact.email), fullName(contact)]));
}
