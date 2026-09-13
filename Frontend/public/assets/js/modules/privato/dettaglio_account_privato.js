/**
 * DETTAGLIO ACCOUNT PRIVATO (V5.9.5)
 * Visualizzazione dettagli, gestione banking e condivisioni.
 */

import { auth, db } from '../../firebase-config.js?v=1.2.110';
import { LOG } from '../../logger.js';
import { doc, updateDoc, increment, onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement, createSafeAccountIcon } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
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
let requestedId = null;
let loadVersion = 0;
let ownerId = null;
let isReadOnly = false;
let accountData = null;
let requireServerRefresh = false;
let mounted = null;

function clearPrivateDetail(view = document) {
    for (const id of ['detail-nomeAccount', 'detail-username', 'detail-account', 'detail-password', 'detail-website',
        'detail-referenteNome', 'detail-referenteTelefono', 'detail-referenteCellulare', 'input-camera', 'input-gallery', 'input-file']) {
        const node = view.getElementById(id);
        if (node) { node.value = ''; node.onchange = null; }
    }
    const password = view.getElementById('detail-password');
    if (password) { password.type = 'password'; password.classList?.add('base-shield'); }
    for (const id of ['header-nome-account', 'hero-title', 'detail-note', 'attachments-list', 'guests-list', 'banking-content', 'footer-center-actions']) {
        const node = view.getElementById(id);
        if (node) { for (const input of node.querySelectorAll?.('input') || []) input.value = ''; clearElement(node); }
    }
    const avatar = view.getElementById('detail-avatar');
    if (avatar) { avatar.style.backgroundImage = 'none'; clearElement(avatar); }
    for (const node of view.querySelectorAll('.copy-btn, #btn-add-attachment, #toggle-password, #open-website, #copy-note, #banking-toggle')) node.onclick = null;
    const add = view.getElementById('btn-add-attachment');
    if (add) { add.onclick = null; add.classList.add('hidden'); }
    const modal = view.getElementById('source-selector-modal');
    if (modal) { modal.classList.remove('active'); modal.classList.add('hidden'); }
    for (const banner of view.querySelectorAll('.read-only-banner')) banner.remove();
    if (view.body) view.body.style.overflow = '';
}

// --- INITIALIZATION ---
/**
 * DETTAGLIO ACCOUNT PRIVATO MODULE (V5.0 ADAPTER)
 * Visualizzazione dettagli.
 * - Entry Point: initDettaglioAccountPrivato(user)
 */

export async function initDettaglioAccountPrivato(user, options = {}) {
    mounted?.destroy();
    if (!user) return {destroy() {}};
    loadVersion++;
    currentUid = user.uid;

    const params = new URLSearchParams(window.location.search);
    requestedId = params.get('id');
    currentId = null;
    accountData = null;
    const attachmentButton = document.getElementById('btn-add-attachment');
    if (attachmentButton) {
        attachmentButton.onclick = null;
        attachmentButton.classList.add('hidden');
    }
    requireServerRefresh = (params.get('afterWrite') === '1' || params.get('m6refresh') === '1') && navigator.onLine;

    if (!requestedId) {
        showToast(t('missing_id') || "ID mancante", "error");
        window.location.href = 'account_privati.html';
        return;
    }

    ownerId = params.get('ownerId') || user.uid;
    isReadOnly = (ownerId !== currentUid);
    const scope = Object.freeze({uid: currentUid, owner: ownerId, requestedId});
    const root = document.querySelector('.base-container');
    const owned = new Map();
    const selectors = new Map();
    const ownedView = {
        getElementById(id) { if (!owned.has(id)) owned.set(id, document.getElementById(id)); return owned.get(id); },
        querySelectorAll(selector) { if (!selectors.has(selector)) selectors.set(selector, [...document.querySelectorAll(selector)]); return selectors.get(selector); },
        body: document.body
    };
    clearPrivateDetail(ownedView);
    let disposed = false, unsubscribe = () => {};
    const mount = {scope, version: 0, resolvedId: null, loaded: false, banners: new Set(), loadAbort: new AbortController(),
        active() {
            if (!disposed && (mounted !== mount || options.signal?.aborted || root?.isConnected === false ||
                auth.currentUser?.uid !== scope.uid || (options.isActive && !options.isActive()))) mount.destroy();
            return !disposed;
        },
        destroy() {
            if (disposed) return;
            disposed = true; mount.loaded = false;
            mount.loadAbort.abort(); unsubscribe();
            for (const banner of mount.banners) banner?.remove();
            mount.banners.clear();
            options.signal?.removeEventListener('abort', mount.destroy);
            globalThis.removeEventListener?.('vault-session-locked', mount.destroy);
            globalThis.removeEventListener?.('pagehide', mount.destroy);
            if (mounted === mount) { accountData = null; currentId = null; clearPrivateDetail(ownedView); document.title = 'Dettaglio'; }
        }
    };
    mounted = mount;
    options.signal?.addEventListener('abort', mount.destroy, {once: true});
    globalThis.addEventListener?.('vault-session-locked', mount.destroy, {once: true});
    globalThis.addEventListener?.('pagehide', mount.destroy, {once: true});
    unsubscribe = onAuthStateChanged(auth, current => { if (current?.uid !== scope.uid) mount.destroy(); });
    if (!mount.active()) { unsubscribe(); return mount; }

    // No record actions are available until the repository resolves its physical ID.
    const footer = document.getElementById('footer-center-actions');
    if (footer) clearElement(footer);
    setupActions(() => mount.active() && mount.loaded);
    await loadAccount(mount);
    return mount;
}

function setupEditAction(resolvedId, active) {
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
                    if (!active() || !currentId || currentId !== resolvedId || isReadOnly) return;
                    window.location.href = `form_account_privato.html?id=${encodeURIComponent(resolvedId)}`;
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
            ]);
            setChildren(fCenter, createElement('div', { className: 'fab-group' }, [editBtn]));
        }
    }

}
/**
 * LOADING ENGINE
 */
async function loadAccount(mount = mounted) {
    if (!mount?.active()) return;
    mount.loadAbort.abort();
    mount.loadAbort = new AbortController();
    const signal = mount.loadAbort.signal;
    const version = ++mount.version;
    loadVersion++;
    mount.loaded = false;
    accountData = null;
    clearPrivateDetail();
    mount.banners.clear();
    const attachmentButton = document.getElementById('btn-add-attachment');
    if (attachmentButton) {
        attachmentButton.onclick = null;
        attachmentButton.classList.add('hidden');
    }
    const lookupId = mount.resolvedId || mount.scope.requestedId, lookupOwner = mount.scope.owner, lookupUid = mount.scope.uid;
    const readOnly = lookupOwner !== lookupUid;
    const active = () => mount.active() && version === mount.version && !signal.aborted;
    const actionActive = () => active() && mount.loaded;
    const decryptActive = async (value, key) => {
        if (!active()) throw new Error('PRIVATE_DETAIL_INVALIDATED');
        const clear = await decryptIfPossible(value, key);
        if (!active()) throw new Error('PRIVATE_DETAIL_INVALIDATED');
        return clear;
    };
    setupActions(actionActive);
    try {
        let loaded = await (requireServerRefresh
            ? getPrivateAccountConfirmed(lookupOwner, lookupId)
            : getPrivateAccount(lookupOwner, lookupId));
        if (!active()) return;
        if (!loaded) loaded = await findPrivateAccountByLegacyId(lookupOwner, lookupId);
        if (!active()) return;
        if (!loaded) { showToast(t('account_not_found'), "error"); return; }
        loaded = {...loaded};
        const resolvedId = loaded.id;
        mount.resolvedId = resolvedId;
        if (requireServerRefresh) {
            requireServerRefresh = false;
            const cleanParams = new URLSearchParams(window.location.search);
            cleanParams.delete('afterWrite');
            cleanParams.delete('m6refresh');
            const cleanQuery = cleanParams.toString();
            window.history.replaceState(null, '', `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}`);
        }
        const docRef = doc(db, "users", lookupOwner, "accounts", resolvedId);

        // 🔐 PROTOCOLLO BLINDA (Auto-Unlock Compliant)
        if (loaded._encrypted) {
            try {
                const vaultKeyMaterial = await ensureVaultKeyMaterial();
                if (!active()) return;
                [loaded.username, loaded.account, loaded.password, loaded.note] = await Promise.all([
                    decryptActive(loaded.username, vaultKeyMaterial),
                    decryptActive(loaded.account, vaultKeyMaterial),
                    decryptActive(loaded.password, vaultKeyMaterial),
                    decryptActive(loaded.note, vaultKeyMaterial)
                ]);
                if (!active()) return;
                if (Array.isArray(loaded.banking)) {
                    loaded.banking = await Promise.all(loaded.banking.map(async b => ({
                        ...b,
                        passwordDispositiva: await decryptActive(b.passwordDispositiva, vaultKeyMaterial),
                        cards: await Promise.all((b.cards || []).map(async c => ({
                            ...c,
                            cardNumber: await decryptActive(c.cardNumber, vaultKeyMaterial),
                            pin: await decryptActive(c.pin, vaultKeyMaterial),
                            ccv: await decryptActive(c.ccv, vaultKeyMaterial)
                        })))
                    })));
                }
            } catch (e) {
                if (!active()) return;
                console.warn("[Dettaglio] Decrittazione saltata o annullata.");
                showToast("Dati cifrati: sbloccare la Vault per visualizzare.", "warning");
            }
        }

        if (!active()) return;
        accountData = loaded;
        currentId = resolvedId;
        mount.loaded = true;
        const reload = () => mount.active() && loadAccount(mount);
        let confirmationPending = false;
        const confirm = (...args) => {
            if (!actionActive() || confirmationPending) return Promise.resolve(false);
            confirmationPending = true;
            const pending = showConfirmModal(...args);
            const modal = document.getElementById('protocol-confirm-modal');
            const cancel = () => { modal?.querySelector('#confirm-cancel-btn')?.click(); modal?.remove(); };
            signal.addEventListener('abort', cancel, {once: true});
            return pending.finally(() => { confirmationPending = false; signal.removeEventListener('abort', cancel); });
        };
        initPrivateAttachmentModule({ownerId: lookupOwner, accountId: resolvedId, readOnly, isActive: actionActive, signal, confirm});
        initPrivateSharingModule({currentUid: lookupUid, ownerId: lookupOwner, accountId: resolvedId, readOnly, onReload: reload, isActive: actionActive, signal, confirm});
        setupEditAction(resolvedId, actionActive);
        if (!readOnly) updateDoc(docRef, {views: increment(1)}).catch(error => { if (active()) logError('UpdateViews', error); });
        renderAccount(loaded, actionActive);
        const contactNames = await initDetailAccountMode({account: loaded, ownerId: lookupOwner, accountId: resolvedId, readOnly, onReload: reload, isActive: actionActive, signal, confirm});
        if (!active()) return;
        renderPrivateSharingMap(loaded, contactNames);
        await loadPrivateAttachments();
        if (!active()) return;
        const widgetContext = {uid: lookupUid, context: 'private', accountId: resolvedId, readOnly, active: actionActive, signal};
        const initWidget = async (module, name) => {
            if (!active()) return;
            const controller = await module[name](widgetContext);
            if (!active()) controller?.destroy();
        };
        import('../shared/account-shared-credentials.js?v=1.2.110').then(module => initWidget(module, 'initAccountSharedCredentials'))
            .catch(error => { if (active()) logError('SharedCredentials', error); });
        import('../shared/account-embedded-widgets.js?v=1.2.110').then(module => initWidget(module, 'initAccountEmbeddedWidgets'))
            .catch(error => { if (active()) logError('AccountWidgets', error); });
        setupActions(actionActive);
        if (readOnly) mount.banners.add(setupReadOnlyUI());
    } catch (e) {
        if (!active()) return;
        mount.loaded = false;
        logError("LoadAccount", e);
        showToast(t('error_loading'), "error");
    }
}

/**
 * RENDERING
 */
function renderAccount(acc, active) {
    const resolvedId = acc.id;
    const renderedVersion = loadVersion;
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

    // La consultazione mostra solo i dati realmente presenti. Il modulo di
    // modifica continua invece a offrire tutti i campi della struttura base.
    const compactGrids = new Set();
    ['detail-username', 'detail-account', 'detail-password', 'detail-website'].forEach(id => {
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

    // Toggle Referente Section visibility
    const hasRefData = !!(map['detail-referenteNome'] || map['detail-referenteTelefono'] || map['detail-referenteCellulare']);
    const secRef = document.getElementById('section-referente');
    if (secRef) secRef.classList.toggle('hidden', !hasRefData);

    renderAccountBanking(acc, {
        isReadOnly, isActive: active,
        promptText: t('banking_hint'),
        onAddBanking: () => {
            if (!active() || !currentId || currentId !== resolvedId || isReadOnly) return;
            window.location.href = `form_account_privato.html?id=${encodeURIComponent(resolvedId)}`;
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
                if (!active() || isReadOnly || !currentId || currentId !== resolvedId || loadVersion !== renderedVersion) return;
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
    return banner;
}

function setupActions(active) {
    // Copy Buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = () => {
            if (!active()) return;
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

}
