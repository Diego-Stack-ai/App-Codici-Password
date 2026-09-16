import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPdfModule} from './company-summary-loader.mjs';
const {mountCompanyPdfPanel} = await loadPdfModule('company-summary-panel');
const tick = () => new Promise(setImmediate);
function setup(overrides = {}) {
    let uid = 'owner', unlocked = true, callback, cleared = 0, disposed = 0, options, context;
    const events = new EventTarget(), root = {textContent: '', replaceChildren() {cleared++; this.textContent = '';}};
    const deps = {getUser: () => ({uid}), ensureUnlocked: async () => {}, isUnlocked: () => unlocked, events,
        subscribeAuth: fn => {callback = fn; return () => {};},
        readCompany: async () => ({id:'firm',ownerId:'owner',ragioneSociale:'enc:Società',emails:{pec:{email:'pec@example.invalid',password:'DO-NOT-EXPORT'}},note:'DO-NOT-EXPORT'}),
        decryptValue: async value => value.slice(4), isEncryptedValue: value => value.startsWith('enc:'),
        mountView: (root, ctx, opts) => {context=ctx; options=opts; return () => {disposed++;};},
        createActions: () => ({dispose() {disposed++;}}), ...overrides};
    const cleanup = mountCompanyPdfPanel(root, 'firm', deps);
    return {root, events, cleanup, get options(){return options;},get context(){return context;},get disposed(){return disposed;},get cleared(){return cleared;},
        lock(){unlocked=false; events.dispatchEvent(new Event('vault-state-changed'));}, change(){uid='other';callback({uid});}};
}
const selection={identity:true,fiscal:true,contactPerson:true,contacts:true,addresses:true};
test('production adapter scopes company reads and excludes passwords', async()=>{
    const f=setup();await tick();const value=await f.options.read(selection);
    assert.match(JSON.stringify(value),/Società/);assert.doesNotMatch(JSON.stringify(value),/DO-NOT-EXPORT/);f.cleanup();
});
for(const event of ['lock','change','pagehide','private-auth-blocked'])test('production PDF revokes on '+event,async()=>{
    const f=setup();await tick();if(event==='lock'||event==='change')f[event]();else f.events.dispatchEvent(new Event(event));
    assert.equal(f.context.signal.aborted,true);assert.equal(f.disposed,2);await assert.rejects(f.options.read(selection));
});
test('late unlock cannot mount after tab disposal',async()=>{
    let release;const f=setup({ensureUnlocked:()=>new Promise(resolve=>{release=resolve;})});f.cleanup();release();await tick();assert.equal(f.options,undefined);
});
test('aliased or foreign company record cannot be exported',async()=>{
    for(const record of [{id:'other',ownerId:'owner',ragioneSociale:'bad'},{id:'firm',ownerId:'other',ragioneSociale:'bad'}]){
        const f=setup({readCompany:async()=>record});await tick();await assert.rejects(f.options.read(selection),/MISMATCH/);f.cleanup();
    }
});
