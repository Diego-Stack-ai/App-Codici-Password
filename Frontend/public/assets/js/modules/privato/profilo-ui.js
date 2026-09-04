/**
 * PROFILO PRIVATO — UI MODULE (V1.0)
 * Avatar, label management, collapsible sections, custom dropdowns engine.
 * Estratto da profilo_privato.js.
 *
 * Init: initUIModule(getState)
 * Import graph (no circular deps):
 *   profilo_privato.js → profilo-ui.js → firebase, ui-core, dom-utils
 */

import { auth, db, storage } from '../../firebase-config.js?v=1.2.31';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal, showInputModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { createStorageObjectName, MAX_AVATAR_BYTES, validateAttachmentFile } from '../shared/attachment-security.js';

let _getState = null;

// Callback per aggiornare il modal aperto dopo modifica dropdown label
let _modalRefreshCallback = null;
/** Registra una funzione da chiamare dopo ogni modifica alle label nel modal aperto. */
export function setModalRefreshCallback(fn) { _modalRefreshCallback = fn; }

/**
 * Inizializza il modulo UI del profilo.
 * @param {Function} getState - () => { currentUserUid, profileLabels }
 */
export function initUIModule(getState) {
    _getState = getState;
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────

export function setupAvatarEdit() {
    const input = document.getElementById('avatar-input');
    const avatarImg = document.getElementById('profile-avatar');
    if (!input) return;

    input.onchange = async (e) => {
        const file = e.target.files[0];
        const { currentUserUid } = _getState();
        if (!file || !currentUserUid) return;
        try { validateAttachmentFile(file, { imageOnly: true, maxBytes: MAX_AVATAR_BYTES }); }
        catch (error) { showToast(error.message, 'error'); input.value = ''; return; }

        showToast(t('uploading_avatar') || 'Caricamento avatar...', 'info');
        try {
            const sRef = ref(storage, `users/${currentUserUid}/avatar_${createStorageObjectName(file)}`);
            await uploadBytes(sRef, file);
            const url = await getDownloadURL(sRef);
            await updateDoc(doc(db, 'users', currentUserUid), { photoURL: url });
            if (avatarImg) avatarImg.src = url;
            showToast(t('avatar_updated') || 'Avatar aggiornato!');
        } catch (error) {
            logError('AvatarUpload', error);
            showToast(t('error_upload'), 'error');
        }
    };
}

// ─── PERSONAL DATA COPY ───────────────────────────────────────────────────────

export function setupPersonalDataCopy() {
    const bind = (btnId, viewId) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.onclick = () => {
                const text = document.getElementById(viewId)?.textContent;
                if (text && text !== '-') {
                    navigator.clipboard.writeText(text);
                    showToast(t('copied') || 'Copiato!', 'success');
                }
            };
        }
    };
    bind('copy-nome', 'nome-view');
    bind('copy-cf', 'cf-view');
    bind('copy-nascita', 'birth_date-view');
}

// ─── PROFILE LABELS ───────────────────────────────────────────────────────────

export async function saveProfileLabels() {
    const { currentUserUid, profileLabels } = _getState();
    if (!currentUserUid) return;
    try {
        await updateDoc(doc(db, 'users', currentUserUid, 'settings', 'profileLabels'), profileLabels);
    } catch (e) {
        const { setDoc } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js');
        await setDoc(doc(db, 'users', currentUserUid, 'settings', 'profileLabels'), profileLabels);
    }
}

// ─── COLLAPSIBLE SECTIONS ─────────────────────────────────────────────────────

export function setupCollapsibleSections() {
    const headers = document.querySelectorAll('.collapsible-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sectionName = header.dataset.section;
            const container = document.getElementById(`${sectionName}-view-container`);
            if (!container) return;
            const isCollapsed = header.classList.contains('collapsed');
            if (isCollapsed) {
                header.classList.remove('collapsed');
                container.classList.remove('collapsed');
            } else {
                header.classList.add('collapsed');
                container.classList.add('collapsed');
            }
        });
    });
}

// ─── CUSTOM DROPDOWNS ENGINE ──────────────────────────────────────────────────

export function initProxyDropdowns() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.dropdown-trigger');
        const container = trigger?.closest('[data-custom-select]');
        const menu = container?.querySelector('.base-dropdown-menu');

        // Chiudi tutti gli altri
        document.querySelectorAll('.base-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });

        if (trigger && menu) {
            e.stopPropagation();
            menu.classList.toggle('show');
        } else if (!e.target.closest('.base-dropdown-menu')) {
            document.querySelectorAll('.base-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        }
    });
}

/**
 * Sincronizza il dropdown custom con il <select> nativo sottostante.
 * Costruisce i menu items con supporto edit/rename/delete delle voci.
 * @param {Element} container - Elemento [data-custom-select]
 * @param {string|null} configKey - Chiave in profileLabels (es. 'phoneLabels') per gestione voci
 */
export function syncCustomDropdowns(container, configKey = null) {
    const { profileLabels } = _getState();
    const select = container.querySelector('select');
    const labelEl = container.querySelector('.dropdown-label');
    const menu = container.querySelector('.base-dropdown-menu');

    if (!select || !labelEl || !menu) return;

    clearElement(menu);
    Array.from(select.options).forEach(opt => {
        const item = createElement('div', {
            className: `base-dropdown-item profile-dropdown-item ${opt.selected ? 'active' : ''}`,
            dataset: { value: opt.value },
        }, [
            createElement('span', { textContent: opt.textContent }),
            (configKey && opt.value !== '') ? createElement('div', { className: 'flex-center-row profile-label-actions' }, [
                createElement('button', {
                    className: 'btn-action-mini profile-label-action profile-label-edit',
                    onclick: async (ev) => {
                        ev.stopPropagation();
                        const newName = await showInputModal('Rinomina voce', opt.value, 'Nuovo nome etichetta...');
                        if (newName && newName.trim() && newName !== opt.value) {
                            const idx = profileLabels[configKey].indexOf(opt.value);
                            if (idx > -1) {
                                profileLabels[configKey][idx] = newName.trim();
                                await saveProfileLabels();
                                showToast('Voce aggiornata!');
                                _modalRefreshCallback?.();
                            }
                        }
                    }
                }, [createElement('span', { className: 'material-symbols-outlined profile-label-action-icon', textContent: 'edit' })]),
                createElement('button', {
                    className: 'btn-action-mini profile-label-action profile-label-delete',
                    onclick: async (ev) => {
                        ev.stopPropagation();
                        const okDel = await showConfirmModal(`Eliminare "${opt.value}"?`);
                        if (okDel) {
                            profileLabels[configKey] = profileLabels[configKey].filter(v => v !== opt.value);
                            await saveProfileLabels();
                            showToast('Voce eliminata!');
                            _modalRefreshCallback?.();
                        }
                    }
                }, [createElement('span', { className: 'material-symbols-outlined profile-label-action-icon', textContent: 'delete' })])
            ]) : null
        ]);

        item.onclick = (e) => {
            if (e.target.closest('button')) return;
            e.stopPropagation();
            select.value = opt.value;
            select.dispatchEvent(new Event('change'));
            labelEl.textContent = opt.textContent;
            menu.classList.remove('show');
            menu.querySelectorAll('.base-dropdown-item').forEach(i => i.classList.toggle('active', i.dataset.value === select.value));
        };
        menu.appendChild(item);
    });

    // Pulsante "Aggiungi voce"
    if (configKey) {
        const btnAdd = createElement('div', {
            className: 'base-dropdown-item profile-label-add',
            onclick: async (e) => {
                e.stopPropagation();
                const newLabel = await showInputModal('Aggiungi voce', '', 'Nome nuova etichetta...');
                if (newLabel && newLabel.trim()) {
                    if (!profileLabels[configKey].includes(newLabel.trim())) {
                        profileLabels[configKey].push(newLabel.trim());
                        await saveProfileLabels();
                        showToast('Voce aggiunta!');
                        _modalRefreshCallback?.();
                    } else {
                        showToast('Voce già esistente', 'info');
                    }
                }
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined profile-label-add-icon', textContent: 'add_circle' }),
            createElement('span', { textContent: 'Aggiungi voce...' })
        ]);
        menu.appendChild(btnAdd);
    }

    const initialOpt = select.options[select.selectedIndex];
    if (initialOpt) labelEl.textContent = initialOpt.textContent;
}
