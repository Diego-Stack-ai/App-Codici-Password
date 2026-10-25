import {auth, db} from '../../firebase-config.js?v=1.2.235';
import {doc, setDoc} from '/assets/js/vendor/firebase-runtime.js';
import {createElement, setChildren} from '../../dom-utils.js';
import {getCurrentLanguage, t} from '../../translations.js';
import {showConfirmModal, showInputModal, showToast} from '../../ui-core-v129.js';
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
import {
    appendDeadlineType,
    deadlineRuleRouteKey,
    updateDeadlineType,
    validateDeadlineFrequency,
    validateDeadlineNotice,
    withDeadlineRuleIdentity
} from './deadline-config-model.js';

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
        dataRow(t('deadline_personal_message'), deadline.templateText || deadline.oggetto_email),
        dataRow(t('deadline_personal_attachments'), Array.isArray(deadline.attachments)
            ? String(deadline.attachments.length) : '')
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

    const content = createElement('div', {className: 'deadline-personal-card-content'}, [
        renderDocumentReference(documentItem),
        deadlineIsAvailable ? renderDeadlineSummary(deadline) : createElement('p', {
            className: 'deadline-personal-missing',
            textContent: t('deadline_personal_missing_deadline')
        }),
        action
    ]);

    return createElement('details', {
        className: 'deadline-personal-card',
        dataset: {profileDocumentId: documentItem.id}
    }, [
        createElement('summary', {className: 'deadline-personal-card-header'}, [
            createElement('span', {className: 'deadline-personal-card-icon'}, icon('badge')),
            createElement('div', {}, [
                createElement('h3', {textContent: documentItem.type || t('deadline_personal_document_fallback')}),
                createElement('span', {
                    className: `deadline-personal-status ${deadlineIsAvailable ? 'is-linked' : 'is-unlinked'}`,
                    textContent: t(deadlineIsAvailable
                        ? 'deadline_personal_status_linked'
                        : 'deadline_personal_status_to_configure')
                })
            ]),
            icon('expand_more', 'deadline-personal-card-chevron')
        ]),
        content
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

function renderConfigurationCard(configuration, actions = {}) {
    const count = configuration.linkedDeadlineIds.length;
    const countLabel = `${count} ${t(count === 1 ? 'deadline_domain_linked_one' : 'deadline_domain_linked_many')}`;
    const manageHref = `configurazione_automezzi.html?source=${encodeURIComponent(configuration.sourceId)}`
        + `&rule=${encodeURIComponent(configuration.routeKey)}&domain=${encodeURIComponent(configuration.domain)}`;
    return createElement('article', {className: 'deadline-domain-config-card'}, [
        createElement('header', {}, [
            createElement('div', {}, [
                createElement('h4', {textContent: configuration.name}),
                createElement('span', {className: 'deadline-domain-source', textContent: sourceLabel(configuration.sourceId)})
            ]),
            count ? createElement('a', {
                className: 'deadline-domain-count deadline-domain-count-link',
                href: `scadenze.html?rule=${encodeURIComponent(configuration.name)}`,
                textContent: countLabel
            }) : createElement('span', {className: 'deadline-domain-count', textContent: countLabel})
        ]),
        createElement('p', {
            className: 'deadline-domain-schedule',
            textContent: scheduleText(configuration.period, configuration.frequency) || t('deadline_domain_schedule_missing')
        }),
        configuration.templateText ? createElement('p', {
            className: 'deadline-domain-template',
            textContent: `${t('deadline_personal_message')}: ${configuration.templateText}`
        }) : null,
        createElement('div', {className: 'deadline-domain-card-actions'}, [
            createElement('button', {
                type: 'button', className: 'deadline-domain-icon-action',
                title: t('deadline_domain_rename_rule'),
                ariaLabel: t('deadline_domain_rename_rule'),
                onclick: () => actions.rename?.(configuration)
            }, icon('edit')),
            createElement('button', {
                type: 'button', className: 'deadline-domain-icon-action is-danger',
                title: t('deadline_domain_delete_rule'),
                ariaLabel: t('deadline_domain_delete_rule'),
                onclick: () => actions.remove?.(configuration)
            }, icon('delete')),
            createElement('a', {className: 'deadline-domain-inline-action', href: manageHref}, [
            createElement('span', {textContent: t('deadline_domain_manage_rule')}), icon('arrow_forward')
            ])
        ].filter(Boolean))
    ].filter(Boolean));
}

function renderDomainSummary(container, group, actions = {}) {
    if (!container) return;
    const blocks = [];
    blocks.push(createElement('section', {className: 'deadline-domain-section'}, [
        createElement('h4', {className: 'deadline-domain-section-title', textContent: t('deadline_domain_rules_title')}),
        group.configurations.length
            ? createElement('div', {className: 'deadline-domain-grid'}, group.configurations.map(item => renderConfigurationCard(item, actions)))
            : createElement('p', {className: 'deadline-domain-empty', textContent: t('deadline_domain_rules_empty')})
    ]));
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
        const configsBySource = {deadlineConfig, deadlineConfigDocuments, generalConfig};
        const persistRules = async (sourceId, nextRules) => {
            if (!Object.hasOwn(configsBySource, sourceId)) throw new Error(t('deadline_domain_error'));
            await setDoc(doc(db, 'users', user.uid, 'settings', sourceId), {deadlineTypes: nextRules}, {merge: true});
            if (active()) await loadDomainInventories(user, root, active);
        };
        const actions = {
            async rename(configuration) {
                if (configuration.linkedDeadlineIds.length) {
                    showToast(t('deadline_domain_rule_linked_blocked'), 'info');
                    return;
                }
                const name = await showInputModal(t('deadline_domain_rename_rule'), configuration.name, t('deadline_domain_rule_name'));
                if (!name?.trim() || name.trim() === configuration.name) return;
                const sourceConfig = configsBySource[configuration.sourceId] || {deadlineTypes: []};
                const next = updateDeadlineType(sourceConfig, configuration.sourceIndex, {
                    ...sourceConfig.deadlineTypes[configuration.sourceIndex], name: name.trim()
                });
                await persistRules(configuration.sourceId, next.deadlineTypes);
            },
            async remove(configuration) {
                if (configuration.linkedDeadlineIds.length) {
                    showToast(t('deadline_domain_rule_linked_blocked'), 'info');
                    return;
                }
                if (!await showConfirmModal(t('deadline_domain_delete_rule'), t('deadline_domain_delete_rule_confirm'))) return;
                const sourceConfig = configsBySource[configuration.sourceId] || {deadlineTypes: []};
                const next = sourceConfig.deadlineTypes.filter((_, index) => index !== configuration.sourceIndex);
                await persistRules(configuration.sourceId, next);
            }
        };
        containers.forEach(container => renderDomainSummary(container,
            inventory[container.dataset.deadlineDomainSummary], actions));

        root.querySelectorAll('[data-deadline-add-rule]').forEach(addRule => {
            addRule.onclick = async () => {
                const domain = addRule.dataset.deadlineAddRule || 'contracts';
                const sourceId = domain === 'vehicles' ? 'deadlineConfig' : 'generalConfig';
                const sourceConfig = configsBySource[sourceId] || {deadlineTypes: []};
                const name = await showInputModal(t('deadline_domain_new_rule'), '', t('deadline_domain_rule_name'));
                if (!name?.trim()) return;
                const periodValue = await showInputModal(t('prompt_days_notice'), '14', t('prompt_days_notice'));
                if (periodValue === null) return;
                const frequencyValue = await showInputModal(t('prompt_freq_days'), '7', t('prompt_freq_days'));
                if (frequencyValue === null) return;
                try {
                    const next = appendDeadlineType(sourceConfig, withDeadlineRuleIdentity({
                        name: name.trim(), period: validateDeadlineNotice(periodValue),
                        freq: validateDeadlineFrequency(frequencyValue), domain
                    }, {id: `rule-${globalThis.crypto?.randomUUID?.() || Date.now()}`, domain}));
                    await persistRules(sourceId, next.deadlineTypes);
                } catch (error) {
                    showToast(error.message || t('error_config_save'), 'error');
                }
            };
        });
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
