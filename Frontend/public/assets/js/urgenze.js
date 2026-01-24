/**
 * URGENZE MODULE
 * Gestione delle urgenze (scadenze passate)
 */
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from './firebase-config.js';

export async function loadExpiredDeadlines(user) {
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const colRef = collection(db, "users", user.uid, "scadenze");
        const snap = await getDocs(colRef);

        const expired = [];
        snap.forEach(d => {
            const data = d.data();
            if (!data.completed && data.dueDate) {
                const due = new Date(data.dueDate); due.setHours(0, 0, 0, 0);
                if (due < today) expired.push({ ...data, id: d.id, due });
            }
        });
        expired.sort((a, b) => b.due - a.due);

        const container = document.getElementById('urgenze-list');
        if (container) {
            if (expired.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.4); font-size: 10px; font-style: italic; padding: 1rem;">Nessuna scadenza scaduta</p>';
            } else {
                container.innerHTML = expired.map(deadline => {
                    const todayNorm = new Date(); todayNorm.setHours(0, 0, 0, 0);
                    const daysAgo = Math.ceil((todayNorm - deadline.due) / (1000 * 60 * 60 * 24));
                    let badgeText = `${daysAgo}g fa`;
                    if (daysAgo === 0) badgeText = 'Oggi';
                    if (daysAgo === 1) badgeText = 'Ieri';

                    const icon = deadline.icon || 'event';
                    return `
                    <a href="scadenze.html" class="titanium-interactive border-glow dynamic-card matrix-red">
                         <div class="flex items-center gap-3 relative z-10 w-full">
                            <div class="icon-circle" style="background: rgba(255,59,48,0.2); border: 1px solid rgba(255,59,48,0.4);">
                                 <span class="material-symbols-outlined" style="font-size: 18px;">${icon}</span>
                            </div>
                            <div class="flex-1">
                                <span class="font-bold" style="font-size: 0.85rem; display: block;">${deadline.title}</span>
                                <span style="font-size: 0.65rem; opacity: 0.6;">${deadline.veicolo_modello || 'Nessun dettaglio'}</span>
                            </div>
                            <div class="flex flex-col items-end shrink-0">
                                <span class="font-bold" style="font-size: 0.7rem;">${badgeText}</span>
                                <span class="material-symbols-outlined" style="font-size: 14px; opacity: 0.4;">chevron_right</span>
                            </div>
                         </div>
                    </a>`;
                }).join('');
            }
        }
    } catch (e) {
        console.error("Errore loadUrgenze:", e);
    }
}
