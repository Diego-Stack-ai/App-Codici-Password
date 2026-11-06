import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const defaultPublicRoot = path.join(projectRoot, 'Frontend', 'public');
const defaultContractPath = path.join(scriptDir, 'ui-topology-contract.json');
const defaultGuideCatalogPath = path.join(defaultPublicRoot, 'assets', 'js', 'modules', 'assistant', 'documentation-catalog.json');
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

export function buildUiTopology({
  publicRoot = defaultPublicRoot,
  contractPath = defaultContractPath,
  guideCatalogPath = defaultGuideCatalogPath
} = {}) {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const guideCatalog = JSON.parse(fs.readFileSync(guideCatalogPath, 'utf8'));
  const collector = makeCollector();
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
    dynamicSurfaces: surfaces.filter(surface => surface.dynamic).length,
    translations: translationNodes.size,
    guidePages: guidePageNodes.size,
    guideSteps: guideSteps.length,
    guideTargets: guideSteps.filter(({ step }) => step.target).length,
    journeys: guideCatalog.journeys?.length || 0,
    runtimeScenarios: contract.runtimeScenarios?.length || 0,
    dormantControls: dormantControlNodeIds.size,
    unmappedControls: unmappedControls.length,
    unmappedControlRate: controls.length ? Number((unmappedControls.length / controls.length).toFixed(4)) : 0,
    contractFlows: contract.criticalFlows?.length || 0,
    contractErrors: contractErrors.length,
    guideErrors: guideErrors.length,
    runtimeScenarioErrors: runtimeScenarioErrors.length
  };
  const fingerprint = createHash('sha256');
  for (const file of [...htmlFiles, ...jsFiles, contractPath, guideCatalogPath].sort()) {
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
