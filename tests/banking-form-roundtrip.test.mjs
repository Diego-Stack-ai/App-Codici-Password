import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const modelSource = await readFile(new URL('shared/banking-model.js', root), 'utf8');
const model = await import(`data:text/javascript;base64,${Buffer.from(modelSource).toString('base64')}`);

for (const area of ['privato', 'azienda']) {
    const form = await readFile(new URL(`${area}/form_account_${area}.js`, root), 'utf8');
    const save = (await readFile(new URL(`${area}/form-${area}-save.js`, root), 'utf8')).replace(/\r\n/g, '\n');
    const loader = form.slice(form.indexOf('        let loadedBanking ='), form.indexOf('        if (hasRealData'));
    const bankingStart = save.indexOf('banking: await Promise.all(') + 'banking: '.length;
    const bankingExpression = save.slice(bankingStart, save.indexOf(',\n        isExplicitMemo:', bankingStart));
    test(`${area}: numero verde e referente banca sopravvivono a carica/salva/ricarica`, async () => {
        for (const record of [
            {numeroVerde: '800 123 456', referenteNome: 'Referente generale'},
            {banking: [{referenteNome: 'Referente banca', numeroVerde: '800 123 456'}]},
            {banking: [{referenteNome: 'Solo referente banca'}]},
            {banking: {numeroVerde: '800 123 456'}}
        ]) {
            const context = vm.createContext({...model, data: record, needsDecryption: false,
                encrypt: async value => value ? `encrypted:${value}` : '', vaultKeyMaterial: 'synthetic-key'});
            const load = () => vm.runInContext(`(async()=>{${loader};return {loadedBanking,hasRealData};})()`, context);
            const first = await load();
            assert.equal(first.hasRealData, true);
            context.bankAccounts = first.loadedBanking;
            const stored = await vm.runInContext(`(async()=>(${bankingExpression}))()`, context);
            context.data = {...record, banking: stored};
            const second = await load();
            assert.equal(second.hasRealData, true);
            assert.equal(second.loadedBanking[0].numeroVerde || '', first.loadedBanking[0].numeroVerde || '');
            assert.equal(second.loadedBanking[0].referenteNome || '', first.loadedBanking[0].referenteNome || '');
            assert.equal(context.data.referenteNome, record.referenteNome);
        }
    });
    test(`${area}: referente generale da solo non apre un conto bancario`, async () => {
        const context = vm.createContext({...model, data: {referenteNome: 'Generale', referenteTelefono: '123'}, needsDecryption: false});
        const result = await vm.runInContext(`(async()=>{${loader};return {loadedBanking,hasRealData};})()`, context);
        assert.equal(result.hasRealData, false);
        assert.equal(result.loadedBanking.length, 0);
    });
}
