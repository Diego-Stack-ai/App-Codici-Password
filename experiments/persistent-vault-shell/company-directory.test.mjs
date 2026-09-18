import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyDirectoryReader, mountCompanyDirectory} from './company-directory.mjs';
function fixture(online=true) {
    const controller=new AbortController(),calls=[];let uid='owner',locked=false;
    const records=[{id:'first',ragioneSociale:'enc:Prima',password:'enc:DO-NOT-READ'},{id:'second',ragioneSociale:'Seconda'},{id:'archived',ragioneSociale:'enc:DO-NOT-READ',isArchived:true}];
    const repository={listCompanies:async id=>{calls.push(['cache',id]);return records;},listCompaniesConfirmed:async id=>{calls.push(['server',id]);return records;}};
    const context={unlocked:true,user:{uid},signal:controller.signal,assertUnlocked(){if(locked)throw Error('VAULT_LOCKED');},read:async({ownerId,ciphertext})=>{assert.equal(ownerId,'owner');assert.equal(ciphertext,'enc:Prima');return 'Prima';}};
    return {records,repository,context,controller,calls,lock(){locked=true;},change(){uid='other';},read:createCompanyDirectoryReader({context,getUser:()=>({uid}),repository,isOnline:()=>online,isEncryptedValue:value=>value.startsWith('enc:')})};
}
for(const online of [true,false])test(`directory uses owner-scoped ${online?'confirmed':'cached'} data and only decrypts active company names`,async()=>{
    const f=fixture(online);assert.deepEqual(await f.read(),[{id:'first',title:'Prima'},{id:'second',title:'Seconda'}]);assert.deepEqual(f.calls,[[online?'server':'cache','owner']]);
});
test('duplicate IDs, wrong owners and invalid IDs fail closed',async()=>{
    for(const bad of [{id:'first',ragioneSociale:'duplicate'},{id:'bad/path'},{id:'foreign',ownerId:'other'},{id:'object',ragioneSociale:{}}]){
        const f=fixture();f.records.push(bad);await assert.rejects(f.read());
    }
});
for(const boundary of ['abort','lock','change'])test(`directory suppresses names after ${boundary} during decryption`,async()=>{
    const f=fixture();let release;f.context.read=()=>new Promise(resolve=>{release=resolve;});
    const pending=f.read(),denied=assert.rejects(pending,/VIEW_DISPOSED|VAULT_LOCKED|AUTH_CHANGED/);
    while(!release)await new Promise(resolve=>setImmediate(resolve));
    if(boundary==='abort')f.controller.abort();else f[boundary]();release('late');await denied;
});
test('server and decrypt errors cannot fall back to cached or plaintext titles',async()=>{
    const f=fixture();f.repository.listCompaniesConfirmed=async()=>{throw Error('permission-denied');};await assert.rejects(f.read(),/permission-denied/);assert.equal(f.calls.length,0);
    const g=fixture();g.context.read=async()=>{throw Error('decrypt');};await assert.rejects(g.read(),/decrypt/);
});
class Node extends EventTarget {
    constructor(tag){super();this.tag=tag;this.children=[];this.dataset={};this.textContent='';this.value='';}
    setAttribute(){}
    append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
    replaceChildren(...nodes){this.children=[];this.textContent='';this.append(...nodes);}
    remove(){this.parent.children=this.parent.children.filter(node=>node!==this);}
    querySelectorAll(tag){return this.children.flatMap(node=>[...(node.tag===tag?[node]:[]),...node.querySelectorAll(tag)]);}
}
globalThis.document={createElement:tag=>new Node(tag)};
test('directory filters locally, binds both destinations and clears retained titles and search on exit',async()=>{
    const f=fixture(),root=new Node('root'),opened=[];
    const cleanup=await mountCompanyDirectory(root,f.context,{readCompanies:f.read,onOpenProfile:id=>opened.push(['profile',id]),onOpenAccounts:id=>opened.push(['accounts',id])});
    const firstButtons=root.querySelectorAll('button'),oldTitle=root.querySelectorAll('h3')[0],search=root.querySelectorAll('input')[0];
    search.value='second';search.dispatchEvent(new Event('input'));assert.equal(oldTitle.textContent,'');
    assert.deepEqual(root.querySelectorAll('h3').map(node=>node.textContent),['Seconda']);
    firstButtons[0].dispatchEvent(new Event('click'));assert.deepEqual(opened,[]);
    for(const button of root.querySelectorAll('button'))button.dispatchEvent(new Event('click'));
    assert.deepEqual(opened,[['profile','second'],['accounts','second']]);
    const title=root.querySelectorAll('h3')[0],button=root.querySelectorAll('button')[0];f.controller.abort();cleanup();
    assert.equal(title.textContent,'');assert.equal(search.value,'');assert.equal(root.children.length,0);
    button.dispatchEvent(new Event('click'));assert.equal(opened.length,2);
});
test('directory cannot mount late data after abort or disturb the next view',async()=>{
    const f=fixture(),root=new Node('root');let release;
    const pending=mountCompanyDirectory(root,f.context,{readCompanies:()=>new Promise(resolve=>{release=resolve;}),onOpenProfile(){},onOpenAccounts(){}});
    f.controller.abort();const next=new Node('new');root.append(next);release([{id:'secret',title:'late-secret'}]);await pending;
    assert.deepEqual(root.children,[next]);
});
test('empty directory renders an explicit empty state',async()=>{
    const f=fixture(),root=new Node('root');const cleanup=await mountCompanyDirectory(root,f.context,{readCompanies:async()=>[],onOpenProfile(){},onOpenAccounts(){}});
    assert.ok(root.querySelectorAll('p').some(node=>node.textContent==='Nessuna azienda trovata.'));assert.equal(root.querySelectorAll('button').length,0);cleanup();
});
