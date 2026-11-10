import {isDeepStrictEqual} from 'node:util';

export const CLAIM_PROJECT = 'appcodici-password';
export const FRAME_CLAIM = 'vault_frame_canary';
const codes = new Set(['ARGUMENT_INVALID','TARGET_NOT_APPROVED','IDENTITY_MISMATCH','CLAIMS_INVALID',
  'CLAIMS_TOO_LARGE','CLAIM_CONFLICT','POLICY_INVALID','POLICY_INCOMPLETE','STATE_CHANGED',
  'EXCLUSIVE_WRITER_REQUIRED','RECEIPT_REQUIRED','RECEIPT_FAILED','READ_FAILED',
  'WRITE_OUTCOME_UNKNOWN','POSTCHECK_FAILED','ADAPTER_UNAVAILABLE','LOCAL_CONFIG_INVALID']);
export class ClaimPreparationError extends Error {
  constructor(code) { super(codes.has(code) ? code : 'READ_FAILED'); this.code = this.message; }
}
const fail = code => { throw new ClaimPreparationError(code); };
export const safeClaimError = error => error instanceof ClaimPreparationError && codes.has(error.code) ? error.code : 'READ_FAILED';
const uidValid = uid => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid);

export function parseClaimArguments(args) {
  const options = {mode: 'dry-run', exclusiveWriter: false};
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (seen.has(key)) fail('ARGUMENT_INVALID'); seen.add(key);
    if (key === '--help') options.help = true;
    else if (key === '--dry-run' || key === '--apply') options.mode = key.slice(2);
    else if (key === '--confirm-exclusive-writer') options.exclusiveWriter = true;
    else if (['--uid','--phase','--private-config','--receipt-file'].includes(key)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) fail('ARGUMENT_INVALID');
      options[{'--uid':'uid','--phase':'phase','--private-config':'privateConfig','--receipt-file':'receiptFile'}[key]] = value;
    } else fail('ARGUMENT_INVALID');
  }
  if (seen.has('--dry-run') && seen.has('--apply')) fail('ARGUMENT_INVALID');
  if (options.help) { if (args.length !== 1) fail('ARGUMENT_INVALID'); return options; }
  if (!uidValid(options.uid) || !['test','personal'].includes(options.phase) || !options.privateConfig) fail('ARGUMENT_INVALID');
  if (options.mode === 'apply' && !options.exclusiveWriter) fail('EXCLUSIVE_WRITER_REQUIRED');
  if (options.mode === 'apply' && !options.receiptFile) fail('RECEIPT_REQUIRED');
  if (options.mode === 'dry-run' && (options.receiptFile || options.exclusiveWriter)) fail('ARGUMENT_INVALID');
  return options;
}

export function validateClaimTarget(config, options) {
  const keys = ['schemaVersion','projectId','uid','expectedEmail','phase','approvedForCanary'];
  if (!config || Object.keys(config).length !== keys.length || keys.some(key => !Object.hasOwn(config,key)) ||
      config.schemaVersion !== 1 || config.projectId !== CLAIM_PROJECT || config.approvedForCanary !== true ||
      !uidValid(config.uid) || config.uid !== options.uid || config.phase !== options.phase ||
      !['test','personal'].includes(config.phase) || typeof config.expectedEmail !== 'string' ||
      config.expectedEmail !== config.expectedEmail.trim() || !/^[^\s@]+@[^\s@]+$/.test(config.expectedEmail)) fail('TARGET_NOT_APPROVED');
  if (config.phase === 'test' && !config.expectedEmail.toLowerCase().endsWith('@appcodici-password.invalid')) fail('TARGET_NOT_APPROVED');
  return {...config, expectedEmail: config.expectedEmail.toLowerCase()};
}

function jsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && [Object.prototype,null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,jsonValue(item)]));
  }
  fail('CLAIMS_INVALID');
}
function claimsFrom(user) {
  const value = user.customClaims ?? {};
  if (!value || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail('CLAIMS_INVALID');
  try { return jsonValue(value); } catch { fail('CLAIMS_INVALID'); }
}
function identity(user, target) {
  if (!user || user.uid !== target.uid || user.disabled !== false || user.emailVerified !== true ||
      typeof user.email !== 'string' || user.email.toLowerCase() !== target.expectedEmail) fail('IDENTITY_MISMATCH');
}
function policyState(snapshot, target) {
  const data = snapshot?.data;
  const keys = ['schemaVersion','version','uid','enabled','expiresAt'];
  if (!snapshot?.exists || typeof snapshot.revision !== 'string' || !snapshot.revision || !data ||
      Object.keys(data).some(key => !keys.includes(key)) ||
      ['schemaVersion','version','uid','enabled'].some(key => !Object.hasOwn(data,key)) ||
      data.schemaVersion !== 1 || data.version !== 1 || data.uid !== target.uid || data.enabled !== false) fail('POLICY_INVALID');
  let expiry = null;
  if (Object.hasOwn(data,'expiresAt')) {
    try { expiry = data.expiresAt.toMillis(); } catch { fail('POLICY_INVALID'); }
    if (!Number.isFinite(expiry)) fail('POLICY_INVALID');
  }
  return {revision:snapshot.revision, expiresAt:expiry, complete:expiry !== null};
}
async function read(operation) {
  try { return await operation(); } catch (error) {
    if (error instanceof ClaimPreparationError) throw error;
    fail('READ_FAILED');
  }
}

// No SDK imports or cloud work at module load. Tests supply synthetic adapters.
// Auth has no compare-and-set here: exclusive writer is an operational gate,
// and the second read reduces, but cannot eliminate, the final race window.
export async function runVaultFrameClaim({auth, readPolicy, target, options, saveBefore, now = Date.now}) {
  target = validateClaimTarget(target,options);
  if (!['apply','dry-run'].includes(options.mode)) fail('ARGUMENT_INVALID');
  if (options.mode === 'apply' && !options.exclusiveWriter) fail('EXCLUSIVE_WRITER_REQUIRED');
  if (options.mode === 'apply' && typeof saveBefore !== 'function') fail('RECEIPT_REQUIRED');
  const firstPolicy = policyState(await read(readPolicy),target);
  const first = await read(() => auth.getUser(target.uid)); identity(first,target);
  const before = claimsFrom(first);
  if (Object.hasOwn(before,FRAME_CLAIM) && typeof before[FRAME_CLAIM] !== 'boolean') fail('CLAIM_CONFLICT');
  const after = {...before, [FRAME_CLAIM]:true};
  if (Buffer.byteLength(JSON.stringify(after),'utf8') > 1000) fail('CLAIMS_TOO_LARGE');
  const alreadySet = before[FRAME_CLAIM] === true;
  const applyReady = firstPolicy.complete && firstPolicy.expiresAt > now();
  const report = {mode:options.mode, phase:options.phase, projectId:CLAIM_PROJECT,
    ...(options.mode === 'dry-run' ? {targetUid:target.uid} : {}),
    intendedChange:{claim:FRAME_CLAIM,value:true}, otherClaimCount:Object.keys(before).filter(key=>key!==FRAME_CLAIM).length,
    preservesOtherClaims:true, policyComplete:firstPolicy.complete, applyReady,
    wouldWrite:!alreadySet && applyReady, alreadySet, wrote:false, verified:false};
  if (options.mode === 'dry-run') return report;
  if (!applyReady) fail('POLICY_INCOMPLETE');
  if (!alreadySet) {
    try { await saveBefore({schemaVersion:1,projectId:CLAIM_PROJECT,uid:target.uid,
      phase:target.phase,previousClaims:before,expectedClaims:after,policyRevision:firstPolicy.revision}); }
    catch { fail('RECEIPT_FAILED'); }
  }
  const secondPolicy = policyState(await read(readPolicy),target);
  const second = await read(() => auth.getUser(target.uid)); identity(second,target);
  if (!isDeepStrictEqual(firstPolicy,secondPolicy) || !isDeepStrictEqual(before,claimsFrom(second)) ||
      secondPolicy.expiresAt <= now()) fail('STATE_CHANGED');
  if (!alreadySet) {
    // Never retry after this call: a failed response may still mean it committed.
    try { await auth.setCustomUserClaims(target.uid,after); }
    catch { fail('WRITE_OUTCOME_UNKNOWN'); }
    report.wrote = true;
  }
  try {
    const finalPolicy = policyState(await readPolicy(),target);
    const final = await auth.getUser(target.uid); identity(final,target);
    if (!isDeepStrictEqual(firstPolicy,finalPolicy) || !isDeepStrictEqual(after,claimsFrom(final)) ||
        finalPolicy.expiresAt <= now()) fail('POSTCHECK_FAILED');
  } catch { fail('POSTCHECK_FAILED'); }
  report.verified = true; return report;
}
