import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {
  fileURLToPath
} from 'node:url';

const result = await build({
  entryPoints: [fileURLToPath(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-form-model.js', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false
});
const {
  buildDeadlineRuleCatalog,
  deadlineRuleLinkFields,
  findDeadlineParameter,
  findDeadlineRule
} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

const catalog = buildDeadlineRuleCatalog({
  deadlineConfig: {
    deadlineTypes: [{
      id: 'rule-bollo', name: 'Bollo', domain: 'vehicles', schemaVersion: 2,
      period: 14, freq: 7, vehicleCardsConfigured: true,
      emailObjects: [{
        id: 'object-bollo', objectText: 'Bollo', vehicles: [{
          id: 'vehicle-fl790ax', model: 'Hyundai I10', plate: 'FL790AX',
          message: {beforeObject: 'È in scadenza il ', betweenObjectModel: ' della ', betweenModelPlate: ' con targa ', afterPlate: '.'}
        }]
      }]
    }]
  },
  deadlineConfigDocuments: {
    deadlineTypes: [{id: 'rule-passaporto', name: 'Passaporto', period: 30, freq: 7, templateText: 'il passaporto'}]
  },
  generalConfig: {
    deadlineTypes: [{
      id: 'rule-visita', name: 'Visita medica', domain: 'health', period: 20, freq: 5,
      parameters: [{id: 'parameter-controllo', name: 'Controllo annuale', templateText: 'È in scadenza la visita medica'}]
    }]
  }
});

test('il catalogo unifica regole, ambiti e parametri senza duplicare la scadenza', () => {
  assert.deepEqual(catalog.map(rule => [rule.name, rule.domain]), [
    ['Passaporto', 'personal'],
    ['Bollo', 'vehicles'],
    ['Visita medica', 'health']
  ]);
  const bollo = findDeadlineRule(catalog, {ruleId: 'rule-bollo'});
  assert.equal(bollo.parameters[0].label, 'Hyundai I10 - FL790AX');
  assert.equal(bollo.parameters[0].templateText, 'È in scadenza il Bollo della Hyundai I10 con targa FL790AX.');
});

test('la selezione legacy per nome e dettaglio viene ricondotta alla regola nuova', () => {
  const visita = findDeadlineRule(catalog, {type: 'visita medica'});
  const parameter = findDeadlineParameter(visita, {detail: 'Controllo annuale'});
  assert.equal(parameter.id, 'parameter-controllo');
  assert.deepEqual(deadlineRuleLinkFields(visita, parameter), {
    ruleDomain: 'health',
    ruleId: 'rule-visita',
    ruleSourceId: 'generalConfig',
    ruleRouteKey: 'rule-visita',
    ruleSchemaVersion: 1,
    ruleParameterId: 'parameter-controllo',
    ruleParameterLabel: 'Controllo annuale'
  });
});

test('i documenti personali restano nello stesso catalogo ma in un ambito dedicato', () => {
  const passaporto = findDeadlineRule(catalog, {type: 'Passaporto'});
  assert.equal(passaporto.domain, 'personal');
  assert.equal(passaporto.period, 30);
  assert.equal(passaporto.parameters[0].templateText, 'il passaporto');
});
