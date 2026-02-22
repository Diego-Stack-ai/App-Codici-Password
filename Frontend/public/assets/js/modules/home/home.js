/**
 * HOME PAGE MODULE (V4.1)
 * Gestisce l'interfaccia della nuova Home Page statica.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/home/.
 */

import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { t } from '../../translations.js';

/**
 * HOME PAGE MODULE (V5.0 ADAPTER)
 * Gestisce l'interfaccia della Home Page.
 * - Entry Point: initHomePage(user) (chiamato da main.js)
 */

// Stato Globale Modulo
let currentUser = null;

// 1. INIT FUNCTION (Single Orchestrator)
export async function initHomePage(user) {
    if (!user) {
        console.error("[HOME] Init chiamato senza utente!");
        return;
    }

    console.log("[HOME] Init V5.0 Dashboard...", user.email);
    currentUser = user;

    try {
        // Fetch Aziende for the shortcut logic
        const aziSnap = await getDocs(collection(db, "users", user.uid, "aziende"));
        const aziendes = aziSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Renderizza Info Utente (Header)
        await renderHeaderUser(user);

        // Renderizza Scadenze e Urgenze
        await renderDashboardDeadlines(user);

        // --- SETUP FLUSSO & PUSH SYNC (V5.0) ---
        const { initSetupFlusso } = await import('./setup_flusso.js');
        const { syncPushToken, listenForTokenRefresh } = await import('../shared/push_manager.js');

        await initSetupFlusso(user);

        // Auto-healing dei token se le notifiche sono attive
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().prefs_push !== false) {
            await syncPushToken(user);
            listenForTokenRefresh(user);
        }

        // Inizializza Listeners (Logout, Tema, Avatar Fallback)
        initHomeListeners();

        // 4. SBLOCCO VISIBILITÀ (Anti-Flicker Ready)
        document.documentElement.setAttribute("data-i18n", "ready");

        // 5. FAB Group (Footer)
        setupFABGroup(aziendes);

        console.log("[HOME] Dashboard Ready.");

    } catch (err) {
        console.error("[HOME] Init Error:", err);
    }
}

/**
 * Gestisce i click e gli eventi della Home Page (No Inline JS)
 */
function initHomeListeners() {
    // 1. Avatar Fallback (Sostituisce onerror inline)
    const avatarImg = document.getElementById('user-avatar-img');
    if (avatarImg) {
        avatarImg.addEventListener('error', function () {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00czLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYy04LTIuNjYtOC00LTh6Ii8+PC9zdmc+';
        });
    }
}


/**
 * Gestisce il rendering dell'utente nell'Header
 * (Foto, Nome, Saluto)
 */
async function renderHeaderUser(user) {
    // Riferimenti DOM
    const uAvatar = document.getElementById('header-user-avatar');
    const uGreeting = document.getElementById('home-greeting-text');
    const uName = document.getElementById('home-user-name');

    // 1. Calcolo Saluto
    const h = new Date().getHours();
    let timeGreeting = t('greeting_evening');
    if (h >= 6 && h < 13) timeGreeting = t('greeting_morning');
    else if (h >= 13 && h < 18) timeGreeting = t('greeting_afternoon');

    if (uGreeting) uGreeting.textContent = timeGreeting;

    // 2. Nome Utente (Fallback su Auth displayName o email)
    // Helper formattazione nome
    const toFriendlyName = (name) => {
        if (!name) return "";
        return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // 2. Fallback immediato Nome
    let displayName = toFriendlyName(user.displayName || user.email.split('@')[0]);
    if (uName) uName.textContent = displayName;

    // 3. Foto Utente (Auth)
    if (user.photoURL && uAvatar) setAvatarImage(uAvatar, user.photoURL);

    // 4. Firestore Profile Sync
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const fullName = toFriendlyName(`${data.nome || ''} ${data.cognome || ''}`.trim());
            if (fullName) uName.textContent = fullName;

            const firestorePhoto = data.photoURL || data.avatar;
            if (firestorePhoto && uAvatar) setAvatarImage(uAvatar, firestorePhoto);
        }
    } catch (e) { console.warn("Errore profilo Firestore:", e); }
}

// Helper per impostare l'immagine avatar
function setAvatarImage(element, url) {
    if (!url) return;

    // Se element è l'ID header-user-avatar o simile
    const img = element.querySelector('img') || document.getElementById('user-avatar-img');

    if (img) {
        img.src = url;
    }
}

/**
 * Carica e renderizza i badge e le mini-liste di Scadenze e Urgenze
 */
async function renderDashboardDeadlines(user) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(today.getDate() + 30);

        const scadenzeRef = collection(db, "users", user.uid, "scadenze");
        const snap = await getDocs(scadenzeRef);

        const expired = [];
        const upcoming = [];

        snap.forEach(d => {
            const data = d.data();
            if (data.completed) return;

            const dueDateValue = data.dueDate || data.date;
            if (!dueDateValue) return;

            const dueDate = (dueDateValue && dueDateValue.toDate) ? dueDateValue.toDate() : new Date(dueDateValue);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate < today) {
                expired.push({ ...data, id: d.id, dateObj: dueDate });
            } else if (dueDate >= today && dueDate <= thirtyDaysLater) {
                upcoming.push({ ...data, id: d.id, dateObj: dueDate });
            }
        });

        // Ordinamento
        expired.sort((a, b) => a.dateObj - b.dateObj);
        upcoming.sort((a, b) => a.dateObj - b.dateObj);

        // Update UI Badge Scadenze (Prossime)
        const upBadge = document.getElementById('upcoming-count-badge');
        const upCount = document.getElementById('upcoming-count');
        const upList = document.getElementById('upcoming-list-container');

        if (upCount) upCount.textContent = upcoming.length;
        if (upBadge) {
            if (upcoming.length > 0) {
                upBadge.classList.remove('badge-initial-hide');
            } else {
                upBadge.classList.add('badge-initial-hide');
            }
        }
        if (upList) {
            clearElement(upList);
            upcoming.slice(0, 3).forEach(item => {
                upList.appendChild(renderMiniItem(item, today));
            });
        }

        // Update UI Badge Urgenze (Scadute)
        const exBadge = document.getElementById('expired-count-badge');
        const exCount = document.getElementById('expired-count');
        const exList = document.getElementById('expired-list-container');

        if (exCount) exCount.textContent = expired.length;
        if (exBadge) {
            if (expired.length > 0) {
                exBadge.classList.remove('badge-initial-hide');
            } else {
                exBadge.classList.add('badge-initial-hide');
            }
        }
        if (exList) {
            clearElement(exList);
            expired.slice(0, 3).forEach(item => {
                exList.appendChild(renderMiniItem(item, today));
            });
        }

    } catch (e) {
        console.error("Errore caricamento dashboard:", e);
    }
}

function renderMiniItem(item, today) {
    const diffTime = item.dateObj - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let labelText = "";
    if (diffDays < 0) labelText = t('expired');
    else if (diffDays === 0) labelText = t('today');
    else if (diffDays === 1) labelText = t('tomorrow');
    else labelText = `${diffDays}g`;

    return createElement('div', { className: 'dashboard-list-item' }, [
        createElement('div', { className: 'item-icon-box' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: item.icon || 'event' })
        ]),
        createElement('span', { className: 'item-title', textContent: item.title }),
        createElement('span', { className: 'item-badge', textContent: labelText })
    ]);
}

// --- FAB GROUP (Quick Add Actions) ---
function setupFABGroup(aziendes = []) {
    // Cerca il footer per 2 secondi max
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        // Nota: In Home Page il footer è iniettato da main.js o è statico? 
        // Se è placeholder, main.js lo riempie. Dobbiamo agganciarci al centro.
        // Ma wait... Home Page ha un footer-placeholder vuoto alla riga 95.
        // main.js caricherà il componente footer standard.
        // Dobbiamo trovare #footer-center-actions DOPO che il footer è stato caricato.

        const footerCenter = document.getElementById('footer-center-actions');

        if (footerCenter) {
            clearInterval(interval);
            clearElement(footerCenter);

            // Container Gruppo
            const fabGroup = createElement('div', { className: 'fab-group' });

            // 1. Privato (SX)
            const btnPrivato = createElement('button', {
                className: 'btn-fab-action btn-fab-privato',
                title: 'Nuovo Privato',
                dataset: { label: 'Privato' },
                onclick: () => window.location.href = 'form_account_privato.html'
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'person_add' })
            ]);

            // 2. Scadenza (Centro - Principale)
            const btnScadenza = createElement('button', {
                className: 'btn-fab-action btn-fab-scadenza',
                title: 'Nuova Scadenza',
                dataset: { label: 'Scadenza' },
                onclick: () => window.location.href = 'aggiungi_scadenza.html'
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'event' })
            ]);

            // 3. Azienda (Dynamic Redirect)
            const btnAzienda = createElement('button', {
                className: 'btn-fab-action btn-fab-azienda',
                title: 'Nuovo Account Azienda',
                dataset: { label: 'Azienda' },
                onclick: () => {
                    if (aziendes.length === 1) {
                        window.location.href = `form_account_azienda.html?aziendaId=${aziendes[0].id}`;
                    } else if (aziendes.length > 1) {
                        window.location.href = 'lista_aziende.html?select=1';
                    } else {
                        window.location.href = 'modifica_azienda.html';
                    }
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'domain_add' })
            ]);

            // Assemblaggio
            fabGroup.appendChild(btnPrivato);
            fabGroup.appendChild(btnScadenza);
            fabGroup.appendChild(btnAzienda);

            footerCenter.appendChild(fabGroup);

            // Animazione Entrata Sequenziale
            const buttons = [btnPrivato, btnScadenza, btnAzienda];
            buttons.forEach((btn, index) => {
                btn.animate([
                    { transform: 'scale(0) translateY(20px)', opacity: 0 },
                    { transform: 'scale(1) translateY(0)', opacity: 1 }
                ], {
                    duration: 400,
                    delay: 500 + (index * 100), // Delay extra per aspettare caricamento footer
                    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    fill: 'backwards'
                });
            });
        }

        if (attempts > 50) clearInterval(interval); // Timeout 5s esteso per attesa fetch
    }, 100);
}
