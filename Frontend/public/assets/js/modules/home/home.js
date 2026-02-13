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

// Stato Globale
let currentUser = null;

// 1. AUTH LISTENER
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Redirect se non loggato
            window.location.href = 'index.html';
            return;
        }

        currentUser = user;
        console.log("Utente autenticato:", user.email);

        // Renderizza Info Utente (Header)
        await renderHeaderUser(user);

        // Renderizza Scadenze e Urgenze
        await renderDashboardDeadlines(user);

        // Inizializza Listeners (Logout, Tema, Avatar Fallback)
        initHomeListeners();

        // 4. SBLOCCO VISIBILITÀ (Anti-Flicker Ready)
        document.documentElement.setAttribute("data-i18n", "ready");
    });
});

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

    let displayName = toFriendlyName(user.displayName || user.email.split('@')[0]);
    if (uName) uName.textContent = displayName; // Set preliminare

    // 3. Foto Utente (da Auth)
    if (user.photoURL && uAvatar) {
        setAvatarImage(uAvatar, user.photoURL);
    }

    // 4. Recupero Dati Completi da Firestore (per nome completo e foto aggiornata)
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Aggiorna Nome Completo
            const fullName = toFriendlyName(`${data.nome || ''} ${data.cognome || ''}`.trim());
            if (fullName) {
                uName.textContent = fullName;
            }

            // Aggiorna Foto (se presente in Firestore vince su Auth)
            const firestorePhoto = data.photoURL || data.avatar;
            if (firestorePhoto && uAvatar) {
                setAvatarImage(uAvatar, firestorePhoto);
            }
        }
    } catch (e) {
        console.warn("Errore recupero profilo Firestore:", e);
    }
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
                upBadge.classList.add('opacity-100'); // Use class instead of inline style
            } else {
                upBadge.classList.add('badge-initial-hide');
                upBadge.classList.remove('opacity-100');
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
                exBadge.classList.add('opacity-100');
            } else {
                exBadge.classList.add('badge-initial-hide');
                exBadge.classList.remove('opacity-100');
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
        createElement('div', { className: 'item-content' }, [
            createElement('div', { className: 'item-icon-box' }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: item.icon || 'event' })
            ]),
            createElement('span', { className: 'item-title', textContent: item.title })
        ]),
        createElement('span', { className: 'item-badge', textContent: labelText })
    ]);
}
