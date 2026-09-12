import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = (await readFile(new URL('../Frontend/public/assets/js/modules/shared/account-shared-credentials.js', import.meta.url), 'utf8')).replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export (async )?function/g, '$1function');
test('new account link action saves first and never links an absent record', () => {
    let clicks = 0, visible = false;
    const add = {}, save = {disabled:false,dataset:{},click(){clicks++;}};
    const nodes = {'shared-credentials-section':{classList:{remove(){visible=true;}}},'btn-link-shared-credential':add,save};
    const sandbox = {document:{getElementById:id=>nodes[id]},navigator:{onLine:true},showToast(){}};
    vm.createContext(sandbox);vm.runInContext(source,sandbox);
    sandbox.initNewAccountSharedCredentials({saveButtonId:'save'});
    assert.equal(visible,true);assert.match(add.textContent,/Salva Account/);
    add.onclick();assert.equal(clicks,1);assert.equal(save.dataset.openSharedCredentials,'true');
    save.disabled=true;add.onclick();assert.equal(clicks,1);
    save.disabled=false;sandbox.navigator.onLine=false;add.onclick();assert.equal(clicks,1);
});
test('confirmed creation routes to the saved record only when linking was requested', async () => {
    for (const [name, company] of [['privato/form-privato-save.js',false],['azienda/form-azienda-save.js',true]]) {
        const code=await readFile(new URL(`../Frontend/public/assets/js/modules/${name}`,import.meta.url),'utf8');
        const expressions=[...code.matchAll(/const destination = (!isEditing[\s\S]*?);/g)].map(match=>match[1]);
        assert.equal(expressions.length,company?1:2);
        for (const expression of expressions) {
            const context={isEditing:false,btnSave:{dataset:{openSharedCredentials:'true'}},accountRef:{id:'new'},savedAccountId:'new',currentDocId:null,currentAziendaId:'company'};
            assert.match(vm.runInNewContext(expression,context), /id=new.*linkShared=1/);
            context.btnSave.dataset={};assert.doesNotMatch(vm.runInNewContext(expression,context), /linkShared/);
            context.isEditing=true;context.currentDocId='existing';context.btnSave.dataset.openSharedCredentials='true';
            assert.match(vm.runInNewContext(expression,context), /dettaglio_account_.*id=existing/);
        }
    }
});
