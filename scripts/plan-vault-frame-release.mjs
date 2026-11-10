// B3 preparation only: local files and pure planning, no Firebase client or deploy runner.
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyRecoveryCanaryWorkflow} from './plan-recovery-canary.mjs';
const {load} = createRequire(import.meta.url)('js-yaml');
const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(resolve(root, name), 'utf8').replace(/\r\n/g, '\n');
const digest = source => createHash('sha256').update(source).digest('hex');
export const FRAME_RULES_SCOPE = 'vault-frame-rules';
export const FRAME_RULES_STEP = 'Recheck master and deploy Vault frame Firestore Rules only';
const currentScopes = ['hosting', 'recovery-prerequisites-disabled', 'mfa-recovery-response'];
const oldCase = 'case "$RELEASE_SCOPE" in hosting|recovery-prerequisites-disabled|mfa-recovery-response) ;; *) exit 1 ;; esac';
const newCase = oldCase.replace('mfa-recovery-response)', 'mfa-recovery-response|vault-frame-rules)');
const summary = `            if [ "$RELEASE_SCOPE" = "vault-frame-rules" ]; then
              echo "- Selected resource: firestore:rules only. Functions, Storage, indexes and Hosting are excluded."
              echo "- Pilot singleton and Auth claims are not provisioned by this run."
            fi
`;
const frameStep = `      - name: ${FRAME_RULES_STEP}
        if: inputs.release_scope == 'vault-frame-rules'
        shell: bash
        env:
          FIREBASE_TOKEN: \${{ secrets.FIREBASE_TOKEN }}
        run: |
          set -euo pipefail
          remote_master="$(git ls-remote origin refs/heads/master | cut -f1)"
          test -n "$remote_master"
          test "$GITHUB_SHA" = "$remote_master"
          node scripts/plan-recovery-canary.mjs --check
          node scripts/plan-vault-frame-release.mjs --check
          node node_modules/firebase-tools/lib/bin/firebase.js deploy --project appcodici-password --only firestore:rules --non-interactive --token "$FIREBASE_TOKEN"

`;
function once(source, before, after) {
    assert.equal(source.split(before).length, 2, 'Proposal base changed; review instead of guessing replacements');
    return source.replace(before, after);
}
export function buildVaultFrameWorkflowProposal(source) {
    source = source.replace(/\r\n/g, '\n');
    verifyRecoveryCanaryWorkflow(source);
    const base = load(source);
    if (base.on.workflow_dispatch.inputs.release_scope.options.includes(FRAME_RULES_SCOPE)) return source;
    assert.deepEqual(base.on.workflow_dispatch.inputs.release_scope.options, currentScopes);
    let proposed = once(source, '          - mfa-recovery-response\n', '          - mfa-recovery-response\n          - vault-frame-rules\n');
    proposed = once(proposed, oldCase, newCase);
    const nextStep = '      - name: Recheck master and deploy MFA recovery response only\n';
    proposed = once(proposed, nextStep, frameStep + nextStep);
    const nextSummary = '            if [ "$GITHUB_SHA" != "$remote_master" ]; then';
    proposed = once(proposed, nextSummary, summary + nextSummary);
    verifyRecoveryCanaryWorkflow(proposed);
    // Undo precisely the four intended semantic changes and compare everything else.
    const restored = load(proposed);
    restored.on.workflow_dispatch.inputs.release_scope.options.pop();
    const manual = restored.jobs.validate.steps.find(step => step.name === 'Verify manual release source');
    manual.run = manual.run.replace(newCase, oldCase);
    restored.jobs.deploy.steps = restored.jobs.deploy.steps.filter(step => step.name !== FRAME_RULES_STEP);
    const record = restored.jobs.deploy.steps.find(step => step.name === 'Record deployed commit');
    record.run = record.run.replace(summary.replace(/^          /gm, ''), '');
    assert.deepEqual(restored, base, 'Unexpected workflow changes outside the proposed Rules scope');
    return proposed;
}
export function planVaultFrameRelease() {
    const workflow = read('.github/workflows/firebase-deploy.yml');
    const proposal = buildVaultFrameWorkflowProposal(workflow);
    const configuration = JSON.parse(read('firebase.json'));
    assert.equal(JSON.parse(read('.firebaserc')).projects.default, 'appcodici-password');
    assert.equal(configuration.firestore.database, '(default)');
    assert.equal(configuration.firestore.rules, 'firestore.rules');
    const installed = load(workflow).on.workflow_dispatch.inputs.release_scope.options.includes(FRAME_RULES_SCOPE);
    return {
        schemaVersion: 1, executable: false, cloudCalls: false, cloudReadsPerformed: false,
        target: {projectId: 'appcodici-password', databaseId: '(default)'},
        workflow: {path: '.github/workflows/firebase-deploy.yml', installed,
            baseSha256: digest(workflow), proposalSha256: digest(proposal), scope: FRAME_RULES_SCOPE,
            applicationAuthorized: false, selectors: ['firestore:rules'], excluded: ['functions', 'storage', 'firestore:indexes', 'hosting'],
            followedBySeparateScope: 'hosting', environment: 'production', approvals: 'Diego personally, separately for each run'},
        sourceDigests: Object.fromEntries(['firestore.rules', 'firebase.json', '.firebaserc',
            'scripts/plan-recovery-canary.mjs', 'scripts/plan-vault-frame-release.mjs'].map(name => [name, digest(read(name))])),
        provisioning: {executable: false, performed: false, identitySelected: false, createUser: false,
            policyPath: 'vaultFramePolicy/current', fields: ['schemaVersion', 'version', 'uid', 'enabled', 'expiresAt'],
            schemaVersion: 1, version: 1, initialEnabled: false, activationLast: true,
            uid: '<privately verified Diego UID>', expiresAt: '<explicitly approved UTC Firestore Timestamp>',
            claim: {name: 'vault_frame_canary', value: true, preserveOthers: true, atomicMerge: false,
                exclusiveWriterRequired: true, beforeAfterVerificationRequired: true},
            authFirestoreTransaction: false, firestorePreconditionsRequired: true, administrativeChannelApproved: false,
            refresh: 'Normal logout/login of the pilot after activation; never paste tokens'},
        gates: ['Claude GO on the B3 package', 'Diego approval of workflow application and final reviewed source',
            'Workflow applied only through the explicitly authorized owner channel, hash verified, checks and final Claude GO',
            'Diego personal merge and bounded cloud approval, immutable master SHA',
            'Rules CI approval and actual ruleset/source verification', 'Hosting CI approval on the same SHA and full manifest/hash/header verification',
            'Private preflight/backup and approved administration channel, UID and UTC expiry',
            'Disabled singleton with preconditions, preserve/verify other claims under exclusive writer, activate singleton last',
            'C1 physical matrix remains NE; C2 is not inferred from deployment'],
        rollback: {disableSingletonFirst: true, firestorePrecondition: true, claimAloneIsKillSwitch: false,
            restoreWholeClaimsMap: false, preserveOtherCurrentClaims: true, restoreOldRulesOrFunctions: false,
            hosting: 'Separate reviewed revert/disable PR, fresh release version and approved CI; no deploy from PC'},
        operationsExecuted: []
    };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    assert.ok(args.length <= 1 && args.every(arg => ['--check', '--write-proposal'].includes(arg)),
        'Only read-only planning or a fixed local proposal file is supported; no apply/deploy/UID arguments');
    const plan = planVaultFrameRelease();
    if (args[0] === '--write-proposal') {
        const dir = resolve(root, '.codex-tmp/vault-frame-b3-proposal');
        mkdirSync(dir, {recursive: true});
        writeFileSync(resolve(dir, 'firebase-deploy.yml'), buildVaultFrameWorkflowProposal(read('.github/workflows/firebase-deploy.yml')));
        writeFileSync(resolve(dir, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
        console.log(`Local proposal only: ${dir} · sha256 ${plan.workflow.proposalSha256}`);
    } else console.log(args[0] === '--check'
        ? `Vault frame B3: proposal ${plan.workflow.installed ? 'installed' : 'not installed'}; no cloud I/O; approval still required.`
        : JSON.stringify(plan, null, 2));
}
