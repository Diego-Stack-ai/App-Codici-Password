/**
 * DETTAGLIO ACCOUNT AZIENDA MODULE (V4.1)
 * Visualizzazione dettagliata credenziali e coordinate bancarie aziendali.
 */

import { auth, db, storage } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import {
    doc, getDoc, updateDoc, increment,
    collection, addDoc, query, orderBy, getDocs, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

// --- STATE ---
let currentUid = null;
let currentId = null;
let currentAziendaId = null;
let originalData = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');
    currentAziendaId = urlParams.get('aziendaId');

    if (!currentId || !currentAziendaId) {
        showToast("Parametri mancanti", "error");
        setTimeout(() => history.back(), 1000);
        return;
    }

    initBaseUI();

    observeAuth(async (user) => {
        if (user) {
            currentUid = user.uid;
            await loadAccount(currentId);
        } else {
            window.location.href = 'index.html';
        }
    });

    setupListeners();
});

function initBaseUI() {
    console.log('[dettaglio_account_azienda] UI Base gestita da main.js');
}

async function loadAccount(id) {
    try {
        const docRef = doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showToast(t('error_not_found') || "Account non trovato", "error");
            return;
        }

        originalData = { id: docSnap.id, ...docSnap.data() };
        updateDoc(docRef, { views: increment(1) }).catch(e => logError("UpdateViews", e));

        render(originalData);
        await loadAttachments();

    } catch (e) {
        logError("LoadAccount", e);
        showToast(t('error_generic'), "error");
    }
}

function render(acc) {
    document.title = acc.nomeAccount || 'Dettaglio Azienda';

    // Aggiorna titolo Header (quello creato da initComponents)
    const hTitle = document.querySelector('.base-header .header-title');
    if (hTitle) {
        hTitle.textContent = acc.nomeAccount || t('without_name');
    }

    // Inietta pulsante Edit nel Footer (specifico per questa pagina)
    const fRight = document.getElementById('footer-right-actions');
    if (fRight) {
        clearElement(fRight);
        setChildren(fRight, [
            createElement('button', {
                id: 'btn-edit-footer',
                className: 'btn-icon-header',
                onclick: () => window.location.href = `form_account_azienda.html?id=${currentId}&aziendaId=${currentAziendaId}`
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
            ])
        ]);
    }

    const heroTitle = document.getElementById('hero-title');
    if (heroTitle) heroTitle.textContent = acc.nomeAccount || '-';

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

    // Fields
    const setF = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = val || '';
        else el.textContent = val || '-';
    };

    setF('detail-nomeAccount', acc.nomeAccount);
    setF('detail-username', acc.username);
    setF('detail-account', acc.account || acc.codice);
    setF('detail-password', acc.password);
    setF('detail-website', acc.url || acc.sitoWeb);
    setF('detail-note', acc.note);

    // Banking
    const hasBanking = !!acc.isBanking;
    const sectionBanking = document.getElementById('section-banking');
    if (sectionBanking) sectionBanking.classList.toggle('hidden', !hasBanking);

    if (hasBanking) {
        const bankingContent = document.getElementById('banking-content');
        if (bankingContent) {
            const bankingArr = Array.isArray(acc.banking) ? acc.banking :
                (acc.banking?.iban ? [acc.banking] :
                    (acc.iban ? [{ iban: acc.iban }] : []));

            const rows = bankingArr.map(bank => createElement('div', {
                className: 'space-y-4 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 border-glow relative'
            }, [
                createElement('div', { className: 'bg-black/20 p-2.5 rounded-xl border border-white/5' }, [
                    createElement('div', { className: 'micro-data-row' }, [
                        createElement('span', { className: 'micro-data-label', textContent: 'IBAN' }),
                        createElement('span', { className: 'micro-data-value text-emerald-400 font-mono tracking-wider truncate', textContent: bank.iban || '-' }),
                        createElement('button', {
                            className: 'micro-btn-copy-inline relative z-10',
                            onclick: () => copyToClipboard(bank.iban)
                        }, [
                            createElement('span', { className: 'material-symbols-outlined !text-[14px]', textContent: 'content_copy' })
                        ])
                    ])
                ])
            ]));
            setChildren(bankingContent, rows);
        }
    }

    // --- ALLEGATI: Aggancio Listener ---
    const btnAdd = document.getElementById('btn-add-attachment');
    if (btnAdd) {
        btnAdd.onclick = openSourceSelector;
    }
}

function setupListeners() {
    // Copy Inputs
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = () => {
            const input = btn.parentElement.querySelector('input');
            if (input) copyToClipboard(input.value);
        };
    });

    // Copy Notes
    const copyNoteBtn = document.getElementById('copy-note');
    if (copyNoteBtn) {
        copyNoteBtn.onclick = () => {
            const t = document.getElementById('detail-note').textContent;
            copyToClipboard(t);
        };
    }

    // Password Toggle
    const toggle = document.getElementById('toggle-password');
    const passInput = document.getElementById('detail-password');
    if (toggle && passInput) {
        toggle.onclick = () => {
            const isMasked = passInput.classList.contains('base-shield');
            passInput.classList.toggle('base-shield');
            passInput.type = isMasked ? "text" : "password";
            const icon = toggle.querySelector('span');
            if (icon) icon.textContent = isMasked ? 'visibility_off' : 'visibility';
        };
    }

    // Website
    const webBtn = document.getElementById('open-website');
    const webInput = document.getElementById('detail-website');
    if (webBtn && webInput) {
        webBtn.onclick = () => {
            let url = webInput.value.trim();
            if (url) {
                if (!url.startsWith('http')) url = 'https://' + url;
                window.open(url, '_blank');
            }
        };
    }

    // Banking Collapse
    const bankingBtn = document.getElementById('banking-toggle');
    if (bankingBtn) {
        bankingBtn.onclick = () => {
            const content = document.getElementById('banking-content');
            const chevron = document.getElementById('banking-chevron');
            if (content) content.classList.toggle('hidden');
            if (chevron) chevron.classList.toggle('rotate-180');
        };
    }

    // --- MODALE SELEZIONE SORGENTE ---
    const sourceModal = document.getElementById('source-selector-modal');
    if (sourceModal) {
        // Pulsanti Sorgente
        sourceModal.querySelectorAll('[data-source]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.source;
                const input = document.getElementById(`input-${type}`);
                if (input) input.click();
                closeSourceSelector();
            });
        });

        // Pulsante Annulla
        document.getElementById('btn-cancel-source')?.addEventListener('click', closeSourceSelector);
    }

    // Hidden Input Listeners
    ['input-camera', 'input-video', 'input-gallery', 'input-file'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => handleFileUpload(e.target));
    });
}

// --- ATTACHMENTS LOGIC ---

function openSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const ok = await showConfirmModal("CARICA ALLEGATO", `Vuoi caricare il file ${file.name}?`, "Carica", false);
    if (!ok) {
        input.value = '';
        return;
    }

    showToast("Caricamento in corso...", "info");

    try {
        const ext = file.name.split('.').pop();
        const timestamp = Date.now();
        const storagePath = `users/${currentUid}/aziende/${currentAziendaId}/accounts/${currentId}/attachments/${timestamp}_${file.name}`;
        const sRef = ref(storage, storagePath);

        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);

        const colRef = collection(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentId, "attachments");
        await addDoc(colRef, {
            name: file.name,
            url: url,
            storagePath: storagePath,
            type: file.type || 'application/octet-stream',
            size: file.size,
            createdAt: serverTimestamp()
        });

        showToast("Allegato caricato!", "success");
        await loadAttachments();
    } catch (e) {
        logError("UploadAttachment", e);
        showToast("Errore durante il caricamento", "error");
    } finally {
        input.value = '';
    }
}

async function loadAttachments() {
    const container = document.getElementById('attachments-list');
    if (!container) return;

    try {
        const colRef = collection(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentId, "attachments");
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);

        const attachments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAttachments(attachments);
    } catch (e) {
        logError("LoadAttachments", e);
    }
}

function renderAttachments(list) {
    const container = document.getElementById('attachments-list');
    if (!container) return;

    clearElement(container);

    if (list.length === 0) {
        container.appendChild(createElement('p', {
            className: 'text-[10px] text-white/20 uppercase text-center py-4',
            textContent: t('no_attachments') || 'Nessun allegato'
        }));
        return;
    }

    const items = list.map(a => {
        const type = (a.type || "").toLowerCase();
        let icon = 'description';
        let color = 'text-blue-400';
        if (type.includes('image')) { icon = 'image'; color = 'text-purple-400'; }
        else if (type.includes('video')) { icon = 'movie'; color = 'text-pink-400'; }
        else if (type.includes('pdf')) { icon = 'picture_as_pdf'; color = 'text-red-400'; }

        const date = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString() : '---';
        const size = (a.size / (1024 * 1024)).toFixed(2);

        return createElement('div', { className: 'glass-card flex items-center gap-3 p-3 group transition-all active:scale-[0.98]' }, [
            createElement('div', {
                className: 'size-10 rounded-xl bg-white/5 flex-center border border-white/10 shrink-0 cursor-pointer',
                onclick: () => window.open(a.url, '_blank')
            }, [
                createElement('span', { className: `material-symbols-outlined ${color} text-xl`, textContent: icon })
            ]),
            createElement('div', {
                className: 'flex-1 flex flex-col min-w-0 cursor-pointer',
                onclick: () => window.open(a.url, '_blank')
            }, [
                createElement('p', { className: 'text-xs font-bold text-white truncate', textContent: a.name }),
                createElement('span', { className: 'text-[9px] text-white/20 font-medium', textContent: `${size} MB • ${date}` })
            ]),
            createElement('button', {
                className: 'btn-icon-header opacity-20 group-hover:opacity-100 hover:text-red-400 transition-all',
                onclick: () => deleteAttachment(a)
            }, [
                createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'delete' })
            ])
        ]);
    });

    setChildren(container, items);
}

async function deleteAttachment(att) {
    const ok = await showConfirmModal("ELIMINA", `Sei sicuro di voler eliminare l'allegato ${att.name}?`, "Elimina", true);
    if (!ok) return;

    try {
        // Delete from Firestore
        const docRef = doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentId, "attachments", att.id);
        await deleteDoc(docRef);

        // Delete from Storage
        if (att.storagePath) {
            const sRef = ref(storage, att.storagePath);
            await deleteObject(sRef);
        }

        showToast("Allegato eliminato", "success");
        await loadAttachments();
    } catch (e) {
        logError("DeleteAttachment", e);
        showToast("Errore durante l'eliminazione", "error");
    }
}

function copyToClipboard(text) {
    if (!text || text === '-' || text === '') return;
    navigator.clipboard.writeText(text).then(() => {
        showToast(t('copied') || "Copiato!", "success");
    }).catch(e => logError("Copy", e));
}

function createSafeAccountIcon(name) {
    const initial = (name || 'A').charAt(0).toUpperCase();
    const gradients = [
        'from-blue-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-purple-500 to-indigo-600'
    ];
    let hash = 0;
    const str = name || 'Account';
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const g = gradients[Math.abs(hash) % gradients.length];

    return createElement('div', {
        className: `w-full h-full rounded-xl bg-gradient-to-br ${g} flex-center text-white font-bold text-4xl shadow-inner border border-white/20`
    }, [
        createElement('span', { className: 'uppercase tracking-tighter', textContent: initial })
    ]);
}

