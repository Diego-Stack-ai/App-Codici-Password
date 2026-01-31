/**
 * URGENZE MODULE
 * Gestione delle urgenze (scadenze passate)
 */
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { logError } from './utils.js';

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
        if (badge) {
            badge.classList.remove('loading-pulse');
            badge.style.opacity = expired.length > 0 ? "1" : "0";
        }

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

                    return `
                    <div class="micro-list-item">
                        <div class="item-content">
                            <div class="item-icon-box">
                                <span class="material-symbols-outlined">${deadline.icon || 'event'}</span>
                            </div>
                            <span class="item-title">${deadline.title}</span>
                        </div>
                        <span class="item-badge">${badgeText}</span>
                    </div>`;
                }).join('');
            }
        }
    } catch (error) {
        logError("Utility Urgenze", error);
        if (error.code === 'permission-denied') {
            console.warn("Permessi insufficienti per leggere le urgenze.");
        } else if (error.code === 'unavailable') {
            console.warn("Database temporaneamente non raggiungibile.");
        }
    }
}
