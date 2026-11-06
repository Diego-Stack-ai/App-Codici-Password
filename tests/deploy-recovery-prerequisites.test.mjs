import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {Writable} from 'node:stream';
import {createRetryConfirmation, RETRY_WARNING, RETRY_QUESTION, RETRY_TRIGGERS, deploymentArguments,
    assertExistingCleanup, runConfirmedProcess} from '../scripts/deploy-recovery-prerequisites.mjs';
import {planRecoveryCanary} from '../scripts/plan-recovery-canary.mjs';

test('only the exact four-trigger warning and question can send one confirmation, including split ANSI/pipes', () => {
    const sent = [], confirm = createRetryConfirmation(value => sent.push(value));
    confirm.push(`? ${RETRY_QUESTION} (Y/n) `);
    assert.deepEqual(sent, []);
    const colored = `\u001b[33m${RETRY_WARNING}\u001b[0m\n`;
    for (const part of [colored.slice(0, 8), colored.slice(8, 63), colored.slice(63)]) confirm.push(part, 'stderr');
    assert.deepEqual(sent, ['y\n']);
    confirm.push(`\n? ${RETRY_QUESTION} (Y/n) y`);
    assert.deepEqual(sent, ['y\n']);
    assert.deepEqual(confirm.finish(), {retryConfirmationSent: true});
});
test('extra/missing/different-region retry policies and unrelated questions receive no input', () => {
    for (const warning of [RETRY_WARNING.replace('onInviteCreated(europe-west1), ', ''),
        RETRY_WARNING.replace('onInviteCreated(europe-west1)', 'onInviteCreated(us-central1)'),
        RETRY_WARNING.replace('onInviteCreated(europe-west1)', 'otherFunction(europe-west1)'),
        RETRY_WARNING.replace('. Retried', ', otherFunction(europe-west1). Retried'),
        RETRY_WARNING.replace('onInviteCreated', 'otherFunction') + '\n' + RETRY_WARNING]) {
        const sent = [], confirm = createRetryConfirmation(value => sent.push(value));
        assert.throws(() => confirm.push(warning + `\n? ${RETRY_QUESTION} (Y/n) `), /WARNING_UNAPPROVED/);
        assert.deepEqual(sent, []);
    }
    for (const question of ['Delete old functions?', 'How many days should artifacts be kept?', 'Would you like to grant IAM roles?']) {
        const sent = [], confirm = createRetryConfirmation(value => sent.push(value));
        confirm.push(RETRY_WARNING);
        assert.throws(() => confirm.push(`\n? ${question}`), /QUESTION_UNAPPROVED/);
        assert.deepEqual(sent, []);
    }
    for (const transcript of [`? ${RETRY_QUESTION} Delete everything instead?`,
        `? ${RETRY_QUESTION} (Y/n) Delete everything instead?`,
        `? Delete old functions?\n? ${RETRY_QUESTION} (Y/n) `,
        `? ${RETRY_QUESTION} (Y/n) \n? Delete old functions?`]) {
        const sent = [], confirm = createRetryConfirmation(value => sent.push(value));
        assert.throws(() => confirm.push(RETRY_WARNING + '\n' + transcript), /QUESTION_UNAPPROVED/);
        assert.deepEqual(sent, []);
    }
});
test('a missing warning or any second confirmation cannot be acknowledged', () => {
    const sent = [], missing = createRetryConfirmation(value => sent.push(value));
    missing.push(`? ${RETRY_QUESTION} (Y/n) `);
    assert.throws(() => missing.finish(), /QUESTION_UNCONFIRMED/); assert.deepEqual(sent, []);
    for (const marker of ['✔', '✓', '√']) {
        const answers = [], confirm = createRetryConfirmation(value => answers.push(value));
        confirm.push(RETRY_WARNING + `\n? ${RETRY_QUESTION} (Y/n) `);
        confirm.push(`\n${marker} ${RETRY_QUESTION} Yes\n`);
        assert.throws(() => confirm.push(`? ${RETRY_QUESTION} (Y/n) `), /SECOND_CONFIRMATION_UNAPPROVED/);
        assert.deepEqual(answers, ['y\n']);
        for (let split = 2; split <= 3; split++) {
            const bytes = Buffer.from(`\n${marker} ${RETRY_QUESTION} Yes\n? ${RETRY_QUESTION} (Y/n) `);
            const inputs = [], fragmented = createRetryConfirmation(value => inputs.push(value));
            fragmented.push(RETRY_WARNING + `\n? ${RETRY_QUESTION} (Y/n) `);
            fragmented.push(bytes.subarray(0, split));
            assert.throws(() => fragmented.push(bytes.subarray(split)), /SECOND_CONFIRMATION_UNAPPROVED/);
            assert.deepEqual(inputs, ['y\n']);
        }
    }
    assert.deepEqual(createRetryConfirmation(() => assert.fail('No input expected')).finish(), {retryConfirmationSent: false});
    const partial = createRetryConfirmation(() => assert.fail('No input expected'));
    partial.push('? Would'); assert.throws(() => partial.finish(), /QUESTION_UNCONFIRMED/);
    assert.throws(() => createRetryConfirmation(() => assert.fail()).push('x'.repeat(256 * 1024 + 1)), /OUTPUT_LIMIT/);
});
test('deployment arguments pin project/selectors and use official interactive mode without broad force', () => {
    const plan = planRecoveryCanary(), args = deploymentArguments(plan, 'synthetic-unused-token');
    assert.equal(args[args.indexOf('--project') + 1], 'appcodici-password');
    assert.equal(args[args.indexOf('--only') + 1], plan.selectors.join(','));
    assert.equal(args.includes('--interactive'), true);
    assert.equal(args.includes('--force'), false); assert.equal(args.includes('--non-interactive'), false);
    for (const mutate of [value => { value.target = {...value.target, projectId: 'other'}; },
        value => { value.selectors[0] = 'functions'; }, value => { value.functions.pop(); }, value => { value.stage = 'canary'; }]) {
        const value = structuredClone(plan); mutate(value); assert.throws(() => deploymentArguments(value, 'synthetic'));
    }
    assert.throws(() => deploymentArguments(plan, ''), /TOKEN_REQUIRED/);
});
test('an existing artifact policy or explicit opt-out is required without changing its retention', () => {
    const repository = {name: 'projects/appcodici-password/locations/europe-west1/repositories/gcf-artifacts',
        cleanupPolicies: {'firebase-functions-cleanup': {action: 'DELETE', condition: {olderThan: '2592000s'}}}};
    const before = structuredClone(repository); assertExistingCleanup(repository); assert.deepEqual(repository, before);
    assertExistingCleanup({name: repository.name, labels: {'firebase-functions-cleanup-opted-out': 'true'}});
    assert.throws(() => assertExistingCleanup({name: repository.name}), /EXISTING_CLEANUP_POLICY_REQUIRED/);
    assert.throws(() => assertExistingCleanup({...repository, name: repository.name.replace('europe-west1', 'us-central1')}));
});
test('actual official Firebase failure-policy prompt accepts exactly one bounded answer with synthetic endpoints only', {timeout: 10000}, async () => {
    const fixture = `process.env.IS_FIREBASE_CLI='true'; require('firebase-tools/lib/logger').useConsoleLoggers();
const prompts=require('firebase-tools/lib/deploy/functions/prompts');
const ids=${JSON.stringify(RETRY_TRIGGERS)}; const endpoints=Object.fromEntries(ids.map(id=>[id,{id,region:'europe-west1',project:'demo-confirmation',platform:'gcfv2',eventTrigger:{eventType:'synthetic.event',retry:true}}]));
prompts.promptForFailurePolicies({nonInteractive:false},{endpoints:{'europe-west1':endpoints}},{endpoints:{}}).then(()=>console.log('Synthetic prompt completed')).catch(()=>process.exitCode=1);`;
    const child = spawn(process.execPath, ['-e', fixture], {cwd: process.cwd(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true});
    const chunks = [];
    const quiet = () => new Writable({write(chunk, _encoding, callback) { chunks.push(String(chunk)); callback(); }});
    try {
        assert.deepEqual(await runConfirmedProcess(child, {stdout: quiet(), stderr: quiet(), timeoutMs: 8000}), {retryConfirmationSent: true});
    } catch (error) { error.message += `: synthetic prompt output ${JSON.stringify(chunks.join(''))}`; throw error; }
});
test('unexpected real subprocess question stops before any positive answer', {timeout: 5000}, async () => {
    const fixture = `require('firebase-tools/lib/prompt').confirm('Delete old functions?').then(()=>process.exitCode=99);`;
    const child = spawn(process.execPath, ['-e', fixture], {cwd: process.cwd(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true});
    const quiet = () => new Writable({write(_chunk, _encoding, callback) { callback(); }});
    await assert.rejects(runConfirmedProcess(child, {stdout: quiet(), stderr: quiet(), timeoutMs: 3000}), /QUESTION_UNAPPROVED/);
});
test('a second official confirmation is rejected after the first native prompt completes', {timeout: 7000}, async () => {
    const fixture = `process.env.IS_FIREBASE_CLI='true';require('firebase-tools/lib/logger').useConsoleLoggers();
const {promptForFailurePolicies}=require('firebase-tools/lib/deploy/functions/prompts');const {confirm}=require('firebase-tools/lib/prompt');
const ids=${JSON.stringify(RETRY_TRIGGERS)}, endpoints=Object.fromEntries(ids.map(id=>[id,{id,region:'europe-west1',platform:'gcfv2',eventTrigger:{retry:true}}]));
promptForFailurePolicies({nonInteractive:false},{endpoints:{'europe-west1':endpoints}},{endpoints:{}}).then(()=>confirm(${JSON.stringify(RETRY_QUESTION)})).then(()=>process.exitCode=99);`;
    const child = spawn(process.execPath, ['-e', fixture], {cwd: process.cwd(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true});
    const quiet = () => new Writable({write(_chunk, _encoding, callback) { callback(); }});
    await assert.rejects(runConfirmedProcess(child, {stdout: quiet(), stderr: quiet(), timeoutMs: 5000}), /SECOND_CONFIRMATION_UNAPPROVED/);
});
