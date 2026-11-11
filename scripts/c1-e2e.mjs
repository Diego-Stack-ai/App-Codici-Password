import {C1_CASES, C1_PROFILES} from './lib/c1-e2e-contract.mjs';

// Intentionally no Playwright, SDK, credential loader or network imports.
// The production adapter/workflow must be reviewed separately before implementation.
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log(JSON.stringify({mode:'plan-only',help:'--list lists local prototype coverage. Production execution is not implemented. No credentials or URL arguments accepted.'}));
} else if (args.length === 1 && args[0] === '--list') {
  console.log(JSON.stringify({mode:'local-prototype',cases:C1_CASES,proposedProfiles:C1_PROFILES,productionReady:false}));
} else {
  console.log(JSON.stringify({code:'C1_PRODUCTION_NOT_IMPLEMENTED',wrote:false,network:false}));
  process.exitCode = 2;
}
