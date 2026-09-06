/**
 * Inbox dei promemoria Scadenze mostrata all'ingresso nella Home.
 */

import { createElement } from '../../dom-utils.js';
import { getDeadline, listDeadlineNotifications } from '../data/vault-repository.js';
import { deadlinePresentation } from '../scadenze/deadline-model.js';

export async function renderHomeDeadlineInbox(user) {
    const notifications = await listDeadlineNotifications(user.uid);
    const unread = notifications
        .filter(item => item.status === 'unread')
        .sort((left, right) => {
            const leftTime = left.createdAt?.toMillis?.() || 0;
            const rightTime = right.createdAt?.toMillis?.() || 0;
            return rightTime - leftTime;
        });
    if (!unread.length || document.getElementById('deadline-inbox-modal')) return;

    const entries = (await Promise.all(unread.slice(0, 10).map(async notification => {
        const deadline = await getDeadline(user.uid, notification.deadlineId);
        if (!deadline || deadline.completed) return null;

        const presentation = deadlinePresentation(deadline);
        const label = `${presentation.category}${presentation.vehicle ? ` · ${presentation.vehicle}` : ''}`;
        const when = notification.diffDays === 0
            ? 'Scade oggi'
            : notification.diffDays === 1
                ? 'Scade domani'
                : `Scadenza tra ${notification.diffDays} giorni`;

        return createElement('button', {
            className: 'deadline-inbox-item',
            onclick: () => {
                window.location.href = `dettaglio_scadenza.html?id=${encodeURIComponent(notification.deadlineId)}&notification=${encodeURIComponent(notification.id)}`;
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'notification_important' }),
            createElement('span', { className: 'deadline-inbox-copy' }, [
                createElement('strong', { textContent: label }),
                createElement('small', { textContent: when })
            ]),
            createElement('span', { className: 'material-symbols-outlined', textContent: 'chevron_right' })
        ]);
    }))).filter(Boolean);
    if (!entries.length) return;

    const modal = createElement('div', {
        id: 'deadline-inbox-modal',
        className: 'modal-overlay deadline-inbox-modal'
    }, [
        createElement('div', { className: 'modal-box deadline-inbox-box' }, [
            createElement('div', { className: 'deadline-inbox-heading' }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'notifications_active' }),
                createElement('div', {}, [
                    createElement('h2', { className: 'modal-title', textContent: 'Promemoria scadenze' }),
                    createElement('p', { textContent: `${entries.length} avvis${entries.length === 1 ? 'o' : 'i'} da controllare` })
                ])
            ]),
            createElement('div', { className: 'deadline-inbox-list' }, entries),
            createElement('button', {
                className: 'btn-modal btn-secondary',
                textContent: 'Ricordamelo dopo',
                onclick: () => modal.classList.remove('active')
            })
        ])
    ]);
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
}
