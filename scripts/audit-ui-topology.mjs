import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUiTopology } from './build-ui-topology.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const contract = JSON.parse(fs.readFileSync(path.join(scriptDir, 'ui-topology-contract.json'), 'utf8'));
const topology = buildUiTopology();
const { summary, diagnostics } = topology;
const errors = [
  ...diagnostics.contractErrors,
  ...diagnostics.guideErrors,
  ...diagnostics.runtimeScenarioErrors
];
const coverage = contract.coverage || {};

for (const [actual, expected, label] of [
  [summary.pages, coverage.minimumPages, 'pagine'],
  [summary.controls, coverage.minimumControls, 'controlli'],
  [summary.eventBindings, coverage.minimumEventBindings, 'eventi'],
  [summary.surfaces, coverage.minimumSurfaces, 'superfici']
]) {
  if (Number.isFinite(expected) && actual < expected) errors.push(`${label}: ${actual} < soglia ${expected}`);
}
if (Number.isFinite(coverage.maximumUnmappedControlRate)
    && summary.unmappedControlRate > coverage.maximumUnmappedControlRate) {
  errors.push(`controlli non mappati: ${summary.unmappedControlRate} > soglia ${coverage.maximumUnmappedControlRate}`);
}

const outputArgument = process.argv.indexOf('--output');
if (outputArgument >= 0 && process.argv[outputArgument + 1]) {
  const output = path.resolve(process.argv[outputArgument + 1]);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(topology, null, 2)}\n`, 'utf8');
}

console.log(`Topologia UI: ${summary.pages} pagine · ${summary.controls} controlli · ${summary.eventBindings} eventi · ${summary.surfaces} superfici`);
console.log(`Guide/video: ${summary.guidePages} pagine · ${summary.guideSteps} passi · ${summary.guideTargets} target · ${summary.journeys} percorsi`);
console.log(`Controlli dormienti dichiarati: ${summary.dormantControls}`);
console.log(`Controlli non mappati: ${summary.unmappedControls}/${summary.controls} (${(summary.unmappedControlRate * 100).toFixed(2)}%)`);
console.log(`Fingerprint sorgenti: ${topology.sourceFingerprint}`);
if (errors.length) {
  for (const error of errors) console.error(`ERRORE: ${error}`);
  process.exitCode = 1;
} else {
  console.log('Audit topologia UI: OK');
}
