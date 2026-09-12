/**
 * DETTAGLIO ACCOUNT AZIENDA MODULE (V6.0 SPLIT)
 * Visualizzazione dettagliata credenziali e coordinate bancarie aziendali.
 * - Entry Point: initDettaglioAccountAzienda(user)
 * - Allegati estratti in: dettaglio-azienda-attachments.js
 * - Condivisione estratta in: dettaglio-azienda-sharing.js
 */

import { db } from '../../firebase-config.js?v=1.2.106';
import { doc, updateDoc, increment } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement, createSafeAccountIcon } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptIfPossible } from '../core/crypto-utils.js';
import { openExternalUrl } from '../shared/attachment-security.js';
import {
    initAttachmentModule, loadAttachments,
    openSourceSelector, closeSourceSelector, handleFileUpload
} from './dettaglio-azienda-attachments.js';
import { initSharingModule, renderSharingMap } from './dettaglio-azienda-sharing.js';
import { initDetailAccountMode } from '../shared/detail-account-mode.js';
import { renderAccountBanking } from '../shared/account-banking-view.js';
import {getCompanyAccount, getCompanyAccountConfirmed} from '../data/vault-repository.js';

// --- STATE ---
let currentUid = null;
let currentId = null;
let currentAziendaId = null;
let originalData = null;
let isReadOnly = false;
let ownerId = null;
let requireServerRefresh = false;

// --- INITIALIZATION ---
export async function initDettaglioAccountAzienda(user) {
    
    if (!user) return;
    currentUid = user.uid;

    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');
    currentAziendaId = urlParams.get('aziendaId');
    ownerId = urlParams.get('ownerId') || user.uid; // V3 Add owner parameter
    requireServerRefresh = (urlParams.get('afterWrite') === '1' || urlParams.get('serverRefresh') === '1') && navigator.onLine;

    if (!currentId || !currentAziendaId) {
        showToast("Parametri mancanti", "error");
        setTimeout(() => history.back(), 1000);
        return;
    }

    isReadOnly = (ownerId !== currentUid);

    // Inizializza moduli estratti con il contesto corrente
    initAttachmentModule({ ownerUid: ownerId, currentAziendaId, currentId, readOnly: isReadOnly });
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
        const account = await (requireServerRefresh
            ? getCompanyAccountConfirmed(ownerId, currentAziendaId, currentId)
            : getCompanyAccount(ownerId, currentAziendaId, currentId));

        if (!account) {
            showToast(t('account_not_found'), "error");
            setTimeout(() => history.back(), 1000);
            return;
        }

        originalData = account;
        if (requireServerRefresh) {
            requireServerRefresh = false;
            const cleanParams = new URLSearchParams(window.location.search);
            cleanParams.delete('afterWrite');
            cleanParams.delete('serverRefresh');
            const cleanQuery = cleanParams.toString();
            window.history.replaceState(null, '', `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}`);
        }

        // 🔐 DECRIPTAZIONE (Auto-Unlock Compliant)
        if (originalData._encrypted) {
            try {
                const vaultKeyMaterial = await ensureVaultKeyMaterial();
                [
                    originalData.username,
                    originalData.account,
                    originalData.password,
                    originalData.numeroIscrizione,
                    originalData.codiceSocieta,
                    originalData.note
                ] = await Promise.all([
                    decryptIfPossible(originalData.username, vaultKeyMaterial),
                    decryptIfPossible(originalData.account, vaultKeyMaterial),
                    decryptIfPossible(originalData.password, vaultKeyMaterial),
                    decryptIfPossible(originalData.numeroIscrizione, vaultKeyMaterial),
                    decryptIfPossible(originalData.codiceSocieta, vaultKeyMaterial),
                    decryptIfPossible(originalData.note, vaultKeyMaterial)
                ]);

                if (Array.isArray(originalData.banking)) {
                    originalData.banking = await Promise.all(originalData.banking.map(async b => ({
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
                console.warn("[Dettaglio Azienda] Decrittazione saltata o annullata.");
                showToast("Dati cifrati: sbloccare la Vault per visualizzare.", "warning");
            }
        }

        updateDoc(docRef, { views: increment(1) }).catch(e => logError("UpdateViews", e));

        render(originalData);
        const contactNames = await initDetailAccountMode({ account: originalData, ownerId, accountId: currentId, aziendaId: currentAziendaId, readOnly: isReadOnly, onReload: loadAccount });
        renderSharingMap(originalData, contactNames);
        await loadAttachments();
        import('../shared/account-shared-credentials.js?v=1.2.106').then(({initAccountSharedCredentials}) =>
            initAccountSharedCredentials({
                uid: currentUid, context: 'company', accountId: currentId,
                companyId: currentAziendaId, readOnly: isReadOnly
            })
        ).catch(error => console.warn('[SHARED CREDENTIALS] Caricamento saltato.', error));
        import('../shared/account-embedded-widgets.js?v=1.2.106').then(({initAccountEmbeddedWidgets}) =>
            initAccountEmbeddedWidgets({
                uid: currentUid, context: 'company', accountId: currentId,
                companyId: currentAziendaId, readOnly: isReadOnly
            })
        ).catch(error => console.warn('[ACCOUNT WIDGETS] Caricamento saltato.', error));

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
    renderAccountBanking(acc, {
        isReadOnly,
        onAddBanking: () => {
            window.location.href = `form_account_azienda.html?id=${currentId}&aziendaId=${currentAziendaId}`;
        }
    });

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

function setupReadOnlyUI() {
    // Hide Actions
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) fCenter.classList.add('hidden');
    const btnEdit = document.getElementById('btn-edit-footer');
    if (btnEdit) btnEdit.remove();
}
