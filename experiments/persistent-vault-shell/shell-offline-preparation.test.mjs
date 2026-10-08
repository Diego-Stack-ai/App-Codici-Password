import test from 'node:test';
import assert from 'node:assert/strict';
import {createShellOfflinePreparation} from './shell-offline-preparation.mjs';
function fixture(prepare=async()=>({complete:true})) {
    let uid='a',online=true;const states=[],events=new EventTarget();
    const service=createShellOfflinePreparation({getUser:()=>uid?{uid}:null,prepare,onState:state=>states.push(state),events,isOnline:()=>online});
    return {service,states,events,user:value=>{uid=value;},network:value=>{online=value;}};
}
test('preparation runs once concurrently and marks success only on complete result',async()=>{
    let release,calls=0;const f=fixture(user=>{calls++;assert.equal(user.uid,'a');return new Promise(resolve=>{release=resolve;});});
    const first=f.service.refresh();assert.equal(f.service.refresh(),first);await Promise.resolve();
    release({complete:true});await first;assert.equal(calls,1);assert.deepEqual(f.states,['preparing','ready']);f.service.dispose();
});
for(const boundary of ['user','clear','dispose'])test(`late readiness cannot escape ${boundary}`,async()=>{
    let release;const f=fixture(()=>new Promise(resolve=>{release=resolve;})),pending=f.service.refresh();await Promise.resolve();
    if(boundary==='user')f.user('b');else f.service[boundary]();release({complete:true});assert.equal(await pending,null);assert.ok(!f.states.includes('ready'));f.service.dispose();
});
test('offline never starts a server request; reconnect automatically retries',async()=>{
    let calls=0;const f=fixture(async()=>{calls++;return{complete:true};});f.network(false);await f.service.refresh();assert.equal(calls,0);
    f.network(true);f.events.dispatchEvent(new Event('online'));await f.service.refresh();assert.equal(calls,1);assert.equal(f.states.at(-1),'ready');f.service.dispose();
    f.events.dispatchEvent(new Event('online'));await Promise.resolve();assert.equal(calls,1);
});
test('incomplete and rejected preparations never certify cache and do not leak provider errors',async()=>{
    for(const prepare of [async()=>({complete:false}),async()=>{throw Error('sensitive-provider');}]){
        const f=fixture(prepare);await f.service.refresh();assert.deepEqual(f.states,['preparing','incomplete']);f.service.dispose();
    }
});
test('logout before the first await prevents starting preparation',async()=>{
    let calls=0;const f=fixture(async()=>{calls++;});const pending=f.service.refresh();f.user(null);f.service.clear();await pending;assert.equal(calls,0);f.service.dispose();
});
test('network loss invalidates a pending readiness result',async()=>{
    let release;const f=fixture(()=>new Promise(resolve=>{release=resolve;})),pending=f.service.refresh();await Promise.resolve();
    f.network(false);f.events.dispatchEvent(new Event('offline'));release({complete:true});await pending;
    assert.equal(f.states.at(-1),'offline');assert.ok(!f.states.includes('ready'));f.service.dispose();
});

test('network events cannot start preparation before unlock or restart it after clear', async () => {
    let calls = 0; const f = fixture(async () => {calls++; return {complete: true};});
    f.events.dispatchEvent(new Event('online')); await Promise.resolve();
    assert.equal(calls, 0, 'identity alone is not an active preparation session');
    await f.service.refresh(); assert.equal(calls, 1);
    f.service.clear();
    f.events.dispatchEvent(new Event('offline')); f.events.dispatchEvent(new Event('online'));
    await Promise.resolve();
    assert.equal(calls, 1); assert.equal(f.states.at(-1), 'idle');
    await f.service.refresh(); assert.equal(calls, 2, 'explicit new unlock can resume preparation');
    f.service.dispose();
});

test('reconnect cannot transfer an old preparation permission to a different UID', async () => {
    const owners = []; const f = fixture(async user => {owners.push(user.uid); return {complete: true};});
    await f.service.refresh(); f.user('b');
    f.events.dispatchEvent(new Event('online')); await Promise.resolve();
    assert.deepEqual(owners, ['a']);
    await f.service.refresh(); assert.deepEqual(owners, ['a', 'b']);
    f.service.dispose();
});
