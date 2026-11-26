import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeadlineDeleteGuard} from '../Frontend/public/assets/js/modules/scadenze/deadline-delete-guard.mjs';

function fixture(child=true) {
 const state={uid:'owner',active:true,unlocked:true,generation:1,suspension:0,local:true,remote:true,fresh:0};
 const auth={get currentUser(){return state.uid?{uid:state.uid}:null;}};
 const transport={isChild:()=>child,isUnlocked:()=>state.unlocked,generation:()=>state.generation,
  suspensionGeneration:()=>state.suspension,request(){state.fresh++;throw Error('Unexpected authentication');}};
 const permit={id:'synthetic-permit'},fence={readPermit:async()=>permit,isLocallyCurrent:()=>state.local,isCurrent:async()=>state.remote};
 const options={uid:'owner',isActive:()=>state.active,auth,transport,fence,isUnlocked:()=>state.unlocked};
 return {state,options,fence,begin:()=>createDeadlineDeleteGuard(options)};
}

test('deadline guard passively accepts a live unlocked session without fresh/consume or key recovery',async()=>{
 for(const child of [false,true]){
  const f=fixture(child),current=await f.begin();await current();current.assertLocal();assert.equal(f.state.fresh,0);
 }
});

test('deadline guard rejects locks, changed owner, mount, generation, suspension and fences',async()=>{
 for(const [field,value] of Object.entries({uid:'another',active:false,unlocked:false,generation:2,suspension:1,local:false,remote:false})){
  const f=fixture(),current=await f.begin();f.state[field]=value;
  await assert.rejects(current,/DEADLINE_DELETE_SESSION_CHANGED/,field);assert.equal(f.state.fresh,0);
 }
});

test('deadline guard cannot be revived by unlocking again under the same owner',async()=>{
 const f=fixture(),current=await f.begin();f.state.unlocked=false;f.state.generation++;f.state.unlocked=true;
 await assert.rejects(current,/DEADLINE_DELETE_SESSION_CHANGED/);
});

test('deadline guard rechecks identity after every pending permit/current read',async()=>{
 for(const phase of ['readPermit','isCurrent']){
  const f=fixture();let release;const gate=new Promise(resolve=>{release=resolve;});
  const original=f.fence[phase];f.fence[phase]=async()=>{await gate;return original();};
  const pending=f.begin();await Promise.resolve();f.state.uid='another';release();
  await assert.rejects(pending,/DEADLINE_DELETE_SESSION_CHANGED/);assert.equal(f.state.fresh,0);
 }
});

test('deadline guard fails closed before confirmation when Vault or admission is unavailable',async()=>{
 for(const cause of ['locked','missing-permit','revoked','network']){
  const f=fixture();if(cause==='locked')f.state.unlocked=false;
  if(cause==='missing-permit')f.fence.readPermit=async()=>null;
  if(cause==='revoked')f.state.remote=false;
  if(cause==='network')f.fence.isCurrent=async()=>{throw Error('Synthetic network failure');};
  await assert.rejects(f.begin());assert.equal(f.state.fresh,0);
 }
});
