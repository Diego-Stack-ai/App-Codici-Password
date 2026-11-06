import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../Frontend/public/assets/js/modules/auth/imposta_nuova_password.js',import.meta.url),'utf8');
function fixture({denied=false,current=true,changeDuringUpdate=false}={}) {
    const calls=[];
    const auth={currentUser:{uid:'synthetic'}};
    const context=vm.createContext({auth,db:{},ACCOUNT_PASSWORD_POLICY_VERSION:1,
        authSessionFence:{readPermit:async()=>denied?null:{nonce:'synthetic'},isCurrent:async()=>current},
        updatePassword:async()=>{calls.push('update');if(changeDuringUpdate)auth.currentUser={uid:'other'};},
        doc:()=>({}),setDoc:async()=>calls.push('policy')});
    vm.runInContext(source.replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/^export /gm,''),context);
    return {calls,run:()=>vm.runInContext("updateAuthenticatedPassword('SYNTHETIC-NEW-PASSWORD')",context)};
}
for(const options of [{denied:true},{current:false}])test('denied/stale shared session cannot update the account password',async()=>{
    const f=fixture(options);await assert.rejects(f.run(),{code:'auth/session-changed'});assert.deepEqual(f.calls,[]);
});
test('verified current admission preserves the legitimate password update',async()=>{
    const f=fixture();await f.run();assert.deepEqual(f.calls,['update','policy']);
});
test('UID change during update prevents a subsequent policy write for the new user',async()=>{
    const f=fixture({changeDuringUpdate:true});await assert.rejects(f.run(),{code:'auth/session-changed'});assert.deepEqual(f.calls,['update']);
});
test('external reset still uses the out-of-band code independently of SDK session admission',()=>{
    const external=source.slice(source.indexOf('if (oobCode)'),source.indexOf('} else if (auth.currentUser)'));
    assert.match(external,/confirmPasswordReset\(auth, oobCode, newPassword\)/);
    assert.doesNotMatch(external,/authSessionFence|updateAuthenticatedPassword/);
});
