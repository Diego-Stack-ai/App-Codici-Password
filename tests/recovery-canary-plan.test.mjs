import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {planRecoveryCanary, verifyRecoveryCanaryContract, verifyRecoveryCanaryWorkflow} from '../scripts/plan-recovery-canary.mjs';
const {load, dump} = createRequire(import.meta.url)('js-yaml');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const input = () => ({indexSource: read('functions/index.js'), policy: {stage: 'disabled', canaryOwners: []},
    clientSource: read('Frontend/public/assets/js/app-env.js'), configuration: JSON.parse(read('firebase.json'))});
const names = {
    manual: 'Verify manual release source', hosting: 'Recheck master and deploy Hosting only',
    backend: 'Recheck master and deploy disabled recovery prerequisites only',
    mfa: 'Recheck master and deploy MFA recovery response only',
    manifest: 'Verify deployed manifest and critical assets', install: 'Install backend deployment dependencies'
};
const yaml = value => dump(value, {lineWidth: -1, noRefs: true});
const step = (value, name, job = 'deploy') => value.jobs[job].steps.find(item => item.name === names[name]);
// Both complete contracts remain self-contained in this tracked test file.
// The future fixture performs no I/O and does not depend on a private YAML file.
function workflowFixture(hasMfaResponse) {
    const value = load(read('.github/workflows/firebase-deploy.yml'));
    value.jobs.deploy.steps = value.jobs.deploy.steps.filter(item => item.name !== 'Recheck master and deploy Vault frame Firestore Rules only');
    value.on.workflow_dispatch.inputs.release_scope.options = hasMfaResponse
        ? ['hosting', 'recovery-prerequisites-disabled', 'mfa-recovery-response']
        : ['hosting', 'recovery-prerequisites-disabled'];
    const manual = step(value, 'manual', 'validate');
    manual.run = manual.run.replace(/^case "\$RELEASE_SCOPE" in .*$/m,
        `case "$RELEASE_SCOPE" in hosting|recovery-prerequisites-disabled${hasMfaResponse ? '|mfa-recovery-response' : ''}) ;; *) exit 1 ;; esac`);
    for (const name of ['hosting', 'manifest']) step(value, name).if = hasMfaResponse
        ? "inputs.release_scope == 'hosting'" : "inputs.release_scope != 'recovery-prerequisites-disabled'";
    step(value, 'install').if = hasMfaResponse
        ? "inputs.release_scope == 'recovery-prerequisites-disabled' || inputs.release_scope == 'mfa-recovery-response'"
        : "inputs.release_scope == 'recovery-prerequisites-disabled'";
    value.jobs.deploy.steps = value.jobs.deploy.steps.filter(item => item.name !== names.mfa);
    if (hasMfaResponse) value.jobs.deploy.steps.push({
        name: names.mfa, if: "inputs.release_scope == 'mfa-recovery-response'", shell: 'bash',
        env: {FIREBASE_TOKEN: '${{ secrets.FIREBASE_TOKEN }}'},
        run: [
            'set -euo pipefail',
            'remote_master="$(git ls-remote origin refs/heads/master | cut -f1)"',
            'test -n "$remote_master"',
            'test "$GITHUB_SHA" = "$remote_master"',
            'node scripts/plan-recovery-canary.mjs --check',
            'node scripts/build-vault-account-backend.mjs --check',
            'node node_modules/firebase-tools/lib/bin/firebase.js deploy --project appcodici-password --only functions:recoverMfaWithCode --non-interactive --token "$FIREBASE_TOKEN"'
        ].join('\n') + '\n'
    });
    return yaml(value);
}
test('reviewed canary prerequisites cover every prior writer, exclude unrelated exports and cannot execute', () => {
    const plan = planRecoveryCanary();
    assert.equal(plan.functions.length, 43);
    assert.equal(new Set(plan.functions).size, 43);
    assert.equal(plan.selectors.length, 45);
    assert.deepEqual(plan.excludedFunctions, ['createMfaRecoveryCodes', 'manageBackupRestoreV2', 'recoverMfaWithCode', 'revokeAllSessions']);
    for (const forbidden of ['functions', 'hosting', 'firestore', 'firestore:indexes', ...plan.excludedFunctions.map(name => `functions:${name}`)]) assert.equal(plan.selectors.includes(forbidden), false);
    assert.equal(plan.executable, false); assert.equal(plan.cloudCalls, false);
    assert.equal(plan.releasePath.backendJobPrepared, true); assert.equal(plan.releasePath.executed, false);
    const scopes = load(read('.github/workflows/firebase-deploy.yml')).on.workflow_dispatch.inputs.release_scope.options;
    const hasMfaResponse = scopes.includes('mfa-recovery-response');
    assert.equal(plan.releasePath.candidateCapability, scopes.includes('vault-frame-rules')
        ? 'manual-hosting-or-disabled-recovery-prerequisites-or-mfa-response-or-frame-rules' : hasMfaResponse
        ? 'manual-hosting-or-disabled-recovery-prerequisites-or-mfa-response'
        : 'manual-hosting-or-disabled-recovery-prerequisites');
    assert.equal(plan.canary.cloudWritesAuthorized, false); assert.equal(plan.canary.qa2WipeOrRotation, false);
    assert.equal(plan.rollback.deleteLock, false); assert.equal(plan.rollback.restoreOldBackendGlobally, false);
});
test('both complete workflow contracts preserve manual validation, production and their exact scope gates', t => {
    assert.equal(verifyRecoveryCanaryWorkflow(read('.github/workflows/firebase-deploy.yml')), true);
    let mutations = 0;
    for (const hasMfaResponse of [false, true]) {
        const source = workflowFixture(hasMfaResponse);
        assert.equal(verifyRecoveryCanaryWorkflow(source), true);
        for (const [before, after] of [
            ['default: hosting', 'default: recovery-prerequisites-disabled'],
            ['environment: production', 'environment: unreviewed'],
            ['needs: validate', 'needs: unreviewed'],
            ["github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/master'", "github.event_name == 'push'"],
            ['group: firebase-production', 'group: bypass-production'],
            ['cancel-in-progress: false', 'cancel-in-progress: true'],
            ["if: inputs.release_scope == 'recovery-prerequisites-disabled'", 'if: always()'],
            ['node scripts/deploy-recovery-prerequisites.mjs', 'node node_modules/firebase-tools/lib/bin/firebase.js deploy --only functions'],
            ['node scripts/plan-recovery-canary.mjs --check', 'node unrelated.mjs'],
            ['node scripts/deploy-recovery-prerequisites.mjs', 'node scripts/deploy-recovery-prerequisites.mjs --force'],
            ['test "$GITHUB_REF" = "refs/heads/master"', 'test -n "$GITHUB_REF"'],
            ["if: github.event_name == 'workflow_dispatch'", 'if: always()'],
            ["RELEASE_SCOPE: ${{ inputs.release_scope || 'hosting' }}", 'RELEASE_SCOPE: hosting'],
            ['run: npm ci --prefix functions', 'run: npm ci'],
            ['test "$GITHUB_SHA" = "$remote_master"', 'test -n "$GITHUB_SHA"']
        ]) {
            assert.ok(source.includes(before), before);
            assert.throws(() => verifyRecoveryCanaryWorkflow(source.replaceAll(before, after)), undefined, before);
            mutations++;
        }
        for (const mutate of [
            value => { value.on.workflow_dispatch.inputs.release_scope.options.push('functions'); },
            value => { value.on.workflow_dispatch.inputs.release_scope.options.reverse(); },
            value => { step(value, 'hosting').if = hasMfaResponse ? "inputs.release_scope != 'recovery-prerequisites-disabled'" : "inputs.release_scope == 'hosting'"; },
            value => { step(value, 'manifest').if = hasMfaResponse ? "inputs.release_scope != 'recovery-prerequisites-disabled'" : "inputs.release_scope == 'hosting'"; },
            value => { step(value, 'install').if = hasMfaResponse ? "inputs.release_scope == 'recovery-prerequisites-disabled'" : "inputs.release_scope == 'recovery-prerequisites-disabled' || inputs.release_scope == 'mfa-recovery-response'"; },
            value => { step(value, 'manual', 'validate').run = step(value, 'manual', 'validate').run.replace(
                hasMfaResponse ? 'hosting|recovery-prerequisites-disabled|mfa-recovery-response)' : 'hosting|recovery-prerequisites-disabled)',
                hasMfaResponse ? 'hosting|recovery-prerequisites-disabled)' : 'hosting|recovery-prerequisites-disabled|mfa-recovery-response)'); },
            value => { if (hasMfaResponse) value.on.workflow_dispatch.inputs.release_scope.options.pop(); else value.on.workflow_dispatch.inputs.release_scope.options.push('mfa-recovery-response'); }
        ]) {
            const value = load(source); mutate(value);
            assert.throws(() => verifyRecoveryCanaryWorkflow(yaml(value)));
            mutations++;
        }
    }
    t.diagnostic(`${mutations} shared-gate and incompatible-contract mutations rejected`);
});
test('each allowed scope selects only its publication and manifest paths, rejecting added or broadened MFA deployment', t => {
    let mutations = 0;
    for (const hasMfaResponse of [false, true]) {
        const source = workflowFixture(hasMfaResponse), value = load(source);
        const guarded = value.jobs.deploy.steps.filter(item => [names.hosting, names.backend, names.mfa, names.manifest].includes(item.name));
        assert.equal(guarded.length, hasMfaResponse ? 4 : 3);
        const allowed = value.on.workflow_dispatch.inputs.release_scope.options;
        for (const [scope, expected] of [
            ['hosting', [names.hosting, names.manifest]],
            ['recovery-prerequisites-disabled', [names.backend]],
            ['mfa-recovery-response', hasMfaResponse ? [names.mfa] : []],
            ['unexpected', []]
        ]) {
            // The old inequality is safe only after its exact manual allowlist.
            const selected = allowed.includes(scope) ? guarded.filter(item => item.if === `inputs.release_scope == '${scope}'`
                || (!hasMfaResponse && item.if === "inputs.release_scope != 'recovery-prerequisites-disabled'" && scope !== 'recovery-prerequisites-disabled')) : [];
            assert.deepEqual(selected.map(item => item.name), expected);
        }
        for (const name of ['hosting', 'backend', 'manifest', 'install', 'manual']) {
            const altered = load(source), job = name === 'manual' ? 'validate' : 'deploy';
            altered.jobs[job].steps.push({...step(altered, name, job)});
            assert.throws(() => verifyRecoveryCanaryWorkflow(yaml(altered)));
            mutations++;
        }
    }
    const old = load(workflowFixture(false)), future = load(workflowFixture(true)), mfa = step(future, 'mfa');
    old.jobs.deploy.steps.push({...mfa});
    assert.throws(() => verifyRecoveryCanaryWorkflow(yaml(old)));
    mutations++;
    for (const mutate of [
        value => { value.jobs.deploy.steps.push({...step(value, 'mfa')}); },
        value => { value.jobs.deploy.steps = value.jobs.deploy.steps.filter(item => item.name !== names.mfa); },
        value => { step(value, 'mfa').if = 'always()'; },
        value => { step(value, 'mfa').shell = 'sh'; },
        value => { step(value, 'mfa').run += '\nnode node_modules/firebase-tools/lib/bin/firebase.js deploy --only hosting\n'; },
        value => { step(value, 'mfa').env.FIREBASE_TOKEN = '${{ secrets.OTHER_TOKEN }}'; },
        value => { step(value, 'mfa').run = mfa.run.replace('refs/heads/master', 'refs/heads/alternate'); },
        value => { step(value, 'mfa').run = mfa.run.replace('test "$GITHUB_SHA" = "$remote_master"', 'test -n "$GITHUB_SHA"'); },
        ...['functions', 'functions:recoverMfaWithCode,hosting', 'functions:recoverMfaWithCode,firestore:rules,storage',
            'functions:recoverMfaWithCode,functions:revokeAllSessions', '"$RELEASE_SCOPE"'].map(selector => value => {
                step(value, 'mfa').run = mfa.run.replace('--only functions:recoverMfaWithCode', `--only ${selector}`);
            }),
        value => { step(value, 'mfa').run = mfa.run.replace('--project appcodici-password', '--project alternate'); },
        value => { step(value, 'mfa').run = mfa.run.replace('--non-interactive', '--force'); },
        value => { step(value, 'mfa').run = mfa.run.replace('--non-interactive', '--interactive'); }
    ]) {
        const value = load(workflowFixture(true)); mutate(value);
        assert.throws(() => verifyRecoveryCanaryWorkflow(yaml(value)));
        mutations++;
    }
    t.diagnostic(`${mutations} duplicate, hybrid and MFA publication mutations rejected`);
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
