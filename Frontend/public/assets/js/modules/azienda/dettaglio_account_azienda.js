/**
 * DETTAGLIO ACCOUNT AZIENDA MODULE (V5.0 ADAPTER)
 * Visualizzazione dettagliata credenziali e coordinate bancarie aziendali.
 * - Entry Point: initDettaglioAccountAzienda(user)
 */

import { auth, db, storage } from '../../firebase-config.js';
import {
    doc, getDoc, updateDoc, increment,
    collection, addDoc, query, orderBy, getDocs, deleteDoc, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, setChildren, clearElement, createSafeAccountIcon } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

// --- STATE ---
let currentUid = null;
let currentId = null;
let currentAziendaId = null;
let originalData = null;

// --- INITIALIZATION ---
export async function initDettaglioAccountAzienda(user) {
    console.log("[DETTAGLIO-ACCOUNT-AZIENDA] Init V5.0...");
    if (!user) return;
    currentUid = user.uid;

    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');
    currentAziendaId = urlParams.get('aziendaId');

    if (!currentId || !currentAziendaId) {
        showToast("Parametri mancanti", "error");
        setTimeout(() => history.back(), 1000);
        return;
    }

    // Expose globals for HTML onclicks if needed (legacy compat)
    window.openSourceSelector = openSourceSelector;
    window.closeSourceSelector = closeSourceSelector;

    initProtocolUI(); // Sync UI setup
    setupActions();
    await loadAccount(currentId);

    console.log("[DETTAGLIO-ACCOUNT-AZIENDA] Ready.");
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
                onclick: () => window.location.href = `modifica_account_azienda.html?id=${currentId}&aziendaId=${currentAziendaId}`
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
            ])
        ]));
    }
}
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
        'detail-website': acc.url || acc.sitoWeb
    };
    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }

    // Banking
    renderBanking(acc);

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

    // Shared Management
    if (acc.shared || acc.isMemoShared) {
        const mgmt = document.getElementById('shared-management-section');
        if (mgmt) mgmt.classList.remove('hidden');
        renderGuests(acc.sharedWith || []);
    }

    // --- ALLEGATI: Aggancio Listener ---
    const btnAdd = document.getElementById('btn-add-attachment');
    if (btnAdd) {
        btnAdd.onclick = openSourceSelector;
    }
}

function renderBanking(acc) {
    const hasBanking = !!acc.isBanking;
    const sectionBanking = document.getElementById('section-banking');
    if (sectionBanking) sectionBanking.classList.toggle('hidden', !hasBanking);

    // Gestione Suggerimento Conto Bancario
    const hasRealBanking = checkRealBankingData(acc);
    const bankingPrompt = document.getElementById('add-banking-prompt');
    if (bankingPrompt) {
        if (!hasRealBanking) {
            bankingPrompt.classList.remove('hidden');
            const btnBankingInfo = document.getElementById('btn-banking-info');
            if (btnBankingInfo) {
                const infoText = btnBankingInfo.querySelector('.info-text');
                if (infoText) infoText.textContent = t('banking_hint');
                btnBankingInfo.onclick = () => {
                    window.location.href = `form_account_azienda.html?id=${currentId}&aziendaId=${currentAziendaId}`;
                };
            }
        } else {
            bankingPrompt.classList.add('hidden');
        }
    }

    if (hasBanking) {
        const bankingContent = document.getElementById('banking-content');
        if (bankingContent) {
            const bankingArr = Array.isArray(acc.banking) ? acc.banking :
                (acc.banking?.iban ? [acc.banking] :
                    (acc.iban ? [{ iban: acc.iban }] : []));

            const rows = bankingArr.map((bank, bIdx) => {
                const fields = [];

                // IBAN
                if (bank.iban) {
                    fields.push(createElement('div', { className: 'bg-black/20 p-2.5 rounded-xl border border-white/5' }, [
                        createElement('div', { className: 'micro-data-row' }, [
                            createElement('span', { className: 'micro-data-label', textContent: 'IBAN' }),
                            createElement('span', { className: 'micro-data-value text-emerald-400 font-mono tracking-wider truncate', textContent: bank.iban }),
                            createElement('button', { className: 'micro-btn-copy-inline', onclick: () => copyToClipboard(bank.iban) }, [
                                createElement('span', { className: 'material-symbols-outlined !text-[14px]', textContent: 'content_copy' })
                            ])
                        ])
                    ]));
                }

                // Password Dispositiva (Shielded)
                if (bank.passwordDispositiva) {
                    const passId = `bank-pass-${bIdx}`;
                    fields.push(createElement('div', { className: 'bg-black/20 p-2.5 rounded-xl border border-white/5' }, [
                        createElement('div', { className: 'micro-data-row' }, [
                            createElement('span', { className: 'micro-data-label', textContent: 'Password Disp.' }),
                            createElement('span', { id: passId, className: 'micro-data-value text-white font-mono base-shield', textContent: bank.passwordDispositiva }),
                            createElement('div', { className: 'flex gap-2' }, [
                                createElement('button', {
                                    className: 'micro-btn-copy-inline',
                                    onclick: (e) => {
                                        const span = document.getElementById(passId);
                                        const isPass = span.classList.toggle('base-shield');
                                        e.currentTarget.querySelector('span').textContent = isPass ? 'visibility' : 'visibility_off';
                                    }
                                }, [
                                    createElement('span', { className: 'material-symbols-outlined !text-[14px]', textContent: 'visibility' })
                                ]),
                                createElement('button', { className: 'micro-btn-copy-inline', onclick: () => copyToClipboard(bank.passwordDispositiva) }, [
                                    createElement('span', { className: 'material-symbols-outlined !text-[14px]', textContent: 'content_copy' })
                                ])
                            ])
                        ])
                    ]));
                }

                // Cards
                if (bank.cards && bank.cards.length > 0) {
                    bank.cards.forEach((card, cIdx) => {
                        fields.push(createElement('div', { className: 'bg-white/5 p-3 rounded-xl border border-white/5 mt-2' }, [
                            createElement('div', { className: 'flex items-center gap-2 mb-2 opacity-40' }, [
                                createElement('span', { className: 'material-symbols-outlined !text-[16px]', textContent: 'credit_card' }),
                                createElement('span', { className: 'text-[9px] font-black uppercase tracking-widest', textContent: card.name || `Carta ${cIdx + 1}` })
                            ]),
                            createElement('div', { className: 'micro-data-row' }, [
                                createElement('span', { className: 'micro-data-label', textContent: 'Numero' }),
                                createElement('span', { className: 'micro-data-value text-white font-mono', textContent: card.number || '-' }),
                                createElement('button', { className: 'micro-btn-copy-inline', onclick: () => copyToClipboard(card.number) }, [
                                    createElement('span', { className: 'material-symbols-outlined !text-[14px]', textContent: 'content_copy' })
                                ])
                            ]),
                            createElement('div', { className: 'grid grid-cols-2 gap-2 mt-2' }, [
                                createElement('div', { className: 'micro-data-row' }, [
                                    createElement('span', { className: 'micro-data-label', textContent: 'Scad.' }),
                                    createElement('span', { className: 'micro-data-value text-white', textContent: card.expiry || '-' })
                                ]),
                                createElement('div', { className: 'micro-data-row' }, [
                                    createElement('span', { className: 'micro-data-label', textContent: 'CVV' }),
                                    createElement('span', { className: 'micro-data-value text-white font-mono', textContent: card.cvv || '-' }),
                                    createElement('button', { className: 'micro-btn-copy-inline', onclick: () => copyToClipboard(card.cvv) }, [
                                        createElement('span', { className: 'material-symbols-outlined !text-[14px]', textContent: 'content_copy' })
                                    ])
                                ])
                            ])
                        ]));
                    });
                }

                return createElement('div', {
                    className: 'space-y-3 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 border-glow relative'
                }, fields);
            });

            setChildren(bankingContent, rows);
        }
    }
}

function setupActions() {
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

    // Modal Events
    const sourceModal = document.getElementById('source-selector-modal');
    if (sourceModal) {
        sourceModal.querySelectorAll('[data-source]').forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.source;
                const input = document.getElementById(`input-${type}`);
                if (input) input.click();
                closeSourceSelector();
            };
        });
        document.getElementById('btn-cancel-source').onclick = closeSourceSelector;
    }

    // Hidden inputs listeners
    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => handleFileUpload(e.target));
    });
}

// --- ATTACHMENTS LOGIC ---

// Renderli globali per onclick HTML
window.openSourceSelector = openSourceSelector;
window.closeSourceSelector = closeSourceSelector;

function openSourceSelector() {
    console.log("Opening Source Selector");
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('invisible', 'opacity-0');
        // modal.classList.add('active'); 
        document.body.style.overflow = 'hidden';
    } else {
        console.error("Modal source-selector-modal not found");
    }
}

function closeSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.add('invisible', 'opacity-0');
        // modal.classList.remove('active');
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
            textContent: 'Nessun allegato'
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

/**
 * GUESTS (Gestione Collaboratori)
 */
async function renderGuests(guests) {
    const list = document.getElementById('guests-list');
    if (!list) return;
    clearElement(list);

    if (!guests || guests.length === 0) {
        list.appendChild(createElement('p', { className: 'text-xs text-white/40 italic ml-1', textContent: t('no_active_access') || 'Nessun accesso attivo' }));
        return;
    }

    let needsUpdate = false;
    let updatedGuests = [...guests];

    for (let i = 0; i < guests.length; i++) {
        let item = guests[i];
        if (typeof item !== 'object') item = { email: item, status: 'accepted' };

        if (item.status === 'rejected') continue;

        const displayEmail = item.email;
        let isPending = item.status === 'pending';
        let displayStatus = t('status_pending') || 'In attesa';
        let statusClass = 'bg-orange-500/20 text-orange-400 border-orange-500/20 animate-pulse';

        if (isPending) {
            try {
                const inviteId = `${currentId}_${displayEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const invSnap = await getDoc(doc(db, "invites", inviteId));

                if (invSnap.exists()) {
                    const invData = invSnap.data();
                    if (invData.status === 'accepted') {
                        isPending = false;
                        displayStatus = t('status_accepted') || 'Accettato';
                        statusClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
                        updatedGuests[i] = { ...item, status: 'accepted' };
                        needsUpdate = true;
                    } else if (invData.status === 'rejected') {
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

        const div = createElement('div', { className: 'rubrica-list-item flex items-center justify-between mb-2' }, [
            createElement('div', { className: 'flex items-center gap-3' }, [
                createElement('div', {
                    className: 'w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex-center text-[10px] font-bold text-white/40',
                    textContent: displayEmail.charAt(0).toUpperCase()
                }),
                createElement('div', { className: 'flex flex-col' }, [
                    createElement('p', { className: 'text-xs font-bold text-white m-0', textContent: displayEmail.split('@')[0] }),
                    createElement('p', { className: 'text-[10px] text-white/30 m-0', textContent: displayEmail })
                ])
            ]),
            createElement('span', {
                className: `text-[8px] font-black uppercase px-2 py-1 rounded border ${statusClass}`,
                textContent: displayStatus
            })
        ]);
        list.appendChild(div);
    }

    if (needsUpdate) {
        try {
            const docRef = doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentId);
            await updateDoc(docRef, { sharedWith: updatedGuests });
        } catch (e) { console.error("SelfHealing update failed", e); }
    }
}

function getAccentColors(acc) {
    if (acc.isBanking) return { rgb: '16, 185, 129', hex: '#10b981' };
    if (acc.isMemoShared) return { rgb: '34, 197, 94', hex: '#22c55e' };
    if (acc.shared) return { rgb: '244, 63, 94', hex: '#f43f5e' };
    if (acc.hasMemo) return { rgb: '245, 158, 11', hex: '#f59e0b' };
    return { rgb: '59, 130, 246', hex: '#3b82f6' };
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

