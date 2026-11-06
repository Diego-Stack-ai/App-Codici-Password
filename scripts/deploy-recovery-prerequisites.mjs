import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {StringDecoder} from 'node:string_decoder';
import {planRecoveryCanary, RECOVERY_PREREQUISITE_FUNCTIONS} from './plan-recovery-canary.mjs';

export const RETRY_TRIGGERS = Object.freeze(['onInviteCreated', 'onScadenzaCreated', 'onScadenzaDeleted', 'onScadenzaUpdated']);
export const RETRY_QUESTION = 'Would you like to proceed with deployment?';
export const RETRY_WARNING = 'The following functions will newly be retried in case of failure: ' +
    RETRY_TRIGGERS.map(name => `${name}(europe-west1)`).join(', ') + '. ' +
    'Retried executions are billed as any other execution, and functions are retried repeatedly until they either successfully execute or the maximum retry period has elapsed, which can be up to 7 days. ' +
    'For safety, you might want to ensure that your functions are idempotent; see https://firebase.google.com/docs/functions/retries to learn more.';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const stripAnsi = value => value.replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[\d*[KG]/g, '\n').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '\n');
const fail = code => { throw new Error(code); };

// The two pipes may arrive in either order. No input is sent until both the
// complete reviewed warning and its exact question have actually appeared.
export function createRetryConfirmation(send) {
    const buffers = new Map();
    const decoders = new Map();
    let warningSeen = false, warningStarted = false, questionStarted = false, answered = false, completed = false, pending = false;
    const questionOffsets = new Map();
    const partialQuestions = new Map();
    const frame = `${RETRY_QUESTION} (Y/n)`;
    function accept() {
        if (warningSeen && pending && !answered && ![...partialQuestions.values()].some(Boolean)) { answered = true; send('y\n'); }
    }
    return {
        push(chunk, channel = 'stdout') {
            if (!decoders.has(channel)) decoders.set(channel, new StringDecoder('utf8'));
            const decoded = Buffer.isBuffer(chunk) ? decoders.get(channel).write(chunk) : String(chunk);
            const text = stripAnsi((buffers.get(channel) || '') + decoded);
            if (text.length > 256 * 1024) {
                if (!answered) fail('DEPLOY_CONFIRMATION_OUTPUT_LIMIT');
                buffers.set(channel, text.slice(-128 * 1024)); questionOffsets.set(channel, -1);
            } else buffers.set(channel, text);
            const current = buffers.get(channel);
            const prefix = 'The following functions will newly be retried in case of failure: ';
            for (let offset = current.indexOf(prefix); offset >= 0; offset = current.indexOf(prefix, offset + prefix.length)) {
                warningStarted = true;
                const end = current.indexOf('to learn more.', offset);
                if (end >= 0) {
                    if (current.slice(offset, end + 'to learn more.'.length) !== RETRY_WARNING) fail('DEPLOY_RETRY_WARNING_UNAPPROVED');
                    warningSeen = true;
                }
            }
            const done = Math.max(...['✔', '✓', '√'].map(marker => current.lastIndexOf(`${marker} ${RETRY_QUESTION}`)));
            if (answered && done >= 0) completed = true;
            partialQuestions.set(channel, false);
            for (const prompt of current.matchAll(/(?:^|\n)[ \t]*\? /g)) {
                const offset = prompt.index + prompt[0].lastIndexOf('? ');
                if (offset <= (questionOffsets.get(channel) ?? -1)) continue;
                questionStarted = true;
                const question = current.slice(offset + 2).split('\n')[0];
                if (question !== frame && question !== frame + ' ' && !(answered && question === frame + ' y')) {
                    if (!current.slice(offset + 2).includes('\n') && frame.startsWith(question)) {
                        partialQuestions.set(channel, true); continue;
                    }
                    fail('DEPLOY_QUESTION_UNAPPROVED');
                }
                if (answered && completed && offset > done) fail('DEPLOY_SECOND_CONFIRMATION_UNAPPROVED');
                questionOffsets.set(channel, offset);
                pending = true;
            }
            accept();
        },
        finish() {
            for (const decoder of decoders.values()) if (decoder.end()) fail('DEPLOY_CONFIRMATION_TEXT_INCOMPLETE');
            if ([...partialQuestions.values()].some(Boolean)) fail('DEPLOY_QUESTION_UNCONFIRMED');
            if ((questionStarted || warningStarted || pending || warningSeen) && !answered) fail('DEPLOY_QUESTION_UNCONFIRMED');
            return {retryConfirmationSent: answered};
        }
    };
}

export function deploymentArguments(plan, token, cliPath = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js')) {
    assert.equal(plan.stage, 'prerequisites-disabled');
    assert.equal(plan.target.projectId, 'appcodici-password');
    assert.deepEqual(plan.functions, [...RECOVERY_PREREQUISITE_FUNCTIONS]);
    assert.deepEqual(plan.selectors, [...RECOVERY_PREREQUISITE_FUNCTIONS.map(name => `functions:${name}`), 'firestore:rules', 'storage']);
    assert.equal(typeof token, 'string'); assert.ok(token.length > 0, 'DEPLOY_TOKEN_REQUIRED');
    return [cliPath, 'deploy', '--project', 'appcodici-password', '--only', plan.selectors.join(','), '--interactive', '--token', token];
}

export function assertExistingCleanup(repository) {
    assert.equal(repository?.name, 'projects/appcodici-password/locations/europe-west1/repositories/gcf-artifacts');
    const optedOut = repository.labels?.['firebase-functions-cleanup-opted-out'] === 'true';
    const policy = repository.cleanupPolicies?.['firebase-functions-cleanup'];
    if (!optedOut && !policy) fail('DEPLOY_EXISTING_CLEANUP_POLICY_REQUIRED');
}
async function checkExistingCleanup(token) {
    const logger = require('firebase-tools/lib/logger').logger;
    logger.silent = true;
    try {
        await require('firebase-tools/lib/requireAuth').requireAuth({cwd: root, project: 'appcodici-password', token});
        const repository = await require('firebase-tools/lib/functions/artifacts').getRepo('appcodici-password', 'europe-west1', true);
        assertExistingCleanup(repository);
    } catch { fail('DEPLOY_CLEANUP_PREFLIGHT_FAILED'); }
}

export function runConfirmedProcess(child, {stdout = process.stdout, stderr = process.stderr, timeoutMs = 35 * 60 * 1000} = {}) {
    return new Promise((resolvePromise, reject) => {
        let rejected;
        const stop = error => { if (rejected) return; rejected = error; child.stdin.destroy(); child.kill('SIGTERM'); };
        const confirmation = createRetryConfirmation(input => child.stdin.write(input));
        const timer = setTimeout(() => stop(new Error('DEPLOY_PROCESS_TIMEOUT')), timeoutMs);
        for (const [channel, output] of [['stdout', stdout], ['stderr', stderr]]) {
            child[channel].on('data', chunk => {
                output.write(chunk);
                try { confirmation.push(chunk, channel); } catch (error) { stop(error); }
            });
        }
        child.stdin.on('error', () => stop(new Error('DEPLOY_INPUT_FAILED')));
        child.on('error', () => stop(new Error('DEPLOY_PROCESS_FAILED')));
        child.on('close', code => {
            clearTimeout(timer);
            if (rejected) reject(rejected);
            else if (code !== 0) reject(new Error('DEPLOY_CLI_FAILED'));
            else { try { resolvePromise(confirmation.finish()); } catch (error) { reject(error); } }
        });
    });
}

async function main() {
    assert.equal(process.argv.length, 2, 'DEPLOY_ARGUMENTS_FORBIDDEN');
    const plan = planRecoveryCanary();
    // The workflow rechecks master/SHA, the disabled policy and source-built
    // bundle before invoking this fixed command. No arbitrary selectors/input.
    const args = deploymentArguments(plan, process.env.FIREBASE_TOKEN);
    await checkExistingCleanup(process.env.FIREBASE_TOKEN);
    const child = spawn(process.execPath, args, {cwd: root, env: process.env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true});
    const result = await runConfirmedProcess(child);
    console.log(JSON.stringify({deploymentCompleted: true, ...result}));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
