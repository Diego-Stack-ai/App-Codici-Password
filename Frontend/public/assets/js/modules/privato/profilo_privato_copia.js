/**
 * PROFILO PRIVATO COPIA MODULE (V5.0 HYBRID)
 * Gestisce la visualizzazione del profilo con layout stile Impostazioni.
 */

import { auth, db, storage } from '../../../firebase-config.js';
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, setChildren, clearElement } from '../../../dom-utils.js';
import { showToast, showConfirmModal } from '../../../ui-core.js';
import { t } from '../../../translations.js';
import { ensureQRCodeLib, renderQRCode } from '../../shared/qr_code_utils.js';

let currentUser = null;
let profileData = {};
let unsubscribe = null;

export async function initProfiloPrivatoCopia(user) {
    console.log("[PROFILO-COPIA] Init V5.0...");
    if (!user) return;
    currentUser = user;

    await ensureQRCodeLib();
    setupListeners();
    startRealtimeUpdates();
}

function setupListeners() {
    // Avatar Click
    const avatarTrigger = document.getElementById('avatar-trigger');
    const avatarInput = document.getElementById('avatar-input');
    if (avatarTrigger && avatarInput) {
        avatarTrigger.onclick = () => avatarInput.click();
        avatarInput.onchange = (e) => handleAvatarUpload(e.target.files[0]);
    }

    // QR Toggles
    const qrToggles = document.querySelectorAll('.qr-checkbox');
    qrToggles.forEach(chk => {
        chk.onchange = () => updateQRCode();
    });

    // Copy Buttons
    ['nome', 'cf'].forEach(id => {
        const btn = document.getElementById(`copy-${id}`);
        if (btn) {
            btn.onclick = () => {
                const text = document.getElementById(`${id}-view`)?.textContent;
                if (text && text !== '-') {
                    navigator.clipboard.writeText(text).then(() => showToast(t('copied'), "success"));
                }
            };
        }
    });

    // Zoom QR
    const qrPreview = document.getElementById('qrcode-preview');
    if (qrPreview) {
        qrPreview.onclick = () => {
            const qrCanvas = document.querySelector('#qrcode-header canvas');
            if (qrCanvas) {
                // Semplice zoom usando una modale o un sistema dedicato
                showToast("Dettaglio QR non ancora implementato in questa copia", "info");
            }
        };
    }
}

function startRealtimeUpdates() {
    const docRef = doc(db, "users", currentUser.uid);
    unsubscribe = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            profileData = snap.data();
            renderProfile();
            updateQRCode();
        }
    }, (error) => {
        console.error("Profile updates error:", error);
    });
}

function renderProfile() {
    // Basic Info
    const displayName = profileData.firstName && profileData.lastName
        ? `${profileData.firstName} ${profileData.lastName}`
        : (profileData.displayName || currentUser.email);

    document.getElementById('user-display-name').textContent = displayName;
    document.getElementById('user-display-email').textContent = currentUser.email;

    // Avatar
    if (profileData.photoURL) {
        document.getElementById('profile-avatar').src = profileData.photoURL;
    }

    // Fields
    document.getElementById('nome-view').textContent = displayName;
    document.getElementById('cf-view').textContent = profileData.cf || '-';
    document.getElementById('note-view').textContent = profileData.notes || t('no_notes');
}

function updateQRCode() {
    const container = document.getElementById('qrcode-header');
    if (!container) return;

    // Costruisco vCard dinamica basata sui toggle
    let vcard = "BEGIN:VCARD\nVERSION:3.0\n";

    if (document.getElementById('qr-toggle-nome')?.checked) {
        vcard += `FN:${profileData.firstName || ''} ${profileData.lastName || ''}\n`;
    }

    if (document.getElementById('qr-toggle-cf')?.checked && profileData.cf) {
        vcard += `NOTE:CF: ${profileData.cf}\n`;
    }

    vcard += "END:VCARD";

    renderQRCode(container, vcard, {
        width: 80,
        height: 80,
        colorDark: "#000000",
        colorLight: "#ffffff"
    });
}

async function handleAvatarUpload(file) {
    if (!file) return;
    try {
        showToast(t('uploading'), "info");
        const fileRef = ref(storage, `avatars/${currentUser.uid}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);

        // Update Firestore
        const { setDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
        await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });

        showToast(t('success_upload'), "success");
    } catch (e) {
        console.error(e);
        showToast(t('error_upload'), "error");
    }
}
