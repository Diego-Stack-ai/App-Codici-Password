import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildDynamicThemeTopology, buildUiTopology, injectUiTopology} from '../scripts/build-ui-topology.mjs';

const contractPath = new URL('../scripts/ui-dynamic-theme-contract.json', import.meta.url);
const contract = JSON.parse(await readFile(contractPath, 'utf8'));

test('all eleven reported dynamic families connect pages, actions, producers, paints and tests', () => {
  const result = buildDynamicThemeTopology();
  assert.deepEqual(result.errors, []);
  for (let number = 1; number <= 11; number++) {
    const id = `UI275-${String(number).padStart(2, '0')}`;
    const item = contract.cases.find(item => item.id === id);
    assert.ok(item, `${id}: reported case must remain registered`);
    const node = `ui:dynamic-theme:${id}`;
    const edges = result.edges.filter(edge => edge.source === node);
    for (const relation of ['ui_rendered_by', 'ui_declares_trigger', 'ui_uses_source', 'ui_declares_test', 'ui_declares_state', 'ui_declares_paint']) {
      assert.ok(edges.some(edge => edge.relation === relation), `${id}: missing ${relation}`);
    }
    assert.equal(edges.filter(edge => edge.relation === 'ui_declares_state').length, item.states.length);
    assert.equal(edges.filter(edge => edge.relation === 'ui_declares_paint').length, item.paints.length);
    for (const state of item.states) {
      const stateId = `${node}:state:${state}`;
      const stateNode = result.nodes.find(node => node.id === stateId);
      const expectedPage = item.statePages?.[state] || item.page;
      assert.equal(stateNode.page, expectedPage);
      assert.ok(result.edges.some(edge => edge.source === `ui:page:${expectedPage}` && edge.target === stateId && edge.relation === 'ui_hosts_dynamic_state'));
      assert.ok(result.edges.some(edge => edge.source === stateId && edge.relation === 'ui_state_rendered_by'));
    }
  }
  assert.equal(result.summary.cases, contract.cases.length);
  assert.equal(result.summary.exceptions, contract.exceptions.length);
  for (const exception of contract.exceptions) {
    const node = result.nodes.find(node => node.id === `ui:theme-exception:${exception.id}`);
    assert.equal(node.selector, exception.selector);
    assert.equal(node.property, exception.property, 'an exception permits one declared property, not the whole subtree');
    assert.equal(result.edges.filter(edge => edge.target === node.id).length, exception.caseIds.length);
  }
  for (const edge of result.edges) {
    assert.equal(edge.declaration, 'CONTRACT');
    assert.equal(edge.observed, false, 'declared relationships do not invent browser PASS evidence');
    assert.ok(edge.source_file.endsWith('ui-dynamic-theme-contract.json'));
  }
  const ids = new Set(result.nodes.map(node => node.id));
  for (const edge of result.edges) assert.ok(ids.has(edge.source) && ids.has(edge.target), 'no dangling edges');
});

test('dynamic color declarations survive deterministic Graphify injection', () => {
  const topology = buildUiTopology();
  assert.equal(topology.summary.dynamicThemeCases, contract.cases.length);
  const graph = {nodes: [], links: []};
  const once = injectUiTopology(graph, topology);
  const twice = injectUiTopology(once, topology);
  assert.equal(twice.nodes.length, once.nodes.length);
  assert.equal(twice.links.length, once.links.length);
  assert.ok(twice.links.some(edge => edge.relation === 'ui_expects_color_role'));
  assert.equal(buildUiTopology().sourceFingerprint, topology.sourceFingerprint);
});

test('missing producers, unknown color roles, duplicate states and reduced theme matrices are errors', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ui-theme-links-'));
  const registryPath = path.join(dir, 'contract.json');
  try {
    const invalid = structuredClone(contract);
    invalid.cases[0].producer.path = '../outside-project.js';
    invalid.cases[0].paints[0].role = '--missing-theme-role';
    invalid.cases[0].states.push(invalid.cases[0].states[0]);
    invalid.matrix.palettes.pop();
    await writeFile(registryPath, JSON.stringify(invalid));
    const result = buildDynamicThemeTopology({registryPath});
    for (const text of ['invalid source', 'unknown CSS role', 'duplicate or invalid state', 'incomplete palettes']) {
      assert.ok(result.errors.some(error => error.includes(text)), `negative control must detect ${text}`);
    }
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('a changed dynamic state contract changes the topology fingerprint', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ui-theme-fingerprint-'));
  const dynamicThemePath = path.join(dir, 'contract.json');
  try {
    await writeFile(dynamicThemePath, JSON.stringify(contract));
    const before = buildUiTopology({dynamicThemePath}).sourceFingerprint;
    const changed = structuredClone(contract);
    changed.cases[0].states.push('negative-fixture-state');
    await writeFile(dynamicThemePath, JSON.stringify(changed));
    const after = buildUiTopology({dynamicThemePath}).sourceFingerprint;
    assert.notEqual(after, before);
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('a stylesheet change invalidates the map even outside explicitly declared dynamic sources', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ui-css-fingerprint-'));
  try {
    await mkdir(path.join(directory, 'assets/js'), {recursive:true});
    await mkdir(path.join(directory, 'assets/css'), {recursive:true});
    await writeFile(path.join(directory, 'sample.html'), '<html><head><link rel="stylesheet" href="assets/css/sample.css"></head><body>Fixture</body></html>');
    await writeFile(path.join(directory, 'assets/css/sample.css'), 'body{color:black}');
    const contractPath = path.join(directory, 'contract.json');
    const guideCatalogPath = path.join(directory, 'guide.json');
    await writeFile(contractPath, JSON.stringify({criticalFlows:[], runtimeScenarios:[], knownDormantControls:[]}));
    await writeFile(guideCatalogPath, JSON.stringify({pages:[],journeys:[]}));
    const options = {publicRoot:directory,contractPath,guideCatalogPath,dynamicThemePath:false};
    const before = buildUiTopology(options);
    await writeFile(path.join(directory, 'assets/css/sample.css'), 'body{color:blue}');
    const after = buildUiTopology(options);
    assert.equal(after.summary.stylesheets, 1);
    assert.ok(after.edges.some(edge => edge.relation === 'ui_loads_stylesheet' && edge.source === 'ui:page:sample.html'));
    assert.notEqual(after.sourceFingerprint, before.sourceFingerprint, 'CSS changes must not leave a supposedly current map');
  } finally { await rm(directory, {recursive:true,force:true}); }
});
