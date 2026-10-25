import {db} from '../../firebase-config.js?v=1.2.234';
import {doc, setDoc} from '/assets/js/vendor/firebase-runtime.js';
import {clearElement, createElement, setChildren} from '../../dom-utils.js';
import {showConfirmModal, showToast} from '../../ui-core-v129.js';
import {t} from '../../translations.js';
import {getUserSetting} from '../data/vault-repository.js';
import {
    compileDeadlineMessage,
    deadlineRuleRouteKey,
    deadlineRuleVehicleCards,
    normalizeDeadlineConfig,
    normalizeDeadlineMessage,
    updateDeadlineRuleVehicleCards,
    validateDeadlineFrequency,
    validateDeadlineNotice,
    withDeadlineRuleIdentity,
    withDeadlineVehicleReferences
} from './deadline-config-model.js';
import {classifyDeadlineDomain, isVehicleComodatoDeadlineType} from './deadline-domain-model.js';

const LIST_FIELDS = ['deadlineTypes', 'models', 'emailTemplates'];
const CONFIG_SOURCES = Object.freeze({
    deadlineConfig: Object.freeze({settingId: 'deadlineConfig', kind: 'vehicles', listFields: LIST_FIELDS}),
    deadlineConfigDocuments: Object.freeze({settingId: 'deadlineConfigDocuments', kind: 'references', listFields: LIST_FIELDS}),
    generalConfig: Object.freeze({settingId: 'generalConfig', kind: 'general', listFields: ['deadlineTypes', 'emailTemplates']})
});
const ICON_ADD = 'add';
const ICON_DELETE = 'delete';
let currentUser = null;
let currentConfig = null;
let sharedVehicleConfig = null;
let ruleIndex = -1;
let workingObjects = [];
let currentSourceId = 'deadlineConfig';
let sourceDefinition = CONFIG_SOURCES.deadlineConfig;
let currentDomain = 'contracts';

const nextId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const currentRule = () => currentConfig?.deadlineTypes?.[ruleIndex] || null;
const usesVehicleCards = () => sourceDefinition.kind === 'vehicles' || (currentDomain === 'vehicles'
    && currentRule() && classifyDeadlineDomain({...currentRule(), sourceId: currentSourceId}) === 'vehicles')
    || (currentDomain === 'user-company' && isVehicleComodatoDeadlineType(currentRule()?.name));
const vehicleProjectionConfig = () => withDeadlineVehicleReferences(currentConfig, sharedVehicleConfig || {});

function composerDefaults() {
    const segment = key => t(key) === '{space}' ? ' ' : t(key);
    return {
        beforeObject: segment('deadline_vehicle_message_before_object'),
        betweenObjectModel: segment('deadline_vehicle_message_before_model'),
        betweenModelPlate: segment('deadline_vehicle_message_before_plate'),
        afterPlate: segment('deadline_vehicle_message_after_plate')
    };
}

function field(label, value, dataName, options = {}) {
    const control = createElement('input', {
        className: 'inline-input-glass', value: String(value ?? ''),
        type: options.type || 'text', min: options.min, max: options.max,
        ariaLabel: label, dataset: {[dataName]: ''}
    });
    return createElement('label', {className: 'vehicle-rule-field'}, [
        createElement('span', {textContent: label}), control
    ]);
}

const token = text => createElement('span', {className: 'vehicle-message-token', textContent: text});

function readMessage(row) {
    return {
        beforeObject: row.querySelector('[data-message-before-object]')?.value || '',
        betweenObjectModel: row.querySelector('[data-message-before-model]')?.value || '',
        betweenModelPlate: row.querySelector('[data-message-before-plate]')?.value || '',
        afterPlate: row.querySelector('[data-message-after-plate]')?.value || ''
    };
}

function updatePreview(card) {
    const vehicle = card?.querySelector('[data-vehicle-row]');
    const preview = card?.querySelector('[data-vehicle-preview]');
    if (!preview) return;
    preview.textContent = compileDeadlineMessage({
        objectText: currentRule()?.name || '',
        model: vehicle?.querySelector('[data-vehicle-model]')?.value || t('deadline_vehicle_model_example'),
        plate: vehicle?.querySelector('[data-vehicle-plate]')?.value || t('deadline_vehicle_plate_example'),
        message: vehicle ? readMessage(vehicle) : composerDefaults()
    });
}

function vehicleCardTitle(vehicle = {}) {
    return [String(vehicle.model || '').trim(), String(vehicle.plate || '').trim()].filter(Boolean).join(' · ')
        || t('deadline_vehicle_new_reference');
}

function genericParameterTitle(parameter = {}) {
    return String(parameter.name || '').trim() || t('deadline_rule_new_configuration');
}

function readRuleSchedule() {
    const rule = currentRule() || {};
    return {
        period: Number(document.querySelector('[data-rule-period]')?.value ?? rule.period ?? 14),
        freq: Number(document.querySelector('[data-rule-frequency]')?.value ?? rule.freq ?? 7)
    };
}

function renderRuleSchedule(rule) {
    return createElement('section', {className: 'vehicle-rule-schedule-card'}, [
        createElement('h3', {textContent: t('deadline_vehicle_schedule_title')}),
        createElement('p', {textContent: t('deadline_vehicle_schedule_help')}),
        createElement('div', {className: 'vehicle-rule-fields two-columns vehicle-rule-schedule'}, [
            field(t('deadline_personal_notice'), rule.period ?? 14, 'rulePeriod', {type: 'number', min: '0', max: '3650'}),
            field(t('deadline_personal_frequency'), rule.freq ?? 7, 'ruleFrequency', {type: 'number', min: '1', max: '30'})
        ])
    ]);
}

function renderVehicleCard(vehicle, vehicleIndex) {
    const message = normalizeDeadlineMessage(vehicle.message, composerDefaults());
    const row = createElement('div', {
        className: 'vehicle-rule-object-content vehicle-card-content',
        dataset: {vehicleRow: '', vehicleId: vehicle.id || nextId('vehicle')}
    }, [
        createElement('div', {className: 'vehicle-reference-heading'}, [createElement('button', {
            type: 'button', className: 'btn-icon-delete', title: t('deadline_vehicle_remove'),
            onclick: async () => {
                if (!await showConfirmModal(t('deadline_vehicle_remove'), t('deadline_vehicle_remove_confirm'))) return;
                workingObjects = readWorkingVehicles();
                workingObjects.splice(vehicleIndex, 1);
                render();
            }
        }, createElement('span', {className: 'material-symbols-outlined notranslate', textContent: ICON_DELETE, translate: 'no'}))]),
        createElement('div', {className: 'vehicle-rule-fields two-columns'}, [
            field(t('deadline_vehicle_model'), vehicle.model, 'vehicleModel'),
            field(t('deadline_vehicle_plate'), vehicle.plate, 'vehiclePlate')
        ]),
        createElement('div', {className: 'vehicle-message-composer'}, [
            createElement('p', {className: 'vehicle-composer-help', textContent: t('deadline_vehicle_composer_help')}),
            createElement('div', {className: 'vehicle-message-sequence'}, [
                field(t('deadline_vehicle_text_before_object'), message.beforeObject, 'messageBeforeObject'),
                token(t('deadline_vehicle_token_object')),
                field(t('deadline_vehicle_text_before_model'), message.betweenObjectModel, 'messageBeforeModel'),
                token(t('deadline_vehicle_token_model')),
                field(t('deadline_vehicle_text_before_plate'), message.betweenModelPlate, 'messageBeforePlate'),
                token(t('deadline_vehicle_token_plate')),
                field(t('deadline_vehicle_text_after_plate'), message.afterPlate, 'messageAfterPlate')
            ])
        ]),
        createElement('div', {className: 'vehicle-message-result'}, [
            createElement('strong', {textContent: t('deadline_vehicle_result')}),
            createElement('p', {className: 'vehicle-message-preview', dataset: {vehiclePreview: ''}})
        ])
    ]);
    const card = createElement('details', {
        className: 'vehicle-rule-object vehicle-card', open: vehicleIndex === 0,
        dataset: {vehicleCard: '', vehicleId: vehicle.id || nextId('vehicle')}
    }, [
        createElement('summary', {className: 'vehicle-rule-object-header'}, [
            createElement('h3', {textContent: vehicleCardTitle(vehicle), dataset: {vehicleCardTitle: ''}}),
            iconButton('expand_more', 'vehicle-rule-object-chevron')
        ]),
        row
    ]);
    card.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
        const title = card.querySelector('[data-vehicle-card-title]');
        if (title) title.textContent = vehicleCardTitle({
            model: card.querySelector('[data-vehicle-model]')?.value,
            plate: card.querySelector('[data-vehicle-plate]')?.value
        });
        updatePreview(card);
    }));
    queueMicrotask(() => updatePreview(card));
    return card;
}

function readWorkingVehicles() {
    return [...document.querySelectorAll('[data-vehicle-card]')].map(card => {
        const row = card.querySelector('[data-vehicle-row]');
        return {
            id: row.dataset.vehicleId,
            model: row.querySelector('[data-vehicle-model]')?.value.trim() || '',
            plate: row.querySelector('[data-vehicle-plate]')?.value.trim() || '',
            message: readMessage(row)
        };
    }).filter(vehicle => vehicle.model || vehicle.plate);
}

function normalizeGenericParameters(rule, config) {
    if (Array.isArray(rule?.parameters) && rule.parameters.length) {
        return rule.parameters.map((item, index) => ({
            id: String(item.id || `parameter-${index}`),
            name: String(item.name || item.label || (Array.isArray(item.references) ? item.references[0] : '')
                || (rule.parameters.length === 1 ? rule.name : `${rule.name} ${index + 1}`) || '').trim(),
            templateText: String(item.templateText || item.text || rule.templateText || rule.name || '').trim(),
            references: sourceDefinition.kind === 'references' && Array.isArray(item.references)
                ? item.references.map(value => String(value || '').trim()).filter(Boolean) : []
        }));
    }
    const itemValue = value => String(typeof value === 'object'
        ? value?.name || value?.label || value?.value || '' : value || '').trim();
    const references = sourceDefinition.kind === 'references'
        ? (config.models || []).map(itemValue).filter(value => value
            && classifyDeadlineDomain({name: value, sourceId: currentSourceId}) === currentDomain) : [];
    const domainTemplates = (config.emailTemplates || []).map(itemValue).filter(value => value
        && classifyDeadlineDomain({name: value, sourceId: currentSourceId}) === currentDomain);
    const safeLegacyTemplate = domainTemplates.length === 1 ? domainTemplates[0] : '';
    return [{
        id: 'legacy-parameter-0', name: String(rule?.name || '').trim(),
        templateText: String(rule?.templateText || safeLegacyTemplate || rule?.name || '').trim(), references
    }];
}

function readGenericParameters() {
    return [...document.querySelectorAll('[data-object-card]')].map(card => ({
        id: card.dataset.objectId,
        name: card.querySelector('[data-parameter-name]')?.value.trim() || '',
        templateText: card.querySelector('[data-parameter-template]')?.value.trim() || '',
        references: [...card.querySelectorAll('[data-parameter-reference]')]
            .map(input => input.value.trim()).filter(Boolean)
    }));
}

function renderGenericParameter(parameter, parameterIndex) {
    const references = createElement('div', {className: 'vehicle-reference-list'},
        (parameter.references || []).map((reference, referenceIndex) => createElement('div', {
            className: 'generic-reference-row'
        }, [
            field(t('deadline_rule_reference'), reference, 'parameterReference'),
            createElement('button', {
                type: 'button', className: 'btn-icon-delete', title: t('deadline_rule_remove_reference'),
                onclick: () => {
                    workingObjects = readGenericParameters();
                    workingObjects[parameterIndex].references.splice(referenceIndex, 1);
                    render();
                }
            }, iconButton(ICON_DELETE))
        ])));
    const card = createElement('details', {
        className: 'vehicle-rule-object', open: parameterIndex === 0,
        dataset: {objectCard: '', objectId: parameter.id || nextId('parameter')}
    }, [
        createElement('summary', {className: 'vehicle-rule-object-header'}, [
            createElement('h3', {textContent: genericParameterTitle(parameter), dataset: {parameterCardTitle: ''}}),
            iconButton('expand_more', 'vehicle-rule-object-chevron')
        ]),
        createElement('div', {className: 'vehicle-rule-object-content'}, [
            createElement('div', {className: 'vehicle-rule-object-actions'}, [createElement('button', {
                type: 'button', className: 'btn-icon-delete', title: t('deadline_vehicle_remove_object'),
                onclick: async () => {
                    if (!await showConfirmModal(t('deadline_vehicle_remove_object'), t('deadline_vehicle_remove_object_confirm'))) return;
                    workingObjects = readGenericParameters();
                    workingObjects.splice(parameterIndex, 1);
                    render();
                }
            }, iconButton(ICON_DELETE))]),
            field(t('deadline_vehicle_object_name'), parameter.name, 'parameterName'),
            field(t('deadline_rule_message'), parameter.templateText, 'parameterTemplate'),
            sourceDefinition.kind === 'references' ? references : null,
            sourceDefinition.kind === 'references' ? createElement('button', {
                type: 'button', className: 'vehicle-add-reference',
                onclick: () => {
                    workingObjects = readGenericParameters();
                    workingObjects[parameterIndex].references.push('');
                    render();
                }
            }, [iconButton(ICON_ADD), createElement('span', {textContent: t('deadline_rule_add_reference')})]) : null
        ].filter(Boolean))
    ]);
    card.querySelector('[data-parameter-name]')?.addEventListener('input', event => {
        const title = card.querySelector('[data-parameter-card-title]');
        if (title) title.textContent = genericParameterTitle({name: event.currentTarget.value});
    });
    return card;
}

function iconButton(name, className = '') {
    return createElement('span', {
        className: `material-symbols-outlined notranslate${className ? ` ${className}` : ''}`,
        textContent: name, translate: 'no'
    });
}

function render() {
    const rule = currentRule();
    const editor = document.getElementById('vehicle-rule-editor');
    const empty = document.getElementById('vehicle-rule-empty');
    const container = document.getElementById('vehicle-rule-objects');
    if (!rule || !container) {
        editor?.classList.add('hidden');
        empty?.classList.remove('hidden');
        return;
    }
    document.getElementById('vehicle-rule-title').textContent = rule.name;
    empty?.classList.add('hidden');
    editor?.classList.remove('hidden');
    clearElement(container);
    container.appendChild(renderRuleSchedule(rule));
    workingObjects.forEach((object, index) => container.appendChild(usesVehicleCards()
        ? renderVehicleCard(object, index) : renderGenericParameter(object, index)));
    if (!workingObjects.length) setChildren(container,
        renderRuleSchedule(rule),
        createElement('p', {className: 'vehicle-empty', textContent: t('deadline_vehicle_no_objects')}));
}

async function save() {
    if (!currentRule() || !currentUser) return;
    const schedule = readRuleSchedule();
    workingObjects = usesVehicleCards() ? readWorkingVehicles() : readGenericParameters();
    if (!usesVehicleCards() && !workingObjects.length) {
        return showToast(t('deadline_vehicle_object_required'), 'error');
    }
    if (!usesVehicleCards() && workingObjects.some(parameter => !parameter.name)) {
        return showToast(t('deadline_rule_name_required'), 'error');
    }
    try {
        schedule.period = validateDeadlineNotice(schedule.period);
        schedule.freq = validateDeadlineFrequency(schedule.freq);
        if (!usesVehicleCards()) workingObjects = workingObjects.map(parameter => ({
            ...parameter,
            period: schedule.period,
            freq: schedule.freq
        }));
        const next = usesVehicleCards()
            ? updateDeadlineRuleVehicleCards(currentConfig, ruleIndex, workingObjects, schedule)
            : {...currentConfig, deadlineTypes: currentConfig.deadlineTypes.map((rule, index) => index === ruleIndex
                ? {...rule, parameters: workingObjects, period: schedule.period,
                    freq: schedule.freq, templateText: workingObjects[0].templateText}
                : rule)};
        next.deadlineTypes[ruleIndex] = withDeadlineRuleIdentity(next.deadlineTypes[ruleIndex], {
            id: nextId('rule'), domain: currentDomain
        });
        await setDoc(doc(db, 'users', currentUser.uid, 'settings', sourceDefinition.settingId),
            {deadlineTypes: next.deadlineTypes}, {merge: true});
        currentConfig = next;
        workingObjects = usesVehicleCards()
            ? deadlineRuleVehicleCards(currentRule(), vehicleProjectionConfig(), composerDefaults())
            : normalizeGenericParameters(currentRule(), currentConfig);
        render();
        showToast(t('success_config_saved'), 'success');
    } catch (error) {
        console.error(error);
        showToast(error.message || t('error_config_save'), 'error');
    }
}

export async function initConfigurazioneAutomezzi(user) {
    if (!user) return;
    currentUser = user;
    const params = new URLSearchParams(window.location.search);
    currentSourceId = CONFIG_SOURCES[params.get('source')] ? params.get('source') : 'deadlineConfig';
    sourceDefinition = CONFIG_SOURCES[currentSourceId];
    currentConfig = normalizeDeadlineConfig(await getUserSetting(user.uid, sourceDefinition.settingId) || {}, sourceDefinition.listFields);
    const requestedRule = params.get('rule');
    ruleIndex = currentConfig.deadlineTypes.findIndex((item, index) => deadlineRuleRouteKey(item, index) === requestedRule);
    currentDomain = ruleIndex >= 0
        ? classifyDeadlineDomain({...currentRule(), sourceId: currentSourceId})
        : 'contracts';
    sharedVehicleConfig = sourceDefinition.kind === 'vehicles' ? currentConfig : null;
    if (usesVehicleCards() && !sharedVehicleConfig) {
        sharedVehicleConfig = normalizeDeadlineConfig(await getUserSetting(user.uid, 'deadlineConfig') || {}, LIST_FIELDS);
    }
    document.title = usesVehicleCards() ? t('vehicles_config_title')
        : currentSourceId === 'generalConfig' ? t('general_config_title')
            : currentSourceId === 'deadlineConfigDocuments' ? t('documents_config_title')
                : t('vehicles_config_title');
    if (ruleIndex >= 0) workingObjects = usesVehicleCards()
        ? deadlineRuleVehicleCards(currentRule(), vehicleProjectionConfig(), composerDefaults())
        : normalizeGenericParameters(currentRule(), currentConfig);
    const addButton = document.getElementById('btn-add-email-object');
    if (addButton) {
        const addLabel = t(usesVehicleCards()
            ? 'deadline_vehicle_add_reference' : 'deadline_vehicle_add_object');
        addButton.setAttribute('aria-label', addLabel);
        addButton.title = addLabel;
    }
    addButton?.addEventListener('click', () => {
        workingObjects = usesVehicleCards() ? readWorkingVehicles() : readGenericParameters();
        workingObjects.push(usesVehicleCards()
            ? {id: nextId('vehicle'), model: '', plate: '', message: composerDefaults()}
            : {id: nextId('parameter'), name: '',
                templateText: currentRule()?.templateText || currentRule()?.name || '', references: []});
        render();
    });
    document.getElementById('btn-save-vehicle-rule')?.addEventListener('click', save);
    render();
}
