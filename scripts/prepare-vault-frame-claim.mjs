import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CLAIM_PROJECT, ClaimPreparationError, parseClaimArguments, validateClaimTarget,
  runVaultFrameClaim, safeClaimError} from './lib/vault-frame-claim.mjs';
import {privateFilePath,savePrivateClaimReceipt} from './lib/vault-frame-private-receipt.mjs';
import {createVaultFrameClaimAdmin} from './lib/vault-frame-claim-admin.mjs';

export const CLAIM_HELP = 'Prepare one approved target only, with the dedicated impersonated ADC. Default: --dry-run (reads only). Required: --uid <private value> --phase test|personal --private-config <private JSON file>. Optional --remove deletes only the frame claim after OFF, including after expiry, before a phase switch or C2. Apply additionally requires --apply --confirm-exclusive-writer --receipt-file <new private DPAPI file>. Reports never echo identifiers. Execute only after Claude review and separate approval by Diego. No singleton writes, activation, credential creation, login or deploy.';

export async function claimMain(args, dependencies = {}) {
  const options = parseClaimArguments(args);
  const output = dependencies.output || (value=>console.log(JSON.stringify(value)));
  if (options.help) { output({help:CLAIM_HELP}); return; }
  // All input guards precede the lazy Admin SDK import and any cloud request.
  const readTarget = dependencies.readTarget || (async filename => JSON.parse(await readFile(await privateFilePath(filename),'utf8')));
  let target;
  try { target = validateClaimTarget(await readTarget(options.privateConfig),options); }
  catch (error) { throw error instanceof ClaimPreparationError ? error : new ClaimPreparationError('LOCAL_CONFIG_INVALID'); }
  if (options.mode === 'apply') {
    try { await (dependencies.checkReceiptPath || (filename=>privateFilePath(filename,{mustExist:false})))(options.receiptFile); }
    catch { throw new ClaimPreparationError('RECEIPT_FAILED'); }
  }
  const loadAdmin = dependencies.loadAdmin || (async()=>{
    try {
      const firebase = JSON.parse(await readFile(new URL('../.firebaserc',import.meta.url),'utf8'));
      if (firebase.projects?.default !== CLAIM_PROJECT) throw new ClaimPreparationError('LOCAL_CONFIG_INVALID');
      return await createVaultFrameClaimAdmin();
    } catch (error) { throw error instanceof ClaimPreparationError ? error : new ClaimPreparationError('ADAPTER_UNAVAILABLE'); }
  });
  const admin = await loadAdmin();
  try {
    const report = await runVaultFrameClaim({auth:admin.auth,readPolicy:admin.readPolicy,target,options,
      saveBefore:options.mode==='apply' ? payload=>(dependencies.saveReceipt || savePrivateClaimReceipt)(options.receiptFile,payload) : undefined});
    output(report); return report;
  } finally { try { await admin.close?.(); } catch {} }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  claimMain(process.argv.slice(2)).catch(error=>{
    console.error(JSON.stringify({ok:false,code:safeClaimError(error)})); process.exitCode=1;
  });
}
