/**
 * SCADENZE MODULE
 * Gestione delle scadenze imminenti e dei badge
 */
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from './firebase-config.js';

export async function loadUrgentDeadlinesCount(user) {
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const colRef = collection(db, "users", user.uid, "scadenze");
        const snap = await getDocs(colRef);

        const items = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.completed) return;
            if (data.dueDate) {
                const due = new Date(data.dueDate); due.setHours(0, 0, 0, 0);
                const days = data.notificationDaysBefore || 7;
                const start = new Date(due); start.setDate(start.getDate() - days);
                if (today >= start && today <= due) {
                    items.push({ ...data, id: d.id, due: due });
                }
            }
        });

        items.sort((a, b) => a.due - b.due);

        const badge = document.getElementById('urgent-count-badge');
        const count = document.getElementById('urgent-count');
        if (count) count.textContent = items.length;
        if (badge) badge.style.opacity = items.length > 0 ? "1" : "0";

        const list = document.getElementById('deadline-list-container');
        if (list) {
            if (items.length === 0) list.innerHTML = '';
            else {
                list.innerHTML = items.map(deadline => {
                    const daysUntil = Math.ceil((deadline.due - today) / (1000 * 60 * 60 * 24));
                    let badgeColor = 'background: #3b82f6;';
                    let badgeText = `${daysUntil}g`;

                    if (daysUntil < 0) { badgeColor = 'background: #ef4444;'; badgeText = 'Scaduto'; }
                    else if (daysUntil === 0) { badgeColor = 'background: #ef4444;'; badgeText = 'Oggi'; }
                    else if (daysUntil === 1) { badgeColor = 'background: #f97316;'; badgeText = 'Domani'; }
                    else if (daysUntil <= 3) { badgeColor = 'background: #f97316;'; }

                    const icon = deadline.icon || 'event';
                    const title = deadline.title || 'Scadenza';
                    let cardGradient = 'linear-gradient(135deg, #FF9800 0%, #E65100 100%)';
                    if (daysUntil < 0) cardGradient = 'linear-gradient(135deg, #6d1a1a 0%, #1a0505 100%)';

                    return `
                    <div class="titanium-interactive border-glow dynamic-card" style="background: ${cardGradient};">
                        <div class="card-shine"></div>
                        <div class="card-content">
                            <span class="material-symbols-outlined" style="color: white; font-size: 18px;">${icon}</span>
                            <div class="card-text">
                                <span class="card-title">${title}</span>
                                <span class="card-subtext">${deadline.veicolo_modello || deadline.descrizione || ''}</span>
                            </div>
                        </div>
                        <div class="card-badge" style="${badgeColor}">${badgeText}</div>
                    </div>`;
                }).join('');
            }
        }
    } catch (e) { console.error("Errore loadScadenze:", e); }
}
