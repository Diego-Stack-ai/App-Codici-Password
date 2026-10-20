import {db} from '../../firebase-config.js?v=1.2.216';
import {doc, setDoc} from '/assets/js/vendor/firebase-runtime.js';
import {clearElement, createElement, setChildren} from '../../dom-utils.js';
import {showConfirmModal, showToast} from '../../ui-core-v129.js';
import {t} from '../../translations.js';
import {getUserSetting} from '../data/vault-repository.js';
import {
    compileDeadlineMessage,
    deadlineRuleEmailObjects,
    deadlineRuleRouteKey,
    normalizeDeadlineConfig,
    normalizeDeadlineMessage,
    updateDeadlineRuleEmailObjects,
    validateDeadlineFrequency,
    validateDeadlineNotice
} from './deadline-config-model.js';
import {classifyDeadlineDomain} from './deadline-domain-model.js';

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
let ruleIndex = -1;
let workingObjects = [];
let currentSourceId = 'deadlineConfig';
let sourceDefinition = CONFIG_SOURCES.deadlineConfig;
let currentDomain = 'generic';

const nextId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const currentRule = () => currentConfig?.deadlineTypes?.[ruleIndex] || null;

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
    const preview = card?.querySelector('[data-object-preview]');
    if (!preview) return;
    preview.textContent = compileDeadlineMessage({
        objectText: currentRule()?.name || '',
        model: vehicle?.querySelector('[data-vehicle-model]')?.value || t('deadline_vehicle_model_example'),
        plate: vehicle?.querySelector('[data-vehicle-plate]')?.value || t('deadline_vehicle_plate_example'),
        message: vehicle ? readMessage(vehicle) : composerDefaults()
    });
}

function renderVehicleRow(vehicle, objectIndex, vehicleIndex) {
    const message = normalizeDeadlineMessage(vehicle.message, composerDefaults());
    const row = createElement('section', {
        className: 'vehicle-reference-editor',
        dataset: {vehicleRow: '', vehicleId: vehicle.id || nextId('vehicle')}
    }, [
        createElement('div', {className: 'vehicle-reference-heading'}, [
            createElement('button', {
                type: 'button', className: 'btn-icon-delete', title: t('deadline_vehicle_remove'),
                onclick: () => {
                    workingObjects = readWorkingObjects();
                    workingObjects[objectIndex].vehicles.splice(vehicleIndex, 1);
                    render();
                }
            }, createElement('span', {className: 'material-symbols-outlined notranslate', textContent: ICON_DELETE, translate: 'no'}))
        ]),
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
        ])
    ]);
    row.querySelectorAll('input').forEach(input => input.addEventListener('input', () => updatePreview(row.closest('[data-object-card]'))));
    return row;
}

function readWorkingObjects() {
    const ruleName = currentRule()?.name || '';
    return [...document.querySelectorAll('[data-object-card]')].map(card => ({
        id: card.dataset.objectId,
        name: ruleName,
        objectText: ruleName,
        period: Number(card.querySelector('[data-object-period]')?.value || 14),
        freq: Number(card.querySelector('[data-object-frequency]')?.value || 7),
        vehicles: [...card.querySelectorAll('[data-vehicle-row]')].map(row => ({
            id: row.dataset.vehicleId,
            model: row.querySelector('[data-vehicle-model]')?.value.trim() || '',
            plate: row.querySelector('[data-vehicle-plate]')?.value.trim() || '',
            message: readMessage(row)
        })).filter(vehicle => vehicle.model || vehicle.plate)
    }));
}

function renderObject(object, objectIndex) {
    const vehicleList = createElement('div', {className: 'vehicle-reference-list'},
        object.vehicles.map((vehicle, vehicleIndex) => renderVehicleRow(vehicle, objectIndex, vehicleIndex)));
    const card = createElement('details', {
        className: 'vehicle-rule-object', open: objectIndex === 0,
        dataset: {objectCard: '', objectId: object.id || nextId('object')}
    }, [
        createElement('summary', {className: 'vehicle-rule-object-header'}, [
            createElement('h3', {textContent: t('deadline_vehicle_reference')}),
            iconButton('expand_more', 'vehicle-rule-object-chevron')
        ]),
        createElement('div', {className: 'vehicle-rule-object-content'}, [
            createElement('div', {className: 'vehicle-rule-object-actions'}, [createElement('button', {
                type: 'button', className: 'btn-icon-delete', title: t('deadline_vehicle_remove_object'),
                onclick: async () => {
                    if (!await showConfirmModal(t('deadline_vehicle_remove_object'), t('deadline_vehicle_remove_object_confirm'))) return;
                    workingObjects = readWorkingObjects();
                    workingObjects.splice(objectIndex, 1);
                    render();
                }
            }, createElement('span', {className: 'material-symbols-outlined notranslate', textContent: ICON_DELETE, translate: 'no'}))]),
            createElement('div', {className: 'vehicle-rule-fields two-columns vehicle-rule-schedule'}, [
                field(t('deadline_personal_notice'), object.period, 'objectPeriod', {type: 'number', min: '0', max: '3650'}),
                field(t('deadline_personal_frequency'), object.freq, 'objectFrequency', {type: 'number', min: '1', max: '30'})
            ]),
            vehicleList,
            createElement('button', {
                type: 'button', className: 'vehicle-add-reference',
                onclick: () => {
                    workingObjects = readWorkingObjects();
                    workingObjects[objectIndex].vehicles.push({id: nextId('vehicle'), model: '', plate: '', message: composerDefaults()});
                    render();
                }
            }, [
                createElement('span', {className: 'material-symbols-outlined notranslate', textContent: ICON_ADD, translate: 'no'}),
                createElement('span', {textContent: t('deadline_vehicle_add_reference')})
            ]),
            createElement('div', {className: 'vehicle-message-result'}, [
                createElement('strong', {textContent: t('deadline_vehicle_result')}),
                createElement('p', {className: 'vehicle-message-preview', dataset: {objectPreview: ''}})
            ])
        ])
    ]);
    card.querySelectorAll('input').forEach(input => input.addEventListener('input', () => updatePreview(card)));
    queueMicrotask(() => updatePreview(card));
    return card;
}

function normalizeGenericParameters(rule, config) {
    if (Array.isArray(rule?.parameters) && rule.parameters.length) {
        return rule.parameters.map((item, index) => ({
            id: String(item.id || `parameter-${index}`),
            period: Number(item.period ?? rule.period ?? 14),
            freq: Number(item.freq ?? rule.freq ?? 7),
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
        id: 'legacy-parameter-0', period: Number(rule?.period ?? 14), freq: Number(rule?.freq ?? 7),
        templateText: String(rule?.templateText || safeLegacyTemplate || rule?.name || '').trim(), references
    }];
}

function readGenericParameters() {
    return [...document.querySelectorAll('[data-object-card]')].map(card => ({
        id: card.dataset.objectId,
        period: Number(card.querySelector('[data-object-period]')?.value || 14),
        freq: Number(card.querySelector('[data-object-frequency]')?.value || 7),
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
    return createElement('details', {
        className: 'vehicle-rule-object', open: parameterIndex === 0,
        dataset: {objectCard: '', objectId: parameter.id || nextId('parameter')}
    }, [
        createElement('summary', {className: 'vehicle-rule-object-header'}, [
            createElement('h3', {textContent: t('deadline_vehicle_reference')}),
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
            createElement('div', {className: 'vehicle-rule-fields two-columns vehicle-rule-schedule'}, [
                field(t('deadline_personal_notice'), parameter.period, 'objectPeriod', {type: 'number', min: '0', max: '3650'}),
                field(t('deadline_personal_frequency'), parameter.freq, 'objectFrequency', {type: 'number', min: '1', max: '30'})
            ]),
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
    workingObjects.forEach((object, index) => container.appendChild(sourceDefinition.kind === 'vehicles'
        ? renderObject(object, index) : renderGenericParameter(object, index)));
    if (!workingObjects.length) setChildren(container,
        createElement('p', {className: 'vehicle-empty', textContent: t('deadline_vehicle_no_objects')}));
}

async function save() {
    if (!currentRule() || !currentUser) return;
    workingObjects = sourceDefinition.kind === 'vehicles' ? readWorkingObjects() : readGenericParameters();
    if (!workingObjects.length) return showToast(t('deadline_vehicle_object_required'), 'error');
    try {
        if (sourceDefinition.kind !== 'vehicles') workingObjects = workingObjects.map(parameter => ({
            ...parameter,
            period: validateDeadlineNotice(parameter.period),
            freq: validateDeadlineFrequency(parameter.freq)
        }));
        const next = sourceDefinition.kind === 'vehicles'
            ? updateDeadlineRuleEmailObjects(currentConfig, ruleIndex, workingObjects)
            : {...currentConfig, deadlineTypes: currentConfig.deadlineTypes.map((rule, index) => index === ruleIndex
                ? {...rule, parameters: workingObjects, period: workingObjects[0].period,
                    freq: workingObjects[0].freq, templateText: workingObjects[0].templateText}
                : rule)};
        const first = sourceDefinition.kind === 'vehicles'
            ? next.deadlineTypes[ruleIndex].emailObjects[0] : next.deadlineTypes[ruleIndex].parameters[0];
        next.deadlineTypes[ruleIndex] = {...next.deadlineTypes[ruleIndex], period: first.period, freq: first.freq};
        await setDoc(doc(db, 'users', currentUser.uid, 'settings', sourceDefinition.settingId),
            {deadlineTypes: next.deadlineTypes}, {merge: true});
        currentConfig = next;
        workingObjects = sourceDefinition.kind === 'vehicles'
            ? deadlineRuleEmailObjects(currentRule(), currentConfig, composerDefaults())
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
    currentDomain = params.get('domain') || 'generic';
    document.title = currentSourceId === 'generalConfig' ? t('general_config_title')
        : currentSourceId === 'deadlineConfigDocuments' ? t('documents_config_title')
            : t('vehicles_config_title');
    currentConfig = normalizeDeadlineConfig(await getUserSetting(user.uid, sourceDefinition.settingId) || {}, sourceDefinition.listFields);
    const requestedRule = params.get('rule');
    ruleIndex = currentConfig.deadlineTypes.findIndex((item, index) => deadlineRuleRouteKey(item, index) === requestedRule);
    if (ruleIndex >= 0) workingObjects = sourceDefinition.kind === 'vehicles'
        ? deadlineRuleEmailObjects(currentRule(), currentConfig, composerDefaults())
        : normalizeGenericParameters(currentRule(), currentConfig);
    document.getElementById('btn-add-email-object')?.addEventListener('click', () => {
        workingObjects = sourceDefinition.kind === 'vehicles' ? readWorkingObjects() : readGenericParameters();
        workingObjects.push(sourceDefinition.kind === 'vehicles'
            ? {id: nextId('object'), name: currentRule()?.name || '', objectText: currentRule()?.name || '',
                period: currentRule()?.period || 14, freq: currentRule()?.freq || 7, vehicles: []}
            : {id: nextId('parameter'), period: currentRule()?.period || 14, freq: currentRule()?.freq || 7,
                templateText: currentRule()?.templateText || currentRule()?.name || '', references: []});
        render();
    });
    document.getElementById('btn-save-vehicle-rule')?.addEventListener('click', save);
    render();
}
