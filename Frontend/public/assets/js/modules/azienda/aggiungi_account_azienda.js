/**
 * AGGIUNGI ACCOUNT AZIENDA MODULE (V4.1)
 * Creazione di un nuovo account (credenziali) all'interno di un'azienda.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';

// --- STATE ---
let currentAziendaId = new URLSearchParams(window.location.search).get('aziendaId');
let bankAccounts = [{
    iban: '',
    cards: [],
    passwordDispositiva: '',
    referenteNome: '',
    referenteCognome: '',
    referenteTelefono: '',
    referenteCellulare: '',
    nota: ''
}];

const companyPalettes = [
    { from: '#10b981', to: '#047857', name: 'Green' },
    { from: '#3b82f6', to: '#1d4ed8', name: 'Blue' },
    { from: '#8b5cf6', to: '#6d28d9', name: 'Purple' },
    { from: '#f59e0b', to: '#b45309', name: 'Orange' },
    { from: '#ec4899', to: '#be185d', name: 'Pink' },
    { from: '#ef4444', to: '#b91c1c', name: 'Red' },
    { from: '#06b6d4', to: '#0e7490', name: 'Cyan' },
    { from: '#6366f1', to: '#4338ca', name: 'Indigo' },
    { from: '#84cc16', to: '#4d7c0f', name: 'Lime' },
    { from: '#14b8a6', to: '#0f766e', name: 'Teal' },
];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initProtocolUI();
    setupStaticListeners();

    observeAuth(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else if (currentAziendaId) {
            await loadAziendaTheme(user.uid);
        }
    });

    renderBankAccounts();
});

async function initProtocolUI() {
    await initComponents();

    // Header Left
    const hLeft = document.getElementById('header-left');
    if (hLeft) {
        clearElement(hLeft);
        setChildren(hLeft, createElement('button', {
            className: 'btn-icon-header',
            onclick: () => history.back()
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
        ]));
    }

    // Header Center
    const hCenter = document.getElementById('header-center');
    if (hCenter) {
        clearElement(hCenter);
        setChildren(hCenter, createElement('h2', {
            className: 'header-title',
            textContent: t('new_account') || 'Nuovo Account'
        }));
    }

    // Footer Right
    const fRight = document.getElementById('footer-right-actions');
    if (fRight) {
        clearElement(fRight);
        setChildren(fRight, createElement('button', {
            id: 'save-btn',
            className: 'base-btn-primary flex-center-gap',
            onclick: saveAccount
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }),
            createElement('span', { textContent: t('save_account') || 'Salva Account' })
        ]));
    }
}

function setupStaticListeners() {
    document.getElementById('btn-toggle-password')?.addEventListener('click', () => {
        const input = document.getElementById('password');
        const icon = document.querySelector('#btn-toggle-password span');
        if (input) {
            const isShield = input.classList.toggle('base-shield');
            if (icon) icon.textContent = isShield ? 'visibility' : 'visibility_off';
        }
    });

    document.getElementById('btn-copy-password')?.addEventListener('click', () => {
        const val = document.getElementById('password')?.value;
        if (val) navigator.clipboard.writeText(val).then(() => showToast(t('copied'), "success"));
    });

    document.getElementById('btn-add-iban')?.addEventListener('click', () => {
        bankAccounts.push({ iban: '', cards: [], passwordDispositiva: '', referenteNome: '', referenteCognome: '', referenteTelefono: '', referenteCellulare: '', nota: '' });
        renderBankAccounts();
    });
}

async function loadAziendaTheme(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid, "aziende", currentAziendaId));
        if (snap.exists()) {
            const data = snap.data();
            applyTheme(data.ragioneSociale, data.colorIndex);
        }
    } catch (e) { logError("Theme", e); }
}

function applyTheme(name, index) {
    let theme = companyPalettes[0];
    if (typeof index === 'number' && companyPalettes[index]) theme = companyPalettes[index];
    else if (name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        theme = companyPalettes[Math.abs(hash) % companyPalettes.length];
    }
    document.documentElement.style.setProperty('--primary-color', theme.from);
    const btn = document.getElementById('save-btn');
    if (btn) {
        btn.style.background = `linear-gradient(to right, ${theme.from}, ${theme.to})`;
        btn.style.boxShadow = `0 10px 15px -3px ${theme.from}4d`;
    }
}

function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    clearElement(container);

    const items = bankAccounts.map((acc, idx) => createElement('div', {
        className: "p-5 bg-slate-500/5 rounded-3xl border border-white/5 border-glow flex-col-gap-4 relative"
    }, [
        // Header
        createElement('div', { className: 'flex items-center justify-between border-b border-white/5 pb-2' }, [
            createElement('span', { className: 'text-[10px] font-bold text-blue-500 uppercase tracking-widest', textContent: `Conto #${idx + 1}` }),
            bankAccounts.length > 1 ? createElement('button', {
                className: 'text-white/40 hover:text-red-500 transition-colors',
                onclick: () => removeIban(idx)
            }, [createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })]) : null
        ]),

        // IBAN Field
        createElement('div', { className: 'glass-field-container' }, [
            createElement('label', { className: 'view-label', textContent: 'IBAN' }),
            createElement('div', { className: 'glass-field' }, [
                createElement('span', { className: 'material-symbols-outlined opacity-70 mr-2', textContent: 'account_balance' }),
                createElement('input', {
                    type: 'text',
                    className: 'uppercase font-bold font-mono',
                    value: acc.iban,
                    placeholder: 'IT00...',
                    oninput: (e) => { acc.iban = e.target.value.toUpperCase(); }
                })
            ])
        ]),

        // Grid: Dispositiva & Nota
        createElement('div', { className: 'form-grid-2' }, [
            // Pass. Dispositiva
            createElement('div', { className: 'glass-field-container' }, [
                createElement('label', { className: 'view-label', textContent: 'Pass. Dispositiva' }),
                createElement('div', { className: 'glass-field' }, [
                    createElement('input', {
                        type: 'text',
                        className: 'base-shield',
                        value: acc.passwordDispositiva || '',
                        placeholder: 'Password...',
                        oninput: (e) => { acc.passwordDispositiva = e.target.value; }
                    }),
                    createElement('button', {
                        className: 'glass-field-btn',
                        onclick: (e) => {
                            const input = e.currentTarget.previousElementSibling;
                            const isShield = input.classList.toggle('base-shield');
                            e.currentTarget.querySelector('span').textContent = isShield ? 'visibility' : 'visibility_off';
                        }
                    }, [createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'visibility' })])
                ])
            ]),
            // Nota IBAN
            createElement('div', { className: 'glass-field-container' }, [
                createElement('label', { className: 'view-label', textContent: 'Nota IBAN' }),
                createElement('div', { className: 'glass-field' }, [
                    createElement('input', {
                        type: 'text',
                        value: acc.nota || '',
                        placeholder: 'Note...',
                        oninput: (e) => { acc.nota = e.target.value; }
                    })
                ])
            ])
        ]),

        // Referente Banca Section
        createElement('div', { className: 'bg-blue-500/5 p-4 rounded-2xl border border-white/5 flex-col-gap-3' }, [
            createElement('div', { className: 'flex items-center gap-2 text-blue-500' }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'contact_phone' }),
                createElement('span', { className: 'text-[10px] font-black uppercase tracking-widest', textContent: 'Referente Banca' })
            ]),
            createElement('div', { className: 'form-grid-2' }, [
                createSmallInput('Nome', acc.referenteNome, (v) => acc.referenteNome = v),
                createSmallInput('Cognome', acc.referenteCognome, (v) => acc.referenteCognome = v)
            ]),
            createElement('div', { className: 'form-grid-2' }, [
                createSmallInput('Telefono', acc.referenteTelefono, (v) => acc.referenteTelefono = v, 'tel'),
                createSmallInput('Cellulare', acc.referenteCellulare, (v) => acc.referenteCellulare = v, 'tel')
            ])
        ]),

        // Cards Section
        createElement('div', { className: 'flex-col-gap-3 pl-4 border-l-2 border-white/5' }, [
            createElement('div', { className: 'flex items-center justify-between' }, [
                createElement('span', { className: 'text-[10px] font-bold text-white/40 uppercase tracking-widest', textContent: 'Strumenti collegati' }),
                createElement('button', {
                    className: 'text-blue-500 text-[10px] font-bold hover:underline flex items-center gap-0.5',
                    onclick: () => {
                        acc.cards.push({ type: 'Credit', titolare: '', cardType: '', cardNumber: '', expiry: '', ccv: '', pin: '', note: '' });
                        renderBankAccounts();
                    }
                }, [
                    createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'add' }),
                    createElement('span', { textContent: 'Aggiungi carta' })
                ])
            ]),
            createElement('div', { className: 'flex-col-gap-4' }, acc.cards.map((c, cIdx) => renderCardEntry(acc, idx, c, cIdx)))
        ])
    ]));

    setChildren(container, items);
}

function renderCardEntry(acc, accIdx, card, cardIdx) {
    return createElement('div', {
        className: 'bg-white/5 p-4 rounded-2xl border border-white/5 shadow-sm flex-col-gap-4 relative'
    }, [
        createElement('div', { className: 'flex items-center justify-between border-b border-white/5 pb-2' }, [
            createElement('div', { className: 'flex items-center gap-2' }, [
                createElement('span', { className: 'material-symbols-outlined text-blue-500 text-sm', textContent: card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card' }),
                createElement('span', { className: 'text-[10px] font-bold text-white/40 uppercase', textContent: `Strumento #${cardIdx + 1}` })
            ]),
            createElement('button', {
                className: 'text-white/40 hover:text-red-500 transition-colors',
                onclick: () => { acc.cards.splice(cardIdx, 1); renderBankAccounts(); }
            }, [createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'close' })])
        ]),
        createElement('div', { className: 'flex-col-gap-3' }, [
            // Tipo
            createElement('div', { className: 'glass-field-container' }, [
                createElement('label', { className: 'view-label', textContent: 'Tipo Strumento' }),
                createElement('div', { className: 'glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center' }, [
                    createElement('select', {
                        className: 'glass-select w-full',
                        onchange: (e) => { card.type = e.target.value; renderBankAccounts(); }
                    }, [
                        createElement('option', { value: 'Credit', selected: card.type === 'Credit', textContent: 'Carta di credito (Credit)' }),
                        createElement('option', { value: 'Debit', selected: card.type === 'Debit', textContent: 'Bancomat (Debit)' })
                    ])
                ])
            ]),
            // Titolare & Tipo Carta
            createElement('div', { className: 'form-grid-2' }, [
                createSmallInput('Titolare', card.titolare, (v) => card.titolare = v),
                card.type !== 'Debit' ? createSmallInput('Tipo Carta', card.cardType, (v) => card.cardType = v, 'text', 'Visa, MC...') : null
            ]),
            // Numero
            createSmallInput('Numero', card.cardNumber, (v) => card.cardNumber = v, 'text', '**** **** **** ****', true),
            // Expiry, CCV, PIN
            createElement('div', { className: 'grid grid-cols-3 gap-3' }, [
                createSmallInput('Scadenza', card.expiry, (v) => { card.expiry = formatExpiry(v); return card.expiry; }, 'text', 'MM/AA'),
                createSmallInput('CCV', card.ccv, (v) => card.ccv = v, 'text', '123'),
                createElement('div', { className: 'glass-field-container' }, [
                    createElement('label', { className: 'view-label', textContent: 'PIN' }),
                    createElement('div', { className: 'glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center' }, [
                        createElement('input', {
                            type: 'text',
                            className: 'base-shield bg-transparent border-none text-sm text-white w-full outline-none font-mono',
                            value: card.pin || '',
                            placeholder: '****',
                            oninput: (e) => { card.pin = e.target.value; }
                        }),
                        createElement('button', {
                            className: 'glass-field-btn',
                            onclick: (e) => {
                                const input = e.currentTarget.previousElementSibling;
                                const isShield = input.classList.toggle('base-shield');
                                e.currentTarget.querySelector('span').textContent = isShield ? 'visibility' : 'visibility_off';
                            }
                        }, [createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'visibility' })])
                    ])
                ])
            ]),
            // Note
            createElement('div', { className: 'glass-field-container' }, [
                createElement('label', { className: 'view-label', textContent: 'Note' }),
                createElement('div', { className: 'note-display-box', style: 'min-height:60px;' }, [
                    createElement('textarea', {
                        className: 'bg-transparent border-none text-sm text-white w-full outline-none resize-none px-2 py-1',
                        rows: 2,
                        placeholder: 'Note sulla carta...',
                        textContent: card.note,
                        oninput: (e) => { card.note = e.target.value; }
                    })
                ])
            ])
        ])
    ]);
}

function createSmallInput(label, val, onInput, type = 'text', placeholder = '', isMono = false) {
    return createElement('div', { className: 'glass-field-container' }, [
        createElement('label', { className: 'view-label', textContent: label }),
        createElement('div', { className: 'glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center' }, [
            createElement('input', {
                type: type,
                className: `bg-transparent border-none text-sm text-white w-full outline-none ${isMono ? 'font-mono' : ''}`,
                value: val || '',
                placeholder: placeholder || label,
                oninput: (e) => { const r = onInput(e.target.value); if (r !== undefined) e.target.value = r; }
            })
        ])
    ]);
}

function formatExpiry(v) {
    let val = v.replace(/\D/g, '');
    if (val.length > 4) val = val.substring(0, 4);
    if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
    return val;
}

async function removeIban(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), "Sei sicuro di voler eliminare interamente questo IBAN e tutte le carte collegate?")) return;
    bankAccounts.splice(idx, 1);
    renderBankAccounts();
}

async function saveAccount() {
    if (!auth.currentUser) return;

    const nome = document.getElementById('nome-account')?.value.trim();
    const utente = document.getElementById('utente')?.value.trim();
    const password = document.getElementById('password')?.value.trim();

    if (!nome) return showToast(t('error_missing_account_name') || "Inserisci Nome Account", "error");
    if (!utente) return showToast(t('error_missing_user') || "Inserisci Utente", "error");
    if (!password) return showToast(t('error_missing_password') || "Inserisci Password", "error");

    const btn = document.getElementById('save-btn');
    if (btn) {
        btn.disabled = true;
        setChildren(btn, [
            createElement('span', { className: 'material-symbols-outlined animate-spin text-sm', textContent: 'progress_activity' }),
            createElement('span', { textContent: t('saving') || 'Salvataggio...' })
        ]);
    }

    const data = {
        nomeAccount: nome,
        sitoWeb: document.getElementById('sito-web')?.value.trim(),
        codiceSocieta: document.getElementById('codice-societa')?.value.trim(),
        numeroIscrizione: document.getElementById('numero-iscrizione')?.value.trim(),
        utente: utente,
        account: document.getElementById('account')?.value.trim(),
        password: password,
        referenteNome: document.getElementById('referente-nome')?.value.trim(),
        referenteTelefono: document.getElementById('referente-telefono')?.value.trim(),
        referenteCellulare: document.getElementById('referente-cellulare')?.value.trim(),
        note: document.getElementById('note')?.value.trim(),
        banking: bankAccounts.filter(b => b.iban.length > 5),
        createdAt: serverTimestamp()
    };

    try {
        const colRef = collection(db, "users", auth.currentUser.uid, "aziende", currentAziendaId, "accounts");
        await addDoc(colRef, data);
        showToast(t('success_save'), 'success');
        setTimeout(() => window.location.href = `account_azienda.html?id=${currentAziendaId}`, 1000);
    } catch (e) {
        logError("SaveAccount", e);
        showToast(t('error_generic'), 'error');
        if (btn) {
            btn.disabled = false;
            setChildren(btn, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }),
                createElement('span', { textContent: t('save_account') || 'Salva Account' })
            ]);
        }
    }
}

