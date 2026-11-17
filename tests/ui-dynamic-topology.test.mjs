import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildDynamicThemeTopology, buildLiveryTopology, buildUiTopology, injectUiTopology} from '../scripts/build-ui-topology.mjs';

const contractPath = new URL('../scripts/ui-dynamic-theme-contract.json', import.meta.url);
const contract = JSON.parse(await readFile(contractPath, 'utf8'));


test('local dynamic roles retain stylesheet provenance and cannot leak between cases',async()=>{
 const result=buildDynamicThemeTopology();assert.deepEqual(result.errors,[]);
 const role=result.nodes.find(n=>n.id==='ui:css-role:--deadline-expired-ink');
 assert.equal(role.source_file,'Frontend/public/assets/css/scadenze.css');assert.match(role.source_location,/^L[0-9]+$/);
 const dir=await mkdtemp(path.join(tmpdir(),'ui-local-role-'));
 try{
  const bad=structuredClone(contract);bad.cases[0].paints[0].role='--deadline-expired-ink';
  const registryPath=path.join(dir,'contract.json');await writeFile(registryPath,JSON.stringify(bad));
  const broken=buildDynamicThemeTopology({registryPath});
  assert.ok(broken.errors.some(e=>e.includes(bad.cases[0].id+': unknown CSS role --deadline-expired-ink')),'a role declared only by another case is unavailable');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('profile typography links both liveries to its source, Italian labels and named regression',()=>{
 const result=buildLiveryTopology();assert.deepEqual(result.errors,[]);
 const id='ui:livery-component:profile-typography',component=result.nodes.find(n=>n.id===id);
 assert.equal(component.test_name,'approved profile typography keeps values and QR intact across both liveries');
 const edges=result.edges.filter(e=>e.source===id);
 for(const target of ['Frontend/public/assets/js/modules/privato/profilo_privato.js','Frontend/public/assets/css/profilo_privato.css','tests/ui-livery.browser.test.mjs'])assert.ok(edges.some(e=>e.target==='ui:source:'+target),target);
 assert.equal(edges.filter(e=>e.relation==='ui_declares_selector').length,4);
 const keys=['profile_personal','label_name_surname','label_cf','label_birth_data','profile_notes'];
 assert.deepEqual(edges.filter(e=>e.relation==='ui_uses_translation').map(e=>e.target).sort(),keys.map(k=>'ui:i18n:'+k).sort());
 for(const key of keys)assert.ok(result.edges.some(e=>e.source==='ui:i18n:'+key&&e.relation==='ui_translation_defined_in'&&e.target==='ui:source:Frontend/public/assets/js/translations/it.js'));
 for(const graphic of ['classic','new'])assert.ok(result.edges.some(e=>e.source==='ui:livery:'+graphic&&e.target===id&&e.observed===false));
});

test('typography mapping rejects invalid sources and unknown translated labels',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ui-typography-links-'));
 try{
  const registry=JSON.parse(await readFile(new URL('../scripts/ui-livery-contract.json',import.meta.url),'utf8'));
  registry.profileTypography.producer='../outside.js';registry.profileTypography.translations.keys[0]='missing_typography_key';
  const registryPath=path.join(dir,'contract.json');await writeFile(registryPath,JSON.stringify(registry));
  const result=buildLiveryTopology({registryPath});
  for(const text of ['invalid source','unknown typography translation'])assert.ok(result.errors.some(e=>e.includes(text)),text);
  delete registry.profileTypography.styles;delete registry.profileTypography.test;
  await writeFile(registryPath,JSON.stringify(registry));
  const missing=buildLiveryTopology({registryPath});
  for(const text of ['missing typography stylesheet','missing named typography regression'])assert.ok(missing.errors.some(e=>e.includes(text)),text);
  registry.profileTypography.test={file:123,name:'nonexistent regression'};
  await writeFile(registryPath,JSON.stringify(registry));
  assert.ok(buildLiveryTopology({registryPath}).errors.some(e=>e.includes('invalid source 123')),'a non-string source is a contract error, not a crash');
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('shared-base liveries connect all 22 pages, selectors, roles, producers and tests without inventing observations',()=>{
  const result=buildLiveryTopology();assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.summary,{pages:22,variants:2,components:9,roles:14});
  const ids=new Set(result.nodes.map(node=>node.id));
  for(const edge of result.edges){assert.ok(ids.has(edge.source)&&ids.has(edge.target));assert.equal(edge.observed,false);assert.equal(edge.declaration,'CONTRACT');}
  for(const component of result.nodes.filter(node=>node.file_type==='ui_livery_component')){
    const edges=result.edges.filter(edge=>edge.source===component.id);
    for(const relation of ['ui_rendered_by','ui_loads_stylesheet','ui_declares_test','ui_declares_selector'])assert.ok(edges.some(edge=>edge.relation===relation),component.id+'/'+relation);
  }
  assert.ok(result.files.some(file=>file.endsWith('ui-livery-contract.json')));
  assert.ok(result.files.some(file=>file.endsWith('ui-livery.browser.test.mjs')));
  assert.ok(result.files.some(file=>file.endsWith('view-tour-harness.mjs')),'the real producer test bundle affects the fingerprint');
  const cardDefinitions=result.edges.filter(edge=>edge.source==='ui:livery-color-role:--card-icon-ink'&&edge.relation==='ui_role_defined_in');
  assert.deepEqual(cardDefinitions.map(edge=>edge.target),['ui:source:Frontend/public/assets/css/core_ui.css']);
  for(const edge of result.edges.filter(edge=>edge.relation==='ui_expects_color_role'&&edge.target.includes('--companion-')))assert.deepEqual(edge.graphics,['new']);
  assert.equal(result.nodes.find(node=>node.id==='ui:livery:new').cardSaturationMultiplier,1.15);
  assert.equal(result.nodes.find(node=>node.id==='ui:livery:classic').cardSaturationMultiplier,1);
  const topology=buildUiTopology();assert.equal(topology.summary.liveryPages,22);assert.equal(topology.summary.liveryVariants,2);
});

test('native contact topology links entries, models, visual states, roles and exact named regressions',()=>{
  const result=buildLiveryTopology();assert.deepEqual(result.errors,[]);
  for(const [name,count] of [['contact-export',11],['company-card-qr',6]]){
    const id='ui:livery-component:'+name,edges=result.edges.filter(edge=>edge.source===id);
    assert.equal(edges.filter(edge=>edge.relation==='ui_declares_state').length,count);
    for(const relation of ['ui_uses_model','ui_names_regression','ui_declares_paint'])assert.ok(edges.some(edge=>edge.relation===relation),name+'/'+relation);
    const states=result.nodes.filter(node=>node.id.startsWith(id+':state:'));
    for(const state of states)assert.ok(result.edges.some(edge=>edge.source===state.id&&edge.relation==='ui_declares_state_test'),state.id);
    assert.equal(result.nodes.filter(node=>node.id.startsWith(id+':entry:')).length,2);
    for(const edge of edges.filter(edge=>edge.relation==='ui_expects_color_role'))assert.deepEqual(edge.graphics,['classic','new']);
  }
  for(const file of ['Frontend/public/assets/js/modules/shared/contact-export-model.js','Frontend/public/assets/js/modules/azienda/company-vcard.js','Frontend/public/assets/js/modules/shared/qr_code_utils.js'])assert.ok(result.edges.some(edge=>edge.target==='ui:source:'+file&&edge.relation==='ui_uses_model'),file);
  for(const file of ['Frontend/public/assets/css/profile-layout.css','Frontend/public/assets/css/dati_azienda.css'])assert.ok(result.edges.some(edge=>edge.target==='ui:source:'+file&&edge.relation==='ui_loads_stylesheet'),file);
  for(const edge of result.edges)assert.equal(edge.observed,false);
});

test('native contact topology rejects incomplete or invented state, source and regression bindings',async()=>{
  const base=JSON.parse(await readFile(new URL('../scripts/ui-livery-contract.json',import.meta.url),'utf8'));
  const mutations=[
    [r=>{delete r.contactExport.models;},'has no models'],
    [r=>{r.companyCardQr.models=[123];},'invalid source 123'],
    [r=>{r.contactExport.states.push('open');},'duplicate state'],
    [r=>{r.companyCardQr.entries.pop();},'incomplete entries'],
    [r=>{r.contactExport.tests[0].name='contact-export';},'missing named native regression'],
    [r=>{r.contactExport.tests[0].states=['unregistered-state'];},'test binds unknown state'],
    [r=>{r.companyCardQr.tests=[];},'untested state'],
    [r=>{r.companyCardQr.paints[0].role='--unknown-native-paint';},'unknown color role'],
    [r=>{r.contactExport.nonVisualStates.push('open');},'invalid nonvisual states'],
    [r=>{r.contactExport.paints[1].minimum='4.5';},'invalid native paint']
  ];
  const dir=await mkdtemp(path.join(tmpdir(),'ui-native-bindings-'));
  try{for(const [mutate,message] of mutations){const registry=structuredClone(base);mutate(registry);const registryPath=path.join(dir,'contract.json');await writeFile(registryPath,JSON.stringify(registry));assert.ok(buildLiveryTopology({registryPath}).errors.some(error=>error.includes(message)),message);}}
  finally{await rm(dir,{recursive:true,force:true});}
});

test('livery topology rejects a reduced matrix, missing producers, empty selectors and an unknown color role',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'ui-livery-links-'));
  try{
    const registry=JSON.parse(await readFile(new URL('../scripts/ui-livery-contract.json',import.meta.url),'utf8'));
    registry.palettes.pop();registry.cardGlyphs=[];registry.footer.homeProducer='../outside.js';registry.footer.inkRole='--missing-livery-color';
    const registryPath=path.join(dir,'contract.json');await writeFile(registryPath,JSON.stringify(registry));
    const result=buildLiveryTopology({registryPath});
    for(const text of ['matrix','no selectors','invalid source','unknown color role'])assert.ok(result.errors.some(error=>error.includes(text)),text);
  }finally{await rm(dir,{recursive:true,force:true});}
});

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
  const headerIcons=result.nodes.find(node=>node.id.startsWith('ui:dynamic-theme:UI275-05:paint:')&&node.selector?.includes('.btn-icon-header'));
  assert.ok(headerIcons,'header icon paint remains declared');
  const headerRoles=result.edges.filter(edge=>edge.source===headerIcons.id&&edge.relation==='ui_expects_color_role');
  assert.deepEqual(headerRoles.map(edge=>[edge.target,edge.graphics]),[
    ['ui:css-role:--text-primary',['classica']],['ui:css-role:--companion-ink',['tre-livelli']]
  ]);
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
    invalid.cases[0].paints[0].newRole = '--missing-companion-role';
    invalid.cases[0].states.push(invalid.cases[0].states[0]);
    invalid.matrix.palettes.pop();
    await writeFile(registryPath, JSON.stringify(invalid));
    const result = buildDynamicThemeTopology({registryPath});
    for (const text of ['invalid source', 'unknown CSS role', 'duplicate or invalid state', 'incomplete palettes']) {
      assert.ok(result.errors.some(error => error.includes(text)), `negative control must detect ${text}`);
    }
    assert.ok(result.errors.some(error=>error.includes('--missing-companion-role')),'variant role must be validated too');
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
