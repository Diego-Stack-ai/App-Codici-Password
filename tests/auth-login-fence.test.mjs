import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../Frontend/public/assets/js/',import.meta.url);
const source=await readFile(new URL('auth.js',root),'utf8');
const fenceSource=await readFile(new URL('auth-session-fence.js',root),'utf8');
const {createAuthSessionFence}=await import(`data:text/javascript;base64,${Buffer.from(fenceSource).toString('base64')}`);
function fixture({verified=true}={}) {
    let state={revision:0,nonce:'initial',denied:false},serial=0;
    const transact=async change=>(state=change({...state}));
    const fence=createAuthSessionFence({transact,nonce:()=>String(++serial)});
    const other=createAuthSessionFence({transact,nonce:()=>String(++serial)});
    const user={uid:'synthetic',email:'synthetic@example.invalid',emailVerified:verified,reload:async()=>{},getIdToken:async()=>{}};
    const session=new Map();
    const context=vm.createContext({auth:{currentUser:user},authSessionFence:fence,
        LOG(){},showToast(){},logError(){},db:{},doc:()=>({}),
        getDoc:async()=>({exists:()=>true,data:()=>({})}),
        localStorage:{getItem:()=>null,removeItem(){}},
        sessionStorage:{getItem:key=>session.get(key)??null,removeItem:key=>session.delete(key)},
        setPersistence:async()=>{},browserLocalPersistence:{},browserSessionPersistence:{},
        signInWithEmailAndPassword:async()=>({user}),
        TotpMultiFactorGenerator:{FACTOR_ID:'totp',assertionForSignIn:()=>({})},
        window:{location:{pathname:'/login.html',search:''}}});
    vm.runInContext(source.replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/^export\s*\{[^}]*\};?/gm,'').replace(/^export /gm,''),context);
    return {context,user,fence,other,run:code=>vm.runInContext(code,context)};
}
test('real login finalizer preserves a legitimate explicit login after durable logout',async()=>{
    const f=fixture();await f.other.deny();
    const result=await f.run("login('synthetic@example.invalid','SYNTHETIC-PASSWORD')");
    assert.equal(result.user.uid,'synthetic');assert.ok(await f.fence.readPermit());
});
test('real login finalizer cannot clear a logout committed while sign-in was pending',async()=>{
    const f=fixture();let release,entered;
    const ready=new Promise(resolve=>{entered=resolve;});
    f.context.signInWithEmailAndPassword=()=>{entered();return new Promise(resolve=>{release=resolve;});};
    const pending=f.run("login('synthetic@example.invalid','SYNTHETIC-PASSWORD')");
    const rejected=assert.rejects(pending,{code:'auth/session-changed'});
    await ready;await f.other.deny();release({user:f.user});await rejected;
    assert.equal(await f.fence.readPermit(),null);
});
test('real TOTP completion retains its original permit across a subsequent login',async()=>{
    const f=fixture();let release,entered;
    const ready=new Promise(resolve=>{entered=resolve;});
    f.context.getMultiFactorResolver=()=>({hints:[{uid:'totp-synthetic',factorId:'totp'}],resolveSignIn(){entered();return new Promise(resolve=>{release=resolve;});}});
    f.context.signInWithEmailAndPassword=async()=>{throw {code:'auth/multi-factor-auth-required'};};
    assert.equal((await f.run("login('synthetic@example.invalid','SYNTHETIC-PASSWORD')")).mfaRequired,true);
    const pending=f.run("completeTotpLogin('000000')");const rejected=assert.rejects(pending,{code:'auth/session-changed'});
    await ready;
    f.context.signInWithEmailAndPassword=async()=>({user:f.user});
    await f.run("login('synthetic@example.invalid','SYNTHETIC-PASSWORD')");
    release({user:f.user});await rejected;
});
test('email verification cannot turn an old explicit attempt into admission after logout',async()=>{
    const f=fixture({verified:false});
    assert.equal((await f.run("login('synthetic@example.invalid','SYNTHETIC-PASSWORD')")).emailVerificationRequired,true);
    f.user.emailVerified=true;await f.other.deny();
    await assert.rejects(f.run('refreshEmailVerification()'),{code:'auth/session-changed'});
    assert.equal(await f.fence.readPermit(),null);
});
