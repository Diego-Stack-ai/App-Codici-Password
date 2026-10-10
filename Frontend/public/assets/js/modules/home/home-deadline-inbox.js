/**
 * Inbox dei promemoria Scadenze mostrata all'ingresso nella Home.
 */

import { createElement, setChildren } from '../../dom-utils.js';
import { listDeadlines, listDeadlineNotifications } from '../data/vault-repository.js';
import { auth } from '../../firebase-config.js?v=1.2.152';
import { onAuthStateChanged } from '/assets/js/vendor/firebase-runtime.js';
import { deadlinePresentation, projectDeadlineReminders } from '../scadenze/deadline-model.js';
import { renderHomeDeadlineDashboard, clearHomeDeadlineDashboard } from './home-deadline-dashboard.js';

let inboxEpoch = 0;
let dismissedSignature = '';
let stopCurrent = null;
let pageOffset = 0;
let pageSignature = '';
const PAGE_SIZE = 10;

const allowed = uid => Boolean(uid) && auth.currentUser?.uid === uid
    && (!window.privateAuthGate || window.privateAuthGate.isReady());

export function clearHomeDeadlineInbox() {
    ++inboxEpoch;
    document.getElementById('deadline-inbox-modal')?.remove();
}

export async function renderHomeDeadlineInbox(user, isCurrent = () => true) {
    const epoch = ++inboxEpoch;
    const active = () => epoch === inboxEpoch && allowed(user?.uid) && isCurrent();
    if (!active()) return;
    const [notifications, records] = await Promise.all([
        listDeadlineNotifications(user.uid), listDeadlines(user.uid)
    ]);
    if (!active()) return;
    const projected = projectDeadlineReminders(notifications, new Map(records.map(item => [item.id, item])));
    document.getElementById('deadline-inbox-modal')?.remove();
    if (!projected.length) return;
    const signature = JSON.stringify(projected.map(item => [item.notification.id, item.dueDate]));
    if (pageSignature !== signature) { pageOffset = 0; pageSignature = signature; }
    const makeEntry = ({notification, deadline, diffDays, dueDate}) => {

        const presentation = deadlinePresentation(deadline);
        const label = `${presentation.category}${presentation.vehicle ? ` · ${presentation.vehicle}` : ''}`;
        const when = diffDays === 0
            ? 'Scade oggi'
            : diffDays === 1
                ? 'Scade domani'
                : `Scadenza tra ${diffDays} giorni`;

        return createElement('button', {
            className: 'deadline-inbox-item',
            onclick: () => {
                if (!active()) return;
                window.location.href = `dettaglio_scadenza.html?id=${encodeURIComponent(notification.deadlineId)}&notification=${encodeURIComponent(notification.id)}`;
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'notification_important' }),
            createElement('span', { className: 'deadline-inbox-copy' }, [
                createElement('strong', { textContent: label }),
                createElement('small', { textContent: `${when} · ${dueDate.split('-').reverse().join('/')}${notification.status === 'viewed' ? ' · Già visto' : ''}` })
            ]),
            createElement('span', { className: 'material-symbols-outlined', textContent: 'chevron_right' })
        ]);
    };
    const list = createElement('div', { className: 'deadline-inbox-list' });
    const pageLabel = createElement('span', { 'aria-live': 'polite' });
    const previous = createElement('button', {className: 'btn-modal btn-secondary', textContent: 'Precedenti', onclick: () => {
        if (!active()) return;
        pageOffset = Math.max(0, pageOffset - PAGE_SIZE); renderPage();
    }});
    const next = createElement('button', {className: 'btn-modal btn-secondary', textContent: 'Successivi', onclick: () => {
        if (!active()) return;
        if (pageOffset + PAGE_SIZE < projected.length) pageOffset += PAGE_SIZE;
        renderPage();
    }});
    const renderPage = () => {
        setChildren(list, projected.slice(pageOffset, pageOffset + PAGE_SIZE).map(makeEntry));
        pageLabel.textContent = `${pageOffset + 1}–${Math.min(projected.length, pageOffset + PAGE_SIZE)} di ${projected.length}`;
        previous.disabled = pageOffset === 0;
        next.disabled = pageOffset + PAGE_SIZE >= projected.length;
    };
    renderPage();

    const modal = createElement('div', {
        id: 'deadline-inbox-modal',
        className: 'modal-overlay deadline-inbox-modal'
    }, [
        createElement('div', { className: 'modal-box deadline-inbox-box' }, [
            createElement('div', { className: 'deadline-inbox-heading' }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'notifications_active' }),
                createElement('div', {}, [
                    createElement('h2', { className: 'modal-title', textContent: 'Promemoria scadenze' }),
                    createElement('p', { textContent: `${projected.length} avvis${projected.length === 1 ? 'o' : 'i'} da controllare` })
                ])
            ]),
            list,
            ...(projected.length > PAGE_SIZE ? [createElement('div', {className: 'deadline-inbox-pagination'}, [previous, pageLabel, next])] : []),
            createElement('button', {
                className: 'btn-modal btn-secondary',
                textContent: 'Ricordamelo dopo',
                onclick: () => { dismissedSignature = signature; modal.classList.remove('active'); }
            })
        ])
    ]);
    document.body.appendChild(modal);
    requestAnimationFrame(() => {
        if (active() && signature !== dismissedSignature) modal.classList.add('active');
    });
}

// One controller per Home session; no persistent writes or changes to push policy.
export function initHomeDeadlineReminders(user) {
    stopCurrent?.();
    dismissedSignature = '';
    pageOffset = 0;
    pageSignature = '';
    let stopped = false;
    let generation = 0;
    let timer;
    let unsubscribe;
    let day = new Date().toDateString();
    const live = () => !stopped && allowed(user?.uid);
    const stop = () => {
        if (stopped) return;
        stopped = true;
        ++generation;
        clearTimeout(timer);
        unsubscribe?.();
        document.removeEventListener('visibilitychange', visible);
        window.removeEventListener('pagehide', stop);
        window.removeEventListener('private-auth-blocked', stop);
        clearHomeDeadlineInbox();
        clearHomeDeadlineDashboard();
    };
    const refresh = async () => {
        if (!live()) { stop(); return; }
        const attempt = ++generation;
        const active = () => live() && attempt === generation;
        const today = new Date().toDateString();
        if (today !== day) {
            day = today;
            clearHomeDeadlineInbox();
            clearHomeDeadlineDashboard();
        }
        const results = await Promise.allSettled([
            renderHomeDeadlineDashboard(user, active), renderHomeDeadlineInbox(user, active)
        ]);
        if (active() && results.some(result => result.status === 'rejected')) {
            clearHomeDeadlineInbox();
            clearHomeDeadlineDashboard();
            console.warn('Promemoria temporaneamente non disponibili.');
        }
    };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const schedule = () => {
        if (stopped) return;
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        timer = setTimeout(() => {
            if (!live()) { stop(); return; }
            if (document.visibilityState !== 'hidden') void refresh();
            schedule();
        }, Math.min(60000, Math.max(1, midnight - now)));
    };
    stopCurrent = stop;
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pagehide', stop);
    window.addEventListener('private-auth-blocked', stop);
    unsubscribe = onAuthStateChanged(auth, next => { if (next?.uid !== user?.uid) stop(); });
    if (stopped) unsubscribe?.();
    schedule();
    return refresh();
}
