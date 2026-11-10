import stylelint from 'stylelint';

const ruleName = 'app-codici-password/valid-accent-colors';
const messages = stylelint.utils.ruleMessages(ruleName, {
  emptyAlpha: 'A color function must provide an alpha value after its separator',
  mixedSeparators: '--accent-rgb contains comma-separated channels; use rgba(var(--accent-rgb), alpha)',
  invalidChannels: '--accent-rgb must contain three comma-separated integer channels from 0 to 255',
});

function* colorFunctions(value) {
  const starts = /\b([a-z][\w-]*)\(/gi;
  let match;
  while ((match = starts.exec(value))) {
    let depth = 1;
    let end = starts.lastIndex;
    for (; end < value.length && depth; end++) {
      if (value[end] === '(') depth++;
      if (value[end] === ')') depth--;
    }
    if (depth) return;
    const name = match[1].toLowerCase();
    if (/^(?:rgba?|hsla?)$/.test(name)) {
      yield value.slice(starts.lastIndex, end - 1);
      starts.lastIndex = end;
    } else if (name === 'url') {
      starts.lastIndex = end;
    }
  }
}

const rule = enabled => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, {actual: enabled, possible: [true]})) return;
  root.walkDecls(declaration => {
    const value = declaration.value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\//g, '');
    let message;
    if (declaration.prop === '--accent-rgb') {
      const channels = value.trim().split(/\s*,\s*/);
      if (channels.length !== 3 || channels.some(channel => !/^\d+$/.test(channel) || Number(channel) > 255)) message = messages.invalidChannels;
    } else {
      for (const body of colorFunctions(value)) {
        if (/\/\s*$/.test(body) || /^\s*var\(\s*--accent-rgb\b[^)]*\)\s*,\s*$/i.test(body)) {
          message = messages.emptyAlpha;
          break;
        }
        if (/^\s*var\(\s*--accent-rgb\b[^)]*\)\s*\//i.test(body)) {
          message = messages.mixedSeparators;
          break;
        }
      }
    }
    if (message) stylelint.utils.report({message, node: declaration, result, ruleName});
  });
};
rule.ruleName = ruleName;
rule.messages = messages;
export default stylelint.createPlugin(ruleName, rule);
