import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPrivateDocumentsEditor} from './private-documents-editor-view.mjs';

class Element extends EventTarget {
    constructor(tag) {super(); this.tag=tag; this.children=[]; this.dataset={}; this.value=''; this.disabled=false;}
    append(...items) {for(const item of items){item.parent=this; this.children.push(item);}}
    remove() {if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
    querySelectorAll(selector) {return this.children.flatMap(n=>[...(selector.split(',').includes(n.tag)?[n]:[]),...n.querySelectorAll(selector)]);}
    querySelector(selector) {return this.querySelectorAll('button').find(n=>selector===`[data-document-action="${n.dataset.documentAction}"]`);}
}
test('cancel clears drafts and returns without saving; unavailable for uncertain or pending saves', async () => {
    const previous=globalThis.document;
    globalThis.document={createElement:tag=>new Element(tag)};
    try {
        const root=new Element('root'), abort=new AbortController(); let cancelled=0, saved=0, disposed=0, emit;
        await mountPrivateDocumentsEditor(root,{signal:abort.signal,assertUnlocked(){}},{
            load:async()=>({canSave:true,templates:[],rows:[{id:'doc',fields:[{key:'note',value:'original'}]}]}),
            createId:()=> 'new', onCancel:()=>cancelled++, onSaved:()=>saved++,
            createController:({onState})=>{emit=onState;return {dispose(){disposed++;},save(){saved++;},retry(){saved++;}};}
        });
        const input=root.querySelectorAll('input')[0], cancel=root.querySelector('[data-document-action="cancel"]');
        assert.ok(cancel); input.value='unsaved';
        for(const status of ['preparing','saving','unknown','saved']) {
            emit({status}); assert.equal(cancel.disabled,true); assert.equal(input.disabled,true);
            assert.equal(root.querySelector('[data-document-action="add"]').disabled,true);
            cancel.dispatchEvent(new Event('click')); assert.equal(cancelled,0);
        }
        emit({status:'rejected'}); assert.equal(cancel.disabled,false); cancel.dispatchEvent(new Event('click'));
        assert.equal(cancelled,1); assert.equal(saved,0); assert.equal(disposed,1); assert.equal(input.value,''); assert.equal(root.children.length,0);
        cancel.dispatchEvent(new Event('click')); assert.equal(cancelled,1);
    } finally {globalThis.document=previous;}
});
