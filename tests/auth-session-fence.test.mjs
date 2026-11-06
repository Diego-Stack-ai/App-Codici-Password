import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../Frontend/public/assets/js/auth-session-fence.js', import.meta.url), 'utf8');
const {createAuthSessionFence} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const user = {uid:'synthetic', emailVerified:true};
function fixture() {
    let state = {revision:0, nonce:'initial', denied:false}, serial=0, tail=Promise.resolve();
    const pending = new Set();
    const transact = change => {
        const result = tail.then(() => {const next=change({...state}); state=next; return {...state};});
        tail = result.catch(() => {});
        return result;
    };
    const tab = () => {
        const invalidations=[];
        return {fence:createAuthSessionFence({transact, nonce:()=>String(++serial), invalidate:phase=>invalidations.push(phase),
            pending:()=>[...pending], markPending:key=>pending.add(key), clearPending:keys=>keys.forEach(k=>pending.delete(k))}), invalidations};
    };
    return {tab, state:()=>state};
}
test('failed SDK logout cannot admit an existing or fresh tab after durable deny', async () => {
    const f=fixture(), a=f.tab(), b=f.tab();
    const old=await b.fence.readPermit();
    assert.ok(old);
    await a.fence.deny();
    assert.equal(await b.fence.isCurrent(old),false);
    assert.equal(await f.tab().fence.readPermit(),null);
    assert.ok(a.invalidations.includes('pending'));
});
test('explicit verified login after logout authorizes only the captured generation', async () => {
    const f=fixture(), a=f.tab();
    await a.fence.deny();
    const permit=await a.fence.beginExplicitLogin();
    await a.fence.completeExplicitLogin(permit,user);
    assert.ok(await f.tab().fence.readPermit());
});
test('late login and TOTP cannot undo a later logout', async () => {
    const f=fixture(), a=f.tab(), b=f.tab();
    const permit=await a.fence.beginExplicitLogin();
    await b.fence.deny();
    await assert.rejects(a.fence.completeExplicitLogin(permit,user),{code:'auth/session-changed'});
    assert.equal(await a.fence.readPermit(),null);
});
test('transaction serializes compare and commit against simultaneous logout', async () => {
    const f=fixture(), a=f.tab(), b=f.tab();
    const permit=await a.fence.beginExplicitLogin();
    const logout=b.fence.deny();
    const completion=a.fence.completeExplicitLogin(permit,user);
    await logout;
    await assert.rejects(completion);
    assert.equal(f.state().denied,true);
});
test('concurrent logout preserves both generations and rejects every old permit', async () => {
    const f=fixture(), a=f.tab(), b=f.tab();
    const permit=await a.fence.readPermit();
    await Promise.all([a.fence.deny(),b.fence.deny()]);
    assert.equal(f.state().revision,2);
    assert.equal(await a.fence.isCurrent(permit),false);
});
test('unverified user and superseded local login cannot clear a denial', async () => {
    const f=fixture(), a=f.tab();
    await a.fence.deny();
    const first=await a.fence.beginExplicitLogin();
    const second=await a.fence.beginExplicitLogin();
    await assert.rejects(a.fence.completeExplicitLogin(first,user));
    await assert.rejects(a.fence.completeExplicitLogin(second,{...user,emailVerified:false}));
    assert.equal(await a.fence.readPermit(),null);
});
test('unavailable authority fails closed, even without notifications', async () => {
    const invalidations=[];
    const fence=createAuthSessionFence({transact:async()=>{throw new Error('unavailable');},invalidate:p=>invalidations.push(p)});
    await assert.rejects(fence.readPermit());
    assert.equal(fence.isLocallyAllowed(),false);
    assert.ok(invalidations.length);
});

test('a failed deny transaction leaves a durable tombstone blocking a fresh tab', async () => {
    const tombstones=new Set();
    const broken=createAuthSessionFence({transact:async()=>{throw new Error('broken');},markPending:id=>tombstones.add(id)});
    await assert.rejects(broken.deny());
    const fresh=createAuthSessionFence({transact:async fn=>fn({revision:0,nonce:'initial',denied:false}),pending:()=>[...tombstones]});
    assert.equal(await fresh.readPermit(),null);
});

test('quota failure in the fallback store cannot skip the authoritative logout', async () => {
    let state={revision:0,nonce:'initial',denied:false};
    const transact=async change=>(state=change({...state}));
    const a=createAuthSessionFence({transact,markPending(){throw new Error('QuotaExceededError');}});
    await a.deny();
    const fresh=createAuthSessionFence({transact});
    assert.equal(await fresh.readPermit(),null);
    assert.equal(state.denied,true);
});
