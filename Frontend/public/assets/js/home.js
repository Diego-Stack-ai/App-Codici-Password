import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

/**
 * HOME PAGE MODULE (Nuova Versione - Protocollo.1)
 * Gestisce l'interfaccia della nuova Home Page statica.
 */

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
    });
});

/**
 * Gestisce i click e gli eventi della Home Page (No Inline JS)
 */
function initHomeListeners() {
    // 1. Logout (Modal Protocollo Centralizzata)
    const logoutBtn = document.getElementById('header-logout-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            // Usa la funzione globale definita in ui-core.js
            if (typeof window.showLogoutModal === 'function') {
                const confirmed = await window.showLogoutModal();
                if (confirmed) {
                    await signOut(auth);
                    window.location.href = 'index.html';
                }
            } else {
                // Fallback di sicurezza se ui-core non è caricato
                if (confirm("Vuoi uscire?")) {
                    await signOut(auth);
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // 2. Toggle Tema (Sostituisce l'inline on click)
    const themeBtn = document.getElementById('theme-toggle-home');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
        });
    }

    // 3. Avatar Fallback (Sostituisce onerror inline)
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
    let timeGreeting = "Benvenuto";
    if (h >= 5 && h < 13) timeGreeting = "Buongiorno";
    else if (h >= 13 && h < 18) timeGreeting = "Buon pomeriggio";
    else timeGreeting = "Buonasera";

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

// Helper per impostare l'immagine avatar (Versione Tag IMG)
function setAvatarImage(element, url) {
    if (!url) return;

    // Se l'elemento passato è il BOX, cerchiamo l'immagine dentro
    let img = element.querySelector('img');
    if (!img) {
        // Se non c'è, forse l'elemento passato è già l'immagine o l'ID era quello del box
        img = document.getElementById('user-avatar-img');
    }

    if (img) {
        img.src = url;
        // FIX FOTO GIGANTE: Forziamo le dimensioni
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '50%';
    } else {
        // Fallback robusto
        console.warn("Elemento img avatar non trovato, uso background su container");
        element.style.backgroundImage = `url("${url}")`;
        element.style.backgroundSize = 'cover';
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
            // Se ci sono scadenze mostro il badge, altrimenti lo nascondo (o grigio 0.3)
            if (upcoming.length > 0) {
                upBadge.classList.remove('badge-initial-hide');
                upBadge.style.opacity = "1";
            } else {
                upBadge.classList.add('badge-initial-hide');
            }
        }
        if (upList) {
            upList.innerHTML = upcoming.slice(0, 3).map(item => renderMiniItem(item, today)).join('');
        }

        // Update UI Badge Urgenze (Scadute)
        const exBadge = document.getElementById('expired-count-badge');
        const exCount = document.getElementById('expired-count');
        const exList = document.getElementById('expired-list-container');

        if (exCount) exCount.textContent = expired.length;
        if (exBadge) {
            if (expired.length > 0) {
                exBadge.classList.remove('badge-initial-hide');
                exBadge.style.opacity = "1";
            } else {
                exBadge.classList.add('badge-initial-hide');
            }
        }
        if (exList) {
            exList.innerHTML = expired.map(item => renderMiniItem(item, today)).join('');
        }

    } catch (e) {
        console.error("Errore caricamento dashboard:", e);
    }
}

function renderMiniItem(item, today) {
    const diffTime = item.dateObj - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let label = "";
    if (diffDays < 0) label = "Scaduto";
    else if (diffDays === 0) label = "Oggi";
    else if (diffDays === 1) label = "Domani";
    else label = `${diffDays}g`;

    return `
        <div class="dashboard-list-item">
            <div class="item-content">
                <div class="item-icon-box">
                    <span class="material-symbols-outlined">${item.icon || 'event'}</span>
                </div>
                <span class="item-title">${item.title}</span>
            </div>
            <span class="item-badge">${label}</span>
        </div>`;
}


