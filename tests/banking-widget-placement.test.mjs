import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = (await readFile(new URL('../Frontend/public/assets/js/modules/shared/account-embedded-widgets.js', import.meta.url), 'utf8')).replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
function fixture(editable = true) {
    const all = [], updates = [];
    function element(tag, props = {}, children = []) {
        const classes = new Set();
        const n = {tag, value: '', dataset: {}, children: [], ...props, classList: {
            add(x) {classes.add(x);}, remove(x) {classes.delete(x);}, contains(x) {return classes.has(x);},
            toggle(x, force) {const set = force ?? !classes.has(x); if(set) classes.add(x); else classes.delete(x); return set;}
        }, appendChild(x) {x.remove(); this.children.push(x); x.parent = this; return x;},
        remove() {if(this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null;},
        addEventListener(type, fn) {this['on'+type] = fn;}, setAttribute(k,v) {this[k]=v;},
        querySelector() {return null;}, focus() {}};
        Object.defineProperty(n, 'firstElementChild', {get() {return this.children[0];}});
        all.push(n); children.filter(Boolean).forEach(x => n.appendChild(x)); return n;
    }
    const ids = Object.fromEntries(['account-widgets-section','account-widgets-list','btn-add-account-widget','section-banking','banking-section'].map(id => [id, element('div')]));
    let hosts = ['bank-a','bank-b'].map(bankId => element('div', {dataset: {bankWidgetId: bankId}}));
    const widgets = [
        {id:'a', bankId:'bank-a', title:'A'}, {id:'b', bankId:'bank-b', title:'B'}, {id:'g',title:'Generic'}
    ].map(w => ({...w, kind:'embedded', context:'private',accountId:'account',revision:1,fields:[{id:'field',label:'Code',value:'initial',type:'text'}]}));
    const sandbox = {document: {getElementById: id => ids[id], querySelectorAll: () => hosts, body: element('body')},
        createElement: element, clearElement(n) {for(const x of [...n.children]) x.remove();},
        setChildren(n, children) {for(const x of [...n.children]) x.remove(); children.filter(Boolean).forEach(x=>n.appendChild(x));},
        auth:{currentUser:{uid:'owner'}}, navigator:{onLine:true}, crypto:{randomUUID:()=> 'uuid'},
        ensureVaultKeyMaterial:async()=> 'key', decrypt:async x => x,
        listAccountWidgets:async()=>widgets, listAccountWidgetsConfirmed:async()=>widgets,
        listSharedVaultDataConfirmed:async()=>[], showToast(){},
        updateAccountWidget:async (...args)=>updates.push(args), createAccountWidget:async(...args)=>updates.push(args)};
    vm.createContext(sandbox); vm.runInContext(source,sandbox);
    return {all, ids, widgets, updates, sandbox, get hosts(){return hosts;},
        remount() {hosts = hosts.map(h=>element('div',{dataset:{...h.dataset}}));},
        init:()=>sandbox.initAccountEmbeddedWidgets({uid:'owner',context:'private',accountId:'account',editable})};
}
test('bank widgets belong to their bank; remount preserves dirty card and main save includes it', async()=>{
    const f=fixture(); const controller=await f.init();
    assert.equal(f.ids['account-widgets-list'].children.length,1);
    const card=f.hosts[0].children[0]; assert.ok(card); assert.equal(f.hosts[1].children.length,1);
    const input=f.all.find(n=>n.className==='account-widget-inline-input'); input.value='changed'; input.oninput();
    f.remount(); controller.placeBankWidgets(); assert.equal(f.hosts[0].children[0],card);
    assert.equal(input.value,'changed'); assert.equal(controller.hasPendingChanges(),true);
    await controller.savePendingChanges(); assert.equal(f.updates.length,1);
    assert.equal(f.updates[0][2].bankId,'bank-a'); assert.equal(f.updates[0][2].fields[0].value,'changed');
});
test('consultation nests banking widgets and keeps legacy generic widgets visible',async()=>{
    const f=fixture(false); await f.init(); assert.equal(f.hosts[0].children.length,1);
    assert.equal(f.ids['account-widgets-list'].children.length,1);
});
test('bank shortcut preselects the owning bank and sends it to create',async()=>{
    const f=fixture(); const controller=await f.init(); await controller.openNewWidget('bank-b');
    const select=f.all.find(n=>n['aria-label']==='Posizione del Widget'); assert.equal(select.value,'bank-b');
    const title=f.all.find(n=>n.placeholder==='Titolo del widget'); title.value='New';
    f.all.find(n=>n.placeholder==='Nome del campo').value='Code';
    const form=f.all.find(n=>n.tag==='form'); await form.onsubmit({preventDefault(){}});
    assert.equal(f.updates[0][0].bankId,'bank-b');
});

test('widget preparation preserves bank binding, explicit detach and encrypted values',async()=>{
    const text=await readFile(new URL('../Frontend/public/assets/js/modules/data/shared-vault-data-model.js',import.meta.url),'utf8');
    const {prepareEmbeddedAccountWidget}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
    const data={title:'Bank code',bankId:'bank-b',fields:[{id:'secret',label:'PIN',type:'sensitive',value:'1234'}]};
    const account={context:'private',accountId:'account'};
    const widget=await prepareEmbeddedAccountWidget(data,account,async()=> 'encrypted');
    assert.equal(widget.bankId,'bank-b'); assert.equal(widget.fields[0].valueEnc,'encrypted');
    assert.equal(Object.hasOwn(widget.fields[0],'value'),false);
    assert.equal((await prepareEmbeddedAccountWidget({...data,bankId:null},account,async()=> 'encrypted')).bankId,null);
    await assert.rejects(prepareEmbeddedAccountWidget({...data,bankId:'bad/path'},account,async()=> 'encrypted'));
});
