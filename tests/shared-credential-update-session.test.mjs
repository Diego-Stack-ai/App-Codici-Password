import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = (await readFile(new URL('../Frontend/public/assets/js/modules/data/shared-vault-data-client.js', import.meta.url), 'utf8')).replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\r?\n/gm, '');
async function fixture() {
    const key = `sharedClient${Math.random().toString(36).slice(2)}`;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const f = {auth: {currentUser: {uid: 'owner'}}, calls: [], release};
    f.encrypt = async value => { await gate; return `cipher:${value}`; };
    globalThis[key] = f;
    const prefix = `const {auth, encrypt, calls} = globalThis['${key}'];
const functions = {}, navigator = {onLine:true};
const httpsCallable = () => async command => { calls.push(command); return {data:{status:'applied'}}; };
const ensureVaultKeyMaterial = async () => 'fixture-key';
const prepareSharedVaultData = async (data, encode) => ({value:await encode(data.value)});
const createSharedVaultIdentifiers = id => ({sharedDataId:id});
const createSharedVaultLinkIdentifiers = () => ({});\n`;
    f.client = await import(`data:text/javascript;base64,${Buffer.from(prefix + source).toString('base64')}`);
    delete globalThis[key];
    return f;
}
test('shared update preserves identity across encryption before sending', async () => {
    const f = await fixture();
    const saving = f.client.updateSharedCredential('shared', 4, {value:'synthetic'});
    f.release();
    assert.equal((await saving).status, 'applied');
    assert.deepEqual(f.calls, [{sharedDataId:'shared', action:'update', expectedRevision:4, data:{value:'cipher:synthetic'}}]);
});
test('shared update never sends after logout or UID change during encryption', async () => {
    for (const user of [null, {uid:'other'}]) {
        const f = await fixture();
        const saving = f.client.updateSharedCredential('shared', 4, {value:'synthetic'});
        f.auth.currentUser = user;
        f.release();
        await assert.rejects(saving, /Sessione cambiata/);
        assert.equal(f.calls.length, 0);
    }
});


test('shared update never sends after form teardown with the same UID',async()=>{
 const f=await fixture();let active=true;
 const saving=f.client.updateSharedCredential('shared',4,{value:'synthetic'},{isActive:()=>active});
 active=false;f.release();await assert.rejects(saving,/Sessione cambiata/);assert.equal(f.calls.length,0);
});


test('shared creation keeps the initiating session through encryption', async () => {
    for (const change of ['none', 'logout', 'uid', 'view']) {
        const f = await fixture();
        let active = true;
        const saving = f.client.createSharedCredential({value:'synthetic'}, 'new', {isActive:()=>active});
        if (change === 'logout') f.auth.currentUser = null;
        if (change === 'uid') f.auth.currentUser = {uid:'other'};
        if (change === 'view') active = false;
        f.release();
        if (change === 'none') {
            assert.equal((await saving).status, 'applied');
            assert.equal(f.calls.length, 1);
        } else {
            await assert.rejects(saving, /Sessione cambiata/);
            assert.equal(f.calls.length, 0);
        }
    }
});
