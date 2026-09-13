/**
 * DETTAGLIO ACCOUNT AZIENDA MODULE (V6.0 SPLIT)
 * Visualizzazione dettagliata credenziali e coordinate bancarie aziendali.
 * - Entry Point: initDettaglioAccountAzienda(user)
 * - Allegati estratti in: dettaglio-azienda-attachments.js
 * - Condivisione estratta in: dettaglio-azienda-sharing.js
 */

import { auth, db } from '../../firebase-config.js?v=1.2.110';
import { doc, updateDoc, increment, onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement, createSafeAccountIcon } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
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

let mounted = null;
function clearDetail(document = globalThis.document) {
    for (const id of ['detail-nomeAccount','detail-username','detail-account','detail-password','detail-website','detail-numero-iscrizione','detail-codice-societa','ref-name','ref-phone','ref-mobile','input-camera','input-gallery','input-file']) {
        const node = document.getElementById(id); if (node) { node.value = ''; node.onchange = null; }
    }
    for (const id of ['hero-title','detail-note','attachments-list','guests-list','banking-content','footer-center-actions']) {
        const node = document.getElementById(id); if (node) { for (const input of node.querySelectorAll?.('input') || []) input.value = ''; clearElement(node); }
    }
    for (const node of document.querySelectorAll('.copy-btn, #btn-add-attachment, #toggle-password, #open-website, #copy-note, #banking-toggle, #btn-call-ref-phone, #btn-call-ref-mobile, #btn-cancel-source, #source-selector-modal')) node.onclick = null;
    const modal = document.getElementById('source-selector-modal');
    if (modal) { modal.classList.remove('active'); modal.classList.add('hidden'); }
    if (document.body) document.body.style.overflow = '';
}

// --- INITIALIZATION ---
export async function initDettaglioAccountAzienda(user, options = {}) {
    mounted?.destroy();
    if (!user) return {destroy() {}};
    currentUid = user.uid;

    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');
    currentAziendaId = urlParams.get('aziendaId');
    ownerId = urlParams.get('ownerId') || user.uid; // V3 Add owner parameter
    requireServerRefresh = (urlParams.get('afterWrite') === '1' || urlParams.get('serverRefresh') === '1') && navigator.onLine;

    const scope = {uid: currentUid, owner: ownerId, company: currentAziendaId, id: currentId};
    const root = document.querySelector('.base-container');
    const owned = new Map();
    const ownedDocument = {getElementById(id) { if (!owned.has(id)) owned.set(id, document.getElementById(id)); return owned.get(id); }, querySelectorAll: selector => document.querySelectorAll(selector), body: document.body};
    clearDetail(ownedDocument);
    const handlers = [...document.querySelectorAll('.copy-btn, #btn-add-attachment, #toggle-password, #open-website, #copy-note, #banking-toggle, #btn-call-ref-phone, #btn-call-ref-mobile, #btn-cancel-source, #source-selector-modal')];
    ownedDocument.querySelectorAll = () => handlers;
    let disposed = false, unsubscribe = () => {};
    const mount = {scope, fileInputs: new Set(), version: 0, loaded: false, loadAbort: new AbortController(),
        active() {
            if (!disposed && (mounted !== mount || options.signal?.aborted || root?.isConnected === false ||
                auth.currentUser?.uid !== scope.uid || (options.active && !options.active()))) mount.destroy();
            return !disposed;
        },
        destroy() {
            if (disposed) return;
            disposed = true; mount.loaded = false;
            for (const input of mount.fileInputs) { input.value = ''; input.onchange = null; }
            mount.fileInputs.clear(); mount.loadAbort.abort(); unsubscribe();
            options.signal?.removeEventListener('abort', mount.destroy);
            globalThis.removeEventListener?.('vault-session-locked', mount.destroy);
            globalThis.removeEventListener?.('pagehide', mount.destroy);
            if (mounted === mount) { originalData = null; clearDetail(ownedDocument); }
        }
    };
    mounted = mount;
    clearDetail();
    options.signal?.addEventListener('abort', mount.destroy, {once: true});
    globalThis.addEventListener?.('vault-session-locked', mount.destroy, {once: true});
    globalThis.addEventListener?.('pagehide', mount.destroy, {once: true});
    unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== scope.uid) mount.destroy(); });
    if (!mount.active()) return mount;
    if (!currentId || !currentAziendaId) {
        showToast('Parametri mancanti', 'error');
        setTimeout(() => { if (mount.active()) history.back(); }, 1000);
        return mount;
    }
    isReadOnly = ownerId !== currentUid;
    const footer = document.getElementById('footer-center-actions');
    if (footer) footer.classList.toggle('hidden', isReadOnly);
    await loadAccount(mount);
    return mount;
}

function initProtocolUI(active) {
    // Pulsante Edit nel Footer Center (Floating Action Button)
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        fCenter.classList.toggle('hidden', isReadOnly);
        if (isReadOnly) return;
        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [
            createElement('button', {
                id: 'btn-edit-footer',
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('edit') || 'Modifica',
                onclick: () => {
                    if (!active() || isReadOnly || ownerId !== currentUid) return;
                    window.location.href = `form_account_azienda.html?id=${currentId}&aziendaId=${currentAziendaId}`;
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
            ])
        ]));
    }
}

async function loadAccount(mount = mounted) {
    if (!mount?.active()) return;
    mount.loadAbort.abort();
    mount.loadAbort = new AbortController();
    const signal = mount.loadAbort.signal;
    const version = ++mount.version;
    mount.loaded = false;
    clearDetail();
    setupActions(() => mount.active() && mount.loaded);
    const active = () => mount.active() && version === mount.version && !signal.aborted;
    setupActions(() => active() && mount.loaded, mount.fileInputs);
    const {uid: loadViewerId, owner: loadOwnerId, company: companyId, id: accountId} = mount.scope;
    try {
        const docRef = doc(db, "users", loadOwnerId, "aziende", companyId, "accounts", accountId);
        const account = await (requireServerRefresh
            ? getCompanyAccountConfirmed(loadOwnerId, companyId, accountId)
            : getCompanyAccount(loadOwnerId, companyId, accountId));

        if (!active()) return;
        if (!account) {
            showToast(t('account_not_found'), "error");
            setTimeout(() => { if (active()) history.back(); }, 1000);
            return;
        }

        const loaded = {...account};
        if (requireServerRefresh) {
            requireServerRefresh = false;
            const cleanParams = new URLSearchParams(window.location.search);
            cleanParams.delete('afterWrite');
            cleanParams.delete('serverRefresh');
            const cleanQuery = cleanParams.toString();
            window.history.replaceState(null, '', `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}`);
        }

        // 🔐 DECRIPTAZIONE (Auto-Unlock Compliant)
        if (loaded._encrypted) {
            try {
                const vaultKeyMaterial = await ensureVaultKeyMaterial();
                if (!active()) return;
                [
                    loaded.username,
                    loaded.account,
                    loaded.password,
                    loaded.numeroIscrizione,
                    loaded.codiceSocieta,
                    loaded.note
                ] = await Promise.all([
                    decryptIfPossible(loaded.username, vaultKeyMaterial),
                    decryptIfPossible(loaded.account, vaultKeyMaterial),
                    decryptIfPossible(loaded.password, vaultKeyMaterial),
                    decryptIfPossible(loaded.numeroIscrizione, vaultKeyMaterial),
                    decryptIfPossible(loaded.codiceSocieta, vaultKeyMaterial),
                    decryptIfPossible(loaded.note, vaultKeyMaterial)
                ]);

                if (!active()) return;
                if (Array.isArray(loaded.banking)) {
                    loaded.banking = await Promise.all(loaded.banking.map(async b => ({
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
                if (!active()) return;
                console.warn("[Dettaglio Azienda] Decrittazione saltata o annullata.");
                showToast("Dati cifrati: sbloccare la Vault per visualizzare.", "warning");
            }
        }

        if (!active()) return;
        originalData = loaded;
        mount.loaded = true;
        const actionActive = () => active() && mount.loaded;
        const confirm = (...args) => {
            if (!active()) return Promise.resolve(false);
            const pending = showConfirmModal(...args);
            const modal = document.getElementById('protocol-confirm-modal');
            const cancel = () => { modal?.querySelector('#confirm-cancel-btn')?.click(); modal?.remove(); };
            signal.addEventListener('abort', cancel, {once: true});
            return pending.finally(() => signal.removeEventListener('abort', cancel));
        };
        const reload = () => mount.active() && loadAccount(mount);
        initAttachmentModule({ownerUid: loadOwnerId, currentAziendaId: companyId, currentId: accountId, readOnly: isReadOnly, isActive: actionActive, signal, confirm});
        initSharingModule({currentUid: loadViewerId, currentAziendaId: companyId, currentId: accountId, isReadOnly, onReload: reload, isActive: actionActive, signal, confirm});
        if (!isReadOnly && loadOwnerId === loadViewerId) {
            updateDoc(docRef, {views: increment(1)}).catch(e => { if (active()) logError('UpdateViews', e); });
        }
        initProtocolUI(actionActive);
        render(loaded, actionActive);
        const contactNames = await initDetailAccountMode({account: loaded, ownerId: loadOwnerId, accountId, aziendaId: companyId, readOnly: isReadOnly, onReload: reload, isActive: actionActive, signal, confirm});
        if (!active()) return;
        renderSharingMap(loaded, contactNames);
        await loadAttachments();
        if (!active()) return;
        const widgetContext = {uid: loadViewerId, context: 'company', accountId, companyId, readOnly: isReadOnly, active: actionActive, signal};
        for (const [path, initializer] of [['account-shared-credentials', 'initAccountSharedCredentials'], ['account-embedded-widgets', 'initAccountEmbeddedWidgets']]) {
            import(`../shared/${path}.js?v=1.2.110`).then(async module => {
                if (!active()) return;
                const controller = await module[initializer](widgetContext);
                if (!active()) controller?.destroy();
            }).catch(error => { if (active()) logError('AccountWidgets', error); });
        }
        if (isReadOnly) setupReadOnlyUI();

    } catch (e) {
        if (!active()) return;
        mount.loaded = false;
        logError("LoadAccount", e);
        showToast(t('error_generic'), "error");
    }
}

function render(acc, active) {
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

    // Compatta la sola pagina di consultazione: i campi vuoti non riservano
    // spazio, mentre restano tutti disponibili nel modulo di modifica.
    const compactGrids = new Set();
    [
        'detail-username', 'detail-account', 'detail-password', 'detail-website',
        'detail-numero-iscrizione', 'detail-codice-societa'
    ].forEach(id => {
        const input = document.getElementById(id);
        input?.closest('.glass-field-container')?.classList.toggle('hidden', !String(input.value || '').trim());
        const grid = input?.closest('.form-grid-2');
        if (grid) compactGrids.add(grid);
    });
    compactGrids.forEach(grid => {
        const visibleChildren = [...grid.children].filter(child => !child.classList.contains('hidden'));
        grid.classList.toggle('hidden', visibleChildren.length === 0);
        grid.classList.toggle('detail-grid-single', visibleChildren.length === 1);
    });
    document.getElementById('section-notes')?.classList.toggle('hidden', !String(acc.note || '').trim());

    // Banking
    renderAccountBanking(acc, {
        isReadOnly, isActive: active,
        onAddBanking: () => {
            if (!active()) return;
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
    document.getElementById('section-referente')?.classList.toggle(
        'hidden', ![refNome, refPhone, refMobile].some(value => String(value || '').trim())
    );

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
        btnAdd.classList.toggle('hidden', isReadOnly);
        btnAdd.onclick = () => { if (active() && !isReadOnly) openSourceSelector(); };
    }
}

function setupActions(active, fileInputs = new Set()) {
    // Phone Call Buttons (CSP Compliant)
    const phone = document.getElementById('btn-call-ref-phone');
    if (phone) phone.onclick = () => {
        if (!active()) return;
        const val = document.getElementById('ref-phone')?.value;
        if (val) window.location.href = `tel:${val.replace(/\s+/g, '')}`;
    };

    const mobile = document.getElementById('btn-call-ref-mobile');
    if (mobile) mobile.onclick = () => {
        if (!active()) return;
        const val = document.getElementById('ref-mobile')?.value;
        if (val) window.location.href = `tel:${val.replace(/\s+/g, '')}`;
    };

    // Copy Buttons logic
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = () => {
            if (!active()) return;
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
            if (!active()) return;
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
            if (!active()) return;
            const url = document.getElementById('detail-website')?.value;
            if (url && !openExternalUrl(url)) showToast('Indirizzo non valido.', 'error');
        };
    }

    // Copy Note
    const copyNoteBtn = document.getElementById('copy-note');
    if (copyNoteBtn) {
        copyNoteBtn.onclick = () => {
            if (!active()) return;
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
            if (!active()) return;
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
            if (!active()) return;
            e.preventDefault();
            closeSourceSelector();
        };
    }

    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.onclick = (e) => {
            if (!active()) return;
            if (e.target === modal) closeSourceSelector();
        };
    }

    // Hidden inputs listeners
    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        let input = document.getElementById(id);
        if (input?.cloneNode && input.parentNode) {
            const fresh = input.cloneNode(true); fresh.value = '';
            input.parentNode.replaceChild(fresh, input); input = fresh;
        }
        if (input) fileInputs.add(input);
        if (input) input.onchange = e => { if (active() && !isReadOnly) handleFileUpload(e.target); };
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
