import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {summarizeLegacyEmailMetadata} from './lib/legacy-email-audit-model.mjs';

const expectedProject = 'appcodici-password';
const confirmation = process.argv[process.argv.indexOf('--confirm-project') + 1];
if (confirmation !== expectedProject) {
    throw new Error(`Audit annullato: specificare --confirm-project ${expectedProject}`);
}

const config = JSON.parse(await readFile(new URL('../.firebaserc', import.meta.url), 'utf8'));
if (config.projects?.default !== expectedProject) throw new Error('Il progetto Firebase configurato non coincide con quello confermato.');

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const {applicationDefault, initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
initializeApp({credential: applicationDefault(), projectId: expectedProject});
const db = getFirestore();

const userSnapshots = await db.collection('users').get();
const users = [];
for (const userSnapshot of userSnapshots.docs) {
    const [privateSnapshot, companySnapshot] = await Promise.all([
        userSnapshot.ref.collection('accounts').get(),
        userSnapshot.ref.collection('aziende').get()
    ]);
    const companies = [];
    for (const company of companySnapshot.docs) {
        const accounts = await company.ref.collection('accounts').get();
        companies.push({
            id: company.id,
            data: company.data(),
            accounts: accounts.docs.map(account => ({id: account.id, ...account.data()}))
        });
    }
    users.push({
        profile: userSnapshot.data(),
        privateAccounts: privateSnapshot.docs.map(account => ({id: account.id, ...account.data()})),
        companies
    });
}

console.log(JSON.stringify(summarizeLegacyEmailMetadata(users), null, 2));
