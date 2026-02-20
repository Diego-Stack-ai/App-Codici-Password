/**
 * DETTAGLIO ACCOUNT PRIVATO (V4.3)
 * Visualizzazione dettagli, gestione banking e condivisioni.
 */

import { auth, db, storage } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import {
    doc, getDoc, collection, query, where, getDocs, updateDoc,
    deleteDoc, onSnapshot, runTransaction, arrayUnion, arrayRemove, increment, serverTimestamp, orderBy
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
/**
 * DETTAGLIO ACCOUNT PRIVATO MODULE (V5.0 ADAPTER)
 * Visualizzazione dettagli.
 * - Entry Point: initDettaglioAccountPrivato(user)
 */

export async function initDettaglioAccountPrivato(user) {
    console.log("[DETTAGLIO] Init V5.0...");
    if (!user) return;
    currentUid = user.uid;

    const params = new URLSearchParams(window.location.search);
    currentId = params.get('id');

    if (!currentId) {
        showToast(t('missing_id') || "ID mancante", "error");
        window.location.href = 'account_privati.html';
        return;
    }

    ownerId = params.get('ownerId') || user.uid;
    isReadOnly = (ownerId !== currentUid);

    // NAVIGAZIONE GERARCHICA: Override pulsante Back
    const hLeft = document.getElementById('header-left');
    if (hLeft) {
        clearElement(hLeft);
        setChildren(hLeft, createElement('button', {
            className: 'btn-icon-header',
            onclick: () => window.location.replace('account_privati.html')
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
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('edit') || 'Modifica',
                onclick: () => {
                    console.log('[dettaglio] Navigating to form with ID:', currentId);
                    window.location.href = `form_account_privato.html?id=${currentId}`;
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
            ]);
            setChildren(fCenter, createElement('div', { className: 'fab-group' }, [editBtn]));
        }
    }

    if (isReadOnly) setupReadOnlyUI();
    setupActions();
    // Setup modal allegati (listener pulsanti sorgente)
    setupSourceSelector();

    await loadAccount();

    console.log("[DETTAGLIO] Ready.");
}

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
        if (!isReadOnly) initSharingMonitor(acc);
        else renderGuests(acc.sharedWithEmails || []);
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
                console.log("[DETTAGLIO] Add Attachment Clicked (onclick)");
                openSourceSelector();
            };
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
        const card = createElement('div', { className: 'banking-card' }, [
            createElement('div', { className: 'banking-header' }, [
                createElement('span', { className: 'banking-index', textContent: `${t('account') || 'Conto'} #${idx + 1}` })
            ]),
            // IBAN
            createElement('div', { className: 'banking-field-box' }, [
                createMicroRow(t('iban') || 'IBAN', bank.iban || '-', true)
            ]),
            // Secondary Data
            createElement('div', { className: 'banking-grid' }, [
                createElement('div', { className: 'banking-field-box h-full' }, [
                    createMicroRow('Pass. Disp.', bank.passwordDispositiva || '••••••••', true, true)
                ]),
                createElement('div', { className: 'banking-field-box h-full' }, [
                    createMicroRow('Nota', bank.nota || '-')
                ])
            ]),
            // Referent
            createElement('div', { className: 'banking-referent-box' }, [
                createElement('div', { className: 'referent-header' }, [
                    createElement('span', { className: 'material-symbols-outlined text-xs', textContent: 'contact_emergency' }),
                    createElement('span', { className: 'referent-title', textContent: 'Referente' })
                ]),
                createElement('div', { className: 'referent-name', textContent: bank.referenteNome || '-' }),
                createElement('div', { className: 'flex-col-gap-2' }, [
                    createCallBtn('call', bank.referenteTelefono),
                    createCallBtn('smartphone', bank.referenteCellulare)
                ])
            ]),
            // Cards Section
            bank.cards && bank.cards.length > 0 ? createElement('div', { className: 'cards-section' }, [
                createElement('div', { className: 'cards-title', textContent: 'Carte / Bancomat' }),
                ...bank.cards.map(c => createElement('div', { className: 'card-item' }, [
                    createElement('div', { className: 'card-type', textContent: c.cardType || c.type || 'Carta' }),
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
        }, [createElement('span', { className: 'material-symbols-outlined icon-xs', textContent: 'content_copy' })]) : null,
        shield ? createElement('button', {
            className: 'micro-btn-copy-inline relative z-10 !bg-transparent',
            onclick: (e) => {
                const isMasked = valEl.classList.toggle('base-shield');
                e.currentTarget.querySelector('span').textContent = isMasked ? 'visibility' : 'visibility_off';
            }
        }, [createElement('span', { className: 'material-symbols-outlined icon-xs', textContent: 'visibility' })]) : null
    ]);
}

function createCallBtn(icon, num) {
    return createElement('div', {
        className: 'call-btn-row',
        onclick: () => { if (num) window.location.href = `tel:${num.replace(/\s+/g, '')}`; }
    }, [
        createElement('span', { className: 'material-symbols-outlined call-icon', textContent: icon }),
        createElement('span', { className: 'call-number', textContent: num || '-' })
    ]);
}

/**
 * SHARING MONITOR & CONSISTENCY (HARDENING V2)
 */
let sharingUnsubscribe = null;

function initSharingMonitor(account) {
    if (sharingUnsubscribe) sharingUnsubscribe();

    console.log("[SharingMonitor] Initializing Realtime Check...");
    const q = query(collection(db, "invites"), where("accountId", "==", currentId), where("senderId", "==", currentUid));

    sharingUnsubscribe = onSnapshot(q, async (snap) => {
        const invites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const listContainer = document.getElementById('guests-list');
        if (!listContainer) return;

        clearElement(listContainer);

        const currentEmails = account.sharedWithEmails || [];
        const isSharingFlagActive = account.shared || account.isMemoShared;

        let needsHealing = false;

        for (const inv of invites) {
            // REGOLA C: Pending ed account non condiviso -> Delete
            if (inv.status === 'pending' && !isSharingFlagActive) {
                console.warn("[AutoHealing] Rule C: Deleting orphan pending invite.");
                await deleteDoc(doc(db, "invites", inv.id));
                continue;
            }

            // REGOLA A: Accepted ma non in array -> Add
            if (inv.status === 'accepted' && !currentEmails.includes(inv.recipientEmail)) {
                console.warn("[AutoHealing] Rule A: Resyncing missing email to account array.");
                await updateDoc(doc(db, "users", currentUid, "accounts", currentId), {
                    sharedWithEmails: arrayUnion(inv.recipientEmail)
                });
                needsHealing = true;
            }

            // REGOLA D: Email in array ma invite 'rejected' -> Remove (Hardening V2)
            if (inv.status === 'rejected' && currentEmails.includes(inv.recipientEmail)) {
                console.warn("[AutoHealing] Rule D: Removing rejected email from array.");
                await updateDoc(doc(db, "users", currentUid, "accounts", currentId), {
                    sharedWithEmails: arrayRemove(inv.recipientEmail)
                });
                needsHealing = true;
            }

            // UI Render (Solo pending ed accepted)
            if (inv.status === 'rejected') continue;

            const displayStatus = inv.status === 'pending' ? (t('status_pending') || 'In attesa') : (t('status_accepted') || 'Accettato');
            const statusClass = inv.status === 'pending' ? 'bg-orange-500/20 text-orange-400 border-orange-500/20 animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';

            const revokeBtn = createElement('button', {
                className: 'btn-icon-header ml-2 hover:text-red-400 transition-colors',
                onclick: () => revokeRecipient(inv.recipientEmail)
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
            ]);

            const div = createElement('div', { className: 'rubrica-list-item flex items-center justify-between' }, [
                createElement('div', { className: 'rubrica-item-info-row' }, [
                    createElement('div', { className: 'rubrica-item-avatar', textContent: inv.recipientEmail.charAt(0).toUpperCase() }),
                    createElement('div', { className: 'rubrica-item-info' }, [
                        createElement('p', { className: 'truncate m-0 rubrica-item-name', textContent: inv.recipientEmail.split('@')[0] }),
                        createElement('p', { className: 'truncate m-0 opacity-60 text-[10px]', textContent: inv.recipientEmail })
                    ])
                ]),
                createElement('div', { className: 'flex items-center gap-2' }, [
                    createElement('span', {
                        className: `text-[8px] font-black uppercase px-2 py-1 rounded border ${statusClass}`,
                        textContent: displayStatus
                    }),
                    revokeBtn
                ])
            ]);
            listContainer.appendChild(div);
        }

        // REGOLA B: Email in array ma nessun invite valido (pending/accepted) -> Remove
        for (const email of currentEmails) {
            const hasValidInvite = invites.some(i => i.recipientEmail === email && (i.status === 'pending' || i.status === 'accepted'));
            if (!hasValidInvite) {
                console.warn("[AutoHealing] Rule B: Removing orphan email from array (no valid invite).");
                await updateDoc(doc(db, "users", currentUid, "accounts", currentId), {
                    sharedWithEmails: arrayRemove(email)
                });
                needsHealing = true;
            }
        }

        // REGOLA E: Se array vuoto ma flag condivisione attivi -> Reset (Auto-Off)
        const updatedEmails = (await (await getDoc(doc(db, "users", currentUid, "accounts", currentId))).data())?.sharedWithEmails || [];
        if (updatedEmails.length === 0 && isSharingFlagActive) {
            console.warn("[AutoHealing] Rule E: Resetting sharing flags (no active recipients).");
            await updateDoc(doc(db, "users", currentUid, "accounts", currentId), {
                shared: false,
                isMemoShared: false
            });
            needsHealing = true;
        }

        if (needsHealing) {
            console.log("[AutoHealing] Consistency repair complete.");
        }

        if (invites.length === 0) {
            listContainer.appendChild(createElement('p', { className: 'text-[10px] opacity-40 italic', textContent: 'Nessuna condivisione attiva' }));
        }
    });
}

/**
 * REVOKE SINGLE RECIPIENT (HARDENING V2 - MULTI)
 */
async function revokeRecipient(email) {
    if (!email) return;
    const ok = await showConfirmModal(t('confirm_revoke_title') || "REVOCA ACCESSO", `${t('confirm_revoke_msg') || 'Vuoi rimuovere l\'accesso per'} ${email}?`, t('revoke') || "Revoca");
    if (!ok) return;

    try {
        await runTransaction(db, async (transaction) => {
            const accRef = doc(db, "users", currentUid, "accounts", currentId);
            const inviteId = `${currentId}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const inviteRef = doc(db, "invites", inviteId);

            // 1. Remove from array
            transaction.update(accRef, {
                sharedWithEmails: arrayRemove(email)
            });

            // 2. Delete/Revoke invite
            transaction.delete(inviteRef);
        });

        showToast("Accesso revocato con successo");
    } catch (e) {
        console.error("RevokeRecipient failed", e);
        showToast(t('error_generic'), 'error');
    }
}

function renderGuests(guests) {
    const list = document.getElementById('guests-list');
    if (!list) return;
    clearElement(list);

    if (!guests || guests.length === 0) {
        list.appendChild(createElement('p', { className: 'text-[10px] opacity-40 italic', textContent: 'Sola lettura' }));
        return;
    }

    guests.forEach(item => {
        const displayEmail = typeof item === 'string' ? item : item.email;
        const div = createElement('div', { className: 'rubrica-list-item flex items-center justify-between' }, [
            createElement('div', { className: 'rubrica-item-info-row' }, [
                createElement('div', { className: 'rubrica-item-avatar', textContent: displayEmail.charAt(0).toUpperCase() }),
                createElement('div', { className: 'rubrica-item-info' }, [
                    createElement('p', { className: 'truncate m-0 rubrica-item-name', textContent: displayEmail.split('@')[0] }),
                    createElement('p', { className: 'truncate m-0 opacity-60 text-[10px]', textContent: displayEmail })
                ])
            ]),
            createElement('span', {
                className: `ml-auto text-[8px] font-black uppercase px-2 py-1 rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/20`,
                textContent: t('status_accepted') || 'Accettato'
            })
        ]);
        list.appendChild(div);
    });
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

    // Pulsante Annulla
    document.getElementById('btn-cancel-source')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeSourceSelector();
    });
}

// Listeners for hidden inputs
['input-camera', 'input-video', 'input-gallery', 'input-file'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => handleFileUpload(e.target));
});

// --- ATTACHMENTS LOGIC ---

window.openSourceSelector = openSourceSelector;
window.closeSourceSelector = closeSourceSelector;

function openSourceSelector() {
    console.log("Opening Source Selector Privato");
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Piccolo delay per permettere al browser di vedere la rimozione di 'hidden' prima di animare
        setTimeout(() => modal.classList.add('active'), 10);
        document.body.style.overflow = 'hidden';
    } else {
        console.error("Modale non trovato");
    }
}

function closeSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('active');
        // Aspettiamo la fine della transizione CSS (0.3s in core_ui.css) prima di rimettere hidden
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    }
}

/**
 * Collega i pulsanti del modal sorgente agli input file nascosti.
 * Deve essere chiamata UNA VOLTA all'init della pagina.
 */
function setupSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (!modal) return;

    // Mappa: data-source -> id input file
    const sourceMap = {
        camera: 'input-camera',
        gallery: 'input-gallery',
        file: 'input-file'
    };

    // Pulsanti sorgente
    // Pulsanti sorgente (ora sono LABEL): il browser gestisce il click nativamente.
    // Non aggiungiamo listener click qui per evitare doppi trigger.

    // Listener per chiusura modal dopo selezione (opzionale, gestito nel change)
    // Se l'utente clicca la label, si apre il file picker.
    // Se seleziona, scatta 'change' -> handleFileUpload -> closeSourceSelector.
    // Se annulla, il modal resta aperto (corretto).

    // Pulsante Annulla
    const cancelBtn = document.getElementById('btn-cancel-source');
    if (cancelBtn) cancelBtn.addEventListener('click', closeSourceSelector);

    // Click sull'overlay (fuori dalla card) per chiudere
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSourceSelector();
    });

    // Input file: al cambio avvia upload
    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('change', () => handleFileUpload(input));
    });

    console.log('[DETTAGLIO] setupSourceSelector: listener agganciati');
}

async function handleFileUpload(input) {
    // Chiudi il modal sorgente se aperto
    closeSourceSelector();

    const file = input.files[0];
    if (!file) return;

    // Feedback immediato per mobile
    showToast(`File selezionato: ${file.name}`, 'info');

    // Piccolo delay per permettere alla UI mobile di stabilizzarsi dopo chiusura picker/modal
    await new Promise(r => setTimeout(r, 800));

    const ok = await showConfirmModal("CARICA ALLEGATO", `Vuoi caricare il file ${file.name}?`, "Carica", "Annulla");
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
            textContent: 'Nessun allegato'
        }));
        return;
    }

    const items = list.map(a => {
        const type = (a.type || "").toLowerCase();
        let icon = 'description';
        let color = 'text-blue-400/40';

        if (type.includes('image')) { icon = 'image'; color = 'text-purple-400/40'; }
        else if (type.includes('video')) { icon = 'movie'; color = 'text-pink-400/40'; }
        else if (type.includes('pdf')) { icon = 'picture_as_pdf'; color = 'text-red-400/40'; }

        const date = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '---';
        const size = (a.size / (1024 * 1024)).toFixed(2);

        return createElement('div', {
            className: 'attachment-item animate-in slide-in-from-left-2'
        }, [
            createElement('div', {
                className: 'attachment-info cursor-pointer',
                onclick: () => window.open(a.url, '_blank')
            }, [
                createElement('span', { className: `material-symbols-outlined attachment-icon ${color}`, textContent: icon }),
                createElement('div', { className: 'attachment-meta' }, [
                    createElement('span', { className: 'attachment-name', textContent: a.name }),
                    createElement('span', { className: 'attachment-status', textContent: `${size} MB • ${date}` })
                ])
            ]),
            !isReadOnly ? createElement('button', {
                type: 'button',
                className: 'btn-delete-attachment',
                onclick: (e) => { e.stopPropagation(); deleteAttachment(a); }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
            ]) : null
        ]);
    });

    setChildren(container, items);
}

async function deleteAttachment(att) {
    const ok = await showConfirmModal("ELIMINA", `Sei sicuro di voler eliminare l'allegato ${att.name}?`, "Elimina", t('cancel') || "Annulla");
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
