import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildUiTopology, injectUiTopology } from '../scripts/build-ui-topology.mjs';

const topology = buildUiTopology();
const contract = JSON.parse(await readFile(new URL('../scripts/ui-topology-contract.json', import.meta.url), 'utf8'));
const guide = JSON.parse(await readFile(new URL('../Frontend/public/assets/js/modules/assistant/documentation-catalog.json', import.meta.url), 'utf8'));

test('la topologia copre pagine, controlli, eventi, superfici e percorsi guida', () => {
  const { summary, diagnostics } = topology;
  assert.ok(summary.pages >= contract.coverage.minimumPages);
  assert.ok(summary.controls >= contract.coverage.minimumControls);
  assert.ok(summary.eventBindings >= contract.coverage.minimumEventBindings);
  assert.ok(summary.surfaces >= contract.coverage.minimumSurfaces);
  assert.ok(summary.unmappedControlRate <= contract.coverage.maximumUnmappedControlRate);
  assert.equal(summary.guidePages, guide.pages.length);
  assert.equal(summary.guideSteps, guide.pages.reduce((total, page) => total + page.steps.length, 0));
  assert.equal(summary.guideTargets, guide.pages.reduce((total, page) => total + page.steps.filter(step => step.target).length, 0));
  assert.equal(summary.journeys, guide.journeys.length);
  assert.equal(summary.dormantControls, contract.knownDormantControls.length);
  assert.equal(summary.unmappedControls, 0);
  assert.deepEqual(diagnostics.contractErrors, []);
  assert.deepEqual(diagnostics.guideErrors, []);
  assert.deepEqual(diagnostics.runtimeScenarioErrors, []);
});

test('nodi e archi hanno identità deterministiche e non duplicate', () => {
  assert.equal(new Set(topology.nodes.map(node => node.id)).size, topology.nodes.length);
  const edgeKeys = topology.edges.map(edge => [edge.source, edge.target, edge.relation, edge.event || '', edge.flow || '', edge.journey || ''].join('\0'));
  assert.equal(new Set(edgeKeys).size, edgeKeys.length);
  assert.match(topology.sourceFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(buildUiTopology().sourceFingerprint, topology.sourceFingerprint);
});

test('i flussi critici dichiarati sono collegati ai target e alle traduzioni', () => {
  for (const flow of contract.criticalFlows) {
    const flowEdges = topology.edges.filter(edge => edge.flow === flow.id);
    assert.ok(flowEdges.some(edge => edge.relation === `ui_${flow.target.kind}`), `${flow.id}: target non collegato`);
    for (const key of flow.translations) {
      assert.ok(flowEdges.some(edge => edge.relation === 'ui_flow_translates_with' && edge.target === `ui:i18n:${key}`),
        `${flow.id}: traduzione ${key} non collegata`);
    }
  }
});

test('i riferimenti degli handler restano confinati al callback del singolo evento', () => {
  const privacySurface = 'ui:surface:impostazioni.html:privacy-dropdown-content';
  const references = topology.edges.filter(edge => edge.relation === 'ui_handler_references' && edge.target === privacySurface);
  assert.ok(references.length >= 1, 'il callback Privacy deve riferire la propria superficie');
  assert.ok(references.every(edge => edge.source.includes(':initSettingsEvents:1345')),
    'la superficie Privacy non deve essere attribuita agli altri listener della funzione di inizializzazione');
});

test('ogni passo guida è pronto per storyboard e registrazione ordinata', () => {
  const stepNodes = topology.nodes.filter(node => node.file_type === 'ui_guide_step');
  for (const stepNode of stepNodes) {
    assert.equal(topology.edges.filter(edge => edge.source === stepNode.id && edge.relation === 'ui_guide_step_text').length, 1,
      `${stepNode.id}: testo guida non univoco`);
    if (stepNode.target_selector) {
      assert.equal(topology.edges.filter(edge => edge.source === stepNode.id && edge.relation === 'ui_targets_element').length, 1,
        `${stepNode.id}: target visivo non univoco`);
    }
  }
  const expectedNextSteps = guide.pages.reduce((total, page) => total + Math.max(0, page.steps.length - 1), 0);
  assert.equal(topology.edges.filter(edge => edge.relation === 'ui_next_step').length, expectedNextSteps);
});

test('i percorsi guida conservano ordine e passaggi fra pagine', () => {
  const memberships = topology.edges.filter(edge => edge.relation === 'ui_journey_contains_page');
  assert.equal(memberships.length, guide.journeys.reduce((total, journey) => total + journey.pageIds.length, 0));
  for (const journey of guide.journeys) {
    const nextPages = topology.edges.filter(edge => edge.relation === 'ui_next_guide_page' && edge.journey === journey.journeyId);
    assert.equal(nextPages.length, Math.max(0, journey.pageIds.length - 1));
  }
});

test('l’iniezione nel grafo Graphify è idempotente', () => {
  const base = { graph: { name: 'base' }, nodes: [{ id: 'base', label: 'base' }], links: [] };
  const once = injectUiTopology(base, topology);
  const twice = injectUiTopology(once, topology);
  assert.equal(twice.nodes.length, once.nodes.length);
  assert.equal(twice.links.length, once.links.length);
  assert.equal(twice.graph.uiTopology.sourceFingerprint, topology.sourceFingerprint);
  assert.equal(twice.graph.uiTopology.directedRelations, true);
  assert.equal(twice.directed, true);
  assert.equal(twice.multigraph, true);
});
