/**
 * DETTAGLIO ACCOUNT PRIVATO (V4.3)
 * Visualizzazione dettagli, gestione banking e condivisioni.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc, increment } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError, formatDateToIT } from '../../utils.js';

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
            // Fallback icon logic if needed
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

    // Sharing
    if (acc.shared || acc.isMemoShared) {
        const mgmt = document.getElementById('shared-management');
        if (mgmt) mgmt.classList.remove('hidden');
        renderGuests(acc.sharedWith || []);
    }
}

function renderBanking(acc) {
    const section = document.getElementById('section-banking');
    const content = document.getElementById('banking-content');
    if (!section || !content) return;

    if (!acc.isBanking) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    clearElement(content);

    const bankingArr = Array.isArray(acc.banking) ? acc.banking : (acc.banking ? [acc.banking] : (acc.iban ? [{ iban: acc.iban }] : []));

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
                createElement('div', { className: 'text-[11px] font-black text-white uppercase', textContent: bank.referenteNome || '-' }),
                createElement('div', { className: 'grid grid-cols-2 gap-2' }, [
                    createCallBtn('call', bank.referenteTelefono),
                    createCallBtn('smartphone', bank.referenteCellulare)
                ])
            ])
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
        createElement('span', { className: 'micro-data-value text-[10px] font-bold text-white group-hover:text-primary', textContent: num || '-' })
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

    for (const item of guests) {
        if (typeof item === 'object' && item.status === 'rejected') continue;

        const displayEmail = typeof item === 'object' ? item.email : item;
        const div = createElement('div', { className: 'rubrica-list-item' }, [
            createElement('div', { className: 'rubrica-item-info-row' }, [
                createElement('div', { className: 'rubrica-item-avatar', textContent: '?' }),
                createElement('div', { className: 'rubrica-item-info' }, [
                    createElement('p', { className: 'truncate m-0 rubrica-item-name', textContent: displayEmail.split('@')[0] }),
                    createElement('p', { className: 'truncate m-0 opacity-60 text-[10px]', textContent: displayEmail })
                ])
            ])
        ]);
        list.appendChild(div);
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
    // Copy Generic
    document.querySelectorAll('.btn-copy-field').forEach(btn => {
        btn.onclick = () => {
            const input = btn.closest('.glass-field')?.querySelector('input');
            if (input && input.value) {
                navigator.clipboard.writeText(input.value);
                showToast(t('copied') || "Copiato!");
            }
        };
    });

    // Toggle Password
    document.querySelectorAll('.btn-toggle-field').forEach(btn => {
        btn.onclick = () => {
            const input = btn.closest('.glass-field')?.querySelector('input');
            if (input) {
                const isPass = input.type === 'password';
                input.type = isPass ? 'text' : 'password';
                input.classList.toggle('base-shield', !isPass);
                btn.querySelector('span').textContent = isPass ? 'visibility_off' : 'visibility';
            }
        };
    });
}

