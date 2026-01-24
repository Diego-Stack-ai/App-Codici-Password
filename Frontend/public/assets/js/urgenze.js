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

        // Update Badge Count
        const badge = document.getElementById('expired-count-badge');
        const count = document.getElementById('expired-count');
        if (count) count.textContent = expired.length;
        if (badge) badge.style.opacity = expired.length > 0 ? "1" : "0";

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
                        <div class="card-shine"></div>
                        <div class="card-content">
                            <div class="icon-circle">
                                <span class="material-symbols-outlined" style="font-size: 20px;">${icon}</span>
                            </div>
                            <div class="card-text">
                                <div class="card-title" style="font-size: 0.85rem; color: inherit;">${deadline.title}</div>
                            </div>
                            <div class="flex flex-col items-end shrink-0">
                                <span class="font-bold" style="font-size: 0.7rem;">${badgeText}</span>
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
