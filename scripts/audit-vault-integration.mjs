import {readFile} from 'node:fs/promises';

// Read-only static inventory, not a browser/backend test or release certificate.
// A missing integration deliberately exits nonzero instead of appearing as a
// passing characterization test in the laboratory's green test count.
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [entry, bridge, deployed, legacy, profile] = await Promise.all([
    read('experiments/persistent-vault-shell/emulator-entry.mjs'),
    read('experiments/persistent-vault-shell/emulator-qr-bridge.mjs'),
    read('functions/index.js'),
    read('Frontend/public/assets/js/modules/core/vault-session.js'),
    read('Frontend/public/profilo_privato.html')
]);
const candidateCalls = [...new Set([...entry.matchAll(/httpsCallable\(functions,\s*([^\n]+?)\)\(request\)/g)]
    .flatMap(match => [...match[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map(value => value[1])))].sort();
const bridgeCalls = new Set([...bridge.matchAll(/\/demo-vault-shell\/europe-west1\/([A-Za-z0-9_]+)/g)].map(match => match[1]));
const exportedCalls = new Set([...deployed.matchAll(/exports\.([A-Za-z0-9_]+)\s*=\s*onCall\s*\(/g)].map(match => match[1]));
const calls = candidateCalls.map(name => ({name, laboratoryBridge: bridgeCalls.has(name), productionExport: exportedCalls.has(name)}));
const blockers = [];
if (!calls.length) blockers.push('INVENTORY_UNRECOGNIZED: callable syntax requires manual review');
for (const call of calls) {
    if (!call.laboratoryBridge) blockers.push(`LABORATORY_ROUTE_MISSING: ${call.name}`);
    if (!call.productionExport) blockers.push(`PRODUCTION_EXPORT_MISSING: ${call.name}`);
}
if (!/mountDocumentAttachments\s*:/.test(entry)) blockers.push('ATTACHMENT_PROVIDER_NOT_COMPOSED_IN_ENTRY');
if (/sessionStorage\.setItem\(WRAPPING_KEY/.test(legacy)) blockers.push('VS-P0-01: legacy wrapping key persistence still present');
if (/src="assets\/js\/main-v129\.js"/.test(profile)) blockers.push('PROFILE_STILL_USES_MULTIPAGE_ENTRY: replacement not evidenced');
console.log(JSON.stringify({scope: 'Static checkout inventory only; no deployed resources inspected',
    status: blockers.length ? 'BLOCKED' : 'MANUAL_REVIEW_REQUIRED', calls, blockers,
    limits: 'Text-pattern inventory; does not prove reachability, middleware enforcement, feature parity or runtime correctness.'}, null, 2));
// Even absence of the known patterns is not sufficient evidence of readiness.
process.exitCode = blockers.length ? 2 : 3;
