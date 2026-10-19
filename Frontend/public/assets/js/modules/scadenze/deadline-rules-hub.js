import {auth} from '../../firebase-config.js?v=1.2.207';
import {createElement, setChildren} from '../../dom-utils.js';
import {getCurrentLanguage, t} from '../../translations.js';
import {showToast} from '../../ui-core-v129.js';
import {logError} from '../../utils.js';
import {decryptIfPossible} from '../core/crypto-utils.js';
import {ensureVaultKeyMaterial} from '../core/security-manager.js';
import {getUserProfile, listDeadlines} from '../data/vault-repository.js';
import {
    isDefinitiveProfileDocumentDeadlineReference,
    normalizeProfileDateInputValue,
    normalizeLegacyProfile,
    resolveProfileDocumentDeadlineState
} from '../privato/profile-model.js';
import {createDeadlineFromDocument} from '../privato/profilo-links.js';
import {deadlineRecipientsFromRecord} from './deadline-recipient-model.js';
import {deadlineDateDisplay} from './deadline-model.js';

const SELECTOR = Object.freeze({
    tab: '[data-deadline-domain]',
    panel: '[data-deadline-panel]'
});

const DOCUMENT_ENCRYPTED_FIELDS = Object.freeze([
    'num_serie', 'cf_value', 'id_number', 'license_number', 'cf',
    'rilasciato_da', 'luogo_rilascio', 'username', 'password',
    'pin', 'puk', 'codice_app', 'note', 'categoria', 'home_page'
]);
let disposeMount = () => {};

function icon(name, className = '') {
    return createElement('span', {
        className: `material-symbols-outlined notranslate${className ? ` ${className}` : ''}`,
        textContent: name,
        translate: 'no'
    });
}

function formatDate(value) {
    const normalized = normalizeProfileDateInputValue(value);
    return normalized ? deadlineDateDisplay(normalized, getCurrentLanguage()) : String(value || '').trim();
}

function definitiveDeadlineForDocument(documentItem, deadlinesById) {
    const reference = documentItem?.expiryReference;
    if (!isDefinitiveProfileDocumentDeadlineReference(reference)) return null;
    const deadline = deadlinesById.get(reference.deadlineId);
    if (!deadline || deadline.experimentTag === 'prova-scadenze'
        || deadline.linkKind !== 'profile-document-deadline-v1') return null;
    const sourceDocumentId = deadline.sourceRef?.type === 'profileDocument'
        ? deadline.sourceRef.id : deadline.sourceDocumentId;
    return sourceDocumentId === documentItem.id ? deadline : null;
}

function dataRow(label, value) {
    if (!String(value || '').trim()) return null;
    return createElement('div', {className: 'deadline-personal-data-row'}, [
        createElement('dt', {textContent: label}),
        createElement('dd', {textContent: String(value)})
    ]);
}

function renderDocumentReference(documentItem) {
    // Il Profilo resta la fonte dei dati del Documento. Qui mostriamo soltanto
    // la data minima necessaria a distinguere il richiamo, senza duplicare
    // numero, ente, rilascio, allegati o campi personalizzati.
    return createElement('dl', {className: 'deadline-personal-data deadline-personal-source-reference'}, [
        dataRow(t('deadline_personal_expiry_date'), formatDate(documentItem.expiry_date))
    ].filter(Boolean));
}

function recipientText(recipient) {
    const channels = [recipient.sendEmail ? t('deadline_personal_channel_email') : '',
        recipient.sendPush ? t('deadline_personal_channel_push') : ''].filter(Boolean).join(' + ');
    const identity = recipient.displayName || recipient.email;
    const permission = t(recipient.canManage
        ? 'deadline_personal_can_manage'
        : 'deadline_personal_view_only');
    return `${identity} · ${channels || t('deadline_personal_channel_suspended')} · ${permission}`;
}

function renderDeadlineSummary(deadline) {
    const recipients = deadlineRecipientsFromRecord(deadline);
    const notice = deadline.notif_days_before ?? deadline.period ?? 14;
    const frequency = deadline.notif_frequency ?? deadline.freq ?? 7;
    const details = [
        dataRow(t('deadline_personal_notice'), `${notice} ${t('deadline_personal_days')}`),
        dataRow(t('deadline_personal_frequency'), `${frequency} ${t('deadline_personal_days')}`),
        dataRow(t('deadline_personal_message'), deadline.templateText || deadline.oggetto_email)
    ].filter(Boolean);
    if (deadline.notes) details.push(dataRow(t('deadline_personal_note'), deadline.notes));
    return createElement('section', {className: 'deadline-personal-alert-summary'}, [
        createElement('h4', {}, [icon('notifications_active'), createElement('span', {textContent: t('deadline_personal_alert_settings')})]),
        createElement('dl', {className: 'deadline-personal-data'}, details),
        createElement('div', {className: 'deadline-personal-recipients'}, [
            createElement('strong', {textContent: t('deadline_personal_recipients')}),
            recipients.length
                ? createElement('ul', {}, recipients.map(recipient => createElement('li', {textContent: recipientText(recipient)})))
                : createElement('p', {textContent: t('deadline_personal_no_recipients')})
        ])
    ]);
}

function renderDocumentCard({documentItem, deadline, profile, active}) {
    const deadlineIsAvailable = Boolean(deadline);
    const actionDocument = deadlineIsAvailable ? documentItem : {...documentItem, expiryReference: undefined};
    const action = createElement('button', {
        type: 'button',
        className: 'deadline-personal-action',
        textContent: t(deadlineIsAvailable ? 'profile_deadline_card_open' : 'profile_deadline_card_configure')
    });
    action.addEventListener('click', async () => {
        if (!active() || action.disabled) return;
        action.disabled = true;
        try {
            await createDeadlineFromDocument(actionDocument, null, profile);
        } catch (error) {
            logError('DeadlineRulesPersonalDocumentAction', error);
            if (active()) showToast(t('profile_deadline_error'), 'error');
        } finally {
            if (active() && action.isConnected) action.disabled = false;
        }
    });

    return createElement('article', {
        className: 'deadline-personal-card',
        dataset: {profileDocumentId: documentItem.id}
    }, [
        createElement('header', {className: 'deadline-personal-card-header'}, [
            createElement('span', {className: 'deadline-personal-card-icon'}, icon('badge')),
            createElement('div', {}, [
                createElement('h3', {textContent: documentItem.type || t('deadline_personal_document_fallback')}),
                createElement('span', {
                    className: `deadline-personal-status ${deadlineIsAvailable ? 'is-linked' : 'is-unlinked'}`,
                    textContent: t(deadlineIsAvailable
                        ? 'deadline_personal_status_linked'
                        : 'deadline_personal_status_to_configure')
                })
            ])
        ]),
        renderDocumentReference(documentItem),
        deadlineIsAvailable ? renderDeadlineSummary(deadline) : createElement('p', {
            className: 'deadline-personal-missing',
            textContent: t('deadline_personal_missing_deadline')
        }),
        action
    ]);
}

async function decryptProfile(profile) {
    if (!profile) return normalizeLegacyProfile({});
    const vaultKey = await ensureVaultKeyMaterial();
    if (!vaultKey) throw new Error('VAULT_LOCKED');
    const decrypted = {...profile};
    for (const field of ['nome', 'cognome']) {
        if (decrypted[field]) decrypted[field] = await decryptIfPossible(decrypted[field], vaultKey);
    }
    decrypted.documenti = await Promise.all((profile.documenti || []).filter(Boolean).map(async item => {
        const documentItem = {...item};
        for (const field of DOCUMENT_ENCRYPTED_FIELDS) {
            if (documentItem[field]) documentItem[field] = await decryptIfPossible(documentItem[field], vaultKey);
        }
        return documentItem;
    }));
    return normalizeLegacyProfile(decrypted);
}

async function loadPersonalDocuments(user, container, active) {
    if (!container || !user?.uid) return;
    container.setAttribute('aria-busy', 'true');
    setChildren(container, createElement('div', {className: 'deadline-personal-state'}, [
        icon('progress_activity', 'deadline-personal-spinner'),
        createElement('p', {textContent: t('deadline_personal_loading')})
    ]));
    try {
        const [storedProfile, deadlines] = await Promise.all([getUserProfile(user.uid), listDeadlines(user.uid)]);
        if (!active()) return;
        const profile = await decryptProfile(storedProfile);
        if (!active()) return;
        const documents = resolveProfileDocumentDeadlineState(profile.documenti || [], deadlines);
        const deadlinesById = new Map(deadlines.map(deadline => [deadline.id, deadline]));
        const cards = documents.map(documentItem => {
            const deadline = definitiveDeadlineForDocument(documentItem, deadlinesById);
            return renderDocumentCard({documentItem, deadline, profile, active});
        });
        setChildren(container, cards.length ? createElement('div', {className: 'deadline-personal-grid'}, cards)
            : createElement('div', {className: 'deadline-personal-state'}, [
                icon('folder_off'),
                createElement('p', {textContent: t('deadline_personal_empty')})
            ]));
    } catch (error) {
        if (!active()) return;
        logError('DeadlineRulesPersonalDocuments', error);
        const retry = createElement('button', {
            type: 'button', className: 'deadline-personal-action', textContent: t('deadline_personal_retry')
        });
        retry.addEventListener('click', () => loadPersonalDocuments(user, container, active));
        setChildren(container, createElement('div', {className: 'deadline-personal-state is-error'}, [
            icon('error'),
            createElement('p', {textContent: t('deadline_personal_error')}),
            retry
        ]));
    } finally {
        if (active()) container.setAttribute('aria-busy', 'false');
    }
}

export function initDeadlineRulesHub(user) {
    disposeMount();
    const controller = new AbortController();
    disposeMount = () => controller.abort();
    const root = document.querySelector('.deadline-hub');
    if (!root) return disposeMount;
    const tabs = [...root.querySelectorAll(SELECTOR.tab)];
    const panels = [...root.querySelectorAll(SELECTOR.panel)];
    const active = () => root.isConnected && !controller.signal.aborted
        && Boolean(user?.uid) && auth.currentUser?.uid === user.uid;

    const activate = (domain, {focus = false} = {}) => {
        const next = tabs.find(tab => tab.dataset.deadlineDomain === domain) || tabs[0];
        if (!next || !active()) return;
        for (const tab of tabs) {
            const selected = tab === next;
            tab.classList.toggle('is-active', selected);
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        }
        for (const panel of panels) panel.hidden = panel.dataset.deadlinePanel !== next.dataset.deadlineDomain;
        if (focus) next.focus();
    };

    for (const tab of tabs) {
        tab.addEventListener('click', () => activate(tab.dataset.deadlineDomain), {signal: controller.signal});
        tab.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = tabs.indexOf(tab);
            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                : event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
            activate(tabs[nextIndex]?.dataset.deadlineDomain, {focus: true});
        }, {signal: controller.signal});
    }

    activate(tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.deadlineDomain);
    void loadPersonalDocuments(user, root.querySelector('#personal-documents-summary'), active);
    return disposeMount;
}
