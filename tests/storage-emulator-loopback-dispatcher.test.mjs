import {createRequire} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {
  createLoopbackDispatcher,
  isLoopbackOrigin,
} = require('../scripts/storage-emulator-loopback-dispatcher.cjs');

test('only exact numeric loopback and localhost origins are direct', () => {
  for (const origin of [
    'http://127.0.0.1:8080',
    'http://[::1]:9199',
    'http://localhost:4400',
  ]) assert.equal(isLoopbackOrigin(origin), true, origin);

  for (const origin of [
    'https://example.invalid',
    'http://localhost.example.invalid:8080',
    'http://127.0.0.1.example.invalid:8080',
    'http://localhost.:8080',
    'http://127.0.0.2:8080',
    'ftp://localhost:8080',
    'not a URL',
  ]) assert.equal(isLoopbackOrigin(origin), false, origin);
});

test('external and localhost-like destinations retain the proxy dispatcher', () => {
  const calls = [];
  const fake = name => ({
    dispatch(options) {
      calls.push([name, String(options.origin)]);
      return name;
    },
  });
  const dispatcher = createLoopbackDispatcher(fake('direct'), fake('proxy'));

  assert.equal(dispatcher.dispatch({origin: 'http://127.0.0.1:8080'}), 'direct');
  assert.equal(dispatcher.dispatch({origin: 'http://localhost:9199'}), 'direct');
  assert.equal(dispatcher.dispatch({origin: 'https://firebase.googleapis.com'}), 'proxy');
  assert.equal(dispatcher.dispatch({origin: 'http://localhost.example.invalid'}), 'proxy');
  assert.deepEqual(calls.map(([name]) => name), ['direct', 'direct', 'proxy', 'proxy']);
});
