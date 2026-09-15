import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const messageSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/read-error-message.js', import.meta.url), 'utf8');
const {readErrorMessage} = await import('data:text/javascript;base64,' + Buffer.from(messageSource).toString('base64'));


const source = await readFile(new URL('../Frontend/public/assets/js/modules/azienda/dettaglio_account_azienda.js', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
function fixture() {
    const writes = [], reads = [], errors = [], modules = [], classes = new Set(), listeners = new Set();
    const nodes = Object.fromEntries(['detail-username','hero-title','detail-password','btn-call-ref-phone','ref-phone'].map(id=>[id,{closest:()=>null,value:'',textContent:'',children:[],classList:{add(){},remove(){},toggle(){}},onclick:null}]));
    const footer = {children: [], classList: {
        add: value => classes.add(value),
        toggle(value, enabled) { if (enabled) classes.add(value); else classes.delete(value); }
    }};
    const find = (nodes, id) => {
        for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
            if (node?.props?.id === id) return node;
            const nested = node?.children && find(node.children, id);
            if (nested) return nested;
        }
    };
    let read = async () => ({nomeAccount: 'Synthetic company account'});
    const window = {location: {search: '?id=account&aziendaId=company', pathname: '/dettaglio_account_azienda.html', href: ''}, history: {replaceState() {}}};
    const context = vm.createContext({readErrorMessage, URLSearchParams, AbortController, auth:{currentUser:null}, onAuthStateChanged:(_auth,fn)=>{listeners.add(fn);return()=>listeners.delete(fn)}, window, navigator: {onLine: true}, console,
        document: {getElementById: id => id === 'footer-center-actions' ? footer : nodes[id] || find(footer.children, id),
            querySelector: () => null, querySelectorAll: () => []},
        db: {}, doc: (_db, ...path) => path.join('/'), increment: value => ({increment: value}),
        updateDoc: async (path, change) => writes.push({path, change}),
        getCompanyAccount: async (...args) => { reads.push(args); return read(); },
        getCompanyAccountConfirmed: async (...args) => { reads.push(args); return read(); },
        createElement: (tag, props, children) => ({tag, props, children}),
        setChildren: (node, children) => { node.children = children; },
        clearElement: node => { node.children = []; node.textContent = ''; }, createSafeAccountIcon: () => ({}),
        ensureVaultKeyMaterial:async()=> 'key', decryptIfPossible:async v=>v, showToast() {}, t: value => value, logError: (...args) => errors.push(args),
        initAttachmentModule: options => modules.push(['attachments', options]),
        initSharingModule: options => modules.push(['sharing', options]),
        initDetailAccountMode: async options => { modules.push(['mode', options]); return {}; },
        renderSharingMap() {}, loadAttachments: async () => {}, renderAccountBanking() {},
        loadModule: async () => ({initAccountNoteEditor() {}, initAccountSharedCredentials() {}, initAccountEmbeddedWidgets() {}}),
        setTimeout() {}, history: {back() {}}
    });
    vm.runInContext(source.replace(/^import[\s\S]*?;\s*$/gm, '').replace('export async function', 'async function').replace(/\bimport\(/g, 'loadModule('), context);
    return {writes, reads, errors, modules, footer, classes, window, context, nodes, listeners,
        button: () => find(footer.children, 'btn-edit-footer'),
        read: value => { read = value; }, init: (uid='owner',options={}) => {context.auth.currentUser={uid};return context.initDettaglioAccountAzienda({uid},options)}};
}


test('same UID A to B rejects late company A record and mounts only company B dependencies',async()=>{
 const f=fixture(),gate=deferred();f.read(()=>gate.promise);const first=f.init();
 f.window.location.search='?id=B&aziendaId=second';f.read(async()=>({nomeAccount:'B',username:'B-user'}));await f.init();gate.resolve({nomeAccount:'A',username:'A-user'});await first;
 assert.equal(f.nodes['detail-username'].value,'B-user');assert.equal(f.nodes['hero-title'].textContent,'B');assert.equal(f.writes.length,1);assert.equal(f.writes[0].path,'users/owner/aziende/second/accounts/B');
 assert.ok(f.modules.every(([,scope])=>(scope.accountId||scope.currentId)==='B'));
});
test('late vault key or decryption cannot render old record into next company',async()=>{
 for(const stage of ['key','decrypt']){const f=fixture(),gate=deferred();f.read(async()=>({_encrypted:true,nomeAccount:'A',username:'cipher'}));if(stage==='key')f.context.ensureVaultKeyMaterial=()=>gate.promise;else f.context.decryptIfPossible=()=>gate.promise;
 const first=f.init();await new Promise(r=>setImmediate(r));f.window.location.search='?id=B&aziendaId=second';f.read(async()=>({nomeAccount:'B',username:'B-user'}));await f.init();gate.resolve('old-plaintext');await first;assert.equal(f.nodes['detail-username'].value,'B-user');assert.equal(f.writes.length,1);}
});
test('late widget imports retain original scope and never initialize after another account mount',async()=>{
 const f=fixture(),gate=deferred(),initialized=[];f.context.loadModule=()=>gate.promise;await f.init();f.window.location.search='?id=B&aziendaId=second';await f.init();
 gate.resolve({initAccountSharedCredentials:scope=>initialized.push(scope),initAccountEmbeddedWidgets:scope=>initialized.push(scope)});await new Promise(r=>setImmediate(r));assert.equal(initialized.length,2);assert.ok(initialized.every(scope=>scope.accountId==='B'&&scope.companyId==='second'));
});
test('abort clears canonical fields, blocks old edit and phone callbacks, unregisters listeners',async()=>{
 const f=fixture(),abort=new AbortController();f.read(async()=>({username:'visible',referenteTelefono:'123'}));const controller=await f.init('owner',{signal:abort.signal});const edit=f.button().props.onclick,phone=f.nodes['btn-call-ref-phone'].onclick;abort.abort();edit();phone();assert.equal(f.nodes['detail-username'].value,'');assert.equal(f.window.location.href,'');assert.equal(f.listeners.size,0);controller.destroy();
});
test('repeated mount replaces phone handler and abort during contacts blocks sharing and attachments continuation',async()=>{
 const f=fixture(),gate=deferred();let loads=0;f.context.loadAttachments=async()=>loads++;f.context.initDetailAccountMode=()=>gate.promise;const abort=new AbortController();const opening=f.init('owner',{signal:abort.signal});await new Promise(r=>setImmediate(r));const oldPhone=f.nodes['btn-call-ref-phone'].onclick;abort.abort();gate.resolve({});await opening;assert.equal(loads,0);
 f.context.initDetailAccountMode=async()=>({});await f.init();assert.notEqual(f.nodes['btn-call-ref-phone'].onclick,oldPhone);oldPhone();assert.equal(f.window.location.href,'');assert.equal(f.listeners.size,1);
});

const moduleText=async path=>(await readFile(new URL('../Frontend/public/assets/js/modules/'+path,import.meta.url),'utf8')).replace(/^import[\s\S]*?;\s*$/gm,'').replace(/^export /gm,'');
test('real attachment reader rejects late list and retained actions after parent context expires',async()=>{
 const text=await moduleText('azienda/dettaglio-azienda-attachments.js');const gate=deferred();let active=true,rendered=0;
 const realm=vm.createContext({showConfirmModal(){},document:{getElementById:()=>({})},listCompanyAccountAttachments:()=>gate.promise,setChildren:()=>rendered++,logError(){},showToast(){}});vm.runInContext(text,realm);
 realm.initAttachmentModule({ownerUid:'A',currentAziendaId:'company',currentId:'one',isActive:()=>active});const reading=realm.loadAttachments();active=false;gate.resolve([{id:'old'}]);await reading;assert.equal(rendered,0);
});
test('real detail mode contact lookup respects parent teardown while default legacy caller still renders',async()=>{
 const text=await moduleText('shared/detail-account-mode.js');
 for(const expired of [true,false]){let active=true;const gate=deferred();const nodes={};const node=()=>({children:[],classList:{add(){},remove(){},toggle(){}},appendChild(n){this.children.push(n)},addEventListener(){}});
 for(const id of ['account-mode-section','account-mode-options','account-mode-contacts','account-mode-contact-list','btn-save-account-mode'])nodes[id]=node();
 const realm=vm.createContext({showConfirmModal(){},document:{getElementById:id=>nodes[id]},listContacts:()=>gate.promise,accountModeFromRecord:()=> 'account-private',hasAccountCredentials:()=>true,createElement:(_tag,props)=>({...node(),...props}),clearElement:n=>n.children=[],console});vm.runInContext(text,realm);
 const pending=realm.initDetailAccountMode({account:{},ownerId:'A',accountId:'one',...(expired?{isActive:()=>active}:{})});active=false;gate.resolve([]);await pending;assert.equal(nodes['account-mode-options'].children.length,expired?0:4);
 }
});
test('real sharing revoke confirmation cannot submit after parent context changes',async()=>{
 const text=await moduleText('azienda/dettaglio-azienda-sharing.js');const gate=deferred();let active=true,writes=0;
 const realm=vm.createContext({showConfirmModal:()=>gate.promise,runTransaction:async()=>writes++,t:()=>'',document:{getElementById:()=>null}});vm.runInContext(text,realm);
 realm.initSharingModule({currentUid:'A',currentAziendaId:'company',currentId:'one',isReadOnly:false,isActive:()=>active});const pending=realm.revokeRecipientV3('synthetic@example.invalid');active=false;gate.resolve(true);await pending;assert.equal(writes,0);
});


test('banking renderer rejects retained copy callback after teardown and keeps legacy default',async()=>{
 const text=await moduleText('shared/account-banking-view.js');let active=true,copies=0;const nodes=[];const realm=vm.createContext({readErrorMessage, crypto:{randomUUID:()=> 'fixture'},createElement:(tag,props,children)=>{const n={tag,...props,children,prepend(){}};nodes.push(n);return n},navigator:{clipboard:{writeText:async()=>copies++}},showToast(){},t:()=>'',document:{getElementById:()=>null}});vm.runInContext(text,realm);
 realm.createBankAccount({iban:'fixture'},0,()=>active);const copy=nodes.find(n=>n.className?.includes('copy-btn'));active=false;await copy.onclick({stopPropagation(){}});assert.equal(copies,0);
 nodes.length=0;realm.createReadonlyField('legacy','fixture','bank');await nodes.find(n=>n.className?.includes('copy-btn')).onclick({stopPropagation(){}});assert.equal(copies,1);
});

test('closing old source selector cannot hide the next account selector from its timer',async()=>{
 const text=await moduleText('azienda/dettaglio-azienda-attachments.js');const timers=[],classes=new Set();const modal={classList:{remove:x=>classes.delete(x),add:x=>classes.add(x)}};
 const realm=vm.createContext({showConfirmModal(){},document:{getElementById:()=>modal,body:{style:{}}},setTimeout:fn=>timers.push(fn)});vm.runInContext(text,realm);
 realm.initAttachmentModule({ownerUid:'A',currentAziendaId:'one',currentId:'a'});realm.closeSourceSelector();realm.initAttachmentModule({ownerUid:'A',currentAziendaId:'two',currentId:'b'});realm.openSourceSelector();timers.forEach(fn=>fn());assert.equal(classes.has('hidden'),false);assert.equal(classes.has('active'),true);
});
test('file picker node belongs to opening generation and late old change cannot upload into next account',async()=>{
 const f=fixture();let uploads=0;f.context.handleFileUpload=()=>uploads++;
 const make=()=>({value:'',classList:{},parentNode:{replaceChild(fresh){f.nodes['input-file']=fresh}},cloneNode(){return make()}});
 f.nodes['input-file']=make();const first=await f.init();const old=f.nodes['input-file'],retained=old.onchange;
 f.window.location.search='?id=B&aziendaId=second';const second=await f.init();assert.notEqual(f.nodes['input-file'],old);retained({target:old});assert.equal(uploads,0);assert.equal(old.value,'');f.nodes['input-file'].onchange({target:f.nodes['input-file']});assert.equal(uploads,1);second.destroy();assert.equal(f.nodes['input-file'].onchange,null);first.destroy();
});
