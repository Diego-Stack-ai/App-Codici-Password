/**
 * DETTAGLIO ACCOUNT AZIENDA MODULE (V4.1)
 * Visualizzazione dettagliata credenziali e coordinate bancarie aziendali.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
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
    // Header
    const hLeft = document.getElementById('header-left');
    if (hLeft) {
        clearElement(hLeft);
        setChildren(hLeft, createElement('button', {
            className: 'btn-icon-header',
            onclick: () => window.location.href = `account_azienda.html?id=${currentAziendaId}`
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
        ]));
    }

    const hCenter = document.getElementById('header-center');
    if (hCenter) {
        clearElement(hCenter);
        setChildren(hCenter, createElement('h1', {
            id: 'header-nome-account',
            className: 'header-title animate-pulse',
            textContent: t('loading') || 'Caricamento...'
        }));
    }

    const hRight = document.getElementById('header-right');
    if (hRight) {
        clearElement(hRight);
        setChildren(hRight, createElement('a', {
            href: 'home_page.html',
            className: 'btn-icon-header'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'home' })
        ]));
    }

    // Footer Edit Button
    const fRight = document.getElementById('footer-right-actions');
    if (fRight) {
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

    } catch (e) {
        logError("LoadAccount", e);
        showToast(t('error_generic'), "error");
    }
}

function render(acc) {
    document.title = acc.nomeAccount || 'Dettaglio Azienda';

    const hNome = document.getElementById('header-nome-account');
    if (hNome) {
        hNome.textContent = acc.nomeAccount || t('without_name');
        hNome.classList.remove('animate-pulse');
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

