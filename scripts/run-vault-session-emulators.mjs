import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync, copyFileSync} from 'node:fs';
const root = resolve(import.meta.dirname, '..');
const laboratory = resolve(root, 'experiments/persistent-vault-shell');
const cli = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const browser = process.argv.includes('--browser');
const mutation = process.argv.includes('--mutation');
const qrSelection = process.argv.includes('--qr-selection');
const profileText = process.argv.includes('--profile-text');
const profileContacts = process.argv.includes('--profile-contacts');
const profileCompanyContacts = process.argv.includes('--profile-company-contacts');
const profileAddresses = process.argv.includes('--profile-addresses');
const profileUtilities = process.argv.includes('--profile-utilities');
const addressesBrowser = process.argv.includes('--profile-addresses-browser');
const profileDocumentAttachments = process.argv.includes('--profile-document-attachments');
const profileDocumentAttachmentsStorage = process.argv.includes('--profile-document-attachments-storage');
const profileDocumentAttachmentsBrowser = process.argv.includes('--profile-document-attachments-browser');
const profileCompanyContactsBrowser = process.argv.includes('--profile-company-contacts-browser');
const profileLink = process.argv.includes('--profile-link');
const accountNote = process.argv.includes('--account-note');
const fencedBrowser = process.argv.includes('--fenced-browser');
const entryBrowser = process.argv.includes('--entry-browser');
const coldBrowser = process.argv.includes('--cold-browser');
const restartBrowser = process.argv.includes('--restart-browser');
const crashBrowser = process.argv.includes('--crash-browser');
if (process.argv.length > 3 || process.argv.slice(2).some(arg => !['--browser', '--account-note', '--profile-link', '--profile-text', '--profile-contacts', '--profile-company-contacts', '--profile-addresses', '--profile-utilities', '--profile-addresses-browser', '--profile-document-attachments', '--profile-document-attachments-storage', '--profile-document-attachments-browser', '--profile-company-contacts-browser', '--qr-selection', '--mutation', '--fenced-browser', '--entry-browser', '--cold-browser', '--restart-browser', '--crash-browser'].includes(arg))) throw new Error('INVALID_ARGUMENT');
mkdirSync(resolve(laboratory, 'dist/emulators'), {recursive: true});
copyFileSync(resolve(root, 'firestore.rules'), resolve(laboratory, 'dist/emulators/firestore.rules'));
copyFileSync(resolve(root, 'storage.rules'), resolve(laboratory, 'dist/emulators/storage.rules'));
// A demo project cannot fall through to real Firebase resources.
const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--project', 'demo-vault-shell',
    '--only', profileDocumentAttachmentsStorage ? 'auth,firestore,storage' : 'auth,firestore', '--config',
    profileDocumentAttachmentsStorage ? 'firebase.emulators-storage.json' : 'firebase.emulators.json',
    accountNote ? 'node --test firebase-account-note.test.mjs' : profileLink ? 'node --test firebase-profile-link.test.mjs' : profileText ? 'node --test firebase-profile-text.test.mjs' : addressesBrowser ? 'node emulator-browser.mjs --test-addresses' : profileUtilities ? 'node --test firebase-utilities.test.mjs' : profileAddresses ? 'node --test firebase-addresses.test.mjs' : profileCompanyContacts ? 'node --test firebase-company-contacts.test.mjs' : profileContacts ? 'node --test firebase-profile-contacts.test.mjs' : profileDocumentAttachmentsBrowser ? 'node emulator-browser.mjs --test-attachments' : profileCompanyContactsBrowser ? 'node emulator-browser.mjs --test-company-contacts' : profileDocumentAttachmentsStorage ? 'node --test firebase-profile-document-attachments-storage.test.mjs profile-document-attachment-rules.test.mjs' : profileDocumentAttachments ? 'node --test firebase-profile-document-attachments.test.mjs' : qrSelection ? 'node --test firebase-qr-selection.test.mjs' : crashBrowser ? 'node emulator-browser.mjs --test-crash' : restartBrowser ? 'node emulator-browser.mjs --test-restart' : coldBrowser ? 'node emulator-browser.mjs --test-cold' : entryBrowser ? 'node emulator-browser.mjs --test' : fencedBrowser ? 'node ../offline-sync/run-emulated-browsers.mjs' : browser ? 'node emulator-browser.mjs' : mutation ? 'node --test firebase-mutation.test.mjs firebase-backup.test.mjs firebase-deadline.test.mjs firebase-archive.test.mjs' : 'node --test firebase-session.test.mjs'],
    {cwd: laboratory, env: {...process.env, GCLOUD_PROJECT: 'demo-vault-shell', GOOGLE_CLOUD_PROJECT: 'demo-vault-shell',
        METADATA_SERVER_DETECTION: 'none'}, stdio: 'inherit', shell: false});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
