import {auth} from '../../firebase-config.js?v=1.2.210';
import {createElement, setChildren} from '../../dom-utils.js';
import {getCurrentLanguage, t} from '../../translations.js';
import {showToast} from '../../ui-core-v129.js';
import {logError} from '../../utils.js';
import {decryptIfPossible} from '../core/crypto-utils.js';
import {ensureVaultKeyMaterial} from '../core/security-manager.js';
import {getUserProfile, getUserSetting, listDeadlines} from '../data/vault-repository.js';
import {
    isDefinitiveProfileDocumentDeadlineReference,
    normalizeProfileDateInputValue,
    normalizeLegacyProfile,
    resolveProfileDocumentDeadlineState
} from '../privato/profile-model.js';
import {createDeadlineFromDocument} from '../privato/profilo-links.js';
import {deadlineRecipientsFromRecord} from './deadline-recipient-model.js';
import {deadlineDateDisplay} from './deadline-model.js';
import {buildDeadlineDomainInventory} from './deadline-domain-model.js';

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

function scheduleText(period, frequency) {
    const values = [];
    if (period !== undefined && period !== null && period !== '') {
        values.push(`${t('deadline_personal_notice')}: ${period} ${t('deadline_personal_days')}`);
    }
    if (frequency !== undefined && frequency !== null && frequency !== '') {
        values.push(`${t('deadline_personal_frequency')}: ${frequency} ${t('deadline_personal_days')}`);
    }
    return values.join(' · ');
}

function sourceLabel(sourceId) {
    const labels = {
        deadlineConfig: 'deadline_domain_source_vehicles',
        deadlineConfigDocuments: 'deadline_domain_source_documents',
        generalConfig: 'deadline_domain_source_general'
    };
    return t(labels[sourceId] || 'deadline_domain_source_general');
}

function renderConfigurationCard(configuration) {
    const count = configuration.linkedDeadlineIds.length;
    return createElement('article', {className: 'deadline-domain-config-card'}, [
        createElement('header', {}, [
            createElement('div', {}, [
                createElement('h4', {textContent: configuration.name}),
                createElement('span', {className: 'deadline-domain-source', textContent: sourceLabel(configuration.sourceId)})
            ]),
            createElement('span', {
                className: 'deadline-domain-count',
                textContent: `${count} ${t(count === 1 ? 'deadline_domain_linked_one' : 'deadline_domain_linked_many')}`
            })
        ]),
        createElement('p', {
            className: 'deadline-domain-schedule',
            textContent: scheduleText(configuration.period, configuration.frequency) || t('deadline_domain_schedule_missing')
        }),
        configuration.templateText ? createElement('p', {
            className: 'deadline-domain-template',
            textContent: `${t('deadline_personal_message')}: ${configuration.templateText}`
        }) : null,
        createElement('a', {className: 'deadline-domain-inline-action', href: configuration.href}, [
            createElement('span', {textContent: t('deadline_domain_manage_rule')}), icon('arrow_forward')
        ])
    ].filter(Boolean));
}

function renderResourceCard(resource) {
    return createElement('article', {className: 'deadline-domain-resource-card'}, [
        createElement('div', {className: 'deadline-domain-resource-copy'}, [
            createElement('p', {textContent: resource.value}),
            createElement('span', {className: 'deadline-domain-source', textContent: sourceLabel(resource.sourceId)})
        ]),
        createElement('a', {className: 'deadline-domain-inline-action', href: resource.href}, [
            createElement('span', {textContent: t('deadline_domain_manage_rule')}), icon('arrow_forward')
        ])
    ]);
}

function renderResourceSection(titleKey, resources) {
    if (!resources.length) return null;
    return createElement('section', {className: 'deadline-domain-section'}, [
        createElement('h4', {className: 'deadline-domain-section-title', textContent: t(titleKey)}),
        createElement('div', {className: 'deadline-domain-grid'}, resources.map(renderResourceCard))
    ]);
}

function deadlineDetail(deadline) {
    return [deadline.name, deadline.veicolo_modello].filter(Boolean).join(' · ');
}

function renderMappedDeadline(deadline) {
    const recipients = deadlineRecipientsFromRecord(deadline);
    const recipientSummary = recipients.length
        ? recipients.map(recipientText).join(' | ')
        : t('deadline_personal_no_recipients');
    const details = [
        dataRow(t('deadline_personal_message'), deadline.templateText || deadline.oggetto_email),
        dataRow(t('deadline_personal_note'), deadline.notes),
        dataRow(t('deadline_personal_attachments'), Array.isArray(deadline.attachments)
            ? String(deadline.attachments.length) : '')
    ].filter(Boolean);
    const configuredSchedule = scheduleText(
        deadline.domainAudit?.configuredPeriod,
        deadline.domainAudit?.configuredFrequency
    );
    return createElement('article', {className: 'deadline-domain-deadline-card'}, [
        createElement('header', {}, [
            createElement('div', {}, [
                createElement('h4', {textContent: deadline.type || deadline.category || deadline.title || t('deadline_personal_document_fallback')}),
                deadlineDetail(deadline) ? createElement('p', {textContent: deadlineDetail(deadline)}) : null
            ].filter(Boolean)),
            createElement('time', {textContent: formatDate(deadline.dueDate || deadline.date)})
        ]),
        createElement('p', {className: 'deadline-domain-schedule', textContent: scheduleText(
            deadline.notif_days_before ?? deadline.period,
            deadline.notif_frequency ?? deadline.freq
        ) || t('deadline_domain_schedule_missing')}),
        deadline.domainAudit?.scheduleMismatch ? createElement('div', {
            className: 'deadline-domain-schedule-warning'
        }, [
            icon('info'),
            createElement('div', {}, [
                createElement('strong', {textContent: t('deadline_domain_schedule_mismatch')}),
                createElement('p', {textContent: t('deadline_domain_default_schedule')
                    .replace('{schedule}', configuredSchedule || t('deadline_domain_schedule_missing'))})
            ])
        ]) : null,
        createElement('p', {className: 'deadline-domain-recipients', textContent: recipientSummary}),
        details.length ? createElement('dl', {className: 'deadline-personal-data deadline-domain-details'}, details) : null,
        createElement('a', {
            className: 'deadline-domain-inline-action',
            href: `dettaglio_scadenza.html?id=${encodeURIComponent(deadline.id)}`
        }, [createElement('span', {textContent: t('deadline_domain_open_deadline')}), icon('arrow_forward')])
    ].filter(Boolean));
}

function renderDomainSummary(container, group) {
    if (!container) return;
    const blocks = [];
    if (group.duplicateConfigurations.length) {
        blocks.push(createElement('div', {className: 'deadline-domain-warning'}, [
            icon('warning'), createElement('p', {textContent: t('deadline_domain_duplicate_warning')})
        ]));
    }
    blocks.push(createElement('section', {className: 'deadline-domain-section'}, [
        createElement('h4', {className: 'deadline-domain-section-title', textContent: t('deadline_domain_rules_title')}),
        group.configurations.length
            ? createElement('div', {className: 'deadline-domain-grid'}, group.configurations.map(renderConfigurationCard))
            : createElement('p', {className: 'deadline-domain-empty', textContent: t('deadline_domain_rules_empty')})
    ]));
    blocks.push(renderResourceSection('deadline_domain_references_title', group.references));
    blocks.push(renderResourceSection('deadline_domain_templates_title', group.templates));
    blocks.push(createElement('section', {className: 'deadline-domain-section'}, [
        createElement('h4', {className: 'deadline-domain-section-title', textContent: t('deadline_domain_current_title')}),
        group.deadlines.length
            ? createElement('div', {className: 'deadline-domain-grid'}, group.deadlines.map(renderMappedDeadline))
            : createElement('p', {className: 'deadline-domain-empty', textContent: t('deadline_domain_current_empty')})
    ]));
    if (group.unmatchedDeadlines.length) {
        blocks.push(createElement('p', {
            className: 'deadline-domain-audit-note',
            textContent: t('deadline_domain_unmatched_warning').replace('{count}', String(group.unmatchedDeadlines.length))
        }));
    }
    setChildren(container, blocks.filter(Boolean));
}

async function loadDomainInventories(user, root, active) {
    const containers = [...root.querySelectorAll('[data-deadline-domain-summary]')];
    if (!containers.length || !user?.uid) return;
    containers.forEach(container => {
        container.setAttribute('aria-busy', 'true');
        setChildren(container, createElement('div', {className: 'deadline-personal-state'}, [
            icon('progress_activity', 'deadline-personal-spinner'),
            createElement('p', {textContent: t('deadline_domain_loading')})
        ]));
    });
    try {
        const [deadlineConfig, deadlineConfigDocuments, generalConfig, deadlines] = await Promise.all([
            getUserSetting(user.uid, 'deadlineConfig'),
            getUserSetting(user.uid, 'deadlineConfigDocuments'),
            getUserSetting(user.uid, 'generalConfig'),
            listDeadlines(user.uid)
        ]);
        if (!active()) return;
        const inventory = buildDeadlineDomainInventory({
            configs: {deadlineConfig, deadlineConfigDocuments, generalConfig}, deadlines
        });
        containers.forEach(container => renderDomainSummary(
            container,
            inventory[container.dataset.deadlineDomainSummary]
        ));
    } catch (error) {
        if (!active()) return;
        logError('DeadlineRulesDomainInventory', error);
        containers.forEach(container => setChildren(container, createElement('div', {
            className: 'deadline-personal-state is-error'
        }, [icon('error'), createElement('p', {textContent: t('deadline_domain_error')})])));
    } finally {
        if (active()) containers.forEach(container => container.setAttribute('aria-busy', 'false'));
    }
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
    void loadDomainInventories(user, root, active);
    return disposeMount;
}
