import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const expectedProject = 'appcodici-password';
const apply = process.argv.includes('--apply');
const confirmation = process.argv[process.argv.indexOf('--confirm-project') + 1];
if (confirmation !== expectedProject) {
  throw new Error(`Operazione annullata: specificare --confirm-project ${expectedProject}`);
}
if (apply && !process.argv.includes('--confirm-verified-share-backfill')) {
  throw new Error('Scrittura annullata: aggiungere --confirm-verified-share-backfill.');
}

const config = JSON.parse(await readFile(new URL('../.firebaserc', import.meta.url), 'utf8'));
if (config.projects?.default !== expectedProject) {
  throw new Error('Il progetto Firebase configurato non coincide con quello confermato.');
}

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const {applicationDefault, initializeApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore} = require('firebase-admin/firestore');
const app = initializeApp({credential: applicationDefault(), projectId: expectedProject}, 'share-email-backfill');
const db = getFirestore(app);
const auth = getAuth(app);
const normalizeEmail = value => String(value || '').trim().toLowerCase();

const report = {mode: apply ? 'apply' : 'dry-run', scanned: 0, eligible: 0, updated: 0,
  alreadyCurrent: 0, rejected: 0, rejectedReasons: {}};
const countRejection = reason => {
  report.rejected++;
  report.rejectedReasons[reason] = (report.rejectedReasons[reason] || 0) + 1;
};

async function accountRefs() {
  const refs = [];
  const users = await db.collection('users').listDocuments();
  for (const user of users) {
    const [privateAccounts, companies] = await Promise.all([
      user.collection('accounts').get(),
      user.collection('aziende').listDocuments()
    ]);
    refs.push(...privateAccounts.docs.map(item => item.ref));
    for (const company of companies) {
      const companyAccounts = await company.collection('accounts').get();
      refs.push(...companyAccounts.docs.map(item => item.ref));
    }
  }
  return refs;
}

const writes = [];
const canonicalMap = value => JSON.stringify(Object.fromEntries(
  Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right))
));
for (const ref of await accountRefs()) {
  const snapshot = await ref.get();
  const account = snapshot.data() || {};
  report.scanned++;
  const accepted = Object.values(account.sharedWith || {})
    .filter(entry => entry?.status === 'accepted' && typeof entry.uid === 'string' && entry.uid);
  const binding = {};
  let valid = true;
  for (const entry of accepted) {
    const expectedEmail = normalizeEmail(entry.email);
    if (!expectedEmail) {
      valid = false;
      countRejection('missing-entry-email');
      continue;
    }
    try {
      const user = await auth.getUser(entry.uid);
      if (user.emailVerified !== true || normalizeEmail(user.email) !== expectedEmail) {
        valid = false;
        countRejection('auth-email-not-verified-or-mismatch');
        continue;
      }
      binding[entry.uid] = expectedEmail;
    } catch (error) {
      valid = false;
      countRejection(error?.code === 'auth/user-not-found' ? 'auth-user-not-found' : 'auth-lookup-failed');
    }
  }
  if (!valid) continue;
  report.eligible++;
  if (canonicalMap(account.sharedWithEmailByUid) === canonicalMap(binding)) {
    report.alreadyCurrent++;
    continue;
  }
  writes.push({ref, binding});
}

if (apply) {
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = db.batch();
    for (const item of writes.slice(offset, offset + 400)) {
      batch.update(item.ref, {sharedWithEmailByUid: item.binding});
    }
    await batch.commit();
    report.updated += Math.min(400, writes.length - offset);
  }
}

report.pendingUpdates = apply ? 0 : writes.length;
console.log(JSON.stringify(report, null, 2));
