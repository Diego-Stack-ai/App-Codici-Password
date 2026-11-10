import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameDiagnostics,validFrameDiagnosticEvent,FRAME_DIAG_CODES,FRAME_DIAG_OPTION,FRAME_DIAG_EVENTS,FRAME_DIAG_TTL,frameLockCode} from '../Frontend/public/assets/js/modules/core/vault-frame-diagnostics.mjs';
function fixture(){let clock=1800000000000, revision=7, ready=true, counter=0,writes=0;const values=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{writes++;values.set(k,v);},removeItem:k=>{writes++;values.delete(k);}};
 const journal=createFrameDiagnostics({storage,now:()=>clock,appVersion:'1.2.268',context:()=>({ready,revision}),nonce:()=>`consent-synthetic-${++counter}`});
 return {journal,storage,values,event:code=>({code,at:clock,version:'1.2.268',page:'impostazioni.html',environment:'browser'}),
 writes:()=>writes,time:v=>{clock=v;},advance:v=>{clock+=v;},bind:(next,allowed=true)=>{revision=next;ready=allowed;}};
}
test('DIAG is opt-in: off means no event buffer, persistence, pruning or creation writes',()=>{
 const f=fixture();assert.equal(f.journal.enabled(),false);
 for(const code of FRAME_DIAG_CODES)assert.equal(f.journal.record(f.event(code)),false);
 assert.deepEqual(f.journal.events(),[]);assert.equal(f.writes(),0);assert.equal(f.values.size,0);
});
test('all allowed codes produce exactly five bounded non-identifying fields',()=>{
 const f=fixture();f.journal.setEnabled(true);
 for(const code of FRAME_DIAG_CODES)assert.equal(f.journal.record(f.event(code)),true);
 for(const value of f.journal.events()){assert.deepEqual(Object.keys(value).sort(),['at','code','environment','page','version']);assert.equal(validFrameDiagnosticEvent(value,value.at),true);}
 const report=JSON.stringify(f.journal.events());for(const forbidden of ['uid','email','https:','?','#','token','nonce','keyMaterial','message','stack'])assert.equal(report.includes(forbidden),false,forbidden);
});
for(const mutation of [e=>({...e,code:'UNREVIEWED'}),e=>({...e,uid:'sensitive-user'}),e=>({...e,email:'secret@example.invalid'}),e=>({...e,error:'secret-stack'}),
 e=>({...e,page:'impostazioni.html?id=sensitive'}),e=>({...e,page:'https://app.invalid/home_page.html'}),e=>({...e,page:'home_page.html#secret'}),
 e=>({...e,environment:'iPhone '+ 'sensitive'}),e=>({...e,version:'1.2.268?key=sensitive'}),e=>({...e,at:Infinity}),e=>({...e,at:e.at+1}),
 e=>Object.defineProperty(e,'uid',{value:'sensitive'}),e=>({...e,[Symbol('extra')]:'sensitive'})])
 test('foreign codes, fields or context cannot enter the ledger: '+String(mutation),()=>{
  const f=fixture();f.journal.setEnabled(true);const before=f.writes();assert.equal(f.journal.record(mutation(f.event('FRAME_ENTER'))),false);assert.equal(f.writes(),before);assert.deepEqual(f.journal.events(),[]);
 });
test('only the newest 200 events survive, with no discarded content in a copied report',()=>{
 const f=fixture();f.journal.setEnabled(true);const first=f.event('FRAME_ENTER').at;
 for(let n=0;n<225;n++){assert.equal(f.journal.record(f.event('FRAME_ENTER')),true);f.advance(1);}
 const events=f.journal.events();assert.equal(events.length,200);assert.equal(events[0].at,first+25);
 assert.equal(JSON.parse(f.values.get(FRAME_DIAG_EVENTS)).events.length,200);
});
test('seven-day expiry is strict and prunes persistence before events can be copied',()=>{
 const f=fixture();f.journal.setEnabled(true);f.journal.record(f.event('FRAME_ENTER'));f.advance(FRAME_DIAG_TTL-1);assert.equal(f.journal.events().length,1);
 f.advance(1);assert.deepEqual(f.journal.events(),[]);assert.deepEqual(JSON.parse(f.values.get(FRAME_DIAG_EVENTS)).events,[]);
});
test('disabling and privacy purge prevent pending writes and subsequent implicit re-enablement',()=>{
 const f=fixture();f.journal.setEnabled(true);const old=f.values.get(FRAME_DIAG_OPTION);f.journal.record(f.event('FRAME_ENTER'));
 f.journal.setEnabled(false);const baseline=f.writes();assert.equal(f.journal.record(f.event('FRAME_EXIT'),old),false);assert.equal(f.writes(),baseline);
 f.journal.setEnabled(true);assert.equal(f.journal.record(f.event('FRAME_EXIT'),old),false);assert.deepEqual(f.journal.events(),[]);
});
test('explicit clear rotates consent while preserving opt-in, invalidating pending worker replies',()=>{
 const f=fixture();f.journal.setEnabled(true);const old=f.values.get(FRAME_DIAG_OPTION);f.journal.record(f.event('FRAME_ENTER'));f.journal.clear();
 assert.equal(f.journal.enabled(),true);assert.notEqual(f.values.get(FRAME_DIAG_OPTION),old);assert.deepEqual(f.journal.events(),[]);
 assert.equal(f.journal.record(f.event('PUSH_ACK_RECEIVED'),old),false);
});
test('an Auth fence revision change or denied identity cannot read or append prior events',()=>{
 const f=fixture();f.journal.setEnabled(true);f.journal.record(f.event('FRAME_ENTER'));f.bind(8);
 assert.equal(f.journal.enabled(),false);assert.deepEqual(f.journal.events(),[]);assert.equal(f.journal.record(f.event('FRAME_ENTER')),false);
 f.bind(7,false);assert.deepEqual(f.journal.events(),[]);
});
test('corrupt storage is rejected as a whole, including extra fields on otherwise valid stored events',()=>{
 const f=fixture();f.journal.setEnabled(true);const {generation}=JSON.parse(f.values.get(FRAME_DIAG_OPTION));
 for(const event of [{...f.event('FRAME_ENTER'),uid:'secret'}, {...f.event('FRAME_ENTER'),code:'secret'}, {...f.event('FRAME_ENTER'),page:'app.html?uid=secret'}]){
  f.storage.setItem(FRAME_DIAG_EVENTS,JSON.stringify({generation,events:[event]}));assert.deepEqual(f.journal.events(),[]);assert.equal(JSON.stringify(f.journal.events()).includes('secret'),false);
 }
});
test('blocked tab storage fails closed without exceptions or fallback persistence',()=>{
 const journal=createFrameDiagnostics({storage:{getItem(){throw Error('BLOCKED');},setItem(){throw Error('BLOCKED');}},appVersion:'1.2.268',context:()=>({ready:true,revision:1}),nonce:()=> 'consent-synthetic-0001'});
 assert.equal(journal.enabled(),false);assert.equal(journal.available(),false);assert.equal(journal.setEnabled(true),false);assert.deepEqual(journal.events(),[]);
});
test('block reasons map to fixed codes; an unknown reason never reaches the ledger',()=>{
 assert.equal(frameLockCode('expired'),'LOCK_EXPIRED');assert.equal(frameLockCode('version-mismatch'),'LOCK_VERSION_MISMATCH');assert.equal(frameLockCode('secret uid=123'),'LOCK_OTHER');
});

test('the canonical application version prefix is accepted without allowing arbitrary version text',()=>{
 const f=fixture(),journal=createFrameDiagnostics({storage:f.storage,now:()=>f.event('FRAME_ENTER').at,appVersion:'v1.2.268',context:()=>({ready:true,revision:1}),nonce:()=> 'consent-synthetic-0001'});
 assert.equal(journal.setEnabled(true),true);assert.equal(journal.record({...f.event('FRAME_ENTER'),version:'v1.2.268'}),true);
 assert.equal(journal.record({...f.event('FRAME_ENTER'),version:'v1.2.268 secret'}),false);
});
