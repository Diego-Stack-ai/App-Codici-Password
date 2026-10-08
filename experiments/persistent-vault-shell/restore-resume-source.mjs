import {deriveBackupKey, decryptBackupEntry, parseBackupLine} from '../../Frontend/public/assets/js/modules/settings/backup-crypto.js';
import {chunkRestoreRecords, validateBackupFooter} from '../../Frontend/public/assets/js/modules/settings/backup-import-model.js';

// Only new plans are ordered. Persisted plans must retain their exact commands,
// hashes and chunk identities when resumed.
export function orderNewRestoreRecords(records) {
  const account = record => ['private-account','company-account'].includes(record.scope);
  return [...records.filter(account),...records.filter(record=>!account(record))];
}

// Keep selected embedded widgets with their selected parent. Otherwise an
// Account overwrite can be refused before the companion widget is reached.
// Oversized dependency groups are rejected before creating any plan.
export function chunkNewRestoreRecords(records) {
  const ordered=orderNewRestoreRecords(records),groups=[],parents=new Map();
  const profile=ordered.find(record=>record.scope==='profile');
  const profileGroup=profile?[profile,...ordered.filter(record=>record.scope==='deadline'&&record.data?.sourceRef?.type==='profileDocument')]:null;
  const key=(context,companyId,accountId)=>JSON.stringify([context,context==='company'?companyId:null,accountId]);
  for(const record of ordered) {
    if(['private-account','company-account'].includes(record.scope)) {
      const group=[record];groups.push(group);
      parents.set(key(record.scope==='company-account'?'company':'private',record.companyId,record.id),group);
    }
  }
  for(const company of ordered.filter(record=>record.scope==='company')) {
    const owned=groups.filter(group=>group[0]?.scope==='company-account'&&group[0].companyId===company.id);
    const group=owned[0]||[];
    if(!owned.length)groups.push(group);
    for(const extra of owned.slice(1)) {
      group.push(...extra);groups.splice(groups.indexOf(extra),1);
    }
    group.unshift(company);
    for(const account of group.filter(record=>record.scope==='company-account'))
      parents.set(key('company',account.companyId,account.id),group);
  }
  for(const record of ordered) {
    if(['company','private-account','company-account'].includes(record.scope))continue;
    if(profileGroup?.includes(record)) {
      if(record===profile)groups.push(profileGroup);
      continue;
    }
    const data=record.data;
    const parent=['private-account-widget','company-account-widget'].includes(record.scope)&&data?.kind==='embedded'
      ?parents.get(key(data.context,data.companyId,data.accountId)):null;
    if(parent)parent.push(record);else groups.push([record]);
  }
  const chunks=[];let current=[];
  for(const group of groups) {
    if(chunkRestoreRecords(group).length!==1)throw Error('RESUME_DEPENDENCY_GROUP_TOO_LARGE');
    if(current.length&&chunkRestoreRecords([...current,...group]).length>1){chunks.push(current);current=[];}
    current.push(...group);
  }
  if(current.length)chunks.push(current);
  return chunks;
}

// Deliberately bounded candidate reader, not the general 2 GiB production import.
// Attachments are opt-in and bounded; no persistent browser storage here.
export async function readResumeBackup(file, recoveryKey, uid, check, allowAttachments = false) {
  check();
  if (!Number.isSafeInteger(file?.size) || file.size <= 0 || file.size > 16 * 1024 * 1024 || typeof file.text !== 'function')
    throw Error('RESUME_BACKUP_SIZE_LIMIT_16_MIB');
  let text = await file.text(); check();
  if (new TextEncoder().encode(text).length !== file.size) throw Error('RESUME_BACKUP_READ_INVALID');
  const lines = text.split(/\r?\n/).filter(line => line.trim()); text = '';
  if (lines.length < 2 || lines.length > 10002) throw Error('RESUME_BACKUP_RECORD_LIMIT');
  const header = parseBackupLine(lines.shift());
  const key = await deriveBackupKey(header, recoveryKey, uid); check();
  const records = [], attachments = []; let previousDigest = '', footer = null, excludedSecuritySettings = 0;
  try {
  for (let sequence = 0; sequence < lines.length; sequence++) {
    check();
    if (footer) throw Error('BACKUP_TRAILING_DATA');
    const opened = await decryptBackupEntry({header, key, expectedSequence: sequence, previousDigest,
      envelope: parseBackupLine(lines[sequence])});
    lines[sequence] = ''; check(); previousDigest = opened.digest;
    if (opened.entry.kind === 'footer') footer = opened.entry;
    else if (opened.entry.kind === 'record' && opened.entry.scope === 'settings' &&
        typeof opened.entry.id === 'string' && opened.entry.id.trim() === 'security') {
      excludedSecuritySettings++;
    } else if (opened.entry.kind === 'attachment' && allowAttachments) {
      const {storagePath, content} = opened.entry;
      if (attachments.length >= 100 || typeof storagePath !== 'string' || !storagePath.startsWith(`users/${uid}/`) ||
          storagePath.includes('..') || attachments.some(item => item.storagePath === storagePath) ||
          typeof content !== 'string' || !content.length || content.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content))
        throw Error('RESUME_ATTACHMENT_INVALID');
      const bytes = Uint8Array.from(atob(content), character => character.charCodeAt(0));
      attachments.push({storagePath, bytes});
      if (!bytes.length || bytes.length > 25 * 1024 * 1024 + 1024) throw Error('RESUME_ATTACHMENT_INVALID');
    } else {
      const supportedSetting=opened.entry.scope==='settings'&&['profileLabels','deadlineConfig','deadlineConfigDocuments','generalConfig'].includes(opened.entry.id);
      if (opened.entry.kind !== 'record' || (!supportedSetting&&!['profile', 'company', 'contact', 'deadline', 'private-account', 'company-account', 'private-account-attachment', 'company-account-attachment', 'private-account-widget', 'company-account-widget'].includes(opened.entry.scope)))
        throw Error('RESUME_SCOPE_NOT_CONNECTED');
      chunkRestoreRecords([opened.entry]); records.push(opened.entry);
    }
  }
  validateBackupFooter(footer, {entries: records.length + excludedSecuritySettings + attachments.length,
    records: records.length + excludedSecuritySettings, attachments: attachments.length});
  if (!records.length) throw Error('BACKUP_EMPTY');
  check(); return {backupId: header.backupId, records, ...(excludedSecuritySettings ? {excludedSecuritySettings} : {}),
    ...(allowAttachments ? {attachments} : {})};
  } catch (error) {for (const item of attachments) item.bytes.fill(0); throw error;}
}

export function createRestoreResumeSource({context, getUser, isOnline, submit, attachmentPreparer}) {
  const uid = context.user.uid;
  let closed = false, busy = false, prepared = null, candidate = null, creationAttempted = false;
  const check = () => {
    if (closed) throw Error('VIEW_DISPOSED');
    if (context.signal.aborted || getUser()?.uid !== uid) {dispose(); throw Error('VIEW_DISPOSED');}
    try {context.assertUnlocked();} catch (error) {dispose(); throw error;}
    if (!isOnline()) throw Error('RESUME_ONLINE_REQUIRED');
  };
  const clearAttachments = () => {for (const item of candidate?.attachments || []) item.bytes.fill(0);};
  const dispose = () => {if (closed) return; closed = true; prepared = null; clearAttachments(); candidate = null;
    context.signal.removeEventListener('abort', dispose); attachmentPreparer?.dispose();};
  context.signal.addEventListener('abort', dispose, {once: true});
  const api = {dispose,
    async cleanupExpired(after = null) {
      check(); if (busy) throw Error('RESUME_BUSY');
      busy = true;
      try {
        const result = await submit({expectedOwnerUid: uid, action: 'cleanupExpired', after}); check();
        if (['scanned', 'removed', 'retained', 'absent', 'rejected'].some(key => !Number.isInteger(result?.[key]) || result[key] < 0) ||
            result.scanned > 50 || result.removed + result.retained + result.absent + result.rejected !== result.scanned ||
            (result.next !== null && !/^[a-f0-9]{64}$/.test(result.next))) throw Error('RESUME_RESPONSE_INVALID');
        return result;
      } finally {busy = false;}
    },
    async previewNew({file, recoveryKey}) {
      check(); if (busy || creationAttempted) throw Error('RESUME_BUSY_OR_CREATION_UNCERTAIN');
      busy = true; clearAttachments(); candidate = null; prepared = null;
      let original;
      try {
        original = await readResumeBackup(file, recoveryKey, uid, check, !!attachmentPreparer);
        const chunks = chunkNewRestoreRecords(original.records);
        const inputs = chunks.map((records, index) => ({expectedOwnerUid: uid, operationId: crypto.randomUUID(), backupId: original.backupId,
          chunkIndex: index, chunkCount: chunks.length, mode: 'preview', records}));
        const report = await submit({expectedOwnerUid: uid, action: 'preview', inputs: structuredClone(inputs)}); check();
        if (!Array.isArray(report?.chunks) || report.chunks.length !== inputs.length) throw Error('RESUME_RESPONSE_INVALID');
        let existing = 0;
        const missingByChunk = [];
        for (const [index, chunk] of report.chunks.entries()) {
          if (chunk.previewVersion !== 1 || !Array.isArray(chunk.entries) || chunk.entries.length !== inputs[index].records.length ||
            chunk.entries.some((entry, at) => entry.index !== at || !['missing', 'changed', 'unchanged'].includes(entry.status))) throw Error('RESUME_RESPONSE_INVALID');
          existing += chunk.entries.filter(entry => entry.status !== 'missing').length;
          missingByChunk.push(chunk.entries.filter(entry => entry.status === 'missing').map(entry => entry.index));
          if (chunk.entries.some(entry => entry.status === 'missing' &&
              (entry.expectedVersion?.exists !== false || Object.keys(entry.expectedVersion).length !== 1))) throw Error('RESUME_RESPONSE_INVALID');
          if (chunk.entries.some(entry => entry.status !== 'missing' &&
              (entry.expectedVersion?.exists !== true || Object.keys(entry.expectedVersion).sort().join(',') !== 'exists,updateTime' ||
               !entry.expectedVersion.updateTime || Object.keys(entry.expectedVersion.updateTime).sort().join(',') !== 'nanoseconds,seconds' ||
               !Number.isSafeInteger(entry.expectedVersion.updateTime.seconds) || entry.expectedVersion.updateTime.seconds < -62135596800 ||
               entry.expectedVersion.updateTime.seconds > 253402300799 || !Number.isInteger(entry.expectedVersion.updateTime.nanoseconds) ||
               entry.expectedVersion.updateTime.nanoseconds < 0 || entry.expectedVersion.updateTime.nanoseconds > 999999999))) throw Error('RESUME_RESPONSE_INVALID');
          inputs[index] = {...inputs[index], mode: 'apply', confirmation: 'RESTORE_VALIDATED',
            records: inputs[index].records.map((record, at) => ({...record, expectedVersion: structuredClone(chunk.entries[at].expectedVersion)}))};
        }
        const restoreOperationId = crypto.randomUUID();
        // Require every storagePath to have exactly one original attachment;
        // no external/legacy fallback and no unused attachment uploads.
        const paths = value => {
          const found = new Set(), pending = [value];
          while (pending.length) {
            const current = pending.pop();
            if (current && typeof current === 'object') for (const [key, child] of Object.entries(current)) {
              if (key === 'storagePath') found.add(child); else if (child && typeof child === 'object') pending.push(child);
            }
          }
          return [...found];
        };
        const chunkPaths = inputs.map(input => paths(input.records.map(record => record.data)));
        const attachments = original.attachments || [], allPaths = new Set(chunkPaths.flat());
        if (allPaths.size !== attachments.length || attachments.some(item => !allPaths.has(item.storagePath)) ||
            chunkPaths.some(list => list.some(path => !attachments.some(item => item.storagePath === path)))) throw Error('RESUME_ATTACHMENT_MAPPING');
        candidate = {inputs, stageCommands: inputs.map(() => ({restoreOperationId, stageIds: []})), attachments, chunkPaths,
          missingByChunk, selectionRequired: existing > 0};
        const excludedSecuritySettings = original.excludedSecuritySettings;
        original = null;
        return {records: inputs.reduce((sum, input) => sum + input.records.length, 0), chunks: inputs.length,
          ...(excludedSecuritySettings ? {excludedSecuritySettings} : {}),
          ...(attachments.length ? {attachments: attachments.length} : {}), ...(existing ? {existing,
            choices: inputs.flatMap((input, chunk) => input.records.map((record, index) => ({key:`${chunk}:${index}`,
              scope:record.scope,id:record.id,status:report.chunks[chunk].entries[index].status}))) } : {})};
      } finally {for (const item of original?.attachments || []) item.bytes.fill(0); busy = false;}
    },
    selectRecords(keys, confirmation) {
      check(); if (busy || creationAttempted || !candidate?.selectionRequired) throw Error('RESUME_SELECTION_UNAVAILABLE');
      if (confirmation !== 'RESTORE_SELECTED_OVERWRITE' || !Array.isArray(keys) || !keys.length || new Set(keys).size !== keys.length)
        throw Error('RESUME_SELECTION_INVALID');
      const available = new Set(candidate.inputs.flatMap((input, chunk) => input.records.map((_, index) => `${chunk}:${index}`)));
      if (keys.some(key => !available.has(key))) throw Error('RESUME_SELECTION_INVALID');
      const selected = new Set(keys);
      candidate.missingByChunk = candidate.inputs.map((input, chunk) => input.records.flatMap((_,index) => selected.has(`${chunk}:${index}`) ? [index] : []));
      candidate.inputs = candidate.inputs.map((input, chunk) => {
        const overwrite = candidate.missingByChunk[chunk].some(index => input.records[index].expectedVersion.exists);
        return {...input, overwriteExisting:overwrite, confirmation:overwrite?'RESTORE_SELECTED_OVERWRITE':'RESTORE_VALIDATED'};
      });
      return api.selectMissingOnly();
    },
    selectMissingOnly() {
      check(); if (busy || creationAttempted || !candidate?.selectionRequired) throw Error('RESUME_SELECTION_UNAVAILABLE');
      if (candidate.missingByChunk.every(list => !list.length)) throw Error('RESUME_SELECTION_EMPTY');
      const selected = [];
      for (const [index, input] of candidate.inputs.entries()) {
        const records = candidate.missingByChunk[index].map(at => input.records[at]);
        if (records.length) selected.push({...input, records});
      }
      const paths = value => {
        const found = new Set(), pending = [value];
        while (pending.length) {
          const current = pending.pop();
          if (current && typeof current === 'object') for (const [key, child] of Object.entries(current)) {
            if (key === 'storagePath') found.add(child); else if (child && typeof child === 'object') pending.push(child);
          }
        }
        return [...found];
      };
      candidate.inputs = selected.map((input, index) => ({...input, chunkIndex: index, chunkCount: selected.length}));
      candidate.chunkPaths = selected.map(input => paths(input.records.map(record => record.data)));
      const needed = new Set(candidate.chunkPaths.flat());
      candidate.attachments = candidate.attachments.filter(item => {
        if (needed.has(item.storagePath)) return true;
        item.bytes.fill(0); return false;
      });
      const restoreOperationId = candidate.stageCommands[0].restoreOperationId;
      candidate.stageCommands = selected.map(() => ({restoreOperationId, stageIds: []}));
      candidate.selectionRequired = false;
      return {records: selected.reduce((sum, input) => sum + input.records.length, 0), chunks: selected.length, attachments: candidate.attachments.length};
    },
    async stageAttachments() {
      check(); if (busy || creationAttempted || !candidate || !attachmentPreparer) throw Error('RESUME_STAGING_UNAVAILABLE');
      if (candidate.selectionRequired) throw Error('RESUME_SELECTION_REQUIRED');
      busy = true;
      try {
        for (const item of candidate.attachments) {
          if (!item.stageId) {
            const result = await attachmentPreparer.prepare({operationId: candidate.stageCommands[0].restoreOperationId,
              storagePath: item.storagePath, bytes: item.bytes}); check();
            if (!/^[a-f0-9]{64}$/.test(result?.stageId || '')) throw Error('RESUME_RESPONSE_INVALID');
            item.stageId = result.stageId;
            item.bytes.fill(0);
          }
        }
        candidate.stageCommands.forEach((command, index) => {
          command.stageIds = candidate.chunkPaths[index].map(path => candidate.attachments.find(item => item.storagePath === path).stageId);
        });
        clearAttachments(); return {staged: candidate.attachments.length};
      } finally {busy = false;}
    },
    async create() {
      check(); if (busy || creationAttempted || !candidate) throw Error('RESUME_CREATION_UNAVAILABLE');
      if (candidate.selectionRequired) throw Error('RESUME_SELECTION_REQUIRED');
      if (candidate.attachments.some(item => !item.stageId)) throw Error('RESUME_STAGING_REQUIRED');
      busy = true; creationAttempted = true;
      try {
        const commands = {inputs: candidate.inputs, stageCommands: candidate.stageCommands};
        const result = await submit({expectedOwnerUid: uid, action: 'create', ...structuredClone(commands)}); check();
        if (typeof result?.planId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(result.planId) || !Number.isSafeInteger(result.expiresAtMs))
          throw Error('RESUME_RESPONSE_INVALID');
        prepared = {expectedOwnerUid: uid, planId: result.planId, ...commands}; clearAttachments(); candidate = null;
        return {planId: result.planId, expiresAtMs: result.expiresAtMs};
      } finally {busy = false;}
    },
    async recoverCreation() {
      check(); if (busy || !creationAttempted || !candidate || prepared) throw Error('RESUME_CREATION_UNAVAILABLE');
      busy = true;
      try {
        const commands = {inputs: candidate.inputs, stageCommands: candidate.stageCommands};
        const result = await submit({expectedOwnerUid: uid, action: 'recoverCreation', ...structuredClone(commands)}); check();
        if (result?.status === 'unconfirmed') return {status: 'unconfirmed'};
        if (result?.status !== 'found' || typeof result.planId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(result.planId) ||
          !Number.isSafeInteger(result.expiresAtMs)) throw Error('RESUME_RESPONSE_INVALID');
        prepared = {expectedOwnerUid: uid, planId: result.planId, ...commands}; clearAttachments(); candidate = null;
        return {status: 'found', planId: result.planId, expiresAtMs: result.expiresAtMs};
      } finally {busy = false;}
    },
    async prepare({file, recoveryKey, planId}) {
      check(); if (busy) throw Error('RESUME_BUSY');
      if (typeof planId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(planId)) throw Error('RESUME_PLAN_INVALID');
      busy = true; prepared = null; clearAttachments(); candidate = null;
      let original;
      try {
        original = await readResumeBackup(file, recoveryKey, uid, check, !!attachmentPreparer); check();
        for (const item of original.attachments || []) item.bytes.fill(0);
        delete original.attachments;
        const result = await submit({expectedOwnerUid: uid, action: 'reconstruct', planId, ...original}); check();
        if (!Array.isArray(result?.inputs) || !result.inputs.length || !Array.isArray(result.stageCommands) ||
          result.stageCommands.length !== result.inputs.length || !Number.isSafeInteger(result.expiresAtMs) ||
          result.inputs.some(input => input.expectedOwnerUid !== uid || input.backupId !== original.backupId))
          throw Error('RESUME_RESPONSE_INVALID');
        const request = {expectedOwnerUid: uid, planId, inputs: result.inputs, stageCommands: result.stageCommands};
        const report = await submit({...structuredClone(request), action: 'inspect'}); check();
        if (!Array.isArray(report?.chunks) || report.chunks.length !== request.inputs.length ||
          report.chunks.some((chunk, index) => chunk.operationId !== request.inputs[index].operationId ||
            !['applied', 'unconfirmed'].includes(chunk.status))) throw Error('RESUME_RESPONSE_INVALID');
        prepared = structuredClone(request);
        return {expiresAtMs: result.expiresAtMs, applied: report.chunks.filter(chunk => chunk.status === 'applied').length,
          total: report.chunks.length};
      } finally {for (const item of original?.attachments || []) item.bytes.fill(0); busy = false;}
    },
    async resume() {
      check(); if (busy) throw Error('RESUME_BUSY');
      if (!prepared) throw Error('RESUME_BACKUP_REQUIRED');
      busy = true;
      try {const result = await submit({...structuredClone(prepared), action: 'resume'}); check(); return result;}
      finally {busy = false;}
    }
  };
  return Object.freeze(api);
}
