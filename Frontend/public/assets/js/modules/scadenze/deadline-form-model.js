import {
    compileDeadlineMessage,
    deadlineRuleRouteKey,
    deadlineRuleVehicleCards,
    resolveDocumentDeadlineTemplate,
    vehicleReferenceLabel,
    withDeadlineVehicleReferences
} from './deadline-config-model.js';
import {
    classifyDeadlineDomain,
    isPersonalDocumentDeadlineType,
    normalizeDeadlineDomainValue
} from './deadline-domain-model.js';

export const DEADLINE_FORM_DOMAINS = Object.freeze([
    {id: 'personal', labelKey: 'deadline_domain_personal', icon: 'badge'},
    {id: 'vehicles', labelKey: 'deadline_domain_vehicles', icon: 'directions_car'},
    {id: 'home', labelKey: 'deadline_domain_home', icon: 'home_work'},
    {id: 'health', labelKey: 'deadline_domain_health', icon: 'cardiology'},
    {id: 'sport', labelKey: 'deadline_domain_sport', icon: 'sports'},
    {id: 'contracts', labelKey: 'deadline_domain_contracts', icon: 'contract'},
    {id: 'user-company', labelKey: 'deadline_domain_user_company', icon: 'handshake'},
    {id: 'company', labelKey: 'deadline_domain_company', icon: 'domain'}
]);

const SOURCES = Object.freeze([
    {id: 'deadlineConfig', mode: 'automezzi'},
    {id: 'deadlineConfigDocuments', mode: 'documenti'},
    {id: 'generalConfig', mode: 'generali'}
]);

function itemText(value) {
    if (value && typeof value === 'object') {
        return String(value.name || value.label || value.value || value.title || '').trim();
    }
    return String(value || '').trim();
}

function stableRuleId(sourceId, rule, index) {
    return String(rule?.id || '').trim() || `${sourceId}:${deadlineRuleRouteKey(rule, index)}`;
}

function genericParameters(rule, config, domain) {
    if (Array.isArray(rule?.parameters) && rule.parameters.length) {
        return rule.parameters.flatMap((parameter, parameterIndex) => {
            const parameterId = String(parameter?.id || `parameter-${parameterIndex}`);
            const name = String(parameter?.name || parameter?.label || rule.name || '').trim();
            const templateText = String(parameter?.templateText || parameter?.text
                || rule.templateText || rule.name || '').trim();
            const references = Array.isArray(parameter?.references)
                ? parameter.references.map(itemText).filter(Boolean) : [];
            if (!references.length) return [{
                id: parameterId,
                parameterId,
                label: name || rule.name,
                detail: name || rule.name,
                templateText
            }];
            return references.map((reference, referenceIndex) => ({
                id: `${parameterId}:reference-${referenceIndex}`,
                parameterId,
                referenceIndex,
                label: [name, reference].filter(Boolean).join(' · '),
                detail: reference,
                templateText
            }));
        });
    }

    const references = (Array.isArray(config?.models) ? config.models : [])
        .map(itemText)
        .filter(value => value && classifyDeadlineDomain({name: value}) === domain);
    const templateText = String(rule?.templateText || rule?.name || '').trim();
    if (references.length) return references.map((reference, index) => ({
        id: `legacy-parameter-0:reference-${index}`,
        parameterId: 'legacy-parameter-0',
        referenceIndex: index,
        label: reference,
        detail: reference,
        templateText
    }));
    return [{
        id: 'legacy-parameter-0',
        parameterId: 'legacy-parameter-0',
        label: String(rule?.name || '').trim(),
        detail: String(rule?.name || '').trim(),
        templateText
    }];
}

function vehicleParameters(rule, sourceConfig, sharedVehicleConfig) {
    const projection = withDeadlineVehicleReferences(sourceConfig, sharedVehicleConfig || {});
    return deadlineRuleVehicleCards(rule, projection).map((vehicle, index) => ({
        id: String(vehicle.id || `vehicle-${index}`),
        parameterId: String(vehicle.id || `vehicle-${index}`),
        label: vehicleReferenceLabel(vehicle) || String(rule.name || '').trim(),
        detail: vehicleReferenceLabel(vehicle),
        model: String(vehicle.model || '').trim(),
        plate: String(vehicle.plate || '').trim(),
        templateText: compileDeadlineMessage({
            message: vehicle.message,
            objectText: rule.name,
            model: vehicle.model,
            plate: vehicle.plate
        })
    }));
}

function parametersForRule({rule, sourceId, config, sharedVehicleConfig, domain}) {
    if (domain === 'personal') {
        return genericParameters({
            ...rule,
            templateText: resolveDocumentDeadlineTemplate(config, rule.name) || rule.templateText || rule.name
        }, config, domain);
    }
    if (domain === 'vehicles' || domain === 'user-company') {
        const vehicles = vehicleParameters(rule, config, sharedVehicleConfig);
        if (vehicles.length) return vehicles;
    }
    return genericParameters(rule, config, domain);
}

export function buildDeadlineRuleCatalog(configs = {}) {
    const sharedVehicleConfig = configs.deadlineConfig || {};
    return SOURCES.flatMap(source => {
        const config = configs[source.id] || {};
        const rules = Array.isArray(config.deadlineTypes) ? config.deadlineTypes : [];
        return rules.map((rawRule, index) => {
            const rule = typeof rawRule === 'string' ? {name: rawRule} : (rawRule || {});
            const name = String(rule.name || '').trim();
            if (!name) return null;
            const domain = isPersonalDocumentDeadlineType(name)
                ? 'personal'
                : classifyDeadlineDomain({name, sourceId: source.id, domain: rule.domain});
            const routeKey = deadlineRuleRouteKey(rule, index);
            const entry = {
                id: stableRuleId(source.id, rule, index),
                ruleId: String(rule.id || '').trim() || `${source.id}:${routeKey}`,
                routeKey,
                sourceId: source.id,
                sourceIndex: index,
                mode: source.mode,
                domain,
                name,
                normalizedName: normalizeDeadlineDomainValue(name),
                period: Number(rule.period ?? 14),
                frequency: Number(rule.freq ?? 7),
                schemaVersion: Number(rule.schemaVersion || 1)
            };
            entry.parameters = parametersForRule({
                rule, sourceId: source.id, config, sharedVehicleConfig, domain
            });
            return entry;
        }).filter(Boolean);
    }).sort((left, right) => {
        const domainOrder = DEADLINE_FORM_DOMAINS.findIndex(item => item.id === left.domain)
            - DEADLINE_FORM_DOMAINS.findIndex(item => item.id === right.domain);
        return domainOrder || left.name.localeCompare(right.name, 'it');
    });
}

export function findDeadlineRule(catalog = [], selection = {}) {
    const sourceId = String(selection.ruleSourceId || '').trim();
    const ruleId = String(selection.ruleId || '').trim();
    const routeKey = String(selection.ruleRouteKey || '').trim();
    const type = normalizeDeadlineDomainValue(selection.type);
    return catalog.find(rule => ruleId && rule.ruleId === ruleId && (!sourceId || rule.sourceId === sourceId))
        || catalog.find(rule => routeKey && rule.routeKey === routeKey && (!sourceId || rule.sourceId === sourceId))
        || catalog.find(rule => type && rule.normalizedName === type)
        || null;
}

export function findDeadlineParameter(rule, selection = {}) {
    if (!rule) return null;
    const parameterId = String(selection.ruleParameterId || '').trim();
    const detail = normalizeDeadlineDomainValue(selection.detail);
    return rule.parameters.find(parameter => parameterId && (parameter.id === parameterId
        || parameter.parameterId === parameterId))
        || rule.parameters.find(parameter => detail && normalizeDeadlineDomainValue(parameter.detail) === detail)
        || rule.parameters[0]
        || null;
}

export function deadlineRuleLinkFields(rule, parameter) {
    if (!rule) return {};
    return {
        ruleDomain: rule.domain,
        ruleId: rule.ruleId,
        ruleSourceId: rule.sourceId,
        ruleRouteKey: rule.routeKey,
        ruleSchemaVersion: rule.schemaVersion,
        ruleParameterId: parameter?.id || parameter?.parameterId || '',
        ruleParameterLabel: parameter?.label || ''
    };
}
