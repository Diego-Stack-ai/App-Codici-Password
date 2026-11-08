import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const require = createRequire(import.meta.url);
const {parse} = require('@babel/parser');
const {load: parseYaml} = require('js-yaml');
const {RECOVERY_TARGET, RECOVERY_PRODUCTION_POLICY} = require('../functions/full-recovery-policy.js');
const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
export const RECOVERY_PREREQUISITE_FUNCTIONS = Object.freeze(`
registerSharingIdentity publishSharedAttachmentEnvelopes uploadProfileDocumentAttachment removeProfileDocumentAttachment
applyAccountNoteMutation applyAccountStandardMutation applyProfileLinkMutation applyProfileAccountCreate applyProfileTextMutation
applyPrivateQrSelection applyCompanyQrSelection applyPrivateDocumentsMutation applyPrivateUtilitiesMutation applyProfileContactsMutation
applyPrivateAddressesMutation applyCompanyAddressesMutation applyCompanyContactsMutation applyOfflineMutation applyPrivateAccountMutation
manageSharedVaultData manageAccountWidget manageWidgetProfile trashSyncRecord restoreSyncRecord purgeArchivedAccount restoreBackupChunk
sendDeadlinePushTest manageReceivedDeadline respondToInvitation onInviteDeletedNotification cleanupInviteRevocationMarkers deleteContactIfUnused
onInviteCreated onInviteWritten onPrivateAccountWritten onCompanyAccountWritten checkDeadlines onScadenzaCreated onScadenzaUpdated
onScadenzaDeleted purgeExpiredAuditEvents manageFullVaultRecovery readRecoveryBackupAsset`.trim().split(/\s+/).sort());
export const EXCLUDED_FUNCTIONS = Object.freeze(['manageBackupRestoreV2', 'createMfaRecoveryCodes', 'recoverMfaWithCode', 'revokeAllSessions'].sort());
export function verifyRecoveryCanaryWorkflow(source) {
    const workflow = parseYaml(source), input = workflow.on?.workflow_dispatch?.inputs?.release_scope;
    // During the reviewed handoff, accept only the complete old or new contract.
    // Removing this compatibility after Diego commits the workflow is separate work.
    const hasMfaResponse = input?.options?.length === 3;
    assert.deepEqual(input?.options, hasMfaResponse
        ? ['hosting', 'recovery-prerequisites-disabled', 'mfa-recovery-response']
        : ['hosting', 'recovery-prerequisites-disabled']);
    assert.equal(input.type, 'choice'); assert.equal(input.default, 'hosting'); assert.equal(input.required, true);
    const deploy = workflow.jobs?.deploy;
    assert.equal(deploy.if, "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/master'");
    assert.equal(deploy.needs, 'validate'); assert.equal(deploy.environment, 'production');
    assert.equal(deploy.concurrency?.group, 'firebase-production'); assert.equal(deploy.concurrency['cancel-in-progress'], false);
    const uniqueStep = (job, name) => {
        const matches = job?.steps?.filter(step => step.name === name) || [];
        assert.equal(matches.length, 1, `Expected exactly one workflow step: ${name}`);
        return matches[0];
    };
    const manual = uniqueStep(workflow.jobs?.validate, 'Verify manual release source');
    assert.equal(manual.if, "github.event_name == 'workflow_dispatch'");
    assert.equal(manual.env?.RELEASE_SCOPE, "${{ inputs.release_scope || 'hosting' }}");
    assert.match(manual.run, hasMfaResponse
        ? /case "\$RELEASE_SCOPE" in hosting\|recovery-prerequisites-disabled\|mfa-recovery-response\) ;; \*\) exit 1 ;; esac/
        : /case "\$RELEASE_SCOPE" in hosting\|recovery-prerequisites-disabled\) ;; \*\) exit 1 ;; esac/);
    assert.match(manual.run, /test "\$GITHUB_REF" = "refs\/heads\/master"/);
    assert.match(manual.run, /test "\$GITHUB_SHA" = "\$remote_master"/);
    const backend = uniqueStep(deploy, 'Recheck master and deploy disabled recovery prerequisites only');
    const hosting = uniqueStep(deploy, 'Recheck master and deploy Hosting only');
    const manifest = uniqueStep(deploy, 'Verify deployed manifest and critical assets');
    const mfaName = 'Recheck master and deploy MFA recovery response only';
    const mfa = hasMfaResponse ? uniqueStep(deploy, mfaName) : null;
    if (!hasMfaResponse) assert.equal(deploy.steps.filter(step => step.name === mfaName).length, 0);
    const install = uniqueStep(deploy, 'Install backend deployment dependencies');
    assert.equal(backend.if, "inputs.release_scope == 'recovery-prerequisites-disabled'");
    assert.equal(hosting.if, hasMfaResponse ? "inputs.release_scope == 'hosting'" : "inputs.release_scope != 'recovery-prerequisites-disabled'");
    assert.equal(manifest.if, hasMfaResponse ? "inputs.release_scope == 'hosting'" : "inputs.release_scope != 'recovery-prerequisites-disabled'");
    if (hasMfaResponse) assert.equal(mfa.if, "inputs.release_scope == 'mfa-recovery-response'");
    assert.equal(install.if, hasMfaResponse
        ? "inputs.release_scope == 'recovery-prerequisites-disabled' || inputs.release_scope == 'mfa-recovery-response'"
        : "inputs.release_scope == 'recovery-prerequisites-disabled'");
    assert.equal(install.run, 'npm ci --prefix functions');
    if (hasMfaResponse) assert.equal(mfa.shell, 'bash');
    if (hasMfaResponse) assert.deepEqual(mfa.env, {FIREBASE_TOKEN: '${{ secrets.FIREBASE_TOKEN }}'});
    assert.match(backend.run, /test "\$GITHUB_SHA" = "\$remote_master"/);
    assert.match(backend.run, /node scripts\/plan-recovery-canary\.mjs --check/);
    assert.match(backend.run, /node scripts\/build-vault-account-backend\.mjs --check/);
    assert.match(backend.run, /^\s*node scripts\/deploy-recovery-prerequisites\.mjs\s*$/m);
    assert.doesNotMatch(backend.run, /--force|--only functions(?:\s|$)/);
    // Exact commands keep this third scope separate from Hosting and the
    // disabled recovery-prerequisite census. No caller-provided selectors.
    if (hasMfaResponse) assert.deepEqual(mfa.run.trim().split(/\r?\n/).map(line => line.trim()), [
        'set -euo pipefail',
        'remote_master="$(git ls-remote origin refs/heads/master | cut -f1)"',
        'test -n "$remote_master"',
        'test "$GITHUB_SHA" = "$remote_master"',
        'node scripts/plan-recovery-canary.mjs --check',
        'node scripts/build-vault-account-backend.mjs --check',
        'node node_modules/firebase-tools/lib/bin/firebase.js deploy --project appcodici-password --only functions:recoverMfaWithCode --non-interactive --token "$FIREBASE_TOKEN"'
    ]);
    return true;
}
export function verifyRecoveryCanaryContract({indexSource, policy, clientSource, configuration}) {
    const ast = parse(indexSource, {sourceType: 'script'});
    const exports = ast.program.body.flatMap(statement => {
        const assignment = statement.type === 'ExpressionStatement' && statement.expression;
        const member = assignment?.type === 'AssignmentExpression' && assignment.operator === '=' && assignment.left;
        return member?.type === 'MemberExpression' && member.object?.name === 'exports' && !member.computed
            ? [member.property.name] : [];
    });
    // Unknown export forms must trigger review rather than disappear from the
    // census (computed names, conditional assignments, Object.assign, etc.).
    let exportReferences = 0;
    function inspect(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'Identifier' && node.name === 'exports') exportReferences++;
        if (node.type === 'MemberExpression' && node.object?.name === 'module' &&
            (node.property?.name === 'exports' || node.property?.value === 'exports')) {
            assert.fail('Unsupported module.exports form: review the complete writer deployment scope');
        }
        for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(inspect); else inspect(value);
    }
    inspect(ast.program);
    assert.equal(exportReferences, exports.length, 'Unsupported export form: review the complete writer deployment scope');
    assert.deepEqual(exports.sort(), [...RECOVERY_PREREQUISITE_FUNCTIONS, ...EXCLUDED_FUNCTIONS].sort(), 'Function census changed: review the complete writer deployment scope');
    assert.deepEqual(policy, {stage: 'disabled', canaryOwners: []}, 'Prerequisite deployment must remain disabled');
    const client = parse(clientSource, {sourceType: 'module'});
    const enabled = client.program.body.flatMap(statement => statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'VariableDeclaration'
        ? statement.declaration.declarations.filter(value => value.id?.name === 'COMPLETE_RECOVERY_ENABLED') : []);
    assert.equal(enabled.length, 1, 'Missing canonical client gate');
    assert.equal(enabled[0].init?.type, 'BooleanLiteral');
    assert.equal(enabled[0].init.value, false, 'Client recovery must remain disabled');
    assert.equal(configuration.firestore?.database, RECOVERY_TARGET.databaseId);
    assert.equal(configuration.firestore?.rules, 'firestore.rules');
    assert.equal(configuration.storage?.rules, 'storage.rules');
    assert.equal(configuration.functions?.length, 1);
    assert.equal(configuration.functions[0].source, 'functions');
    assert.equal(configuration.functions[0].codebase, 'default');
    return {functions: [...RECOVERY_PREREQUISITE_FUNCTIONS], selectors: [...RECOVERY_PREREQUISITE_FUNCTIONS.map(name => `functions:${name}`), 'firestore:rules', 'storage']};
}
export function planRecoveryCanary() {
    const contract = verifyRecoveryCanaryContract({indexSource: read('functions/index.js'), policy: RECOVERY_PRODUCTION_POLICY,
        clientSource: read('Frontend/public/assets/js/app-env.js'), configuration: JSON.parse(read('firebase.json'))});
    const workflowSource = read('.github/workflows/firebase-deploy.yml');
    verifyRecoveryCanaryWorkflow(workflowSource);
    const hasMfaResponse = parseYaml(workflowSource).on.workflow_dispatch.inputs.release_scope.options.length === 3;
    const evidenceFiles = ['functions/index.js', 'functions/full-recovery-policy.js', 'functions/full-recovery-production.js',
        'functions/full-recovery-adapter.js', 'functions/full-recovery-runtime.js', 'functions/vault-recovery-fence.js',
        'functions/archive-purge-global-lock.js', 'functions/vault-account-runtime.js', 'functions/package-lock.json',
        'firestore.rules', 'storage.rules', 'firebase.json', 'Frontend/public/assets/js/app-env.js', '.github/workflows/firebase-deploy.yml',
        'scripts/plan-recovery-canary.mjs', 'scripts/deploy-recovery-prerequisites.mjs'];
    return {schemaVersion: 1, executable: false, cloudCalls: false, target: RECOVERY_TARGET,
        stage: 'prerequisites-disabled', ...contract, excludedFunctions: EXCLUDED_FUNCTIONS,
        sourceDigests: Object.fromEntries(evidenceFiles.map(path => [path, createHash('sha256').update(read(path).replace(/\r\n/g, '\n')).digest('hex')])),
        releasePath: {workflow: '.github/workflows/firebase-deploy.yml', lastPublishedCapability: 'hosting-only',
            candidateCapability: hasMfaResponse ? 'manual-hosting-or-disabled-recovery-prerequisites-or-mfa-response'
                : 'manual-hosting-or-disabled-recovery-prerequisites', backendJobPrepared: true, executed: false},
        canary: {identityCreated: false, identitySelected: false, uidPattern: 'qa-recovery-*', emailPattern: 'codex.recovery.*@example.invalid',
            disposableAuthUser: true, administrativelyVerifiedSyntheticEmail: true, passwordProvider: true, realAppCheck: true,
            syntheticBackupBoundToSameUid: true, cloudWritesAuthorized: false, qa2WipeOrRotation: false, realUserData: false,
            fixtureDeletionBeforeImport: false, automaticAccountDeletion: false, automaticLockDeletion: false},
        activationGates: ['Reviewed immutable source SHA and explicit cloud scope approval',
            'Fixed manual backend path in the existing GitHub workflow; no deployment from the PC',
            'Remote census of all regions, generations, aliases and serving revisions; no unfenced Admin writer',
            'Deploy Rules and all 43 prerequisite functions with server and client disabled, then verify revisions',
            'Drain actual prior invocations/jobs; source timeout alone is not proof',
            'Approve a new disposable identity and same-UID local synthetic backup; target empty with no purge/reserved/deleting markers',
            'Separate reviewed code-owned canary policy and client cohort or confined test harness',
            'Real Auth/App Check, resume/replay, new-password unlock, byte verification and warm-runtime resource measurements'],
        rollback: {retainFenceRulesAndWriters: true, disableRecoveryCohortAndClient: true, drainInvocations: true,
            preserveInterruptedPlansAndLocks: true, restoreOldBackendGlobally: false, deleteLock: false}};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assert.ok(process.argv.length <= 3 && process.argv.slice(2).every(value => ['--check', '--selectors'].includes(value)), 'Only read-only planning, --check or --selectors is supported');
    const plan = planRecoveryCanary();
    console.log(process.argv.includes('--selectors') ? plan.selectors.join(',') : process.argv.includes('--check')
        ? `Recovery prerequisite contract: ${plan.functions.length} functions + Firestore/Storage Rules; disabled; no cloud I/O.` : JSON.stringify(plan, null, 2));
}
