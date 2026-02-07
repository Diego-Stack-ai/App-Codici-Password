import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc, increment } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showToast } from './ui-core.js';

// --- GLOBALS & CONFIG ---
window.t = window.t || ((k) => k);

// --- STATE ---
let currentUid = null;
let currentId = null;
let currentAziendaId = null;
let originalData = null;

document.addEventListener('DOMContentLoaded', () => {
    // URL Params
    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');
    currentAziendaId = urlParams.get('aziendaId');

    if (!currentId || !currentAziendaId) {
        showToast("Parametri mancanti", "error");
        setTimeout(() => history.back(), 1000);
        return;
    }

    initBaseUI();

    // Auth Listener
    onAuthStateChanged(auth, async (user) => {
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
    const hPlaceholder = document.getElementById('header-placeholder');
    if (!hPlaceholder) return;

    // Internal function to apply Header UI
    const applyHeader = () => {
        if (!document.getElementById('header-content')) {
            hPlaceholder.innerHTML = `
                <div id="header-content" class="header-balanced-container">
                    <div id="header-left" class="header-left"></div>
                    <div id="header-center" class="header-center"></div>
                    <div id="header-right" class="header-right"></div>
                </div>
            `;
        }

        const hLeft = document.getElementById('header-left');
        const hCenter = document.getElementById('header-center');
        const hRight = document.getElementById('header-right');

        if (hLeft && hLeft.innerHTML.trim() === '') {
            hLeft.innerHTML = `
                <button id="btn-back-protocol" class="btn-icon-header">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
            `;
            // Back to Company Account List
            document.getElementById('btn-back-protocol').addEventListener('click', () => {
                window.location.href = `account_azienda.html?id=${currentAziendaId}`;
            });
        }

        if (hCenter && hCenter.innerHTML.trim() === '') {
            hCenter.innerHTML = `<h1 class="header-title animate-pulse" id="header-nome-account">Caricamento...</h1>`;
        }

        if (hRight && hRight.innerHTML.trim() === '') {
            hRight.innerHTML = `
                <a href="home_page.html" class="btn-icon-header">
                    <span class="material-symbols-outlined">home</span>
                </a>
            `;
        }
    };

    const applyFooter = () => {
        const fRight = document.getElementById('footer-right-actions');
        if (fRight) {
            if (!document.getElementById('btn-edit-footer')) {
                const btnEdit = document.createElement('button');
                btnEdit.id = 'btn-edit-footer';
                btnEdit.className = 'btn-icon-header';
                btnEdit.innerHTML = '<span class="material-symbols-outlined">edit</span>';

                btnEdit.addEventListener('click', () => {
                    window.location.href = `form_account_azienda.html?id=${currentId}&aziendaId=${currentAziendaId}`;
                });
                fRight.prepend(btnEdit);
            }
        }
    };

    applyHeader();
    applyFooter();

    // RETRY LOOP
    let attempts = 0;
    const interval = setInterval(() => {
        const hLeft = document.getElementById('header-left');
        if (!hLeft || hLeft.innerHTML.trim() === '') applyHeader();
        if (!document.getElementById('btn-edit-footer')) applyFooter();
        attempts++;
        if (attempts > 30) clearInterval(interval);
    }, 100);
}

async function loadAccount(id) {
    try {
        // Path: users/{uid}/aziende/{aziendaId}/accounts/{id}
        const docRef = doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showToast("Account non trovato", "error");
            return;
        }

        originalData = docSnap.data();
        originalData.docId = docSnap.id;

        // Increment View Count
        updateDoc(docRef, { views: increment(1) }).catch(console.error);

        render(originalData);

    } catch (e) {
        console.error(e);
        showToast("Errore caricamento dati.", "error");
    }
}

function render(acc) {
    document.title = acc.nomeAccount || 'Dettaglio Azienda';

    // Accent Color: Blue default for Company
    const accentHex = '#3b82f6';

    const hNome = document.getElementById('header-nome-account');
    if (hNome) {
        hNome.textContent = acc.nomeAccount || 'Senza Nome';
        hNome.classList.remove('animate-pulse');
    }

    const heroTitle = document.getElementById('hero-title');
    if (heroTitle) heroTitle.textContent = acc.nomeAccount || '-';

    // Avatar
    const avatar = document.getElementById('detail-avatar');
    const logoUrl = acc.logo || acc.avatar;
    if (avatar) {
        if (logoUrl) {
            avatar.style.backgroundImage = `url("${logoUrl}")`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.innerHTML = '';
        } else {
            avatar.style.backgroundImage = 'none';
            if (window.getAccountIcon) {
                avatar.innerHTML = window.getAccountIcon(acc.nomeAccount, 'w-full h-full p-6 text-white');
            }
        }
    }

    const ref = acc.referente || {};

    const map = {
        'detail-nomeAccount': acc.nomeAccount,
        'detail-username': acc.username,
        'detail-account': acc.account || acc.codice,
        'detail-password': acc.password,
        'detail-website': acc.url || acc.sitoWeb,
        'detail-note': acc.note
    };

    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = val || '';
            else el.textContent = val || '-';
        }
    }

    // Ref fields (manual map as they might differ in structure sometimes)
    const refName = document.getElementById('ref-name');
    if (refName) refName.value = ref.nome || acc.referenteNome || '';

    // Note: HTML removed ref fields? NO, I copied details page HTML which assumes referencing logic.
    // Wait, `dettaglio_account_azienda.html` as created in previous step DOES have referencing like `detail-referenteNome`.
    // BUT `map` above handled `dettaglio_account_privato.html` IDs.
    // In `dettaglio_account_privato` HTML, ref IDs are `detail-referenteNome`.
    // I need to ensure my JS map matches the HTML I wrote.
    // Checking `dettaglio_account_azienda.html` created: NO, IT DOES NOT HAVE Ref fields in the "Dettaglio" VIEW mode in the Credenziali section?
    // Looking at `dettaglio_account_privato.html` source: It did NOT have Ref fields in the main credentials section visible in the snippet I read? 
    // Wait, let me re-examine `dettaglio_account_privato.html` lines 64-152. NO REF FIELDS there.
    // Ref fields are usually in a separate section if present, or maybe not in View mode?
    // Ah, I missed scrolling down in `dettaglio_account_privato.html` view.
    // BUT in `render` function of `dettaglio_account_privato.js`: 
    // `detail-referenteNome`, `detail-referenteTelefono`.
    // Does the HTML have them?
    // I created `dettaglio_account_azienda.html` by duplicating `dettaglio_account_privato.html`.
    // Let's assume the HTML structure is there. If not, map won't find elements and that's fine.

    // Banking
    let bankingArr = [];
    if (Array.isArray(acc.banking)) {
        bankingArr = acc.banking;
    } else if (acc.banking && acc.banking.iban) {
        bankingArr = [acc.banking];
    } else if (acc.iban) {
        bankingArr = [{ iban: acc.iban, cards: [] }];
    }

    const hasBanking = acc.isBanking === true;
    const sectionBanking = document.getElementById('section-banking');
    if (sectionBanking) sectionBanking.classList.toggle('hidden', !hasBanking);

    if (hasBanking) {
        const bankingContent = document.getElementById('banking-content');
        if (bankingContent) {
            bankingContent.innerHTML = bankingArr.map((bank, idx) => `
                <div class="space-y-4 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 border-glow relative">
                     <div class="bg-black/20 p-2.5 rounded-xl border border-white/5">
                        <div class="micro-data-row">
                            <span class="micro-data-label">IBAN</span>
                            <span class="micro-data-value text-emerald-400 font-mono tracking-wider truncate">${bank.iban || '-'}</span>
                            <button class="micro-btn-copy-inline relative z-10" data-action="copy-text" data-text="${bank.iban}">
                                <span class="material-symbols-outlined !text-[14px]">content_copy</span>
                            </button>
                        </div>
                    </div>
                </div>
             `).join('');

            // Use event delegation or re-attach listeners if needed for copy buttons inside dynamic content
            bankingContent.querySelectorAll('[data-action="copy-text"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    window.copyText(btn.getAttribute('data-text'));
                });
            });
        }
    }
}

function setupListeners() {
    // Copy Buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            if (input) window.copyText(input.value);
        });
    });

    const copyNoteBtn = document.getElementById('copy-note');
    if (copyNoteBtn) {
        copyNoteBtn.addEventListener('click', () => {
            const t = document.getElementById('detail-note').textContent;
            window.copyText(t);
        });
    }

    // Password Toggle
    const toggle = document.getElementById('toggle-password');
    const passInput = document.getElementById('detail-password');
    if (toggle && passInput) {
        toggle.addEventListener('click', () => {
            const isMasked = passInput.classList.contains('base-shield');
            passInput.classList.toggle('base-shield');
            passInput.type = isMasked ? "text" : "password";
            const icon = toggle.querySelector('span');
            if (icon) icon.textContent = isMasked ? 'visibility_off' : 'visibility';
        });
    }

    // Website
    const webBtn = document.getElementById('open-website');
    const webInput = document.getElementById('detail-website');
    if (webBtn && webInput) {
        webBtn.addEventListener('click', () => {
            let url = webInput.value.trim();
            if (url) {
                if (!url.startsWith('http')) url = 'https://' + url;
                window.open(url, '_blank');
            }
        });
    }

    // Banking Toggle
    const bankingBtn = document.getElementById('banking-toggle');
    if (bankingBtn) {
        bankingBtn.addEventListener('click', () => {
            const content = document.getElementById('banking-content');
            const chevron = document.getElementById('banking-chevron');
            if (content) content.classList.toggle('hidden');
            if (chevron) chevron.classList.toggle('rotate-180');
        });
    }
}

// Helper Copy
window.copyText = function (text) {
    if (!text || text === '-' || text === '') return;
    navigator.clipboard.writeText(text).then(() => {
        if (window.showToast) window.showToast("Copiato!", "success");
    });
};
