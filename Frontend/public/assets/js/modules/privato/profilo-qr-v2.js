/**
 * PROFILO PRIVATO — QR CODE MODULE (V1.0)
 * Gestione QR Code del profilo: toggles, generazione vCard, modal ingrandimento.
 * Estratto da profilo_privato.js.
 *
 * Init: initQRModule(getState, renders)
 * Import graph (no circular deps):
 *   profilo_privato.js → profilo-qr.js → qr_code_utils.js, firebase
 */

import { db } from '../../firebase-config.js?v=1.2.39';
import { doc, updateDoc } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, clearElement } from '../../dom-utils.js';
import { ensureQRCodeLib, buildVCard, renderQRCode } from '../shared/qr_code_utils-v2.js';

let _getState = null;
let _renders = null;

/**
 * Inizializza il modulo QR.
 * @param {Function} getState - () => { qrCodeInclusions, currentUserUid, currentUserData, contactPhones, contactEmails, userAddresses }
 * @param {{ renderPhonesView: Function, renderEmailsView: Function, renderAddressesView: Function }} renders
 */
export function initQRModule(getState, renders) {
    _getState = getState;
    _renders = renders;
}
export function setupQRToggles() {
    const toggles = [
        { id: 'qr-toggle-nome', field: 'nome' },
        { id: 'qr-toggle-cf', field: 'cf' },
        { id: 'qr-toggle-nascita', field: 'nascita' }
    ];
    toggles.forEach(({ id, field }) => {
        const btn = document.getElementById(id);
        if (btn) {
            const { qrCodeInclusions } = _getState();
            btn.checked = qrCodeInclusions[field];
            btn.onclick = async () => {
                _getState().qrCodeInclusions[field] = btn.checked;
                await _saveQRInclusions();
                generateProfileQRCode();
            };
        }
    });
}

async function _saveQRInclusions() {
    const { currentUserUid, qrCodeInclusions } = _getState();
    if (!currentUserUid) return;
    try {
        await updateDoc(doc(db, 'users', currentUserUid, 'settings', 'qrCodeInclusions'), qrCodeInclusions);
    } catch (e) {
        const { setDoc } = await import('/assets/js/vendor/firebase-runtime.js');
        await setDoc(doc(db, 'users', currentUserUid, 'settings', 'qrCodeInclusions'), qrCodeInclusions);
    }
}

export async function toggleQRInclusion(type, itemId) {
    const { qrCodeInclusions } = _getState();
    const array = qrCodeInclusions[type];
    const index = array.indexOf(itemId);
    if (index > -1) {
        array.splice(index, 1);
    } else {
        array.push(itemId);
    }
    await _saveQRInclusions();

    if (type === 'emails') _renders.renderEmailsView();
    else if (type === 'phones') _renders.renderPhonesView();
    else if (type === 'addresses') _renders.renderAddressesView();

    generateProfileQRCode();
}

export async function setQRScalar(field, value) {
    _getState().qrCodeInclusions[field] = value === true;
    await _saveQRInclusions();
    setupQRToggles();
    generateProfileQRCode();
}

export function getProfileVCard() {
    const { currentUserData, qrCodeInclusions, contactPhones, contactEmails, userAddresses, customWidgets } = _getState();
    return buildVCard(currentUserData, qrCodeInclusions, {
        contactPhones, contactEmails, userAddresses,
        customFields: (customWidgets || []).flatMap(widget => widget.fields || [])
    });
}

export async function generateProfileQRCode() {
    if (!_getState) return;  // modulo non ancora inizializzato
    const { currentUserData, qrCodeInclusions, contactPhones, contactEmails, userAddresses, customWidgets } = _getState();
    await ensureQRCodeLib();
    const container = document.getElementById('qrcode-header');
    if (!container) return;
    const vcard = buildVCard(currentUserData, qrCodeInclusions, {
        contactPhones, contactEmails, userAddresses,
        customFields: (customWidgets || []).flatMap(widget => widget.fields || [])
    });
    clearElement(container);
    renderQRCode(container, vcard, { width: 104, height: 104, colorDark: '#000000', colorLight: '#E3F2FD', correctLevel: 2 });
    container.onclick = () => _showEnlargedQR(vcard);
    const zoomIcon = document.getElementById('qr-zoom-icon');
    if (zoomIcon) zoomIcon.onclick = () => _showEnlargedQR(vcard);
}

function _showEnlargedQR(vcard) {
    document.getElementById('qr-zoom-modal-dynamic')?.remove();
    const qrSize = Math.min(window.innerWidth * 0.7, 300);
    const modal = createElement('div', { id: 'qr-zoom-modal-dynamic', className: 'modal-overlay' }, [
        createElement('div', { className: 'modal-profile-box modal-box-qr' }, [
            createElement('h3', { className: 'modal-title', textContent: 'QR Code Profilo', dataset: { t: 'qr_code_profile' } }),
            createElement('div', { id: 'qr-enlarged', className: 'qr-zoom-container' }),
            createElement('button', {
                className: 'btn-modal btn-secondary',
                textContent: 'Chiudi',
                dataset: { t: 'close' },
                onclick: () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); }
            })
        ])
    ]);
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    modal.onclick = (e) => {
        if (e.target === modal) { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); }
    };
    renderQRCode(document.getElementById('qr-enlarged'), vcard, { width: qrSize, height: qrSize, colorDark: '#000000', colorLight: '#E3F2FD', correctLevel: 3 });
}
