import { auth, db } from './firebase-config.js';
import {
    collection, getDocs, writeBatch, orderBy, query, limit
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

let currentUid = null;

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);
const showConfirmModal = (t, m, c, d) => window.showConfirmModal ? window.showConfirmModal(t, m, c, d) : Promise.resolve(confirm(m));

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUid = user.uid;
            loadNotifications(user.uid);
            initEvents();
        } else {
            window.location.href = 'index.html';
        }
    });
});

function initEvents() {
    document.getElementById('btn-clear-history')?.addEventListener('click', clearHistory);
}

async function loadNotifications(uid) {
    const list = document.getElementById('notifications-list');
    const loading = document.getElementById('loading-indicator');
    const empty = document.getElementById('empty-state');

    if (!list) return;

    try {
        const q = query(
            collection(db, 'users', uid, 'notifications'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const snap = await getDocs(q);

        if (loading) loading.classList.add('hidden');

        if (snap.empty) {
            list.classList.add('hidden');
            if (empty) empty.classList.remove('hidden');
            return;
        }

        if (empty) empty.classList.add('hidden');
        list.classList.remove('hidden');
        list.innerHTML = '';

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const date = data.timestamp ? new Date(data.timestamp.toDate()) : new Date();
            const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

            const config = getNotificationConfig(data.type);

            const item = document.createElement('div');
            item.className = 'glass-card p-4 flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300';
            item.innerHTML = `
                <div class="size-12 rounded-2xl flex-center border ${config.border} ${config.bg} ${config.color} shadow-sm">
                    <span class="material-symbols-outlined filled text-xl">${config.icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] font-black text-white/80 uppercase truncate">${data.message || 'Avviso di Sistema'}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[9px] font-bold text-white/20 uppercase tracking-widest">${config.label}</span>
                        <div class="size-1 rounded-full bg-white/5"></div>
                        <span class="text-[9px] font-bold text-white/40 uppercase tracking-widest">${dateStr} • ${timeStr}</span>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });

    } catch (e) {
        console.error(e);
        if (loading) loading.classList.add('hidden');
        showToast("Errore caricamento notifiche", "error");
    }
}

function getNotificationConfig(type) {
    const base = { icon: 'notifications', bg: 'bg-white/5', border: 'border-white/10', color: 'text-white/40', label: 'Sistema' };

    switch (type) {
        case 'invite_accepted':
            return { icon: 'check_circle', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', color: 'text-emerald-400', label: 'Collaborazione' };
        case 'invite_rejected':
        case 'share_revoked':
            return { icon: 'cancel', bg: 'bg-red-500/10', border: 'border-red-500/20', color: 'text-red-400', label: 'Accesso' };
        case 'deadline':
            return { icon: 'warning', bg: 'bg-amber-500/10', border: 'border-amber-500/20', color: 'text-amber-400', label: 'Scadenza' };
        case 'security':
            return { icon: 'shield', bg: 'bg-blue-500/10', border: 'border-blue-500/20', color: 'text-blue-400', label: 'Sicurezza' };
        default:
            return base;
    }
}

async function clearHistory() {
    if (!currentUid) return;

    const ok = await showConfirmModal("SVUOTA STORICO", "Vuoi davvero cancellare definitivamente tutte le notifiche? L'azione non è reversibile.", "Svuota Tutto", true);
    if (!ok) return;

    const list = document.getElementById('notifications-list');
    const loading = document.getElementById('loading-indicator');
    const empty = document.getElementById('empty-state');

    try {
        if (loading) loading.classList.remove('hidden');
        if (list) list.classList.add('hidden');

        const q = collection(db, 'users', currentUid, 'notifications');
        const snap = await getDocs(q);

        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        if (list) list.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        if (loading) loading.classList.add('hidden');

        showToast("Cronologia svuotata", "success");
    } catch (e) {
        console.error(e);
        showToast("Errore cancellazione", "error");
        if (loading) loading.classList.add('hidden');
        if (list) list.classList.remove('hidden');
    }
}
