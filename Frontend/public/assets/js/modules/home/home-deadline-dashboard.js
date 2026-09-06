/**
 * Dashboard sintetica delle Scadenze nella Home.
 */

import { createElement, clearElement } from '../../dom-utils.js';
import { t } from '../../translations.js';
import { listDeadlines } from '../data/vault-repository.js';
import { deadlineDate, deadlinePresentation } from '../scadenze/deadline-model.js';

export async function renderHomeDeadlineDashboard(user) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(today.getDate() + 30);

        const expired = [];
        const upcoming = [];
        for (const deadline of await listDeadlines(user.uid)) {
            if (deadline.completed) continue;
            const dueDate = deadlineDate(deadline);
            if (!dueDate) continue;
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate < today) expired.push({ ...deadline, dateObj: dueDate });
            else if (dueDate <= thirtyDaysLater) upcoming.push({ ...deadline, dateObj: dueDate });
        }

        expired.sort((left, right) => left.dateObj - right.dateObj);
        upcoming.sort((left, right) => left.dateObj - right.dateObj);
        renderDeadlineGroup('upcoming', upcoming, today);
        renderDeadlineGroup('expired', expired, today);
    } catch (error) {
        console.error('Errore caricamento dashboard:', error);
    }
}

function renderDeadlineGroup(prefix, items, today) {
    const badge = document.getElementById(`${prefix}-count-badge`);
    const count = document.getElementById(`${prefix}-count`);
    const list = document.getElementById(`${prefix}-list-container`);

    if (count) count.textContent = items.length;
    badge?.classList.toggle('badge-initial-hide', items.length === 0);
    if (!list) return;

    clearElement(list);
    items.slice(0, 3).forEach(item => list.appendChild(renderMiniItem(item, today)));
}

function renderMiniItem(item, today) {
    const diffDays = Math.ceil((item.dateObj - today) / (1000 * 60 * 60 * 24));
    let label = '';
    if (diffDays < 0) label = t('expired');
    else if (diffDays === 0) label = t('today');
    else if (diffDays === 1) label = t('tomorrow');
    else label = `${diffDays}g`;

    return createElement('div', { className: 'dashboard-list-item' }, [
        createElement('div', { className: 'item-icon-box' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: item.icon || 'event' })
        ]),
        createElement('span', { className: 'item-title', textContent: deadlinePresentation(item).category }),
        createElement('span', { className: 'item-badge', textContent: label })
    ]);
}
