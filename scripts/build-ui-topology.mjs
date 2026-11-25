import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const defaultPublicRoot = path.join(projectRoot, 'Frontend', 'public');
const defaultContractPath = path.join(scriptDir, 'ui-topology-contract.json');
const defaultGuideCatalogPath = path.join(defaultPublicRoot, 'assets', 'js', 'modules', 'assistant', 'documentation-catalog.json');
const defaultDynamicThemePath = path.join(scriptDir, 'ui-dynamic-theme-contract.json');
const defaultDeepThemePath = path.join(scriptDir, 'ui-deep-theme-contract.json');
const defaultLiveryPath = path.join(scriptDir, 'ui-livery-contract.json');
const CONTROL_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary', 'form']);
const TRANSLATION_ATTRIBUTES = [
  ['data-t', 'ui_translates_with', 'text'],
  ['data-t-placeholder', 'ui_translates_placeholder_with', 'placeholder'],
  ['data-t-aria', 'ui_translates_aria_with', 'aria-label'],
  ['data-t-title', 'ui_translates_title_with', 'title'],
  ['data-t-alt', 'ui_translates_alt_with', 'alt']
];

const normalize = value => String(value || '').replaceAll('\\', '/');
const relativeToProject = value => normalize(path.relative(projectRoot, value));
const lineOf = (source, index) => source.slice(0, index).split('\n').length;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function attributesOf(tagSource) {
  const attributes = {};
  const pattern = /\s([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tagSource.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function hasSurfaceIdentity(id = '', className = '') {
  if (/(?:^|[-_])(?:modal|dialog|popup|overlay|drawer|sheet|toast|panel|popover|context-menu)(?:$|[-_])/i.test(id)) return true;
  return String(className).split(/\s+/).some(token => /^(?:modal|dialog|popup|overlay|drawer|sheet|toast|panel|popover|context-menu|role-menu|dropdown-menu|settings-dropdown-panel)(?:$|--)/i.test(token)
    || /(?:-modal|-dialog|-popup|-overlay|-drawer|-sheet|-toast|-panel|-popover|-context-menu)$/i.test(token));
}

function localPage(value, currentPage) {
  if (!value || /^(?:https?:|mailto:|tel:|javascript:|#)/i.test(value)) return null;
  const clean = value.split('#')[0].split('?')[0];
  if (!clean || !/\.html$/i.test(clean)) return null;
  return normalize(path.posix.normalize(path.posix.join(path.posix.dirname(currentPage), clean)));
}

function balancedBlockEnd(source, openIndex) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return index + 1;
  }
  return source.length;
}

function functionRanges(source) {
  const ranges = [];
  const declarations = [
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g
  ];
  for (const pattern of declarations) {
    for (const match of source.matchAll(pattern)) {
      const open = source.indexOf('{', match.index + match[0].lastIndexOf('{'));
      ranges.push({ name: match[1], start: match.index, end: balancedBlockEnd(source, open) });
    }
  }
  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
}

function containingFunction(ranges, index) {
  return ranges.filter(range => range.start <= index && index < range.end)
    .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0] || null;
}

function eventCallbackRange(source, index, ranges) {
  const fragment = source.slice(index, Math.min(source.length, index + 1200));
  const argument = /\.addEventListener\(\s*["'][^"']+["']\s*,\s*/.exec(fragment)
    || /\.on(?:click|change|input|submit|keydown|keyup)\s*=\s*/.exec(fragment);
  if (!argument) return null;
  const start = index + argument.index + argument[0].length;
  const tail = source.slice(start, Math.min(source.length, start + 1000));
  const inline = /^(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/.exec(tail)
    || /^function(?:\s+[A-Za-z_$][\w$]*)?\s*\([^)]*\)\s*\{/.exec(tail);
  if (inline) {
    const open = start + inline[0].lastIndexOf('{');
    return { start: open + 1, end: balancedBlockEnd(source, open) - 1 };
  }
  const named = /^([A-Za-z_$][\w$]*)\s*[,)]/.exec(tail);
  if (!named) return null;
  return ranges.filter(range => range.name === named[1])
    .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0] || null;
}

function simpleSelector(value) {
  const trimmed = String(value || '').trim();
  if (/^#[A-Za-z][\w:.-]*$/.test(trimmed)) return trimmed;
  if (/^\.[A-Za-z_-][\w-]*$/.test(trimmed)) return trimmed;
  if (/^(?:[a-z][\w-]*)?\[(?:data-[\w-]+|role)(?:=["'][^"']+["'])?\]$/i.test(trimmed)) return trimmed;
  const action = /^\[data-action=["']?([^"'\]]+)["']?\]$/.exec(trimmed);
  return action ? `[data-action="${action[1]}"]` : null;
}

function elementMatchesSelector(element, selector) {
  if (!selector || !element) return false;
  if (selector.startsWith('#')) return element.attributes.id === selector.slice(1);
  if (selector.startsWith('.')) return String(element.attributes.class || '').split(/\s+/).includes(selector.slice(1));
  const attribute = /^(?:([a-z][\w-]*))?\[([\w-]+)(?:=["']([^"']+)["'])?\]$/i.exec(selector);
  if (!attribute) return false;
  const [, tag, name, expected] = attribute;
  if (tag && element.tag !== tag.toLowerCase()) return false;
  if (!(name.toLowerCase() in element.attributes)) return false;
  return expected === undefined || element.attributes[name.toLowerCase()] === expected;
}

function makeCollector() {
  const nodes = new Map();
  const edges = new Map();
  const addNode = node => {
    const existing = nodes.get(node.id);
    nodes.set(node.id, existing ? { ...existing, ...node } : node);
    return node.id;
  };
  const addEdge = edge => {
    const key = `${edge.source}\u0000${edge.target}\u0000${edge.relation}\u0000${edge.event || ''}\u0000${edge.flow || ''}\u0000${edge.journey || ''}`;
    if (!edges.has(key)) edges.set(key, edge);
  };
  return { nodes, edges, addNode, addEdge };
}

function uiNode(id, label, type, details = {}) {
  return {
    id,
    label,
    file_type: type,
    norm_label: String(label).toLowerCase(),
    _origin: 'ui-topology',
    ...details
  };
}

function uiEdge(source, target, relation, details = {}) {
  const requestedConfidence = details.confidence || 'EXTRACTED';
  const confidence = requestedConfidence === 'DECLARED' ? 'EXTRACTED' : requestedConfidence;
  return {
    source,
    target,
    relation,
    weight: 1,
    ...details,
    confidence,
    confidence_score: requestedConfidence === 'DECLARED' ? 0.95 : (details.confidence_score ?? 1),
    declaration: requestedConfidence === 'DECLARED' ? 'CONTRACT' : details.declaration,
    _origin: 'ui-topology'
  };
}

// These edges record declarations and their exact sources, never browser PASS results.
export function buildDynamicThemeTopology({ registryPath = defaultDynamicThemePath } = {}) {
  const collector = makeCollector();
  const errors = [];
  const files = new Set();
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  files.add(registryPath);
  const cases = Array.isArray(registry.cases) ? registry.cases : [];
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.cases)) errors.push('dynamic themes: invalid registry');
  for (const [key, expected] of Object.entries({ graphics: ['tre-livelli', 'classica'], palettes: ['blue', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose'], themes: ['light', 'dark'] })) {
    const actual = registry.matrix?.[key];
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some(value => !actual.includes(value))) errors.push(`dynamic themes: incomplete ${key} matrix`);
  }
  const ids = new Set();
  let states = 0, paints = 0;
  const source = (file, label) => {
    if (typeof file !== 'string' || !file) { errors.push(`${label}: missing source`); return null; }
    const absolute = path.resolve(projectRoot, file);
    const relative = path.relative(projectRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      errors.push(`${label}: invalid source ${file}`); return null;
    }
    files.add(absolute);
    return collector.addNode(uiNode(`ui:source:${normalize(file)}`, normalize(file), 'ui_source', { source_file: normalize(file) }));
  };
  const roleSources = [path.join(defaultPublicRoot, 'assets/css/core.css'), path.join(defaultPublicRoot, 'assets/css/core_ui.css')]
    .map(file => ({ file, text: fs.readFileSync(file, 'utf8') }));
  for (const { file } of roleSources) files.add(file);
  const declared = { confidence: 'DECLARED', source_file: relativeToProject(registryPath), observed: false };
  for (const item of cases) {
    if (!item.id || ids.has(item.id)) { errors.push(`dynamic themes: duplicate or missing id ${item.id || ''}`); continue; }
    ids.add(item.id);
    if (!item.trigger?.action || !item.producer?.export || !item.states?.length || !item.paints?.length || !item.tests?.length) {
      errors.push(`${item.id}: incomplete dynamic state contract`);
    }
    const caseId = collector.addNode(uiNode(`ui:dynamic-theme:${item.id}`, item.id, 'ui_dynamic_theme_case', {
      page: item.page, trigger: item.trigger, producer: item.producer, source_file: relativeToProject(registryPath), observed: false
    }));
    if (!/^[a-z0-9_-]+\.html$/.test(item.page || '') || !fs.existsSync(path.join(defaultPublicRoot, item.page || ''))) {
      errors.push(`${item.id}: unknown page ${item.page}`);
    } else {
      const pageId = collector.addNode(uiNode(`ui:page:${item.page}`, item.page, 'ui_page', { source_file: `Frontend/public/${item.page}` }));
      collector.addEdge(uiEdge(pageId, caseId, 'ui_declares_dynamic_theme_case', declared));
      source(`Frontend/public/${item.page}`, item.id);
    }
    const producer = source(item.producer?.path, item.id);
    if (producer) collector.addEdge(uiEdge(caseId, producer, 'ui_rendered_by', declared));
    const actionId = collector.addNode(uiNode(`${caseId}:action`, item.trigger?.action || 'missing trigger', 'ui_dynamic_action', {
      selector: item.trigger?.selector, kind: item.trigger?.kind, source_file: relativeToProject(registryPath), observed: false
    }));
    collector.addEdge(uiEdge(caseId, actionId, 'ui_declares_trigger', declared));
    const caseRoleSources = [...roleSources];
    for (const file of item.sources || []) {
      const sourceId = source(file, item.id);
      if (sourceId) {
        collector.addEdge(uiEdge(caseId, sourceId, 'ui_uses_source', declared));
        const absolute = path.resolve(projectRoot, file);
        if (file.endsWith('.css') && !caseRoleSources.some(entry => entry.file === absolute)) {
          caseRoleSources.push({file: absolute, text: fs.readFileSync(absolute, 'utf8')});
        }
      }
    }
    for (const file of item.tests || []) {
      const testId = source(file, item.id);
      if (testId) collector.addEdge(uiEdge(caseId, testId, 'ui_declares_test', declared));
    }
    const seenStates = new Set();
    for (const state of item.states || []) {
      if (typeof state !== 'string' || !state || seenStates.has(state)) { errors.push(`${item.id}: duplicate or invalid state`); continue; }
      seenStates.add(state); states++;
      const statePage = item.statePages?.[state] || item.page;
      const stateProducer = item.stateProducers?.[state] || item.producer;
      const stateId = collector.addNode(uiNode(`${caseId}:state:${state}`, `${item.id} / ${state}`, 'ui_dynamic_state', {
        page: statePage, producer: stateProducer, source_file: relativeToProject(registryPath), observed: false
      }));
      collector.addEdge(uiEdge(caseId, stateId, 'ui_declares_state', declared));
      collector.addEdge(uiEdge(actionId, stateId, 'ui_expects_dynamic_state', declared));
      if (!/^[a-z0-9_-]+\.html$/.test(statePage || '') || !fs.existsSync(path.join(defaultPublicRoot, statePage || ''))) {
        errors.push(`${item.id}/${state}: unknown state page ${statePage}`);
      } else {
        const pageId = collector.addNode(uiNode(`ui:page:${statePage}`, statePage, 'ui_page', {source_file:`Frontend/public/${statePage}`}));
        collector.addEdge(uiEdge(pageId, stateId, 'ui_hosts_dynamic_state', declared));
        source(`Frontend/public/${statePage}`, `${item.id}/${state}`);
      }
      const stateProducerId = source(stateProducer?.path, `${item.id}/${state}`);
      if (stateProducerId) collector.addEdge(uiEdge(stateId, stateProducerId, 'ui_state_rendered_by', declared));
    }
    for (const state of [...Object.keys(item.statePages || {}), ...Object.keys(item.stateProducers || {})]) {
      if (!seenStates.has(state)) errors.push(`${item.id}: metadata for unknown state ${state}`);
    }
    const seenPaints = new Map();
    for (const paint of item.paints || []) {
      const baseKey = `${paint.selector}|${paint.pseudo || ''}|${paint.property}`;
      const paintStates = paint.states || item.states || [];
      const used = seenPaints.get(baseKey) || new Set();
      if (!paint.selector || !paint.property || !paint.role || paintStates.some(state => used.has(state) || !seenStates.has(state))) {
        errors.push(`${item.id}: duplicate, unknown-state or incomplete paint ${baseKey}`); continue;
      }
      for (const state of paintStates) used.add(state);
      seenPaints.set(baseKey, used); paints++;
      const key = `${baseKey}|${[...paintStates].sort().join(',')}`;
      const paintId = collector.addNode(uiNode(`${caseId}:paint:${encodeURIComponent(key)}`, key, 'ui_dynamic_paint', {
        selector: paint.selector, pseudo: paint.pseudo, property: paint.property, states: paintStates, source_file: relativeToProject(registryPath), observed: false
      }));
      collector.addEdge(uiEdge(caseId, paintId, 'ui_declares_paint', declared));
      for (const state of paintStates) collector.addEdge(uiEdge(`${caseId}:state:${state}`, paintId, 'ui_expects_state_paint', declared));
      if(paint.newRole!==undefined&&(typeof paint.newRole!=='string'||!paint.newRole.startsWith('--')))errors.push(`${item.id}: invalid variant CSS role`);
      if(paint.darkRole!==undefined&&(typeof paint.darkRole!=='string'||!paint.darkRole.startsWith('--')))errors.push(`${item.id}: invalid dark CSS role`);
      const variants=[{role:String(paint.role),graphics:paint.newRole?['classica']:undefined,themes:paint.darkRole?['light']:undefined},
        ...(paint.darkRole?[{role:String(paint.darkRole),graphics:paint.newRole?['classica']:undefined,themes:['dark']}]:[]),
        ...(paint.newRole?[{role:String(paint.newRole),graphics:['tre-livelli']}]:[])];
      for(const {role,graphics,themes} of variants){
      const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rolePattern = new RegExp(`${escapedRole}\\s*:`);
      const definition = role.startsWith('--') ? caseRoleSources.find(({text}) => rolePattern.test(text)) : null;
      if (role.startsWith('--') && !definition) errors.push(`${item.id}: unknown CSS role ${role}`);
      const expression = /^color-mix\(in srgb,\s*var\(--[a-z0-9-]+\)\s+(?:100|[0-9]{1,2})(?:\.[0-9]+)?%,\s*transparent\)$/.test(role);
      if (!role.startsWith('--') && !expression && !['#fff', 'white', 'transparent', 'none'].includes(role)) errors.push(`${item.id}: unregistered literal ${role}`);
      const roleId = collector.addNode(uiNode(`ui:css-role:${role}`, role, 'ui_css_role', {
        source_file: definition ? relativeToProject(definition.file) : relativeToProject(registryPath),
        source_location: definition ? `L${lineOf(definition.text, definition.text.search(rolePattern))}` : undefined
      }));
      collector.addEdge(uiEdge(paintId, roleId, 'ui_expects_color_role', {...declared,...(graphics?{graphics}:{}),...(themes?{themes}:{})}));
      for (const [, variable] of role.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
        const pattern = new RegExp(`${variable}\\s*:`);
        const origin = caseRoleSources.find(({text}) => pattern.test(text));
        if (!origin) errors.push(`${item.id}: unknown CSS role ${variable}`);
        const variableId = collector.addNode(uiNode(`ui:css-role:${variable}`, variable, 'ui_css_role', {
          source_file: origin ? relativeToProject(origin.file) : relativeToProject(registryPath),
          source_location: origin ? `L${lineOf(origin.text, origin.text.search(pattern))}` : undefined
        }));
        collector.addEdge(uiEdge(roleId, variableId, 'ui_uses_color_role', declared));
      }
      }
    }
  }
  const exceptionIds = new Set();
  for (const exception of registry.exceptions || []) {
    if (!exception.id || exceptionIds.has(exception.id) || !exception.selector || !exception.property || !exception.meaning
      || !exception.caseIds?.length || exception.caseIds.some(id => !ids.has(id))
      || (!exception.valueSource && !exception.values?.length)) {
      errors.push(`dynamic themes: incomplete or unbound exception ${exception.id || ''}`); continue;
    }
    exceptionIds.add(exception.id);
    const exceptionId = collector.addNode(uiNode(`ui:theme-exception:${exception.id}`, exception.meaning, 'ui_theme_exception', {
      selector: exception.selector, property: exception.property, value_source: exception.valueSource,
      values: exception.values, source_file: relativeToProject(registryPath), observed: false
    }));
    for (const caseId of exception.caseIds) collector.addEdge(uiEdge(`ui:dynamic-theme:${caseId}`, exceptionId, 'ui_declares_theme_exception', declared));
  }
  return { nodes: [...collector.nodes.values()], edges: [...collector.edges.values()], errors, files: [...files], summary: { cases: ids.size, states, paints, exceptions: exceptionIds.size } };
}

export function buildDeepThemeTopology({registryPath = defaultDeepThemePath} = {}) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const collector = makeCollector(), errors = [], files = new Set([registryPath]), ids = new Set();
  let states = 0;
  const declared = {confidence:'DECLARED', source_file:relativeToProject(registryPath), observed:false};
  const source = (file,id) => {
    const absolute = path.resolve(projectRoot,file || '');
    if (!file || !absolute.startsWith(projectRoot + path.sep) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {errors.push(`${id}: invalid deep source ${file}`);return null;}
    files.add(absolute);
    return collector.addNode(uiNode(`ui:source:${file}`,file,'ui_source',{source_file:file,observed:false}));
  };
  if (registry.schemaVersion !== 1 || !registry.cases?.length) errors.push('deep themes: empty or invalid registry');
  for (const item of registry.cases || []) {
    if (!item.id || ids.has(item.id)) {errors.push(`deep themes: duplicate or missing id ${item.id}`);continue;}
    ids.add(item.id);
    const caseId = collector.addNode(uiNode(`ui:deep-theme:${item.id}`,item.title,'ui_deep_theme_case',{page:item.page,...declared}));
    const pageId = collector.addNode(uiNode(`ui:page:${item.page}`,item.page,'ui_page',{source_file:`Frontend/public/${item.page}`}));
    source(`Frontend/public/${item.page}`,item.id);
    collector.addEdge(uiEdge(pageId,caseId,'ui_declares_deep_theme_case',declared));
    for (const [relation,list] of [['ui_rendered_by',[item.producer]],['ui_loads_stylesheet',item.styles || []],['ui_declares_test',[item.test?.file]],['ui_exercised_by',[item.test?.runner]]]) {
      for (const file of list) {const target=source(file,item.id);if(target)collector.addEdge(uiEdge(caseId,target,relation,declared));}
    }
    const names = new Set();
    if (!item.expectedStates?.length) errors.push(`${item.id}: no deep states`);
    for (const name of item.expectedStates || []) {
      if (!name || names.has(name)) {errors.push(`${item.id}: duplicate or missing deep state`);continue;}
      names.add(name);states++;
      const stateId=collector.addNode(uiNode(`${caseId}:state:${name}`,`${item.id} / ${name}`,'ui_deep_state',declared));
      collector.addEdge(uiEdge(caseId,stateId,'ui_declares_state',declared));
      for (const [role,value] of Object.entries(item.colors || {})) {
        const roleId=collector.addNode(uiNode(`ui:deep-color-role:${role}`,role,'ui_color_role',{value,...declared}));
        collector.addEdge(uiEdge(stateId,roleId,'ui_declares_color_role',declared));
      }
    }
  }
  return {nodes:[...collector.nodes.values()],edges:[...collector.edges.values()],files:[...files],errors,summary:{cases:ids.size,states}};
}

export function buildLiveryTopology({registryPath = defaultLiveryPath} = {}) {
  const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
  const collector=makeCollector(),errors=[],files=new Set([registryPath,fileURLToPath(import.meta.url),path.join(projectRoot,'tests/ui-dynamic-topology.test.mjs'),path.join(projectRoot,'scripts/lib/view-tour-harness.mjs')]),roles=new Set();
  const declared={confidence:'DECLARED',source_file:relativeToProject(registryPath),observed:false};
  const source=file=>{
    if(typeof file!=='string'||!file){errors.push(`liveries: invalid source ${file}`);return null;}
    const absolute=path.resolve(projectRoot,file);
    if(!absolute.startsWith(projectRoot+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){errors.push(`liveries: invalid source ${file}`);return null;}
    files.add(absolute);return collector.addNode(uiNode(`ui:source:${file}`,file,'ui_source',{source_file:file,observed:false}));
  };
  const equalList=(actual,expected)=>Array.isArray(actual)&&actual.length===expected.length&&new Set(actual).size===expected.length&&expected.every(value=>actual.includes(value));
  if(registry.schemaVersion!==1||!equalList(registry.graphics,['classic','new'])||!equalList(registry.themes,['light','dark'])||!equalList(registry.widths,[320,1280])||!equalList(registry.palettes,['blue','green','red','sand','petrol','lavender','dusty-rose']))errors.push('liveries: invalid or reduced matrix');
  if(registry.baseRevision!=='tre-livelli'||registry.cardSaturationMultiplier!==1.15)errors.push('liveries: shared base or New-only saturation contract changed');
  const decorationSource=source(registry.decorationsSource),colorSource=source(registry.colorSource),styles=source(registry.sharedStyles),testSource=source(registry.test);
  const roleSources=[colorSource&&{file:registry.colorSource,id:colorSource},styles&&{file:registry.sharedStyles,id:styles}].filter(Boolean).map(entry=>({...entry,text:fs.readFileSync(path.resolve(projectRoot,entry.file),'utf8')}));
  const text=decorationSource?fs.readFileSync(path.resolve(projectRoot,registry.decorationsSource),'utf8'):'';
  const symbolMap=/export const pageSymbols = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(text)?.[1]||'';
  const entries=[...symbolMap.matchAll(/['"]([^'"]+\.html)['"]\s*:\s*['"]([^'"]+)['"]/g)].map(match=>[match[1],match[2]]);
  const pages=entries.map(([page])=>page);
  if(!pages.length||new Set(pages).size!==pages.length||pages.length!==registry.expectedPageCount)errors.push('liveries: empty, duplicate or incomplete page-symbol map');
  const variants=(Array.isArray(registry.graphics)?registry.graphics:[]).map(name=>collector.addNode(uiNode(`ui:livery:${name}`,name,'ui_livery',{base:registry.baseRevision,companion:name==='new',cardSaturationMultiplier:name==='new'?registry.cardSaturationMultiplier:1,...declared})));
  for(const [page,symbol] of entries){
    const pageId=collector.addNode(uiNode(`ui:page:${page}`,page,'ui_page',{source_file:`Frontend/public/${page}`}));source(`Frontend/public/${page}`);
    for(const variant of variants)collector.addEdge(uiEdge(pageId,variant,'ui_supports_livery',declared));
    const symbolId=collector.addNode(uiNode(`ui:livery-symbol:${symbol}`,symbol,'ui_decorative_symbol',declared));
    collector.addEdge(uiEdge(pageId,symbolId,'ui_declares_page_symbol',declared));
  }
  const components=[
    {id:'decorations',pages,selectors:['.archive-watermark','.header-title::before','.page-container::after'],roles:[],producers:[registry.decorationsSource]},
    {id:'card-glyphs',pages,selectors:registry.cardGlyphs,roles:['--card-icon-ink','--theme-ink','--companion-card-ink'],producers:registry.cardProducers},
    {id:'filled-card-glyphs',pages,selectors:registry.filledCardGlyphs,roles:['--companion-card-fill','--theme-fill'],producers:registry.cardProducers},
    {id:'home-urgency',pages:[registry.homeUrgency?.page],selectors:registry.homeUrgency?.selectors,roles:[registry.homeUrgency?.role],producers:registry.homeUrgency?.producers,styles:registry.homeUrgency?.styles,test:registry.homeUrgency?.test},
    {id:'account-mode-counts',pages:registry.accountModeCounts?.pages||[],selectors:registry.accountModeCounts?.selectors,roles:[registry.accountModeCounts?.inkRole,registry.accountModeCounts?.fillRole],producers:registry.accountModeCounts?.producers,styles:registry.accountModeCounts?.styles,test:registry.accountModeCounts?.test},
    {id:'footer-ink',pages,selectors:['#search-status','.footer-settings-link'],roles:[registry.footer?.inkRole,'--theme-ink','--text-primary'],producers:[registry.footer?.producer]},
    {id:'home-actions',pages:['home_page.html'],selectors:['.fab-group .btn-fab-privato','.fab-group .btn-fab-scadenza','.fab-group .btn-fab-azienda'],roles:[registry.footer?.fillRole,registry.footer?.deepRole,'--theme-fill','--theme-fill-deep'],producers:[registry.footer?.homeProducer]},
    {id:'profile-guide',pages:['profilo_privato.html'],selectors:[registry.footer?.guide],roles:[registry.footer?.inkRole,'--text-primary'],producers:[registry.footer?.producer]},
    {id:'profile-typography',pages:[registry.profileTypography?.page],selectors:registry.profileTypography?.selectors,roles:[],producers:[registry.profileTypography?.producer],styles:registry.profileTypography?.styles,test:registry.profileTypography?.test,translations:registry.profileTypography?.translations},
    {id:'profile-surfaces',...registry.profileSurfaces},
    {id:'private-entry',...registry.privateEntry},
    ...[
      {id:'contact-export',metadata:registry.contactExport,expectedPages:['profilo_privato.html','dati_azienda.html'],requiredStates:['open','save-unavailable','share-unavailable','saved','shared','save-error','share-error','cancelled','download-started','revoked','pending','preparing','ready','options-open']},
      {id:'company-card-qr',metadata:registry.companyCardQr,expectedPages:['dati_azienda.html'],requiredStates:['card-inline','card-zoom','unsaved-selection-zoom','header-zoom','closed','revoked']}
    ].map(component=>({...component,native:true,pages:Array.isArray(component.metadata?.pages)?component.metadata.pages:[],
      selectors:component.metadata?.selectors,styles:component.metadata?.styles,
      producers:[component.metadata?.producer,...(Array.isArray(component.metadata?.entries)?component.metadata.entries.map(entry=>entry?.producer):[])],
      roles:[...new Set([...(Array.isArray(component.metadata?.paints)?component.metadata.paints:[]),
        ...(Array.isArray(component.metadata?.entries)?component.metadata.entries:[]).flatMap(entry=>Array.isArray(entry?.paints)?entry.paints:[])]
        .map(paint=>paint?.role).filter(role=>typeof role==='string'&&role.startsWith('--')))]}))
  ];
  for(const component of components){
    const scope=component.themes?{themes:component.themes}:{};
    const id=collector.addNode(uiNode(`ui:livery-component:${component.id}`,component.id,'ui_livery_component',{...declared,...scope,...(component.test?{test_name:component.test.name}:{})}));
    for(const variant of variants)collector.addEdge(uiEdge(variant,id,'ui_shares_component',{...declared,graphics:['classic','new']}));
    for(const page of component.pages){if(!pages.includes(page)){errors.push(`liveries: ${component.id} has unknown page ${page}`);continue;}collector.addEdge(uiEdge(`ui:page:${page}`,id,'ui_declares_livery_component',declared));}
    for(const target of [styles,!component.native&&testSource].filter(Boolean))collector.addEdge(uiEdge(id,target,target===testSource?'ui_declares_test':'ui_loads_stylesheet',declared));
    for(const file of Array.isArray(component.styles)?component.styles:[]){const target=source(file);if(target)collector.addEdge(uiEdge(id,target,'ui_loads_stylesheet',declared));}
    let componentTestSource=null;
    if(component.test){componentTestSource=source(component.test.file);if(componentTestSource)collector.addEdge(uiEdge(id,componentTestSource,'ui_declares_test',declared));if(!component.test.name)errors.push(`liveries: ${component.id} has no named test`);}
    if(component.id==='profile-surfaces'){
      if(JSON.stringify(component.themes)!=='["light","dark"]')errors.push('liveries: profile surfaces must declare light and dark scope');
      if(!componentTestSource||!component.test?.name||!fs.readFileSync(path.resolve(projectRoot,component.test.file),'utf8').includes(component.test.name))errors.push('liveries: missing named profile surface regression');
    }
    if(component.id==='private-entry'){
      if(JSON.stringify(component.themes)!=='["light","dark"]')errors.push('liveries: private entry must declare light and dark scope');
      if(component.pages.length!==pages.length||new Set(component.pages).size!==pages.length||pages.some(page=>!component.pages.includes(page)))errors.push('liveries: private entry must cover every private page');
      for(const selector of ['#private-entry-status','#private-entry-retry'])if(!component.selectors?.includes(selector))errors.push('liveries: missing private entry selector '+selector);
      for(const file of ['Frontend/public/assets/js/main-v129.js','Frontend/public/home_page.html'])if(!component.producers?.includes(file))errors.push('liveries: missing private entry producer '+file);
      for(const file of ['Frontend/public/assets/css/core.css','Frontend/public/assets/css/core_ui.css'])if(!component.styles?.includes(file))errors.push('liveries: missing private entry stylesheet '+file);
      if(!componentTestSource||!component.test?.name||!fs.readFileSync(path.resolve(projectRoot,component.test.file),'utf8').includes(component.test.name))errors.push('liveries: missing named private entry regression');
    }
    if(component.id==='profile-typography'){
      if(!Array.isArray(component.styles)||!component.styles.length)errors.push('liveries: missing typography stylesheet');
      if(!componentTestSource||typeof component.test?.name!=='string'||!component.test.name||!fs.readFileSync(path.resolve(projectRoot,component.test.file),'utf8').includes(component.test.name))errors.push('liveries: missing named typography regression');
      const translations=component.translations,target=source(translations?.source),keys=translations?.keys;
      if(!Array.isArray(keys)||keys.length!==5||new Set(keys).size!==keys.length)errors.push('liveries: profile typography has invalid translation keys');
      const text=target?fs.readFileSync(path.resolve(projectRoot,translations.source),'utf8'):'';
      for(const key of Array.isArray(keys)?keys:[]){
        if(typeof key!=='string'||!/^[a-z0-9_]+$/.test(key)||!new RegExp(`\\b${key}\\s*:`).test(text)){errors.push(`liveries: unknown typography translation ${key}`);continue;}
        const translationId=collector.addNode(uiNode(`ui:i18n:${key}`,key,'ui_translation',{...declared,source_file:translations.source}));
        collector.addEdge(uiEdge(id,translationId,'ui_uses_translation',declared));if(target)collector.addEdge(uiEdge(translationId,target,'ui_translation_defined_in',declared));
      }
    }
    if(component.native){
      const metadata=component.metadata||{},states=new Map(),covered=new Set();
      if(!equalList(metadata.pages,component.expectedPages)||!equalList(metadata.states,component.requiredStates))errors.push(`liveries: ${component.id} has incomplete pages or states`);
      for(const state of Array.isArray(metadata.states)?metadata.states:[]){
        if(typeof state!=='string'||!state||states.has(state)){errors.push(`liveries: ${component.id} has invalid or duplicate state`);continue;}
        const stateId=collector.addNode(uiNode(`${id}:state:${state}`,state,'ui_livery_state',declared));states.set(state,stateId);
        collector.addEdge(uiEdge(id,stateId,'ui_declares_state',declared));
      }
      if(!Array.isArray(metadata.styles)||!metadata.styles.length)errors.push(`liveries: ${component.id} has no native stylesheets`);
      if(!Array.isArray(metadata.models)||!metadata.models.length)errors.push(`liveries: ${component.id} has no models`);
      for(const file of Array.isArray(metadata.models)?metadata.models:[]){const target=source(file);if(target)collector.addEdge(uiEdge(id,target,'ui_uses_model',declared));}
      const entries=new Set();
      if(!Array.isArray(metadata.entries)||metadata.entries.length!==2)errors.push(`liveries: ${component.id} has incomplete entries`);
      for(const [index,entry] of (Array.isArray(metadata.entries)?metadata.entries:[]).entries()){
        const entryKey=`${entry?.page}:${entry?.selector}`;
        if(!component.pages.includes(entry?.page)||typeof entry?.selector!=='string'||!entry.selector||entries.has(entryKey)){errors.push(`liveries: ${component.id} has invalid or duplicate entry`);continue;}
        entries.add(entryKey);const entrySource=source(entry.producer);
        const entryId=collector.addNode(uiNode(`${id}:entry:${index}`,entry.selector,'ui_livery_entry',{...declared,page:entry.page,selector:entry.selector}));
        collector.addEdge(uiEdge(`ui:page:${entry.page}`,entryId,'ui_declares_entry',declared));collector.addEdge(uiEdge(entryId,id,'ui_opens_component',declared));
        if(entrySource)collector.addEdge(uiEdge(entryId,entrySource,'ui_rendered_by',declared));
        if(component.id==='contact-export'&&(!Array.isArray(entry.paints)||!entry.paints.length))errors.push('liveries: contact-export has no entry paints');
        if(component.id==='contact-export')for(const state of ['normal','hover','focus'])for(const property of ['color','backgroundColor']){
          if(!(Array.isArray(entry.paints)?entry.paints:[]).some(paint=>paint?.property===property&&Array.isArray(paint.states)&&paint.states.includes(state)))
            errors.push(`liveries: contact-export has unpainted entry state ${state}/${property}`);
        }
        for(const [paintIndex,paint] of (Array.isArray(entry.paints)?entry.paints:[]).entries()){
          if(!['color','backgroundColor'].includes(paint?.property)||typeof paint?.role!=='string'||!paint.role.startsWith('--')||
            (paint.minimum!==undefined&&(!Number.isFinite(paint.minimum)||paint.minimum<=0))||
            (paint.property==='color'&&(!Number.isFinite(paint.minimum)||paint.minimum<4.5))||
            !Array.isArray(paint.states)||!paint.states.length||paint.states.some(state=>!['normal','hover','focus'].includes(state))){
            errors.push(`liveries: ${component.id} has invalid entry paint`);continue;
          }
          const paintId=collector.addNode(uiNode(`${entryId}:paint:${paintIndex}`,entry.selector,'ui_declared_paint',{
            ...declared,selector:entry.selector,property:paint.property,role:paint.role,entry_states:paint.states,...(paint.minimum?{minimum:paint.minimum}:{})}));
          collector.addEdge(uiEdge(entryId,paintId,'ui_declares_paint',declared));
          collector.addEdge(uiEdge(paintId,`ui:livery-color-role:${paint.role}`,'ui_uses_color_role',declared));
        }
      }
      const namedTest=(reference,bindStates)=>{
        const target=source(reference?.file),name=reference?.name;
        const text=target?fs.readFileSync(path.resolve(projectRoot,reference.file),'utf8'):'';
        const escaped=typeof name==='string'?name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'):'';
        if(!escaped||!new RegExp("\\btest\\(\\s*(['\"])"+escaped+"\\1").test(text)){errors.push(`liveries: ${component.id} has a missing named native regression`);return;}
        const testId=collector.addNode(uiNode(`${id}:test:${encodeURIComponent(reference.file+'#'+name)}`,name,'ui_regression',{...declared,source_file:reference.file,test_name:name}));
        collector.addEdge(uiEdge(id,target,'ui_declares_test',declared));collector.addEdge(uiEdge(id,testId,'ui_names_regression',declared));
        collector.addEdge(uiEdge(testId,target,'ui_test_defined_in',declared));
        if(bindStates){
          if(!Array.isArray(reference.states)||!reference.states.length)errors.push(`liveries: ${component.id} has an unbound native regression`);
          for(const state of Array.isArray(reference.states)?reference.states:[]){
            if(!states.has(state)){errors.push(`liveries: ${component.id} test binds unknown state ${state}`);continue;}
            covered.add(state);collector.addEdge(uiEdge(states.get(state),testId,'ui_declares_state_test',declared));
          }
        }
      };
      if(!Array.isArray(metadata.tests)||!metadata.tests.length||!Array.isArray(metadata.modelTests)||!metadata.modelTests.length)errors.push(`liveries: ${component.id} has incomplete native tests`);
      for(const reference of Array.isArray(metadata.tests)?metadata.tests:[])namedTest(reference,true);
      for(const reference of Array.isArray(metadata.modelTests)?metadata.modelTests:[])namedTest(reference,false);
      for(const state of states.keys())if(!covered.has(state))errors.push(`liveries: ${component.id} has untested state ${state}`);
      const painted=new Set(),nonVisual=Array.isArray(metadata.nonVisualStates)?metadata.nonVisualStates:[];
      if(!equalList(nonVisual,component.id==='contact-export'?['revoked']:['closed','revoked']))errors.push(`liveries: ${component.id} has invalid nonvisual states`);
      if(nonVisual.some(state=>!states.has(state)))errors.push(`liveries: ${component.id} has unknown nonvisual state`);
      if(!Array.isArray(metadata.paints)||!metadata.paints.length)errors.push(`liveries: ${component.id} has no paints`);
      for(const [index,paint] of (Array.isArray(metadata.paints)?metadata.paints:[]).entries()){
        if(typeof paint?.selector!=='string'||!paint.selector||!['color','backgroundColor'].includes(paint.property)||typeof paint.role!=='string'||!paint.role.startsWith('--')||
          (paint.minimum!==undefined&&(!Number.isFinite(paint.minimum)||paint.minimum<=0))){errors.push(`liveries: ${component.id} has invalid native paint`);continue;}
        const paintId=collector.addNode(uiNode(`${id}:paint:${index}`,paint.selector,'ui_declared_paint',{...declared,selector:paint.selector,property:paint.property,role:paint.role,...(paint.minimum?{minimum:paint.minimum}:{})}));
        collector.addEdge(uiEdge(id,paintId,'ui_declares_paint',declared));collector.addEdge(uiEdge(paintId,`ui:livery-color-role:${paint.role}`,'ui_uses_color_role',declared));
        if(!Array.isArray(paint.states)||!paint.states.length)errors.push(`liveries: ${component.id} has unbound native paint`);
        for(const state of Array.isArray(paint.states)?paint.states:[]){
          if(!states.has(state)||nonVisual.includes(state)){errors.push(`liveries: ${component.id} paint binds invalid state ${state}`);continue;}
          painted.add(state);collector.addEdge(uiEdge(states.get(state),paintId,'ui_declares_state_paint',declared));
        }
      }
      for(const state of states.keys())if(!painted.has(state)&&!nonVisual.includes(state))errors.push(`liveries: ${component.id} has unpainted visual state ${state}`);
    }
    if(!Array.isArray(component.selectors)||!component.selectors.length)errors.push(`liveries: ${component.id} has no selectors`);
    for(const [index,selector] of (Array.isArray(component.selectors)?component.selectors:[]).entries()){
      if(typeof selector!=='string'||!selector.trim()){errors.push(`liveries: ${component.id} has an invalid selector`);continue;}
      const selectorId=collector.addNode(uiNode(`${id}:selector:${index}`,selector,'ui_livery_selector',{selector,...declared,...(component.surfaceScopes?.[selector]?{themes:component.surfaceScopes[selector]}:{})}));collector.addEdge(uiEdge(id,selectorId,'ui_declares_selector',declared));
    }
    if(!Array.isArray(component.producers)||!component.producers.length)errors.push(`liveries: ${component.id} has no producers`);
    for(const file of Array.isArray(component.producers)?component.producers:[]){const target=source(file);if(target)collector.addEdge(uiEdge(id,target,'ui_rendered_by',declared));}
    for(const role of component.roles){
      if(typeof role!=='string'||!role.startsWith('--')){errors.push(`liveries: ${component.id} has an invalid role`);continue;}
      const definitions=roleSources.filter(entry=>entry.text.includes(role+':'));
      if(!definitions.length)errors.push(`liveries: ${component.id} has unknown color role ${role}`);
      const graphics=role.startsWith('--companion-')?['new']:component.native||['home-urgency','account-mode-counts','profile-surfaces','private-entry'].includes(component.id)||role==='--card-icon-ink'?['classic','new']:['classic'];
      roles.add(role);const roleId=collector.addNode(uiNode(`ui:livery-color-role:${role}`,role,'ui_color_role',declared));collector.addEdge(uiEdge(id,roleId,'ui_expects_color_role',{...declared,...scope,graphics}));
      for(const definition of definitions)collector.addEdge(uiEdge(roleId,definition.id,'ui_role_defined_in',declared));
    }
  }
  return {nodes:[...collector.nodes.values()],edges:[...collector.edges.values()],files:[...files],errors,summary:{pages:pages.length,variants:variants.length,components:components.length,roles:roles.size}};
}

export function buildUiTopology({
  publicRoot = defaultPublicRoot,
  contractPath = defaultContractPath,
  guideCatalogPath = defaultGuideCatalogPath,
  dynamicThemePath = defaultDynamicThemePath,
  deepThemePath = defaultDeepThemePath,
  liveryPath = defaultLiveryPath
} = {}) {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const guideCatalog = JSON.parse(fs.readFileSync(guideCatalogPath, 'utf8'));
  const collector = makeCollector();
  const dynamicThemes = dynamicThemePath ? buildDynamicThemeTopology({ registryPath: dynamicThemePath }) : { nodes: [], edges: [], errors: [], files: [], summary: { cases: 0, states: 0, paints: 0 } };
  for (const node of dynamicThemes.nodes) collector.addNode(node);
  for (const edge of dynamicThemes.edges) collector.addEdge(edge);
  const deepThemes = deepThemePath ? buildDeepThemeTopology({registryPath:deepThemePath}) : {nodes:[],edges:[],files:[],errors:[],summary:{cases:0,states:0}};
  for (const node of deepThemes.nodes) collector.addNode(node);
  for (const edge of deepThemes.edges) collector.addEdge(edge);
  const liveries=liveryPath?buildLiveryTopology({registryPath:liveryPath}):{nodes:[],edges:[],files:[],errors:[],summary:{pages:0,variants:0,components:0,roles:0}};
  for(const node of liveries.nodes)collector.addNode(node);
  for(const edge of liveries.edges)collector.addEdge(edge);
  const controls = [];
  const surfaces = [];
  const eventBindings = [];
  const selectorReferences = [];
  const elements = [];
  const pageNodes = new Map();
  const elementNodes = new Map();
  const elementsBySelector = new Map();
  const scriptNodes = new Map();
  const translationNodes = new Map();
  const guidePageNodes = new Map();
  const htmlFiles = fs.readdirSync(publicRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
    .map(entry => path.join(publicRoot, entry.name));
  const jsRoot = path.join(publicRoot, 'assets', 'js');
  const jsFiles = walk(jsRoot).filter(file => file.endsWith('.js') && !normalize(file).includes('/vendor/'));
  const cssRoot = path.join(publicRoot, 'assets', 'css');
  const cssFiles = walk(cssRoot).filter(file => file.endsWith('.css'));
  const jsSourceByFile = new Map(jsFiles.map(file => [file, fs.readFileSync(file, 'utf8')]));

  const ensurePage = page => {
    const id = `ui:page:${page}`;
    if (!pageNodes.has(page)) {
      pageNodes.set(page, collector.addNode(uiNode(id, page, 'ui_page', {
        source_file: normalize(path.join('Frontend/public', page))
      })));
    }
    return id;
  };
  const ensureTranslation = (key, sourceFile, sourceLocation) => {
    const id = `ui:i18n:${key}`;
    if (!translationNodes.has(key)) {
      translationNodes.set(key, collector.addNode(uiNode(id, key, 'ui_translation', {
        source_file: sourceFile,
        source_location: sourceLocation
      })));
    }
    return id;
  };
  const ensureRoute = route => collector.addNode(uiNode(`ui:route:${route}`, route, 'ui_route', {
    source_file: normalize(path.join('Frontend/public', route))
  }));

  for (const file of htmlFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const page = normalize(path.relative(publicRoot, file));
    const pageId = ensurePage(page);
    const tagPattern = /<([a-z][\w:-]*)\b[^>]*>/gi;
    for (const match of source.matchAll(tagPattern)) {
      if (match[0].startsWith('</')) continue;
      const tag = match[1].toLowerCase();
      const attributes = attributesOf(match[0]);
      const line = lineOf(source, match.index);
      const location = `L${line}`;
      const htmlId = attributes.id || '';
      const selector = htmlId ? `#${htmlId}` : attributes['data-action'] ? `[data-action="${attributes['data-action']}"]` : '';
      const classes = attributes.class || '';
      const isHiddenInput = tag === 'input' && String(attributes.type).toLowerCase() === 'hidden';
      const isControl = CONTROL_TAGS.has(tag) && !isHiddenInput;
      const isSurface = tag === 'dialog' || /^(?:dialog|alertdialog|menu)$/.test(attributes.role || '')
        || hasSurfaceIdentity(htmlId, classes);
      const isTranslatedElement = TRANSLATION_ATTRIBUTES.some(([attribute]) => attributes[attribute]);
      let elementId = null;
      if (isControl || isSurface || htmlId || isTranslatedElement) {
        const identity = htmlId || attributes['data-action'] || `${tag}@${line}`;
        const type = isSurface ? 'ui_surface' : isControl ? 'ui_control' : 'ui_element';
        elementId = `ui:${type.slice(3)}:${page}:${identity}`;
        collector.addNode(uiNode(elementId, selector || identity, type, {
          page,
          selector: selector || undefined,
          tag,
          source_file: relativeToProject(file),
          source_location: location
        }));
        collector.addEdge(uiEdge(pageId, elementId, isSurface ? 'ui_contains_surface' : 'ui_contains', {
          source_file: relativeToProject(file), source_location: location
        }));
        if (selector) {
          elementNodes.set(`${page}\u0000${selector}`, elementId);
          if (!elementsBySelector.has(selector)) elementsBySelector.set(selector, []);
          elementsBySelector.get(selector).push(elementId);
        }
        elements.push({ page, tag, attributes, selector, nodeId: elementId, isControl, isSurface });
      }
      if (isControl) {
        const route = tag === 'a' ? localPage(attributes.href, page) : null;
        controls.push({
          page, selector, tag, id: htmlId, route, href: attributes.href || '', type: String(attributes.type || '').toLowerCase(),
          nodeId: elementId, source_file: relativeToProject(file), line
        });
        if (route) {
          collector.addEdge(uiEdge(elementId, ensureRoute(route), 'ui_navigates_to', {
            source_file: relativeToProject(file), source_location: location
          }));
        }
      }
      if (isSurface) surfaces.push({ page, selector, id: htmlId, nodeId: elementId, dynamic: false, source_file: relativeToProject(file), line });
      for (const [attribute, relation, targetAttribute] of TRANSLATION_ATTRIBUTES) {
        const translationKey = attributes[attribute];
        if (!translationKey || !elementId) continue;
        collector.addEdge(uiEdge(elementId, ensureTranslation(translationKey, relativeToProject(file), location), relation, {
          translated_attribute: targetAttribute,
          source_file: relativeToProject(file), source_location: location
        }));
      }
      if (tag === 'script' && attributes.src) {
        const clean = attributes.src.replace(/^\//, '').split('?')[0];
        if (clean.endsWith('.js')) {
          const scriptPath = normalize(clean.startsWith('assets/') ? `Frontend/public/${clean}` : path.posix.join(path.posix.dirname(`Frontend/public/${page}`), clean));
          const scriptId = `ui:script:${scriptPath}`;
          scriptNodes.set(scriptPath, collector.addNode(uiNode(scriptId, path.posix.basename(scriptPath), 'ui_script', { source_file: scriptPath })));
          collector.addEdge(uiEdge(pageId, scriptId, 'ui_loads_script', {
            source_file: relativeToProject(file), source_location: location
          }));
        }
      }
      if (tag === 'link' && String(attributes.rel || '').toLowerCase().split(/\s+/).includes('stylesheet') && attributes.href
        && !/^(?:https?:|\/\/|data:)/i.test(attributes.href)) {
        const clean = attributes.href.replace(/^\//, '').split('?')[0].split('#')[0];
        if (clean.endsWith('.css')) {
          const stylePath = normalize(clean.startsWith('assets/') ? `Frontend/public/${clean}` : path.posix.join(path.posix.dirname(`Frontend/public/${page}`), clean));
          const styleId = collector.addNode(uiNode(`ui:source:${stylePath}`, path.posix.basename(stylePath), 'ui_stylesheet', {source_file:stylePath}));
          collector.addEdge(uiEdge(pageId, styleId, 'ui_loads_stylesheet', {source_file:relativeToProject(file),source_location:location}));
        }
      }
    }
  }

  const controlById = new Map(controls.filter(control => control.id).map(control => [control.id, control]));
  const surfaceBySelector = new Map(surfaces.filter(surface => surface.selector)
    .map(surface => [`${surface.page}\u0000${surface.selector}`, surface]));

  for (const file of jsFiles) {
    const source = jsSourceByFile.get(file);
    const sourceFile = relativeToProject(file);
    const ranges = functionRanges(source);
    const scriptId = `ui:script:${sourceFile}`;
    if (!scriptNodes.has(sourceFile)) scriptNodes.set(sourceFile, collector.addNode(uiNode(scriptId, path.basename(file), 'ui_script', { source_file: sourceFile })));

    const variableBindings = [];
    for (const match of source.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*document\.getElementById\(\s*["']([^"']+)["']\s*\)/g)) {
      variableBindings.push({ variable: match[1], selector: `#${match[2]}`, index: match.index });
    }
    for (const match of source.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*document\.querySelector\(\s*["']([^"']+)["']\s*\)/g)) {
      const selector = simpleSelector(match[2]);
      if (selector) variableBindings.push({ variable: match[1], selector, index: match.index });
    }
    for (const match of source.matchAll(/document\.getElementById\(\s*["']([^"']+)["']\s*\)/g)) {
      selectorReferences.push({ selector: `#${match[1]}`, file: sourceFile, line: lineOf(source, match.index), index: match.index });
    }
    for (const match of source.matchAll(/(?:querySelector|querySelectorAll|closest|matches)\(\s*["']([^"']+)["']\s*\)/g)) {
      const selector = simpleSelector(match[1]);
      if (selector) selectorReferences.push({ selector, file: sourceFile, line: lineOf(source, match.index), index: match.index });
    }
    for (const match of source.matchAll(/["']([.#][A-Za-z_-][\w-]*|\[(?:data-[\w-]+|role)(?:=[^\]]+)?\])["']/g)) {
      const selector = simpleSelector(match[1]);
      if (selector) selectorReferences.push({ selector, file: sourceFile, line: lineOf(source, match.index), index: match.index });
    }
    const directPatterns = [
      /document\.getElementById\(\s*["']([^"']+)["']\s*\)\??\.addEventListener\(\s*["']([^"']+)["']/g,
      /document\.querySelector\(\s*["']([^"']+)["']\s*\)\??\.addEventListener\(\s*["']([^"']+)["']/g
    ];
    for (const pattern of directPatterns) {
      for (const match of source.matchAll(pattern)) {
        const selector = pattern === directPatterns[0] ? `#${match[1]}` : simpleSelector(match[1]);
        if (selector) eventBindings.push({ selector, event: match[2], file: sourceFile, line: lineOf(source, match.index), index: match.index, ranges, source });
      }
    }
    const directPropertyPatterns = [
      /document\.getElementById\(\s*["']([^"']+)["']\s*\)\??\.(on(?:click|change|input|submit|keydown|keyup))\s*=/g,
      /document\.querySelector\(\s*["']([^"']+)["']\s*\)\??\.(on(?:click|change|input|submit|keydown|keyup))\s*=/g
    ];
    for (const pattern of directPropertyPatterns) {
      for (const match of source.matchAll(pattern)) {
        const selector = pattern === directPropertyPatterns[0] ? `#${match[1]}` : simpleSelector(match[1]);
        if (selector) eventBindings.push({ selector, event: match[2].slice(2), file: sourceFile, line: lineOf(source, match.index), index: match.index, ranges, source });
      }
    }
    for (const { variable, selector, index: declarationIndex } of variableBindings) {
      const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\??\\.addEventListener\\(\\s*["']([^"']+)["']`, 'g');
      const declarationScope = containingFunction(ranges, declarationIndex);
      const scopeEnd = declarationScope?.end ?? source.length;
      const scopedSource = source.slice(declarationIndex, scopeEnd);
      for (const match of scopedSource.matchAll(pattern)) {
        const absoluteIndex = declarationIndex + match.index;
        eventBindings.push({ selector, event: match[1], file: sourceFile, line: lineOf(source, absoluteIndex), index: absoluteIndex, ranges, source });
      }
      const propertyPattern = new RegExp(`\\b${escaped}\\??\\.(on(?:click|change|input|submit|keydown|keyup))\\s*=`, 'g');
      for (const match of scopedSource.matchAll(propertyPattern)) {
        const absoluteIndex = declarationIndex + match.index;
        eventBindings.push({ selector, event: match[1].slice(2), file: sourceFile, line: lineOf(source, absoluteIndex), index: absoluteIndex, ranges, source });
      }
    }
    for (const match of source.matchAll(/\b(window|document)\.addEventListener\(\s*["']([^"']+)["']/g)) {
      eventBindings.push({ selector: `@${match[1]}`, event: match[2], file: sourceFile, line: lineOf(source, match.index), index: match.index, ranges, source });
    }
    for (const match of source.matchAll(/\bt\(\s*["']([^"']+)["']\s*\)/g)) {
      const keyNode = ensureTranslation(match[1], sourceFile, `L${lineOf(source, match.index)}`);
      collector.addEdge(uiEdge(scriptId, keyNode, 'ui_uses_translation', {
        source_file: sourceFile, source_location: `L${lineOf(source, match.index)}`
      }));
    }
    for (const match of source.matchAll(/createElement\(\s*["']([a-z][\w-]*)["']\s*,\s*\{([\s\S]{0,700}?)\}\s*[,)]/gi)) {
      const tag = match[1].toLowerCase();
      const props = match[2];
      const role = /\brole\s*:\s*["']([^"']+)["']/.exec(props)?.[1] || '';
      const id = /\bid\s*:\s*["']([^"']+)["']/.exec(props)?.[1] || '';
      const className = /\bclassName\s*:\s*["']([^"']+)["']/.exec(props)?.[1] || '';
      if (tag !== 'dialog' && !/^(?:dialog|alertdialog|menu)$/.test(role) && !hasSurfaceIdentity(id, className)) continue;
      const line = lineOf(source, match.index);
      const identity = id || className.split(/\s+/).find(value => hasSurfaceIdentity('', value)) || `${tag}@${line}`;
      const nodeId = `ui:surface:dynamic:${sourceFile}:${identity}:${line}`;
      collector.addNode(uiNode(nodeId, id ? `#${id}` : identity, 'ui_surface', {
        dynamic: true, tag, role: role || undefined, source_file: sourceFile, source_location: `L${line}`
      }));
      collector.addEdge(uiEdge(scriptId, nodeId, 'ui_defines_surface', { source_file: sourceFile, source_location: `L${line}` }));
      surfaces.push({ page: '', selector: id ? `#${id}` : '', id, nodeId, dynamic: true, source_file: sourceFile, line });
    }
  }

  const mappedControlNodeIds = new Set();
  for (const binding of eventBindings) {
    const matchingControls = elements.filter(element => element.isControl && elementMatchesSelector(element, binding.selector));
    const control = matchingControls[0] ? controls.find(item => item.nodeId === matchingControls[0].nodeId) : null;
    const scope = containingFunction(binding.ranges, binding.index);
    const handlerLabel = scope?.name || `${binding.event}@${binding.line}`;
    const handlerId = `ui:handler:${binding.file}:${handlerLabel}:${binding.line}`;
    collector.addNode(uiNode(handlerId, handlerLabel, 'ui_handler', {
      event: binding.event, source_file: binding.file, source_location: `L${binding.line}`
    }));
    for (const matchingControl of matchingControls) {
      mappedControlNodeIds.add(matchingControl.nodeId);
      collector.addEdge(uiEdge(matchingControl.nodeId, handlerId, 'ui_binds_event', {
        event: binding.event, source_file: binding.file, source_location: `L${binding.line}`
      }));
    }
    const callback = eventCallbackRange(binding.source, binding.index, binding.ranges);
    if (!callback) continue;
    const scopeStart = callback.start;
    const scopeEnd = callback.end;
    for (const reference of selectorReferences) {
      if (reference.file !== binding.file || reference.index < scopeStart || reference.index >= scopeEnd) continue;
      for (const targetElement of elements.filter(element => elementMatchesSelector(element, reference.selector))) {
        if (targetElement.nodeId !== control?.nodeId) collector.addEdge(uiEdge(handlerId, targetElement.nodeId, 'ui_handler_references', {
          event: binding.event, source_file: binding.file, source_location: `L${reference.line}`
        }));
      }
    }
  }

  for (const reference of selectorReferences) {
    const scriptId = scriptNodes.get(reference.file);
    if (!scriptId) continue;
    for (const targetElement of elements.filter(element => elementMatchesSelector(element, reference.selector))) {
      if (targetElement.isControl) mappedControlNodeIds.add(targetElement.nodeId);
      collector.addEdge(uiEdge(scriptId, targetElement.nodeId, 'ui_references_element', {
        confidence: 'INFERRED', confidence_score: 0.8,
        source_file: reference.file, source_location: `L${reference.line}`
      }));
    }
  }

  const literalReferencedSelectors = new Set();
  for (const control of controls.filter(item => item.selector)) {
    const literal = control.selector.startsWith('#')
      ? control.selector.slice(1)
      : /^\[data-action="([^"]+)"\]$/.exec(control.selector)?.[1];
    if (!literal) continue;
    const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`["']${escaped}["']`);
    for (const [file, source] of jsSourceByFile) {
      const match = pattern.exec(source);
      if (!match) continue;
      literalReferencedSelectors.add(control.selector);
      mappedControlNodeIds.add(control.nodeId);
      const sourceFile = relativeToProject(file);
      const scriptId = scriptNodes.get(sourceFile);
      if (scriptId) collector.addEdge(uiEdge(scriptId, control.nodeId, 'ui_references_selector_literal', {
        selector: control.selector,
        confidence: 'INFERRED',
        confidence_score: 0.7,
        source_file: sourceFile,
        source_location: `L${lineOf(source, match.index)}`
      }));
    }
  }

  const guideErrors = [];
  const guideSteps = [];
  const guideSource = relativeToProject(guideCatalogPath);
  for (const guidePage of guideCatalog.pages || []) {
    const page = guidePage.route.replace(/^\//, '');
    const pageNodeId = pageNodes.get(page);
    const guidePageId = collector.addNode(uiNode(`ui:guide-page:${guidePage.pageId}`, guidePage.pageId, 'ui_guide_page', {
      page,
      family: guidePage.family,
      tutorial_id: guidePage.tutorialId || undefined,
      source_file: guideSource
    }));
    guidePageNodes.set(guidePage.pageId, guidePageId);
    if (!pageNodeId) guideErrors.push(`${guidePage.pageId}: pagina ${page} assente`);
    else collector.addEdge(uiEdge(pageNodeId, guidePageId, 'ui_documented_by', {
      confidence: 'DECLARED', source_file: guideSource
    }));
    for (const [kind, key] of [['title', guidePage.titleKey], ['purpose', guidePage.purposeKey]]) {
      collector.addEdge(uiEdge(guidePageId, ensureTranslation(key, guideSource), `ui_guide_${kind}`, {
        confidence: 'DECLARED', source_file: guideSource
      }));
    }
    let previousStepId = null;
    for (const [index, step] of (guidePage.steps || []).entries()) {
      const stepNodeId = collector.addNode(uiNode(`ui:guide-step:${guidePage.pageId}:${step.stepId}`, `${guidePage.pageId}/${step.stepId}`, 'ui_guide_step', {
        page,
        step_id: step.stepId,
        sequence_index: index,
        target_selector: step.target || undefined,
        source_file: guideSource
      }));
      guideSteps.push({ page, pageId: guidePage.pageId, step, nodeId: stepNodeId });
      collector.addEdge(uiEdge(guidePageId, stepNodeId, 'ui_has_guide_step', {
        sequence_index: index, confidence: 'DECLARED', source_file: guideSource
      }));
      collector.addEdge(uiEdge(stepNodeId, ensureTranslation(step.bodyKey, guideSource), 'ui_guide_step_text', {
        confidence: 'DECLARED', source_file: guideSource
      }));
      if (step.target) {
        const targetId = elementNodes.get(`${page}\u0000${step.target}`);
        if (!targetId) guideErrors.push(`${guidePage.pageId}/${step.stepId}: target ${step.target} assente da ${page}`);
        else collector.addEdge(uiEdge(stepNodeId, targetId, 'ui_targets_element', {
          selector: step.target, confidence: 'DECLARED', source_file: guideSource
        }));
      }
      if (previousStepId) collector.addEdge(uiEdge(previousStepId, stepNodeId, 'ui_next_step', {
        confidence: 'DECLARED', source_file: guideSource
      }));
      previousStepId = stepNodeId;
    }
  }

  for (const guidePage of guideCatalog.pages || []) {
    const sourceId = guidePageNodes.get(guidePage.pageId);
    for (const relatedPageId of guidePage.relatedPageIds || []) {
      const targetId = guidePageNodes.get(relatedPageId);
      if (!targetId) guideErrors.push(`${guidePage.pageId}: pagina correlata ${relatedPageId} assente`);
      else collector.addEdge(uiEdge(sourceId, targetId, 'ui_related_guide_page', {
        confidence: 'DECLARED', source_file: guideSource
      }));
    }
  }

  for (const journey of guideCatalog.journeys || []) {
    const journeyId = collector.addNode(uiNode(`ui:journey:${journey.journeyId}`, journey.journeyId, 'ui_journey', {
      source_file: guideSource
    }));
    collector.addEdge(uiEdge(journeyId, ensureTranslation(journey.titleKey, guideSource), 'ui_journey_title', {
      confidence: 'DECLARED', source_file: guideSource
    }));
    let previousPageId = null;
    for (const [index, pageId] of (journey.pageIds || []).entries()) {
      const targetId = guidePageNodes.get(pageId);
      if (!targetId) {
        guideErrors.push(`${journey.journeyId}: pagina percorso ${pageId} assente`);
        continue;
      }
      collector.addEdge(uiEdge(journeyId, targetId, 'ui_journey_contains_page', {
        sequence_index: index, confidence: 'DECLARED', source_file: guideSource
      }));
      if (previousPageId) collector.addEdge(uiEdge(previousPageId, targetId, 'ui_next_guide_page', {
        journey: journey.journeyId, confidence: 'DECLARED', source_file: guideSource
      }));
      previousPageId = targetId;
    }
  }

  const contractErrors = [];
  for (const flow of contract.criticalFlows || []) {
    const trigger = controls.find(control => control.page === flow.page && control.selector === flow.trigger);
    const matchingEvent = eventBindings.find(binding => binding.selector === flow.trigger && binding.event === flow.event);
    if (!trigger) contractErrors.push(`${flow.id}: trigger ${flow.trigger} assente da ${flow.page}`);
    if (!matchingEvent && flow.target.kind !== 'route') contractErrors.push(`${flow.id}: evento ${flow.event} non rilevato per ${flow.trigger}`);
    let targetId = null;
    if (flow.target.kind === 'surface') {
      const target = surfaceBySelector.get(`${flow.page}\u0000${flow.target.value}`);
      if (!target) contractErrors.push(`${flow.id}: superficie ${flow.target.value} assente da ${flow.page}`);
      targetId = target?.nodeId;
    } else if (flow.target.kind === 'route') {
      targetId = ensureRoute(flow.target.value);
      const allSources = [...jsSourceByFile.values()].join('\n');
      if (!allSources.includes(flow.target.value)) contractErrors.push(`${flow.id}: rotta ${flow.target.value} non richiamata dal codice`);
    } else if (flow.target.kind === 'symbol') {
      const source = jsFiles.find(file => jsSourceByFile.get(file).includes(flow.target.value));
      if (!source) contractErrors.push(`${flow.id}: simbolo ${flow.target.value} assente dal codice`);
      targetId = collector.addNode(uiNode(`ui:symbol:${flow.target.value}`, flow.target.value, 'ui_symbol', {
        source_file: source ? relativeToProject(source) : undefined
      }));
    }
    if (trigger && targetId) collector.addEdge(uiEdge(trigger.nodeId, targetId, `ui_${flow.target.kind}`, {
      event: flow.event, flow: flow.id, confidence: 'DECLARED', source_file: trigger.source_file,
      source_location: `L${trigger.line}`
    }));
    for (const key of flow.translations || []) {
      const keyId = ensureTranslation(key, trigger?.source_file, trigger ? `L${trigger.line}` : undefined);
      if (trigger) collector.addEdge(uiEdge(trigger.nodeId, keyId, 'ui_flow_translates_with', {
        flow: flow.id, confidence: 'DECLARED', source_file: trigger.source_file, source_location: `L${trigger.line}`
      }));
    }
  }

  const runtimeScenarioErrors = [];
  for (const [index, scenario] of (contract.runtimeScenarios || []).entries()) {
    const scenarioId = collector.addNode(uiNode(`ui:runtime-scenario:${index + 1}`, `${scenario.page}:${scenario.trigger}`, 'ui_runtime_scenario', {
      page: scenario.page,
      trigger: scenario.trigger,
      expect_visible: scenario.expectVisible,
      safe: true,
      source_file: relativeToProject(contractPath)
    }));
    const trigger = controls.find(control => control.page === scenario.page && control.selector === scenario.trigger);
    const expected = surfaceBySelector.get(`${scenario.page}\u0000${scenario.expectVisible}`);
    if (!trigger) runtimeScenarioErrors.push(`scenario ${index + 1}: trigger ${scenario.trigger} assente`);
    else collector.addEdge(uiEdge(scenarioId, trigger.nodeId, 'ui_runtime_triggers', {
      confidence: 'DECLARED', source_file: relativeToProject(contractPath)
    }));
    if (!expected) runtimeScenarioErrors.push(`scenario ${index + 1}: superficie ${scenario.expectVisible} assente`);
    else collector.addEdge(uiEdge(scenarioId, expected.nodeId, 'ui_runtime_expects_visible', {
      confidence: 'DECLARED', source_file: relativeToProject(contractPath)
    }));
  }

  contractErrors.push(...dynamicThemes.errors);
  contractErrors.push(...deepThemes.errors);
  contractErrors.push(...liveries.errors);
  const mappedSelectors = new Set([
    ...eventBindings.map(binding => binding.selector),
    ...selectorReferences.map(reference => reference.selector),
    ...literalReferencedSelectors
  ]);
  const dormantControlNodeIds = new Set();
  for (const dormant of contract.knownDormantControls || []) {
    const control = controls.find(item => item.page === dormant.page && item.selector === dormant.selector);
    if (!control) {
      contractErrors.push(`controllo dormiente ${dormant.page} ${dormant.selector} assente`);
      continue;
    }
    dormantControlNodeIds.add(control.nodeId);
    collector.addNode(uiNode(control.nodeId, control.selector, 'ui_control', {
      page: control.page,
      selector: control.selector,
      operational_state: 'dormant',
      dormant_reason: dormant.reason,
      source_file: control.source_file,
      source_location: `L${control.line}`
    }));
  }
  const actionInputs = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color']);
  const unmappedControls = controls.filter(control => control.selector && !mappedSelectors.has(control.selector)
    && !mappedControlNodeIds.has(control.nodeId)
    && !dormantControlNodeIds.has(control.nodeId)
    && !control.route && !control.href && !['form', 'select', 'textarea', 'summary'].includes(control.tag)
    && (control.tag !== 'input' || actionInputs.has(control.type))
    && !(control.tag === 'button' && control.type === 'submit'));
  const summary = {
    pages: pageNodes.size,
    controls: controls.length,
    controlsWithStableSelector: controls.filter(control => control.selector).length,
    eventBindings: eventBindings.length,
    surfaces: surfaces.length,
    stylesheets: cssFiles.length,
    dynamicSurfaces: surfaces.filter(surface => surface.dynamic).length,
    translations: translationNodes.size,
    guidePages: guidePageNodes.size,
    guideSteps: guideSteps.length,
    guideTargets: guideSteps.filter(({ step }) => step.target).length,
    journeys: guideCatalog.journeys?.length || 0,
    runtimeScenarios: contract.runtimeScenarios?.length || 0,
    dynamicThemeCases: dynamicThemes.summary.cases,
    dynamicThemeStates: dynamicThemes.summary.states,
    dynamicThemePaints: dynamicThemes.summary.paints,
    dynamicThemeExceptions: dynamicThemes.summary.exceptions || 0,
    deepThemeCases: deepThemes.summary.cases,
    deepThemeStates: deepThemes.summary.states,
    liveryPages: liveries.summary.pages,
    liveryVariants: liveries.summary.variants,
    liveryComponents: liveries.summary.components,
    liveryColorRoles: liveries.summary.roles,
    dormantControls: dormantControlNodeIds.size,
    unmappedControls: unmappedControls.length,
    unmappedControlRate: controls.length ? Number((unmappedControls.length / controls.length).toFixed(4)) : 0,
    contractFlows: contract.criticalFlows?.length || 0,
    contractErrors: contractErrors.length,
    guideErrors: guideErrors.length,
    runtimeScenarioErrors: runtimeScenarioErrors.length
  };
  const fingerprint = createHash('sha256');
  for (const file of [...new Set([...htmlFiles, ...jsFiles, ...cssFiles, contractPath, guideCatalogPath, ...dynamicThemes.files, ...deepThemes.files, ...liveries.files])].sort()) {
    fingerprint.update(relativeToProject(file));
    fingerprint.update('\0');
    fingerprint.update(fs.readFileSync(file));
    fingerprint.update('\0');
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    projectRoot: normalize(projectRoot),
    sourceFingerprint: fingerprint.digest('hex'),
    summary,
    diagnostics: {
      contractErrors,
      guideErrors,
      runtimeScenarioErrors,
      unmappedControls: unmappedControls.map(({ page, selector, tag, source_file, line }) => ({ page, selector, tag, source_file, line }))
    },
    nodes: [...collector.nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...collector.edges.values()].sort((left, right) => `${left.source}:${left.relation}:${left.target}`.localeCompare(`${right.source}:${right.relation}:${right.target}`))
  };
}

export function injectUiTopology(graph, topology) {
  const nodes = (graph.nodes || []).filter(node => node._origin !== 'ui-topology');
  const links = (graph.links || graph.edges || []).filter(edge => edge._origin !== 'ui-topology');
  return {
    ...graph,
    directed: true,
    multigraph: true,
    nodes: [...nodes, ...topology.nodes],
    links: [...links, ...topology.edges],
    graph: {
      ...(graph.graph || {}),
      uiTopology: {
        schemaVersion: topology.schemaVersion,
        sourceFingerprint: topology.sourceFingerprint,
        directedRelations: true,
        ...topology.summary
      }
    }
  };
}

function argument(name, fallback = '') {
  const exact = process.argv.indexOf(name);
  if (exact >= 0 && process.argv[exact + 1]) return process.argv[exact + 1];
  const inline = process.argv.find(value => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(argument('--output', path.join(projectRoot, 'graphify-out', 'ui-topology.json')));
  const topology = buildUiTopology();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(topology, null, 2)}\n`, 'utf8');
  const graphPath = argument('--inject');
  if (graphPath) {
    const absoluteGraph = path.resolve(graphPath);
    const graph = JSON.parse(fs.readFileSync(absoluteGraph, 'utf8'));
    fs.writeFileSync(absoluteGraph, `${JSON.stringify(injectUiTopology(graph, topology), null, 2)}\n`, 'utf8');
  }
  console.log(`Topologia UI: ${topology.summary.pages} pagine, ${topology.summary.controls} controlli, `
    + `${topology.summary.eventBindings} eventi, ${topology.summary.surfaces} superfici, `
    + `${topology.summary.guideSteps} passi guida, ${topology.summary.contractErrors + topology.summary.guideErrors + topology.summary.runtimeScenarioErrors} errori.`);
}
