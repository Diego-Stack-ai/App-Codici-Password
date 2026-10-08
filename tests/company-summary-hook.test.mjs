import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const raw = await readFile(new URL('../Frontend/public/assets/js/modules/azienda/company-profile-ui.js', import.meta.url), 'utf8');
const start = raw.indexOf('let pdfCleanup'), end = raw.indexOf('function styleCompanySections', start);
assert.ok(start > 0 && end > start);
const source = raw.slice(start, end).replace('export function', 'function')
  .replace("import('./pdf/company-summary-entry.js')", 'loadPdf()');
const tick = () => new Promise(setImmediate);
function fixture() {
  const node = (dataset = {}) => ({dataset, isConnected: true, textContent: '',
    classList: {toggle() {}, add() {}}, setAttribute() {}, replaceChildren() {this.textContent = '';}});
  const tabs = ['overview', 'pdf-summary'].map(companyTab => node({companyTab}));
  const panels = ['overview', 'pdf-summary'].map(companyPanel => node({companyPanel}));
  const root = panels[1], events = new EventTarget(), auth = {currentUser: {uid: 'A'}};
  events.location = {search: ''};
  let observer, release, reject, mounts = 0, cleanups = 0;
  const context = vm.createContext({auth, window: events, URLSearchParams, TextEncoder,
    document: {querySelectorAll: selector => selector === '[data-company-tab]' ? tabs : panels,
      getElementById: id => id === 'company-pdf-summary' ? root : node()},
    sessionStorage: {getItem() {return null;}, setItem() {}},
    onAuthStateChanged: (_auth, callback) => {observer = callback;},
    loadPdf: () => new Promise((yes, no) => {release = yes; reject = no;}),
    styleCompanySections() {}, companyProfileContacts: () => ({emails: []}),
    createElement: () => node(), setChildren() {}, text: () => node(), button: () => node(),
    renderCompanyContacts() {}, renderQRCode() {},
  });
  vm.runInContext(source, context);
  vm.runInContext("initCompanyProfile({}, 'firm', {buildVCard: () => '', reload() {}})", context);
  return {root, events, tabs, auth, get mounts() {return mounts;}, get cleanups() {return cleanups;},
    change(uid) {auth.currentUser = {uid}; observer(auth.currentUser);},
    resolve() {release({mountCompanySummary: (target, id) => {
      assert.equal(target, root); assert.equal(id, 'firm'); mounts++; return () => {cleanups++;};
    }});}, fail() {reject(new Error('synthetic'));}};
}
test('actual profile hook loads only when selected and cleans up on leaving', async () => {
  const f = fixture(); assert.equal(f.mounts, 0);
  f.tabs[1].onclick(); f.resolve(); await tick(); assert.equal(f.mounts, 1);
  f.tabs[0].onclick(); assert.equal(f.cleanups, 1);
});
for (const boundary of ['tab', 'lock', 'auth-roundtrip', 'pagehide', 'detached']) {
  test(`actual profile hook rejects lazy import after ${boundary}`, async () => {
    const f = fixture(); f.tabs[1].onclick();
    if (boundary === 'tab') f.tabs[0].onclick();
    if (boundary === 'lock') f.events.dispatchEvent(new Event('vault-session-locked'));
    if (boundary === 'pagehide') f.events.dispatchEvent(new Event('pagehide'));
    if (boundary === 'auth-roundtrip') {f.change('B'); f.change('A');}
    if (boundary === 'detached') f.root.isConnected = false;
    f.resolve(); await tick(); assert.equal(f.mounts, 0);
  });
}
test('import failure is shown only while the same PDF tab is active', async () => {
  const current = fixture(); current.tabs[1].onclick(); current.fail(); await tick();
  assert.match(current.root.textContent, /non disponibile/);
  const stale = fixture(); stale.tabs[1].onclick(); stale.tabs[0].onclick(); stale.fail(); await tick();
  assert.equal(stale.root.textContent, '');
});
