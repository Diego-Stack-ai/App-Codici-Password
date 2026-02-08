/**
 * DETTAGLIO ACCOUNT PRIVATO (V4.3)
 * Visualizzazione dettagli, gestione banking e condivisioni.
 */

import { auth, db, storage } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import {
    doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, setChildren, clearElement, createSafeAccountIcon } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError, formatDateToIT } from '../../utils.js';
import { initComponents } from '../../components.js';

// --- STATE ---
let currentUid = null;
let currentId = null;
let ownerId = null;
let isReadOnly = false;
let accountData = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentId = params.get('id');

    if (!currentId) {
        showToast(t('missing_id') || "ID mancante", "error");
        window.location.href = 'account_privati.html';
        return;
    }

    observeAuth(async (user) => {
        if (user) {
            currentUid = user.uid;
            ownerId = params.get('ownerId') || user.uid;
            isReadOnly = (ownerId !== currentUid);

            // Inizializza Header e Footer secondo Protocollo Base
            await initComponents();

            // NAVIGAZIONE GERARCHICA: Override pulsante Back per tornare alla LISTA (non history back)
            const hLeft = document.getElementById('header-left');
            if (hLeft) {
                clearElement(hLeft);
                setChildren(hLeft, createElement('button', {
                    className: 'btn-icon-header',
                    onclick: () => window.location.href = 'account_privati.html'
                }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
                ]));
            }

            // Aggiungi pulsante Edit nel footer (solo se non è read-only)
            if (!isReadOnly) {
                const fCenter = document.getElementById('footer-center-actions');
                if (fCenter) {
                    clearElement(fCenter);
                    const editBtn = createElement('button', {
                        id: 'btn-edit-footer',
                        className: 'btn-floating-add bg-accent-blue'
                    }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
                    ]);
                    editBtn.onclick = () => {
                        console.log('[dettaglio] Navigating to form with ID:', currentId);
                        window.location.href = `form_account_privato.html?id=${currentId}`;
                    };
                    setChildren(fCenter, editBtn);
                }
            }

            if (isReadOnly) setupReadOnlyUI();
            await loadAccount();
        }
    });

    setupActions();
});

/**
 * LOADING ENGINE
 */
async function loadAccount() {
    try {
        let docRef = doc(db, "users", ownerId, "accounts", currentId);
        let snap = await getDoc(docRef);

        if (!snap.exists()) {
            const q = query(collection(db, "users", ownerId, "accounts"), where("id", "==", currentId));
            const qSnap = await getDocs(q);
            if (qSnap.empty) { showToast(t('account_not_found'), "error"); return; }
            snap = qSnap.docs[0];
            docRef = snap.ref;
        }

        accountData = { id: snap.id, ...snap.data() };
        if (!isReadOnly) updateDoc(docRef, { views: increment(1) }).catch(console.warn);

        renderAccount(accountData);
        await loadAttachments();
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

    // Banking
    renderBanking(acc);

    // Gestione Suggerimento Conto Bancario
    const hasRealBanking = checkRealBankingData(acc);
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

    if (acc.shared || acc.isMemoShared) {
        const mgmt = document.getElementById('shared-management-section');
        if (mgmt) mgmt.classList.remove('hidden');
        renderGuests(acc.sharedWith || []);
    }

    // --- ALLEGATI: Aggancio Listener ---
    const btnAdd = document.getElementById('btn-add-attachment');
    if (btnAdd) {
        if (isReadOnly) {
            btnAdd.classList.add('hidden');
        } else {
            btnAdd.classList.remove('hidden');
            btnAdd.onclick = openSourceSelector;
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

    // Normalizzazione dati per compatibilità:
    // Supportiamo l'array 'banking' (standard attuale) o i campi a radice (legacy)
    let bankingArr = [];
    if (Array.isArray(acc.banking)) {
        bankingArr = acc.banking;
    } else if (acc.iban || hasCardsAtRoot) {
        bankingArr = [{
            iban: acc.iban || '',
            cards: acc.cards || [],
            passwordDispositiva: acc.passwordDispositiva || '',
            referenteNome: acc.referenteNome || '',
            referenteTelefono: acc.referenteTelefono || '',
            referenteCellulare: acc.referenteCellulare || ''
        }];
    }

    // Double check: if still no banking array or empty elements, hide
    const hasRealBankingData = bankingArr.some(bank => {
        const hasIban = bank.iban && bank.iban.trim().length > 0;
        const hasDisp = bank.passwordDispositiva && bank.passwordDispositiva.trim().length > 0;
        const hasCards = bank.cards && bank.cards.some(c => c.cardNumber?.trim() || c.cardType?.trim() || c.pin?.trim() || c.ccv?.trim());
        const hasRef = (bank.referenteTelefono?.trim() || bank.referenteCellulare?.trim());
        return hasIban || hasDisp || hasCards || hasRef;
    });

    if (!hasRealBankingData) {
        section.classList.add('hidden');
        return;
    }

    bankingArr.forEach((bank, idx) => {
        const card = createElement('div', { className: 'space-y-4 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 border-glow relative' }, [
            createElement('div', { className: 'flex items-center justify-between border-b border-white/5 pb-2' }, [
                createElement('span', { className: 'text-[9px] font-black text-emerald-500 uppercase tracking-widest', textContent: `${t('account') || 'Conto'} #${idx + 1}` })
            ]),
            // IBAN
            createElement('div', { className: 'bg-black/20 p-2.5 rounded-xl border border-white/5' }, [
                createMicroRow(t('iban') || 'IBAN', bank.iban || '-', true)
            ]),
            // Secondary Data
            createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' }, [
                createElement('div', { className: 'bg-black/20 p-2.5 rounded-xl border border-white/5 h-full' }, [
                    createMicroRow('Pass. Disp.', bank.passwordDispositiva || '••••••••', true, true)
                ]),
                createElement('div', { className: 'bg-black/20 p-2.5 rounded-xl border border-white/5 h-full' }, [
                    createMicroRow('Nota', bank.nota || '-')
                ])
            ]),
            // Referent
            createElement('div', { className: 'bg-emerald-500/10 p-3 rounded-xl border border-white/5 space-y-2.5' }, [
                createElement('div', { className: 'flex items-center gap-2 text-emerald-500/80' }, [
                    createElement('span', { className: 'material-symbols-outlined text-xs', textContent: 'contact_emergency' }),
                    createElement('span', { className: 'text-[9px] font-black uppercase tracking-widest', textContent: 'Referente' })
                ]),
                createElement('div', { className: 'text-[11px] font-black uppercase', textContent: bank.referenteNome || '-' }),
                createElement('div', { className: 'flex flex-col gap-2' }, [
                    createCallBtn('call', bank.referenteTelefono),
                    createCallBtn('smartphone', bank.referenteCellulare)
                ])
            ]),
            // Cards Section
            bank.cards && bank.cards.length > 0 ? createElement('div', { className: 'space-y-2' }, [
                createElement('div', { className: 'text-[9px] font-black text-white/40 uppercase tracking-widest px-1', textContent: 'Carte / Bancomat' }),
                ...bank.cards.map(c => createElement('div', { className: 'bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-2 border-glow' }, [
                    createElement('div', { className: 'text-[10px] font-black text-emerald-400 uppercase', textContent: c.cardType || c.type || 'Carta' }),
                    createMicroRow('Titolare', c.titolare || '-'),
                    createMicroRow('Numero', c.cardNumber || '-', true),
                    createMicroRow('Scadenza', c.expiry || '-'),
                    createMicroRow('PIN', c.pin || '••••', true, true),
                    createMicroRow('CCV', c.ccv || '-', true, true)
                ]))
            ]) : null
        ]);
        content.appendChild(card);
    });
}

function createMicroRow(label, value, copy = false, shield = false) {
    const valEl = createElement('span', { className: `micro-data-value ${shield ? 'base-shield' : ''}`, textContent: value });
    return createElement('div', { className: 'micro-data-row' }, [
        createElement('span', { className: 'micro-data-label', textContent: label }),
        valEl,
        copy ? createElement('button', {
            className: 'micro-btn-copy-inline relative z-10',
            onclick: () => { navigator.clipboard.writeText(value); showToast(t('copied') || "Copiato!"); }
        }, [createElement('span', { className: 'material-symbols-outlined !text-[14px]', textContent: 'content_copy' })]) : null,
        shield ? createElement('button', {
            className: 'micro-btn-copy-inline relative z-10 !bg-transparent',
            onclick: (e) => {
                const isMasked = valEl.classList.toggle('base-shield');
                e.currentTarget.querySelector('span').textContent = isMasked ? 'visibility' : 'visibility_off';
            }
        }, [createElement('span', { className: 'material-symbols-outlined !text-[14px]', textContent: 'visibility' })]) : null
    ]);
}

function createCallBtn(icon, num) {
    return createElement('div', {
        className: 'micro-data-row bg-black/20 p-2 rounded-lg border border-white/5 cursor-pointer hover:bg-emerald-500/10 transition-all group',
        onclick: () => { if (num) window.location.href = `tel:${num.replace(/\s+/g, '')}`; }
    }, [
        createElement('span', { className: 'material-symbols-outlined text-[14px] text-emerald-500/50 group-hover:text-emerald-400', textContent: icon }),
        createElement('span', { className: 'micro-data-value text-[10px] font-bold group-hover:text-primary', textContent: num || '-' })
    ]);
}

/**
 * GUESTS
 */
async function renderGuests(guests) {
    const list = document.getElementById('guests-list');
    if (!list) return;
    clearElement(list);

    if (!guests || guests.length === 0) {
        list.appendChild(createElement('p', { className: 'text-xs text-white/40 italic ml-1', textContent: t('no_active_access') || 'Nessun accesso attivo' }));
        return;
    }

    // Mappa per aggiornamenti batch se necessario
    let needsUpdate = false;
    let updatedGuests = [...guests];

    for (let i = 0; i < guests.length; i++) {
        let item = guests[i];

        // Normalizzazione item stringa vs oggetto
        if (typeof item !== 'object') {
            item = { email: item, status: 'accepted' };
        }

        if (item.status === 'rejected') continue;

        const displayEmail = item.email;
        let isPending = item.status === 'pending';
        let displayStatus = t('status_pending') || 'In attesa';
        let statusClass = 'bg-orange-500/20 text-orange-400 border-orange-500/20 animate-pulse';

        // LIVE STATUS CHECK
        if (isPending) {
            try {
                // Cerchiamo l'invito reale corrispondente
                // Nota: L'ID invito è costruito come accountId_emailSanitized
                const inviteId = `${currentId}_${displayEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const invSnap = await getDoc(doc(db, "invites", inviteId));

                if (invSnap.exists()) {
                    const invData = invSnap.data();
                    if (invData.status === 'accepted') {
                        // AGGIORNAMENTO UI
                        isPending = false;
                        displayStatus = t('status_accepted') || 'Accettato';
                        statusClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';

                        // Preparo aggiornamento persistente
                        updatedGuests[i] = { ...item, status: 'accepted' };
                        needsUpdate = true;
                    } else if (invData.status === 'rejected') {
                        // Se rifiutato, lo saltiamo visivamente (o mostriamo rifiutato)
                        updatedGuests[i] = { ...item, status: 'rejected' };
                        needsUpdate = true;
                        continue;
                    }
                }
            } catch (e) { console.warn("LiveCheck failed", e); }
        } else {
            displayStatus = t('status_accepted') || 'Accettato';
            statusClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
        }

        const div = createElement('div', { className: 'rubrica-list-item flex items-center justify-between' }, [
            createElement('div', { className: 'rubrica-item-info-row' }, [
                createElement('div', { className: 'rubrica-item-avatar', textContent: displayEmail.charAt(0).toUpperCase() }),
                createElement('div', { className: 'rubrica-item-info' }, [
                    createElement('p', { className: 'truncate m-0 rubrica-item-name', textContent: displayEmail.split('@')[0] }),
                    createElement('p', { className: 'truncate m-0 opacity-60 text-[10px]', textContent: displayEmail })
                ])
            ]),
            createElement('span', {
                className: `ml-auto text-[8px] font-black uppercase px-2 py-1 rounded border ${statusClass}`,
                textContent: displayStatus
            })
        ]);
        list.appendChild(div);
    }

    // SELF-HEALING: Se abbiamo rilevato cambiamenti di stato, aggiorniamo il documento
    if (needsUpdate && !isReadOnly) {
        try {
            await updateDoc(doc(db, "users", currentUid, "accounts", currentId), { sharedWith: updatedGuests });
            console.log("Account sharedWith list auto-updated based on invites status.");
        } catch (e) { console.error("SelfHealing update failed", e); }
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
            if (url) window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
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

    // Listeners for hidden inputs
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
        const timestamp = Date.now();
        const storagePath = `users/${ownerId}/accounts/${currentId}/attachments/${timestamp}_${file.name}`;
        const sRef = ref(storage, storagePath);

        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);

        const colRef = collection(db, "users", ownerId, "accounts", currentId, "attachments");
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
        const colRef = collection(db, "users", ownerId, "accounts", currentId, "attachments");
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
            !isReadOnly ? createElement('button', {
                className: 'btn-icon-header opacity-20 group-hover:opacity-100 hover:text-red-400 transition-all',
                onclick: () => deleteAttachment(a)
            }, [
                createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'delete' })
            ]) : null
        ]);
    });

    setChildren(container, items);
}

async function deleteAttachment(att) {
    const ok = await showConfirmModal("ELIMINA", `Sei sicuro di voler eliminare l'allegato ${att.name}?`, "Elimina", true);
    if (!ok) return;

    try {
        // Delete from Firestore
        const docRef = doc(db, "users", ownerId, "accounts", currentId, "attachments", att.id);
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
