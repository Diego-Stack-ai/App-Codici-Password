/**
 * Dashboard sintetica delle Scadenze nella Home.
 */

import { createElement, clearElement } from '../../dom-utils.js';
import { t } from '../../translations.js';
import { listDeadlines } from '../data/vault-repository.js';
import { auth } from '../../firebase-config.js?v=1.2.128';
import { currentDiffDays, deadlineBucket, deadlinePresentation } from '../scadenze/deadline-model.js';

let dashboardEpoch = 0;

export function clearHomeDeadlineDashboard() {
    ++dashboardEpoch;
    renderDeadlineGroup('upcoming', []);
    renderDeadlineGroup('expired', []);
}

export async function renderHomeDeadlineDashboard(user, isCurrent = () => true) {
    const epoch = ++dashboardEpoch;
    const active = () => epoch === dashboardEpoch && auth.currentUser?.uid === user?.uid
        && isCurrent() && (!window.privateAuthGate || window.privateAuthGate.isReady());
    if (!user?.uid || !active()) return;
    try {
        const records = await listDeadlines(user.uid);
        if (!active()) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expired = [];
        const upcoming = [];
        for (const deadline of records) {
            if (deadline.completed) continue;
            const bucket = deadlineBucket(deadline, today);
            const diffDays = currentDiffDays(deadline.dueDate || deadline.date, today);
            if (bucket === 'urgent') expired.push({ ...deadline, diffDays });
            else if (bucket === 'upcoming') upcoming.push({ ...deadline, diffDays });
        }

        expired.sort((left, right) => left.diffDays - right.diffDays);
        upcoming.sort((left, right) => left.diffDays - right.diffDays);
        renderDeadlineGroup('upcoming', upcoming, today);
        renderDeadlineGroup('expired', expired, today);
    } catch (error) {
        if (active()) clearHomeDeadlineDashboard();
        throw error;
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
    const diffDays = item.diffDays;
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
