import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildVaultFrameWorkflowProposal, planVaultFrameRelease, FRAME_RULES_SCOPE, FRAME_RULES_STEP} from '../scripts/plan-vault-frame-release.mjs';
import {verifyRecoveryCanaryWorkflow} from '../scripts/plan-recovery-canary.mjs';
const {load, dump} = createRequire(import.meta.url)('js-yaml');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const source = () => read('.github/workflows/firebase-deploy.yml');
const proposal = () => buildVaultFrameWorkflowProposal(source());
const yaml = value => dump(value, {lineWidth: -1, noRefs: true});
const frame = value => value.jobs.deploy.steps.find(step => step.name === FRAME_RULES_STEP);

test('B3 plans only a bounded Rules scope and separate Hosting, without cloud or executable provisioning', () => {
    const plan = planVaultFrameRelease();
    assert.equal(plan.executable, false); assert.equal(plan.cloudCalls, false); assert.equal(plan.cloudReadsPerformed, false);
    assert.deepEqual(plan.operationsExecuted, []);
    assert.deepEqual(plan.target, {projectId: 'appcodici-password', databaseId: '(default)'});
    assert.deepEqual(plan.workflow.selectors, ['firestore:rules']);
    assert.equal(plan.workflow.followedBySeparateScope, 'hosting');
    assert.equal(plan.workflow.applicationAuthorized, false);
    assert.equal(plan.provisioning.executable, false); assert.equal(plan.provisioning.identitySelected, false);
    assert.equal(plan.provisioning.createUser, false); assert.equal(plan.provisioning.initialEnabled, false);
    assert.equal(plan.provisioning.activationLast, true); assert.equal(plan.provisioning.claim.atomicMerge, false);
    assert.equal(plan.provisioning.authFirestoreTransaction, false);
    assert.equal(plan.provisioning.claim.exclusiveWriterRequired, true);
    assert.equal(plan.rollback.disableSingletonFirst, true); assert.equal(plan.rollback.restoreWholeClaimsMap, false);
    assert.equal(plan.rollback.claimAloneIsKillSwitch, false);
    assert.deepEqual(plan.provisioning.fields, ['schemaVersion','version','uid','enabled','expiresAt']);
});

test('the complete proposal preserves every other workflow field and is reproducible and idempotent', () => {
    const output = proposal(), plan = planVaultFrameRelease();
    assert.equal(verifyRecoveryCanaryWorkflow(output), true);
    assert.equal(buildVaultFrameWorkflowProposal(output), output);
    assert.equal(buildVaultFrameWorkflowProposal(source().replace(/\n/g, '\r\n')), output);
    assert.equal(createHash('sha256').update(output).digest('hex'), plan.workflow.proposalSha256);
    assert.equal(plan.workflow.installed, load(source()).on.workflow_dispatch.inputs.release_scope.options.includes(FRAME_RULES_SCOPE));
});

test('the fourth scope selects only Rules, with no backend install, Hosting, Functions or manifest publication', () => {
    const value = load(proposal());
    const scoped = value.jobs.deploy.steps.filter(step => String(step.if || '').includes('inputs.release_scope'));
    const expected = new Map([
        ['hosting', ['Recheck master and deploy Hosting only', 'Verify deployed manifest and critical assets']],
        ['recovery-prerequisites-disabled', ['Install backend deployment dependencies', 'Recheck master and deploy disabled recovery prerequisites only']],
        ['mfa-recovery-response', ['Install backend deployment dependencies', 'Recheck master and deploy MFA recovery response only']],
        [FRAME_RULES_SCOPE, [FRAME_RULES_STEP]]
    ]);
    for (const [scope,names] of expected) {
        const selected = scoped.filter(step => step.if.split(' || ').some(clause => clause === `inputs.release_scope == '${scope}'`));
        assert.deepEqual(selected.map(step => step.name), names);
    }
    assert.equal(frame(value).run.split('\n').filter(line => line.includes('firebase.js deploy')).length, 1);
    assert.match(frame(value).run, /--only firestore:rules --non-interactive --token "\$FIREBASE_TOKEN"/);
    assert.equal(value.jobs.deploy.environment, 'production');
});

test('Rules proposal rejects broadened selectors, missing guards, changed credentials and hybrid scopes', t => {
    const mutations = [
        v => {frame(v).if = 'always()';},
        v => {frame(v).env.FIREBASE_TOKEN = '${{ secrets.OTHER_TOKEN }}';},
        v => {frame(v).shell = 'sh';},
        v => {v.jobs.deploy.steps.push({...frame(v)});},
        v => {v.jobs.deploy.steps = v.jobs.deploy.steps.filter(step => step.name !== FRAME_RULES_STEP);},
        v => {v.on.workflow_dispatch.inputs.release_scope.options.pop();},
        v => {v.on.workflow_dispatch.inputs.release_scope.options.reverse();},
        v => {v.on.workflow_dispatch.inputs.release_scope.options.push('unreviewed');},
        v => {v.jobs.deploy.environment = 'unprotected';},
        v => {v.jobs.deploy.steps.find(step => step.name === 'Install backend deployment dependencies').if += " || inputs.release_scope == 'vault-frame-rules'";},
        v => {v.jobs.deploy.steps.find(step => step.name === 'Recheck master and deploy Hosting only').if = "inputs.release_scope != 'recovery-prerequisites-disabled'";},
        ...['firestore', 'firestore:rules,storage', 'firestore:rules,hosting', 'functions', 'firestore:indexes', '"$RELEASE_SCOPE"'].map(selector => v => {
            frame(v).run = frame(v).run.replace('--only firestore:rules', `--only ${selector}`);
        }),
        ...['test "$GITHUB_SHA" = "$remote_master"', 'node scripts/plan-recovery-canary.mjs --check', 'node scripts/plan-vault-frame-release.mjs --check'].map(line => v => {
            frame(v).run = frame(v).run.replace(line, 'true');
        }),
        v => {frame(v).run = frame(v).run.replace('--project appcodici-password', '--project alternate');},
        v => {frame(v).run = frame(v).run.replace('--non-interactive', '--force');},
        v => {frame(v).run += '\nnode unreviewed.mjs\n';}
    ];
    for (const mutate of mutations) {const value = load(proposal()); mutate(value); assert.throws(() => verifyRecoveryCanaryWorkflow(yaml(value)));}
    t.diagnostic(`${mutations.length} negative mutations rejected`);
});

test('the planner CLI refuses cloud execution, identities and arbitrary output destinations', () => {
    const cli = fileURLToPath(new URL('../scripts/plan-vault-frame-release.mjs', import.meta.url));
    for (const args of [['--apply'],['--deploy'],['--uid','synthetic'],['--write-proposal','elsewhere'],['--check','--apply']]) {
        const result = spawnSync(process.execPath, [cli,...args], {encoding:'utf8',timeout:10000});
        assert.notEqual(result.status, 0); assert.equal(result.error, undefined);
        assert.equal(result.stdout, '');
    }
    const result = spawnSync(process.execPath, [cli,'--check'], {encoding:'utf8',timeout:10000});
    assert.equal(result.status, 0); assert.match(result.stdout, /no cloud I\/O; approval still required/);
});
