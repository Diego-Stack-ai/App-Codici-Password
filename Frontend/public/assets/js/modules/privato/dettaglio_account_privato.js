/**
 * DETTAGLIO ACCOUNT PRIVATO (V5.9.5)
 * Visualizzazione dettagli, gestione banking e condivisioni.
 */

import { auth, db } from '../../firebase-config.js?v=1.2.52';
import { LOG } from '../../logger.js';
import { doc, collection, query, where, updateDoc, onSnapshot, runTransaction, arrayUnion, arrayRemove, increment } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement, createSafeAccountIcon } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError, formatDateToIT, sanitizeEmail } from '../../utils.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptIfPossible } from '../core/crypto-utils.js';
import { openExternalUrl } from '../shared/attachment-security.js';
import { initDetailAccountMode } from '../shared/detail-account-mode.js';
import { hasRealBankingData, normalizeBankingAccounts } from '../shared/banking-model.js';
import { findPrivateAccountByLegacyId, getPrivateAccount } from '../data/vault-repository.js';
import { initPrivateAttachmentModule, loadPrivateAttachments, openSourceSelector } from './dettaglio-privato-attachments.js';

// --- STATE ---
let currentUid = null;
let currentId = null;
let ownerId = null;
let isReadOnly = false;
let accountData = null;

// --- INITIALIZATION ---
/**
 * DETTAGLIO ACCOUNT PRIVATO MODULE (V5.0 ADAPTER)
 * Visualizzazione dettagli.
 * - Entry Point: initDettaglioAccountPrivato(user)
 */

export async function initDettaglioAccountPrivato(user) {
    
    if (!user) return;
    currentUid = user.uid;

    const params = new URLSearchParams(window.location.search);
    currentId = params.get('id');

    if (!currentId) {
        showToast(t('missing_id') || "ID mancante", "error");
        window.location.href = 'account_privati.html';
        return;
    }

    ownerId = params.get('ownerId') || user.uid;
    isReadOnly = (ownerId !== currentUid);

    // Aggiungi pulsante Edit nel footer (solo se non è read-only)
    if (!isReadOnly) {
        const fCenter = document.getElementById('footer-center-actions');
        if (fCenter) {
            clearElement(fCenter);
            const editBtn = createElement('button', {
                id: 'btn-edit-footer',
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('edit') || 'Modifica',
                onclick: () => {
                    LOG('[dettaglio] Navigating to form with ID:', currentId);
                    window.location.href = `form_account_privato.html?id=${currentId}`;
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
            ]);
            setChildren(fCenter, createElement('div', { className: 'fab-group' }, [editBtn]));
        }
    }

    if (isReadOnly) setupReadOnlyUI();
    setupActions();
    initPrivateAttachmentModule({ ownerId, accountId: currentId, readOnly: isReadOnly });

    await loadAccount();

    
}

/**
 * LOADING ENGINE
 */
async function loadAccount() {
    try {
        accountData = await getPrivateAccount(ownerId, currentId)
            || await findPrivateAccountByLegacyId(ownerId, currentId);
        if (!accountData) { showToast(t('account_not_found'), "error"); return; }
        const docRef = doc(db, "users", ownerId, "accounts", accountData.id);
        if (!isReadOnly) updateDoc(docRef, { views: increment(1) }).catch(console.warn);

        // 🔐 PROTOCOLLO BLINDA (Auto-Unlock Compliant)
        if (accountData._encrypted) {
            try {
                const vaultKeyMaterial = await ensureVaultKeyMaterial();
                [accountData.username, accountData.account, accountData.password, accountData.note] = await Promise.all([
                    decryptIfPossible(accountData.username, vaultKeyMaterial),
                    decryptIfPossible(accountData.account, vaultKeyMaterial),
                    decryptIfPossible(accountData.password, vaultKeyMaterial),
                    decryptIfPossible(accountData.note, vaultKeyMaterial)
                ]);
                if (Array.isArray(accountData.banking)) {
                    accountData.banking = await Promise.all(accountData.banking.map(async b => ({
                        ...b,
                        passwordDispositiva: await decryptIfPossible(b.passwordDispositiva, vaultKeyMaterial),
                        cards: await Promise.all((b.cards || []).map(async c => ({
                            ...c,
                            cardNumber: await decryptIfPossible(c.cardNumber, vaultKeyMaterial),
                            pin: await decryptIfPossible(c.pin, vaultKeyMaterial),
                            ccv: await decryptIfPossible(c.ccv, vaultKeyMaterial)
                        })))
                    })));
                }
            } catch (e) {
                console.warn("[Dettaglio] Decrittazione saltata o annullata.");
                showToast("Dati cifrati: sbloccare la Vault per visualizzare.", "warning");
            }
        }

        renderAccount(accountData);
        const contactNames = await initDetailAccountMode({ account: accountData, ownerId, accountId: currentId, readOnly: isReadOnly, onReload: loadAccount });
        renderSharingMap(accountData, contactNames);
        await loadPrivateAttachments();
        setupActions();
    } catch (e) {
        logError("LoadAccount", e);
        showToast(t('error_loading'), "error");
    }
}

/**
 * RENDERING
 */
function renderAccount(acc) {
    document.title = acc.nomeAccount || 'Dettaglio';

    // Accent Colors
    const colors = getAccentColors(acc);
    const container = document.querySelector('.base-container');
    if (container) {
        container.style.setProperty('--accent-rgb', colors.rgb);
        container.style.setProperty('--accent-hex', colors.hex);
    }

    // Header & Hero
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
    set('header-nome-account', acc.nomeAccount);
    set('hero-title', acc.nomeAccount);
    set('detail-note', acc.note);

    const avatar = document.getElementById('detail-avatar');
    if (avatar) {
        const logoUrl = acc.logo || acc.avatar;
        if (logoUrl) {
            avatar.style.backgroundImage = `url("${logoUrl}")`;
            avatar.style.backgroundSize = 'cover';
        } else {
            avatar.style.backgroundImage = 'none';
            setChildren(avatar, createSafeAccountIcon(acc.nomeAccount));
        }
    }

    // Form Fields
    const ref = acc.referente || {};
    const map = {
        'detail-nomeAccount': acc.nomeAccount,
        'detail-username': acc.username,
        'detail-account': acc.account || acc.codice,
        'detail-password': acc.password,
        'detail-website': acc.url || acc.sitoWeb,
        'detail-referenteNome': ref.nome || acc.referenteNome,
        'detail-referenteTelefono': ref.telefono || acc.referenteTelefono,
        'detail-referenteCellulare': ref.cellulare || acc.referenteCellulare
    };

    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }

    // Toggle Referente Section visibility
    const hasRefData = !!(map['detail-referenteNome'] || map['detail-referenteTelefono'] || map['detail-referenteCellulare']);
    const secRef = document.getElementById('section-referente');
    if (secRef) secRef.classList.toggle('hidden', !hasRefData);

    // Banking
    renderBanking(acc);

    // Gestione Suggerimento Conto Bancario
    const hasRealBanking = hasRealBankingData(acc);
    const bankingPrompt = document.getElementById('add-banking-prompt');
    if (bankingPrompt) {
        if (!hasRealBanking && !isReadOnly) {
            bankingPrompt.classList.remove('hidden');
            const btnBankingInfo = document.getElementById('btn-banking-info');
            if (btnBankingInfo) {
                const infoText = btnBankingInfo.querySelector('.info-text');
                if (infoText) infoText.textContent = t('banking_hint');
                btnBankingInfo.onclick = () => {
                    window.location.href = `form_account_privato.html?id=${currentId}`;
                };
            }
        } else {
            bankingPrompt.classList.add('hidden');
        }
    }

    if (acc.visibility === 'shared') {
        const mgmt = document.getElementById('shared-management-section');
        if (mgmt) mgmt.classList.remove('hidden');
        renderSharingMap(acc);
    } else {
        const mgmt = document.getElementById('shared-management-section');
        if (mgmt) mgmt.classList.add('hidden');
    }

    // --- ALLEGATI: Aggancio Listener ---
    const btnAdd = document.getElementById('btn-add-attachment');
    if (btnAdd) {
        if (isReadOnly) {
            btnAdd.classList.add('hidden');
        } else {
            btnAdd.classList.remove('hidden');
            btnAdd.onclick = (e) => {
                e.preventDefault();
                LOG("[DETTAGLIO] Add Attachment Clicked (onclick)");
                openSourceSelector();
            };
        }
    }
}

function renderBanking(acc) {
    const section = document.getElementById('section-banking');
    const content = document.getElementById('banking-content');
    if (!section || !content) return;

    const hasCardsAtRoot = (acc.cards && acc.cards.length > 0);
    if (!acc.isBanking && !hasCardsAtRoot) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    clearElement(content);

    const bankingArr = normalizeBankingAccounts(acc);

    if (!hasRealBankingData(acc)) {
        section.classList.add('hidden');
        return;
    }

    bankingArr.forEach((bank, idx) => {
        const handleCopy = (val) => {
            if (!val) return;
            navigator.clipboard.writeText(val);
            showToast(t('copied') || "Copiato!");
        };

        const createReadonlyField = (label, value, icon, isPassword = false) => {
            const id = 'bank-field-' + Math.random().toString(36).substr(2, 9);

            const btnCopy = createElement('button', {
                className: 'btn-icon-header copy-btn cursor-pointer',
                type: 'button',
                onclick: (e) => {
                    e.stopPropagation();
                    handleCopy(value);
                }
            }, [createElement('span', { className: 'material-symbols-outlined text-[14px]', textContent: 'content_copy' })]);

            const actionsDiv = createElement('div', { className: 'detail-field-actions flex items-center gap-2' }, [btnCopy]);

            if (isPassword) {
                const btnToggle = createElement('button', {
                    className: 'btn-icon-header btn-field-toggle cursor-pointer',
                    type: 'button',
                    onclick: (e) => {
                        e.stopPropagation();
                        const input = document.getElementById(id);
                        const isPass = input.type === 'password' || input.classList.contains('base-shield');
                        input.type = isPass ? 'text' : 'password';
                        input.classList.toggle('base-shield', !isPass);
                        e.currentTarget.querySelector('span').textContent = isPass ? 'visibility_off' : 'visibility';
                    }
                }, [createElement('span', { className: 'material-symbols-outlined text-[14px]', textContent: 'visibility' })]);
                actionsDiv.prepend(btnToggle);
            }

            return createElement('div', { className: 'glass-field-container' }, [
                createElement('label', { className: 'view-label', textContent: label }),
                createElement('div', { className: 'glass-field border-glow' }, [
                    createElement('span', { className: 'material-symbols-outlined ml-4 opacity-40', textContent: icon }),
                    createElement('input', { id: id, className: `field-input w-full no-transform ${isPassword ? 'base-shield field-value-password' : ''}`, value: value || '-', readonly: true, autocomplete: 'new-password' }),
                    actionsDiv
                ])
            ]);
        };

        const fields = [];

        if (bank.iban) fields.push(createReadonlyField('IBAN', bank.iban, 'account_balance'));
        if (bank.passwordDispositiva) fields.push(createReadonlyField('Pass. Disp.', bank.passwordDispositiva, 'lock', true));
        if (bank.referenteTelefono) fields.push(createReadonlyField('Tel. Banca', bank.referenteTelefono, 'call'));
        if (bank.referenteCellulare) fields.push(createReadonlyField('Cell. Banca', bank.referenteCellulare, 'smartphone'));

        // Cards
        if (bank.cards && bank.cards.length > 0) {
            const cardsArr = bank.cards.map((card, cIdx) => {
                return createElement('div', { className: 'card-entry border-glow' }, [
                    createElement('div', { className: 'card-entry-header cursor-default' }, [
                        createElement('div', { className: 'card-entry-title-row' }, [
                            createElement('span', { className: 'material-symbols-outlined card-entry-icon', textContent: 'credit_card' }),
                            createElement('span', { className: 'card-entry-label', textContent: card.cardType || card.type || `Carta #${cIdx + 1}` })
                        ])
                    ]),
                    createElement('div', { className: 'flex-col-gap' }, [
                        card.titolare ? createReadonlyField('Intestatario', card.titolare, 'person') : null,
                        card.cardNumber ? createReadonlyField('Numero', card.cardNumber, 'credit_card') : null,
                        card.expiry ? createReadonlyField('Scadenza', card.expiry, 'calendar_month') : null,
                        card.pin ? createReadonlyField('PIN', card.pin, 'dialpad', true) : null,
                        card.ccv ? createReadonlyField('CCV', card.ccv, 'shield', true) : null
                    ].filter(Boolean))
                ]);
            });

            fields.push(createElement('div', { className: 'bank-cards-section' }, [
                createElement('div', { className: 'bank-cards-header' }, [
                    createElement('span', { className: 'bank-cards-title', textContent: 'Carte Associate' })
                ]),
                createElement('div', { className: 'flex-col-gap' }, cardsArr)
            ]));
        }

        const cardEl = createElement('div', { className: 'bank-account-card border-glow cursor-default' }, [
            createElement('div', { className: 'bank-header cursor-default' }, [
                createElement('div', { className: 'bank-header-left' }, [
                    createElement('span', { className: 'material-symbols-outlined bank-expand-icon', textContent: 'account_balance' }),
                    createElement('span', { className: 'bank-title', textContent: bank.iban ? `Conto: ${bank.iban.substring(0, 10)}...` : `Conto Bancario #${idx + 1}` })
                ])
            ]),
            createElement('div', { className: 'bank-details' }, fields)
        ]);
        content.appendChild(cardEl);
    });
}

/**
 * SHARING MONITOR & CONSISTENCY (HARDENING V2)
 */
let sharingUnsubscribe = null; // Removed inside loading logic later, left for safety

function renderSharingMap(account, contactNames = new Map()) {
    const listContainer = document.getElementById('guests-list');
    const mgmtSection = document.getElementById('shared-management-section');

    if (!listContainer) return;

    clearElement(listContainer);

    if (account.visibility !== 'shared' || !account.sharedWith || Object.keys(account.sharedWith).length === 0) {
        if (mgmtSection) mgmtSection.classList.add('hidden');
        listContainer.appendChild(createElement('p', { className: 'text-[10px] opacity-40 italic', textContent: 'Nessuna condivisione attiva' }));
        return;
    }

    if (mgmtSection) mgmtSection.classList.remove('hidden');

    const guests = Object.values(account.sharedWith);

    for (const inv of guests) {
        if (inv.status === 'rejected') continue; // Should be handled/removed cleanly by backend, but safe fallback

        const displayStatus = inv.status === 'pending' ? (t('status_pending') || 'In attesa') : (t('status_accepted') || 'Accettato');
        const statusClass = inv.status === 'pending' ? 'bg-orange-500/20 text-orange-400 border-orange-500/20 animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';

        const items = [
            createElement('span', {
                className: `text-[8px] font-black uppercase px-2 py-1 rounded border ${statusClass}`,
                textContent: displayStatus
            })
        ];

        if (!isReadOnly) {
            items.push(createElement('button', {
                className: 'ml-2 p-2 rounded-lg bg-transparent border-none text-red-600 hover:text-red-500 hover:scale-110 transition-all cursor-pointer flex items-center justify-center sharing-revoke-button',
                onclick: () => revokeRecipientV3(inv.email)
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
            ]));
        }

        const div = createElement('div', { className: 'rubrica-list-item flex items-center justify-between' }, [
            createElement('div', { className: 'rubrica-item-info-row' }, [
                createElement('div', { className: 'rubrica-item-avatar', textContent: inv.email.charAt(0).toUpperCase() }),
                createElement('div', { className: 'rubrica-item-info' }, [
                    createElement('p', { className: 'truncate m-0 rubrica-item-name', textContent: contactNames.get(normalizeEmailForLookup(inv.email)) || inv.email.split('@')[0] }),
                    createElement('p', { className: 'truncate m-0 opacity-60 text-[10px]', textContent: inv.email })
                ])
            ]),
            createElement('div', { className: 'flex items-center gap-2' }, items)
        ]);
        listContainer.appendChild(div);
    }
}

function normalizeEmailForLookup(email) {
    return String(email || '').trim().toLowerCase();
}

/**
 * REVOKE SINGLE RECIPIENT V3.1 (Atomic Transaction over Map)
 */
async function revokeRecipientV3(email) {
    if (!email) return;
    const ok = await showConfirmModal(t('confirm_revoke_title') || "REVOCA ACCESSO", `${t('confirm_revoke_msg') || 'Vuoi rimuovere l\'accesso per'} ${email}?`, t('revoke') || "Revoca");
    if (!ok) return;

    try {
        await runTransaction(db, async (transaction) => {
            const accRef = doc(db, "users", currentUid, "accounts", currentId);
            const targetSanitized = sanitizeEmail(email);
            const inviteId = `${currentId}_${targetSanitized}`;
            const invRef = doc(db, "invites", inviteId);

            const accSnap = await transaction.get(accRef);
            if (!accSnap.exists()) return;

            let data = accSnap.data();
            let sharedWith = data.sharedWith || {};
            let wasAccepted = sharedWith[targetSanitized]?.status === 'accepted';

            // 1. Array Remove
            delete sharedWith[targetSanitized];

            let newCount = data.acceptedCount || 0;
            if (wasAccepted) newCount = Math.max(0, newCount - 1);

            let hasActiveGests = Object.values(sharedWith).some(g => g.status === 'pending' || g.status === 'accepted');
            let newVisibility = hasActiveGests ? "shared" : "private";

            // V5.2 AUTO-HEALING DI STATO: Se torna privato e non era un Memo esplicito, torna ad essere Account
            let newType = data.type;
            if (newVisibility === 'private' && data.type === 'memo' && data.isExplicitMemo !== true) {
                newType = 'account';
            }

            transaction.update(accRef, {
                sharedWith: sharedWith,
                sharedWithUids: Object.values(sharedWith).filter(g => g.status === 'accepted' && g.uid).map(g => g.uid),
                acceptedCount: newCount,
                visibility: newVisibility,
                type: newType,
                updatedAt: new Date().toISOString()
            });

            // 2. Clear technical invite (silent fail if not found natively in V3)
            transaction.delete(invRef);

            // 3. V3 Notification to Owner
            const ownerNotifRef = doc(collection(db, "users", currentUid, "notifications"));
            transaction.set(ownerNotifRef, {
                title: "Accesso Revocato",
                message: `Hai revocato l'accesso a ${email} per l'account ${data.nomeAccount || 'selezionato'}.`,
                accountName: data.nomeAccount || 'Account',
                type: "share_revoked",
                accountId: currentId,
                guestEmail: email,
                timestamp: new Date().toISOString(),
                read: false
            });

            // 4. [NEW] Notification to Guest (if accepted)
            const guestUid = wasAccepted ? accSnap.data().sharedWith[targetSanitized]?.uid : null;
            if (guestUid) {
                const guestNotifRef = doc(collection(db, "users", guestUid, "notifications"));
                transaction.set(guestNotifRef, {
                    title: "Accesso Revocato",
                    message: `Il proprietario ha rimosso il tuo accesso a: ${data.nomeAccount || 'un account condiviso'}.`,
                    accountName: data.nomeAccount || 'Account',
                    type: "share_revoked",
                    ownerEmail: auth.currentUser?.email || 'Proprietario',
                    timestamp: new Date().toISOString(),
                    read: false
                });
                LOG(`[V5.9-REVOKE] Notification sent to guest: ${guestUid}`);
            }
        });

        showToast("Accesso revocato con successo");
        // Reload account internally or via UI bounce since we killed the listener
        await loadAccount();
    } catch (e) {
        console.error("RevokeRecipient failed", e);
        showToast(t('error_generic'), 'error');
    }
}

function renderGuests(guests) {
    const list = document.getElementById('guests-list');
    if (!list) return;
    clearElement(list);

    if (!guests || guests.length === 0) {
        list.appendChild(createElement('p', { className: 'text-[10px] opacity-40 italic', textContent: 'Sola lettura' }));
        return;
    }

    guests.forEach(item => {
        const displayEmail = typeof item === 'string' ? item : item.email;
        const div = createElement('div', { className: 'rubrica-list-item flex items-center justify-between' }, [
            createElement('div', { className: 'rubrica-item-info-row' }, [
                createElement('div', { className: 'rubrica-item-avatar', textContent: displayEmail.charAt(0).toUpperCase() }),
                createElement('div', { className: 'rubrica-item-info' }, [
                    createElement('p', { className: 'truncate m-0 rubrica-item-name', textContent: displayEmail.split('@')[0] }),
                    createElement('p', { className: 'truncate m-0 opacity-60 text-[10px]', textContent: displayEmail })
                ])
            ]),
            createElement('span', {
                className: `ml-auto text-[8px] font-black uppercase px-2 py-1 rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/20`,
                textContent: t('status_accepted') || 'Accettato'
            })
        ]);
        list.appendChild(div);
    });
}

/**
 * UI HELPERS
 */
function getAccentColors(acc) {
    if (acc.isBanking) return { rgb: '16, 185, 129', hex: '#10b981' };
    if (acc.isMemoShared) return { rgb: '34, 197, 94', hex: '#22c55e' };
    if (acc.shared) return { rgb: '244, 63, 94', hex: '#f43f5e' };
    if (acc.hasMemo) return { rgb: '245, 158, 11', hex: '#f59e0b' };
    return { rgb: '59, 130, 246', hex: '#3b82f6' };
}

function setupReadOnlyUI() {
    const banner = createElement('div', { className: 'read-only-banner p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-6' }, [
        createElement('p', { className: 'text-xs font-black text-blue-400 uppercase tracking-widest', textContent: t('read_only_mode') || 'Modalità Lettura' }),
        createElement('p', { className: 'text-[10px] text-white/40 mt-1', textContent: t('read_only_desc') || 'Account condiviso in sola lettura' })
    ]);
    const container = document.querySelector('.detail-content-wrap');
    if (container) container.prepend(banner);

    // Hide Actions
    const saveBar = document.getElementById('save-bar');
    if (saveBar) saveBar.classList.add('hidden');
    const footerEdit = document.getElementById('btn-edit-footer');
    if (footerEdit) footerEdit.remove();
}

function setupActions() {
    // Copy Buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = () => {
            const container = btn.closest('.detail-field-box') || btn.closest('.glass-field-container');
            const input = container?.querySelector('input');
            if (input && input.value) {
                navigator.clipboard.writeText(input.value);
                showToast(t('copied') || "Copiato!");
            }
        };
    });

    // Toggle Password
    const toggleBtn = document.getElementById('toggle-password');
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            const input = document.getElementById('detail-password');
            if (input) {
                const isPass = input.type === 'password';
                input.type = isPass ? 'text' : 'password';
                input.classList.toggle('base-shield', !isPass);
                toggleBtn.querySelector('span').textContent = isPass ? 'visibility_off' : 'visibility';
            }
        };
    }

    // Open Website
    const openWebBtn = document.getElementById('open-website');
    if (openWebBtn) {
        openWebBtn.onclick = () => {
            const url = document.getElementById('detail-website')?.value;
            if (url && !openExternalUrl(url)) showToast('Indirizzo non valido.', 'error');
        };
    }

    // Copy Note
    const copyNoteBtn = document.getElementById('copy-note');
    if (copyNoteBtn) {
        copyNoteBtn.onclick = () => {
            const note = document.getElementById('detail-note')?.textContent;
            if (note && note !== '-') {
                navigator.clipboard.writeText(note);
                showToast(t('copied') || "Copiato!");
            }
        };
    }

    // Banking Toggle
    const bankToggle = document.getElementById('banking-toggle');
    const bankContent = document.getElementById('banking-content');
    const bankChevron = document.getElementById('banking-chevron');
    if (bankToggle && bankContent) {
        bankToggle.onclick = () => {
            const isHidden = bankContent.classList.toggle('hidden');
            if (bankChevron) {
                bankChevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                bankChevron.classList.toggle('text-white/20', isHidden);
                bankChevron.classList.toggle('text-emerald-500', !isHidden);
            }
        };
    }

}
