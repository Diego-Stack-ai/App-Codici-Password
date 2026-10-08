import planner from '../../functions/archive-purge-reference-plan.js';
import service from '../../functions/archive-purge-service.js';
import {createHash} from 'node:crypto';
import {preparePurgeFence, cancelPreparedPurge} from './purge-fence-model.mjs';

const fields = ['context','accountId','companyId','kind','linkId','widgetId','sharedDataId','ownerId','aziendaId','revision'];

// Internal, read-only diagnostic. This is deliberately not a deletion permit:
// grants, unknown descendants and Storage effects are outside this inventory.
export function createPurgeReferenceInventoryLab(db, {limit = 400} = {}) {
  if (db.projectId !== 'demo-vault-shell' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085') throw Error('PURGE_LAB_ONLY');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 400) throw Error('INVENTORY_LIMIT_INVALID');
  const inspect = async ({uid, command: input, writeBudget}, prepare = false, expectedPlanHash = null) => {
    if (!Number.isSafeInteger(writeBudget) || writeBudget < 0 || writeBudget > 450) throw Error('WRITE_BUDGET_INVALID');
    const command = structuredClone(input);
    const normalized = service.validatePurgeCommand(command);
    const targetPath = service.accountPath(uid, normalized);
    if (!normalized.confirmation) throw Error('CONFIRMATION_REQUIRED');
    return db.runTransaction(async transaction => {
      const versions = new Map();
      const remember = snapshot => {
        if (!snapshot.exists) return;
        const version=snapshot.updateTime;
        if (!version || !Number.isSafeInteger(version.seconds) || !Number.isInteger(version.nanoseconds) || version.nanoseconds<0 || version.nanoseconds>=1e9)
          throw Error('REFERENCE_VERSION_UNVERIFIED');
        versions.set(snapshot.ref.path,Object.freeze({seconds:version.seconds,nanoseconds:version.nanoseconds}));
      };
      const target = await transaction.get(db.doc(targetPath));
      if (!target.exists || target.data().revision !== normalized.expectedRevision) throw Error('TARGET_VERSION_CONFLICT');
      remember(target);
      if (prepare && target.data().isArchived !== true) throw Error('TARGET_NOT_ARCHIVED');
      // Scan entire owner collections, not just target-filtered pairs: foreign
      // incoming references must remain visible to the planner. Overflow fails
      // closed; never paginate across separately timed snapshots.
      const queries = {
        widgets: db.collection(`users/${uid}/accountWidgets`),
        links: db.collection(`users/${uid}/sharedVaultLinks`),
        sharedData: db.collection(`users/${uid}/sharedVaultData`),
        invites: db.collection('invites').where('ownerId','==',uid),
      };
      const inventory = {scope:{ownerUid:uid,context:normalized.context,accountId:normalized.accountId,companyId:normalized.companyId},complete:{}};
      for (const [name, query] of Object.entries(queries)) {
        const snapshot = await transaction.get(query.limit(limit + 1));
        if (snapshot.docs.length > limit) throw Error('REFERENCE_INVENTORY_TOO_LARGE');
        inventory[name] = snapshot.docs.map(doc => {
          remember(doc);
          const data = doc.data(), metadata = {path:doc.ref.path};
          for (const field of fields) if (Object.hasOwn(data,field)) metadata[field] = data[field];
          return metadata;
        });
        inventory.complete[name] = true;
      }
      const profile = await transaction.get(db.doc(`users/${uid}`));
      const companies = await transaction.get(db.collection(`users/${uid}/aziende`).limit(limit + 1));
      if (companies.docs.length > limit) throw Error('REFERENCE_INVENTORY_TOO_LARGE');
      const profilePaths = [];
      const collect = (snapshot, company) => {
        if (!snapshot.exists) return;
        remember(snapshot);
        const patch = service.planProfileReferenceCleanup(snapshot.data(), normalized, {company});
        // Do not return patches: they can contain ciphertext/contact data. This
        // report only identifies documents requiring a future atomic cleanup.
        if (Object.keys(patch).length) profilePaths.push(snapshot.ref.path);
      };
      collect(profile,false);
      for (const company of companies.docs) collect(company,true);
      const attachments = await transaction.get(db.collection(`${targetPath}/attachments`).limit(limit + 1));
      if (attachments.docs.length > limit) throw Error('REFERENCE_INVENTORY_TOO_LARGE');
      const attachmentMetadata = attachments.docs.map(snapshot => {
        remember(snapshot);
        const storagePath = snapshot.data().storagePath;
        if (!service.isSafeAttachmentPath(uid,normalized,storagePath)) throw Error('ATTACHMENT_PATH_UNVERIFIED');
        const version = snapshot.updateTime;
        if (!version || !Number.isSafeInteger(version.seconds) || !Number.isInteger(version.nanoseconds) ||
            version.nanoseconds < 0 || version.nanoseconds >= 1e9) throw Error('ATTACHMENT_VERSION_UNVERIFIED');
        return Object.freeze({path:snapshot.ref.path,storagePath,
          expectedVersion:Object.freeze({seconds:version.seconds,nanoseconds:version.nanoseconds})});
      });
      const referencePlan = planner.planArchivePurgeReferences({uid,command,inventory,writeBudget:
        writeBudget-profilePaths.length-attachmentMetadata.length});
      const affected = referencePlan.valid ? [...new Set([targetPath,...referencePlan.deletePaths,
        ...referencePlan.revisionTouches.map(item=>item.path),...profilePaths,...attachmentMetadata.map(item=>item.path)])].sort() : [];
      const expectedDocuments = affected.map(path=>{
        if (!versions.has(path)) throw Error('REFERENCE_VERSION_UNVERIFIED');
        return Object.freeze({path,updateTime:versions.get(path)});
      });
      const details = {...referencePlan,profileReferencePaths:Object.freeze(profilePaths.sort()),
        expectedDocuments:Object.freeze(expectedDocuments),
        attachmentMetadata:Object.freeze(attachmentMetadata),attachmentInventoryComplete:true,
        profileInventoryComplete:true,plannedWriteCount:referencePlan.valid ? referencePlan.plannedWriteCount+profilePaths.length+attachmentMetadata.length : 0};
      const planHash=createHash('sha256').update(JSON.stringify({domain:'purge-reference-preview-v1',command:normalized,details})).digest('hex');
      const plan=Object.freeze({...details,planHash});
      if (!prepare) return plan;
      if (!plan.valid) throw Error('REFERENCE_INVENTORY_INVALID');
      if (expectedPlanHash !== null && expectedPlanHash !== planHash) throw Error('REFERENCE_PREVIEW_STALE');
      const stateRef = db.doc(`labPurgeStates/${createHash('sha256').update(targetPath).digest('hex')}`);
      const snapshot = await transaction.get(stateRef);
      const state = snapshot.exists ? snapshot.data() : {fence:{phase:'idle',revision:0,operationId:null}};
      if (Object.keys(state).length !== 1 || !state.fence) throw Error('PURGE_WRITE_BLOCKED');
      if (expectedPlanHash !== null && state.fence.phase==='prepared' &&
          state.fence.operationId===normalized.operationId && state.fence.previewHash===planHash &&
          Number.isSafeInteger(state.fence.revision) && state.fence.revision>0 &&
          Object.keys(state.fence).length===4) {
        return {plan,fence:state.fence,duplicate:true,destructiveAllowed:false};
      }
      const prepared = preparePurgeFence(state.fence, normalized.operationId);
      const fence = expectedPlanHash===null ? prepared : {...prepared,previewHash:planHash};
      transaction.set(stateRef,{fence});
      // Preparing only establishes writer invalidation. No claim/executor is
      // exposed: uncovered grants/Storage still prohibit destructive effects.
      return {plan,fence,duplicate:false,destructiveAllowed:false};
    });
  };
  const read = request => inspect(request);
  // Explicit preview-bound preparation; comparison and fence creation are one
  // transaction. Neither this hash nor preparation grants deletion authority.
  read.prepareVerified = (request, expectedPlanHash) => {
    if (typeof expectedPlanHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedPlanHash)) throw Error('REFERENCE_PREVIEW_INVALID');
    return inspect(request,true,expectedPlanHash);
  };
  read.prepare = read.prepareVerified;
  // Internal cancellation, not a destructive executor or an exclusive release.
  read.cancelPrepared = async ({uid, command: input}, expected) => {
    const command = service.validatePurgeCommand(structuredClone(input));
    const targetPath = service.accountPath(uid, command), token = structuredClone(expected);
    if (!command.confirmation || !token || Object.keys(token).length !== 4 || token.phase !== 'prepared' ||
        token.operationId !== command.operationId || !Number.isSafeInteger(token.revision) || token.revision < 1 ||
        typeof token.previewHash !== 'string' || !/^[a-f0-9]{64}$/.test(token.previewHash)) throw Error('FENCE_CONFLICT');
    return db.runTransaction(async transaction => {
      const ref = db.doc(`labPurgeStates/${createHash('sha256').update(targetPath).digest('hex')}`);
      const snapshot = await transaction.get(ref);
      const state = snapshot.exists ? snapshot.data() : null;
      if (!state || Object.keys(state).length !== 1 || !state.fence || Object.keys(state.fence).length !== 4)
        throw Error('PURGE_WRITE_BLOCKED');
      const fence = cancelPreparedPurge(state.fence, token);
      transaction.set(ref, {fence});
      return {status:'cancelled-before-effects', fence, destructiveAllowed:false};
    });
  };
  return Object.freeze(read);
}
