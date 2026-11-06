import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRecoveryCanary, verifyRecoveryCanaryContract, verifyRecoveryCanaryWorkflow} from '../scripts/plan-recovery-canary.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const input = () => ({indexSource: read('functions/index.js'), policy: {stage: 'disabled', canaryOwners: []},
    clientSource: read('Frontend/public/assets/js/app-env.js'), configuration: JSON.parse(read('firebase.json'))});
test('reviewed canary prerequisites cover every prior writer, exclude unrelated exports and cannot execute', () => {
    const plan = planRecoveryCanary();
    assert.equal(plan.functions.length, 43);
    assert.equal(new Set(plan.functions).size, 43);
    assert.equal(plan.selectors.length, 45);
    for (const forbidden of ['functions', 'hosting', 'firestore', 'firestore:indexes', ...plan.excludedFunctions.map(name => `functions:${name}`)]) assert.equal(plan.selectors.includes(forbidden), false);
    assert.equal(plan.executable, false); assert.equal(plan.cloudCalls, false);
    assert.equal(plan.releasePath.backendJobPrepared, true); assert.equal(plan.releasePath.executed, false);
    assert.equal(plan.canary.cloudWritesAuthorized, false); assert.equal(plan.canary.qa2WipeOrRotation, false);
    assert.equal(plan.rollback.deleteLock, false); assert.equal(plan.rollback.restoreOldBackendGlobally, false);
});
test('backend release is a fixed manual choice behind validation, production environment and mutually exclusive Hosting', () => {
    const source = read('.github/workflows/firebase-deploy.yml');
    assert.equal(verifyRecoveryCanaryWorkflow(source), true);
    for (const [before, after] of [
        ['default: hosting', 'default: recovery-prerequisites-disabled'], ['environment: production', 'environment: unreviewed'],
        ["if: inputs.release_scope == 'recovery-prerequisites-disabled'", 'if: always()'],
        ['--only "$selectors" --non-interactive', '--only functions --non-interactive'],
        ['node scripts/plan-recovery-canary.mjs --check', 'node unrelated.mjs'],
        ['--non-interactive --token "$FIREBASE_TOKEN"', '--non-interactive --force --token "$FIREBASE_TOKEN"']
    ]) { assert.ok(source.includes(before)); assert.throws(() => verifyRecoveryCanaryWorkflow(source.replaceAll(before, after))); }
});
test('writer census drift, gate activation and alternate rule/configuration targets block the prerequisite contract', () => {
    for (const mutate of [
        value => { value.indexSource += '\nexports.newAdminWriter = handler;'; },
        value => { value.indexSource += "\nexports['newAdminWriter'] = handler;"; },
        value => { value.indexSource += '\nif (condition) exports.newAdminWriter = handler;'; },
        value => { value.indexSource += '\nObject.assign(exports, {newAdminWriter: handler});'; },
        value => { value.indexSource += "\nmodule['exports'] = {newAdminWriter: handler};"; },
        value => { value.indexSource = value.indexSource.replace('exports.restoreBackupChunk =', 'const removedWriter ='); },
        value => { value.policy.stage = 'canary'; }, value => { value.policy.canaryOwners.push({uid: 'unexpected'}); },
        value => { value.clientSource = value.clientSource.replace('COMPLETE_RECOVERY_ENABLED = false', 'COMPLETE_RECOVERY_ENABLED = true'); },
        value => { value.configuration.firestore.database = 'alternate'; }, value => { value.configuration.storage.rules = 'other.rules'; }
    ]) { const value = input(); mutate(value); assert.throws(() => verifyRecoveryCanaryContract(value)); }
});
