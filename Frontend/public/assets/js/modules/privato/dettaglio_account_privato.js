/**
 * DETTAGLIO ACCOUNT PRIVATO (V5.9.5)
 * Visualizzazione dettagli, gestione banking e condivisioni.
 */

import { db } from '../../firebase-config.js?v=1.2.89';
import { LOG } from '../../logger.js';
import { doc, updateDoc, increment } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement, createSafeAccountIcon } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError, formatDateToIT } from '../../utils.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptIfPossible } from '../core/crypto-utils.js';
import { openExternalUrl } from '../shared/attachment-security.js';
import { initDetailAccountMode } from '../shared/detail-account-mode.js';
import { renderAccountBanking } from '../shared/account-banking-view.js';
import {
    findPrivateAccountByLegacyId,
    getPrivateAccount,
    getPrivateAccountConfirmed
} from '../data/vault-repository.js';
import { initPrivateAttachmentModule, loadPrivateAttachments, openSourceSelector } from './dettaglio-privato-attachments.js';
import { initPrivateSharingModule, renderPrivateSharingMap } from './dettaglio-privato-sharing.js';

// --- STATE ---
let currentUid = null;
let currentId = null;
let ownerId = null;
let isReadOnly = false;
let accountData = null;
let requireServerRefresh = false;

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
    requireServerRefresh = params.get('m6refresh') === '1' && navigator.onLine;

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
                    window.location.href = `form_account_privato.html?id=${encodeURIComponent(currentId)}`;
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
    initPrivateSharingModule({ currentUid, ownerId, accountId: currentId, readOnly: isReadOnly, onReload: loadAccount });

    await loadAccount();

    
}
/**
 * LOADING ENGINE
 */
async function loadAccount() {
    try {
        accountData = await (requireServerRefresh
            ? getPrivateAccountConfirmed(ownerId, currentId)
            : getPrivateAccount(ownerId, currentId))
            || await findPrivateAccountByLegacyId(ownerId, currentId);
        if (!accountData) { showToast(t('account_not_found'), "error"); return; }
        if (requireServerRefresh) {
            requireServerRefresh = false;
            const cleanParams = new URLSearchParams(window.location.search);
            cleanParams.delete('m6refresh');
            const cleanQuery = cleanParams.toString();
            window.history.replaceState(null, '', `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}`);
        }
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
        renderPrivateSharingMap(accountData, contactNames);
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

    renderAccountBanking(acc, {
        isReadOnly,
        promptText: t('banking_hint'),
        onAddBanking: () => {
            window.location.href = `form_account_privato.html?id=${encodeURIComponent(currentId)}`;
        }
    });

    if (acc.visibility === 'shared') {
        const mgmt = document.getElementById('shared-management-section');
        if (mgmt) mgmt.classList.remove('hidden');
        renderPrivateSharingMap(acc);
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
