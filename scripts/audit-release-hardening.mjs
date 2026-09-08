import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const firebase = JSON.parse(read('firebase.json'));
const functions = read('functions/index.js');
const firestore = read('firestore.rules');
const storage = read('storage.rules');
const packageLock = JSON.parse(read('package-lock.json'));

const headers = firebase.hosting?.headers?.find(item => item.source === '**')?.headers ?? [];
const header = name => headers.find(item => item.key.toLowerCase() === name.toLowerCase())?.value;
const csp = header('Content-Security-Policy') ?? '';

assert.equal(header('X-Frame-Options'), 'DENY', 'X-Frame-Options deve negare il framing');
assert.equal(header('X-Content-Type-Options'), 'nosniff', 'X-Content-Type-Options mancante');
assert.match(csp, /frame-ancestors 'none'/, 'CSP frame-ancestors mancante');
assert.doesNotMatch(csp, /unsafe-eval/, 'CSP non deve consentire unsafe-eval');
const scriptPolicy = csp.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] ?? '';
assert.doesNotMatch(scriptPolicy, /'unsafe-inline'/, 'CSP script-src non deve consentire script inline');
assert.match(csp, /(?:^|;)\s*object-src 'none'/, 'CSP object-src deve negare i plugin');
assert.match(csp, /(?:^|;)\s*base-uri 'self'/, 'CSP base-uri deve essere confinata');
assert.match(csp, /(?:^|;)\s*form-action 'self'/, 'CSP form-action deve essere confinata');
assert.match(firestore, /request\.auth\.uid/, 'Firestore Rules senza vincolo UID');
assert.match(storage, /request\.auth\.uid/, 'Storage Rules senza vincolo UID');
assert.equal(packageLock.lockfileVersion >= 3, true, 'package-lock obsoleto');

const callables = [...functions.matchAll(/exports\.([A-Za-z0-9_]+)\s*=\s*onCall\s*\(/g)].map(match => ({name: match[1], offset: match.index}));
for (const callable of callables) {
  const declaration = functions.slice(callable.offset, callable.offset + 240);
  assert.match(declaration, /enforceAppCheck:\s*true/, `${callable.name} deve imporre App Check`);
}

console.log(`Hardening statico superato: ${headers.length} header, ${callables.length} callable con App Check, Rules vincolate all'UID.`);
