import {db} from '../../firebase-config.js?v=1.2.214';
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
    updateDeadlineRuleEmailObjects
} from './deadline-config-model.js';

const LIST_FIELDS = ['deadlineTypes', 'models', 'emailTemplates'];
const ICON_ADD = 'add';
const ICON_DELETE = 'delete';
let currentUser = null;
let currentConfig = null;
let ruleIndex = -1;
let workingObjects = [];

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
        objectText: card.querySelector('[data-object-text]')?.value || '',
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
            createElement('strong', {textContent: t('deadline_vehicle_reference')}),
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
    return [...document.querySelectorAll('[data-object-card]')].map(card => ({
        id: card.dataset.objectId,
        name: card.querySelector('[data-object-name]')?.value.trim() || '',
        objectText: card.querySelector('[data-object-text]')?.value.trim() || '',
        period: Number(card.querySelector('[data-object-period]')?.value || 14),
        freq: Number(card.querySelector('[data-object-frequency]')?.value || 7),
        vehicles: [...card.querySelectorAll('[data-vehicle-row]')].map(row => ({
            id: row.dataset.vehicleId,
            model: row.querySelector('[data-vehicle-model]')?.value.trim() || '',
            plate: row.querySelector('[data-vehicle-plate]')?.value.trim() || '',
            message: readMessage(row)
        })).filter(vehicle => vehicle.model || vehicle.plate)
    })).filter(item => item.name || item.objectText);
}

function renderObject(object, objectIndex) {
    const vehicleList = createElement('div', {className: 'vehicle-reference-list'},
        object.vehicles.map((vehicle, vehicleIndex) => renderVehicleRow(vehicle, objectIndex, vehicleIndex)));
    const card = createElement('article', {
        className: 'vehicle-rule-object', dataset: {objectCard: '', objectId: object.id || nextId('object')}
    }, [
        createElement('header', {className: 'vehicle-rule-object-header'}, [
            createElement('h3', {textContent: object.name || t('deadline_vehicle_email_object')}),
            createElement('button', {
                type: 'button', className: 'btn-icon-delete', title: t('deadline_vehicle_remove_object'),
                onclick: async () => {
                    if (!await showConfirmModal(t('deadline_vehicle_remove_object'), t('deadline_vehicle_remove_object_confirm'))) return;
                    workingObjects = readWorkingObjects();
                    workingObjects.splice(objectIndex, 1);
                    render();
                }
            }, createElement('span', {className: 'material-symbols-outlined notranslate', textContent: ICON_DELETE, translate: 'no'}))
        ]),
        createElement('div', {className: 'vehicle-rule-fields'}, [
            field(t('deadline_vehicle_object_name'), object.name, 'objectName'),
            field(t('deadline_vehicle_object_text'), object.objectText, 'objectText')
        ]),
        createElement('div', {className: 'vehicle-rule-fields two-columns'}, [
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
    ]);
    card.querySelectorAll('input').forEach(input => input.addEventListener('input', () => updatePreview(card)));
    queueMicrotask(() => updatePreview(card));
    return card;
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
    workingObjects.forEach((object, index) => container.appendChild(renderObject(object, index)));
    if (!workingObjects.length) setChildren(container,
        createElement('p', {className: 'vehicle-empty', textContent: t('deadline_vehicle_no_objects')}));
}

async function save() {
    if (!currentRule() || !currentUser) return;
    workingObjects = readWorkingObjects();
    if (!workingObjects.length) return showToast(t('deadline_vehicle_object_required'), 'error');
    try {
        const next = updateDeadlineRuleEmailObjects(currentConfig, ruleIndex, workingObjects);
        const first = next.deadlineTypes[ruleIndex].emailObjects[0];
        next.deadlineTypes[ruleIndex] = {...next.deadlineTypes[ruleIndex], period: first.period, freq: first.freq};
        await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'deadlineConfig'),
            {deadlineTypes: next.deadlineTypes}, {merge: true});
        currentConfig = next;
        workingObjects = deadlineRuleEmailObjects(currentRule(), currentConfig, composerDefaults());
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
    currentConfig = normalizeDeadlineConfig(await getUserSetting(user.uid, 'deadlineConfig') || {}, LIST_FIELDS);
    const requestedRule = new URLSearchParams(window.location.search).get('rule');
    ruleIndex = currentConfig.deadlineTypes.findIndex((item, index) => deadlineRuleRouteKey(item, index) === requestedRule);
    if (ruleIndex >= 0) workingObjects = deadlineRuleEmailObjects(currentRule(), currentConfig, composerDefaults());
    document.getElementById('btn-add-email-object')?.addEventListener('click', () => {
        workingObjects = readWorkingObjects();
        workingObjects.push({id: nextId('object'), name: currentRule()?.name || '', objectText: currentRule()?.name || '',
            period: currentRule()?.period || 14, freq: currentRule()?.freq || 7, vehicles: []});
        render();
    });
    document.getElementById('btn-save-vehicle-rule')?.addEventListener('click', save);
    render();
}
