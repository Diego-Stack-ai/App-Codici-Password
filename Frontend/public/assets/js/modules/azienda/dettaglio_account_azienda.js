/**
 * DETTAGLIO ACCOUNT AZIENDA MODULE (V6.0 SPLIT)
 * Visualizzazione dettagliata credenziali e coordinate bancarie aziendali.
 * - Entry Point: initDettaglioAccountAzienda(user)
 * - Allegati estratti in: dettaglio-azienda-attachments.js
 * - Condivisione estratta in: dettaglio-azienda-sharing.js
 */

import { db } from '../../firebase-config.js?v=1.2.32';
import {
    doc, getDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement, createSafeAccountIcon } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { ensureMasterKey } from '../core/security-manager.js';
import { decryptIfPossible } from '../core/crypto-utils.js';
import { openExternalUrl } from '../shared/attachment-security.js';
import {
    initAttachmentModule, loadAttachments,
    openSourceSelector, closeSourceSelector, handleFileUpload
} from './dettaglio-azienda-attachments.js';
import { initSharingModule, renderSharingMap } from './dettaglio-azienda-sharing.js';

// --- STATE ---
let currentUid = null;
let currentId = null;
let currentAziendaId = null;
let originalData = null;
let isReadOnly = false;
let ownerId = null;

// --- INITIALIZATION ---
export async function initDettaglioAccountAzienda(user) {
    
    if (!user) return;
    currentUid = user.uid;

    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');
    currentAziendaId = urlParams.get('aziendaId');
    ownerId = urlParams.get('ownerId') || user.uid; // V3 Add owner parameter

    if (!currentId || !currentAziendaId) {
        showToast("Parametri mancanti", "error");
        setTimeout(() => history.back(), 1000);
        return;
    }

    isReadOnly = (ownerId !== currentUid);

    // Inizializza moduli estratti con il contesto corrente
    initAttachmentModule({ currentUid, currentAziendaId, currentId });
    initSharingModule({ currentUid, currentAziendaId, currentId, isReadOnly, onReload: () => loadAccount() });

    initProtocolUI(); // Sync UI setup
    setupActions();
    await loadAccount();
}

function initProtocolUI() {
    // Pulsante Edit nel Footer Center (Floating Action Button)
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [
            createElement('button', {
                id: 'btn-edit-footer',
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('edit') || 'Modifica',
                onclick: () => window.location.href = `form_account_azienda.html?id=${currentId}&aziendaId=${currentAziendaId}`
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
            ])
        ]));
    }
}

async function loadAccount() {
    try {
        const docRef = doc(db, "users", ownerId, "aziende", currentAziendaId, "accounts", currentId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showToast(t('account_not_found'), "error");
            setTimeout(() => history.back(), 1000);
            return;
        }

        originalData = { id: docSnap.id, ...docSnap.data() };

        // 🔐 DECRIPTAZIONE (Auto-Unlock Compliant)
        if (originalData._encrypted) {
            try {
                const masterKey = await ensureMasterKey();
                originalData.username = await decryptIfPossible(originalData.username, masterKey);
                originalData.account = await decryptIfPossible(originalData.account, masterKey);
                originalData.password = await decryptIfPossible(originalData.password, masterKey);
                originalData.numeroIscrizione = await decryptIfPossible(originalData.numeroIscrizione, masterKey);
                originalData.codiceSocieta = await decryptIfPossible(originalData.codiceSocieta, masterKey);
                originalData.note = await decryptIfPossible(originalData.note, masterKey);

                if (Array.isArray(originalData.banking)) {
                    originalData.banking = await Promise.all(originalData.banking.map(async b => ({
                        ...b,
                        passwordDispositiva: await decryptIfPossible(b.passwordDispositiva, masterKey),
                        cards: await Promise.all((b.cards || []).map(async c => ({
                            ...c,
                            cardNumber: await decryptIfPossible(c.cardNumber, masterKey),
                            pin: await decryptIfPossible(c.pin, masterKey),
                            ccv: await decryptIfPossible(c.ccv, masterKey)
                        })))
                    })));
                }
            } catch (e) {
                console.warn("[Dettaglio Azienda] Decrittazione saltata o annullata.");
                showToast("Dati cifrati: sbloccare la Vault per visualizzare.", "warning");
            }
        }

        updateDoc(docRef, { views: increment(1) }).catch(e => logError("UpdateViews", e));

        render(originalData);
        await loadAttachments();

        if (isReadOnly) setupReadOnlyUI();

    } catch (e) {
        logError("LoadAccount", e);
        showToast(t('error_generic'), "error");
    }
}

function render(acc) {
    document.title = acc.nomeAccount || 'Dettaglio Azienda';

    // Accent Colors
    const colors = getAccentColors(acc);
    const container = document.querySelector('.base-container');
    if (container) {
        container.style.setProperty('--accent-rgb', colors.rgb);
        container.style.setProperty('--accent-hex', colors.hex);
    }

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
    setT('hero-title', acc.nomeAccount);
    setT('detail-note', acc.note);

    const hTitle = document.querySelector('.base-header .header-title');
    if (hTitle) hTitle.textContent = acc.nomeAccount || t('without_name');

    // Avatar
    const avatar = document.getElementById('detail-avatar');
    if (avatar) {
        const logoUrl = acc.logo || acc.avatar;
        if (logoUrl) {
            Object.assign(avatar.style, {
                backgroundImage: `url("${logoUrl}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            });
            clearElement(avatar);
        } else {
            avatar.style.backgroundImage = 'none';
            setChildren(avatar, createSafeAccountIcon(acc.nomeAccount));
        }
    }

    // Form Fields
    const map = {
        'detail-nomeAccount': acc.nomeAccount,
        'detail-username': acc.username,
        'detail-account': acc.account || acc.codice,
        'detail-password': acc.password,
        'detail-website': acc.url || acc.sitoWeb,
        'detail-numero-iscrizione': acc.numeroIscrizione,
        'detail-codice-societa': acc.codiceSocieta
    };
    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }

    // Banking
    renderBanking(acc);

    // Referente
    const refNome = acc.referenteNome || acc.referente?.nome;
    const refPhone = acc.referenteTelefono || acc.referente?.telefono;
    const refMobile = acc.referenteCellulare || acc.referente?.cellulare;

    const setF = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = val || '';
        else el.textContent = val || '-';
    };

    setF('ref-name', refNome);
    setF('ref-phone', refPhone);
    setF('ref-mobile', refMobile);

    // Shared Management V3
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
        btnAdd.onclick = openSourceSelector;
    }
}

function renderBanking(acc) {
    const hasBanking = !!acc.isBanking;
    const sectionBanking = document.getElementById('section-banking');
    if (sectionBanking) sectionBanking.classList.toggle('hidden', !hasBanking);

    // Gestione Suggerimento Conto Bancario
    const hasRealBanking = checkRealBankingData(acc);
    const bankingPrompt = document.getElementById('add-banking-prompt');
    if (bankingPrompt) {
        if (!hasRealBanking && !isReadOnly) {
            bankingPrompt.classList.remove('hidden');
            const btnBankingInfo = document.getElementById('btn-banking-info');
            if (btnBankingInfo) {
                btnBankingInfo.onclick = () => {
                    window.location.href = `form_account_azienda.html?id=${currentId}&aziendaId=${currentAziendaId}`;
                };
            }
        } else {
            bankingPrompt.classList.add('hidden');
        }
    }

    if (hasBanking) {
        const bankingContent = document.getElementById('banking-content');
        if (bankingContent) {
            const bankingArr = Array.isArray(acc.banking) ? acc.banking :
                (acc.banking?.iban ? [acc.banking] :
                    (acc.iban ? [{ iban: acc.iban }] : []));

            const rows = bankingArr.map((bank, bIdx) => {
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
                            createElement('input', { id: id, className: `field-input w-full no-transform ${isPassword ? 'base-shield field-value-password' : ''}`, value: value || '-', readonly: true }),
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

                return createElement('div', { className: 'bank-account-card border-glow cursor-default' }, [
                    createElement('div', { className: 'bank-header cursor-default' }, [
                        createElement('div', { className: 'bank-header-left' }, [
                            createElement('span', { className: 'material-symbols-outlined bank-expand-icon', textContent: 'account_balance' }),
                            createElement('span', { className: 'bank-title', textContent: bank.iban ? `Conto: ${bank.iban.substring(0, 10)}...` : `Conto Bancario #${bIdx + 1}` })
                        ])
                    ]),
                    createElement('div', { className: 'bank-details' }, fields)
                ]);
            });

            setChildren(bankingContent, rows);
        }
    }
}

function setupActions() {
    // Phone Call Buttons (CSP Compliant)
    document.getElementById('btn-call-ref-phone')?.addEventListener('click', () => {
        const val = document.getElementById('ref-phone')?.value;
        if (val) window.location.href = `tel:${val.replace(/\s+/g, '')}`;
    });

    document.getElementById('btn-call-ref-mobile')?.addEventListener('click', () => {
        const val = document.getElementById('ref-mobile')?.value;
        if (val) window.location.href = `tel:${val.replace(/\s+/g, '')}`;
    });

    // Copy Buttons logic
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = () => {
            const fieldId = btn.dataset.field;
            const input = document.getElementById(fieldId);
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

    // Modal Events
    const btnCancel = document.getElementById('btn-cancel-source');
    if (btnCancel) {
        btnCancel.onclick = (e) => {
            e.preventDefault();
            closeSourceSelector();
        };
    }

    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) closeSourceSelector();
        };
    }

    // Hidden inputs listeners
    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => handleFileUpload(e.target));
    });
}

function getAccentColors(acc) {
    if (acc.isBanking) return { rgb: '16, 185, 129', hex: '#10b981' };
    if (acc.isMemoShared) return { rgb: '34, 197, 94', hex: '#22c55e' };
    if (acc.shared) return { rgb: '244, 63, 94', hex: '#f43f5e' };
    if (acc.hasMemo) return { rgb: '245, 158, 11', hex: '#f59e0b' };
    return { rgb: '59, 130, 246', hex: '#3b82f6' };
}

/**
 * Utility per rilevare se ci sono dati bancari reali
 */
function checkRealBankingData(acc) {
    let bankingArr = [];
    if (Array.isArray(acc.banking)) {
        bankingArr = acc.banking;
    } else if (acc.iban || (acc.cards && acc.cards.length > 0)) {
        bankingArr = [{
            iban: acc.iban || '',
            cards: acc.cards || [],
            passwordDispositiva: acc.passwordDispositiva || '',
            referenteNome: acc.referenteNome || '',
            referenteTelefono: acc.referenteTelefono || '',
            referenteCellulare: acc.referenteCellulare || ''
        }];
    }
    return bankingArr.some(bank => {
        const hasIban = bank.iban && bank.iban.trim().length > 0;
        const hasDisp = bank.passwordDispositiva && bank.passwordDispositiva.trim().length > 0;
        const hasCards = bank.cards && bank.cards.some(c => c.cardNumber?.trim() || c.cardType?.trim() || c.pin?.trim() || c.ccv?.trim());
        const hasRef = (bank.referenteTelefono?.trim() || bank.referenteCellulare?.trim());
        return hasIban || hasDisp || hasCards || hasRef;
    });
}

function setupReadOnlyUI() {
    // Hide Actions
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) fCenter.classList.add('hidden');
    const btnEdit = document.getElementById('btn-edit-footer');
    if (btnEdit) btnEdit.remove();
}

