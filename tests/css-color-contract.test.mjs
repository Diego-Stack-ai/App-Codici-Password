import test from 'node:test';
import assert from 'node:assert/strict';
import stylelint from 'stylelint';
import plugin from '../scripts/stylelint-color-contract.mjs';

const config = {plugins: [plugin], rules: {'app-codici-password/valid-accent-colors': true}};

test('CSS lint rejects missing alpha and mixed channel separators, including fallbacks', async () => {
  for (const value of [
    'rgb(var(--accent-rgb) / )',
    'rgb(var(--accent-rgb) / 12%)',
    'rgb(var(--accent-rgb, 19 127 236) / .1)',
    'rgba(var(--accent-rgb), )',
    'rgb(19 127 236 / )',
  ]) {
    const result = await stylelint.lint({code: `.sample { background: ${value}; }`, config});
    assert.equal(result.errored, true, value);
    assert.ok(result.results[0].warnings.some(warning => warning.rule === 'app-codici-password/valid-accent-colors'));
  }
});

test('CSS lint accepts legacy token colors, fallbacks, modern literals and quoted examples', async () => {
  for (const value of [
    'rgba(var(--accent-rgb), .1)',
    'rgba(var(--accent-rgb), 12%)',
    'rgba(var(--accent-rgb, 19, 127, 236), .1)',
    'rgb(19 127 236 / 12%)',
    'linear-gradient(rgb(0 0 0 / 50%), transparent)',
    'linear-gradient(rgb(1 2 3), white), url(/)',
    'drop-shadow(0 0 1px rgb(0 0 0)) url(#filter/)',
    '"rgb(0 0 0 / )"',
  ]) {
    const result = await stylelint.lint({code: `.sample { --example: ${value}; }`, config});
    assert.equal(result.errored, false, value);
  }
});

test('CSS lint keeps the channel format compatible with CSS and existing JS producers', async () => {
  for (const [channels, invalid] of [
    ['19, 127, 236', false], ['0, 0, 0', false], ['255, 255, 255', false],
    ['19 127 236', true], ['19, 127', true], ['256, 0, 0', true],
  ]) {
    const result = await stylelint.lint({code: `:root { --accent-rgb: ${channels}; }`, config});
    assert.equal(result.errored, invalid, channels);
  }
});
