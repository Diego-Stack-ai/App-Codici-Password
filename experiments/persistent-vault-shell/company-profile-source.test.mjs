import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCompanyProfileSource} from './company-profile-source.mjs';
import {createProfileSectionReader} from './profile-section-reader.mjs';
import {createProfileLinkedAccountReader} from './profile-linked-account.mjs';
const model = await readFile(new URL('../../Frontend/public/assets/js/modules/azienda/company-profile-model.js', import.meta.url), 'utf8');
const {companyProfileContacts} = await import('data:text/javascript;base64,' + Buffer.from(model).toString('base64'));
function fixture(online = true) {
    let uid = 'owner', locked = false;
    const calls = [], decrypted = [], controller = new AbortController();
    const record = {ownerId: uid, ragioneSociale: 'enc:Azienda', partitaIva: 'enc:IVA',
        emails: {pec: {email: 'enc:pec@example.invalid', linkedAccountId: 'same', linkedAccountCompanyId: 'target', password: 'enc:LEGACY'}, extra: [{id: 'extra', email: 'enc:extra@example.invalid'}]},
        telefonoAzienda: 'enc:000', phoneAccountLinks: {telefonoAzienda: {linkedAccountId: 'same', linkedAccountCompanyId: 'target'}},
        indirizzoSede: 'enc:Sede legale', altreSedi: [{indirizzo: 'enc:Filiale', prov: 'VE'}],
        allegati: [{name: 'enc:Visura', url: 'enc:DO-NOT-READ', storagePath: 'enc:DO-NOT-READ'}]};
    const repository = {};
    for (const suffix of ['', 'Confirmed']) {
        repository['getCompany' + suffix] = async (...args) => { calls.push(['profile' + suffix, ...args]); assert.deepEqual(args, ['owner', 'source']); return record; };
        repository['getCompanyAccount' + suffix] = async (...args) => { calls.push(['account' + suffix, ...args]); assert.deepEqual(args, ['owner', 'target', 'same']); return {ownerId: 'owner', password: 'enc:ACCOUNT'}; };
        repository['getPrivateAccount' + suffix] = async (...args) => { calls.push(['private' + suffix, ...args]); return {ownerId: 'owner', password: 'enc:PRIVATE'}; };
    }
    const context = {user: {uid}, signal: controller.signal, assertUnlocked() {if(locked)throw Error('VAULT_LOCKED');}, read: async ({ownerId, ciphertext}) => {assert.equal(ownerId, 'owner');decrypted.push(ciphertext);return ciphertext.slice(4);}};
    const source = createCompanyProfileSource({uid, companyId: 'source', repository, normalizeContacts: companyProfileContacts});
    return {source, record, context, calls, decrypted, repository, controller, change(){uid='other';}, lock(){locked=true;},
        read: createProfileSectionReader({context, getUser:()=>({uid}), source, isEncryptedValue:value=>value.startsWith('enc:')}),
        links: createProfileLinkedAccountReader({context, getUser:()=>({uid}), repository, source, isOnline:()=>online})};
}
test('company canonical fields use the common profile projection without reading legacy passwords or file URLs', async()=>{
    const f=fixture();
    assert.deepEqual((await f.read('personal')).map(row=>row.value),['Azienda','IVA']);
    const rows=await f.read('contacts');assert.deepEqual(rows.map(row=>row.value),['pec@example.invalid','extra@example.invalid','000']);
    assert.deepEqual(rows.filter(row=>row.link).map(row=>row.link.sourceId),['pec','telefonoAzienda']);
    assert.deepEqual((await f.read('addresses')).map(row=>row.value),['Sede legale','Filiale','VE']);
    assert.deepEqual((await f.read('documents')).map(row=>row.value),['Visura']);
    assert.ok(f.decrypted.every(value=>!value.includes('LEGACY')&&!value.includes('DO-NOT-READ')));
});
for(const online of [true,false])test(`company source and destination stay distinct ${online?'online':'offline'}`,async()=>{
    const f=fixture(online),rows=await f.read('contacts');f.calls.length=0;
    for(const row of rows.filter(row=>row.link))assert.equal(await f.links.readPassword(row.link),'ACCOUNT');
    assert.ok(f.calls.every(call=>call[0].endsWith('Confirmed')===online));
    f.record.emails.pec.linkedAccountCompanyId='';
    const privateLink=(await f.read('contacts'))[0].link;
    assert.equal(await f.links.readPassword(privateLink),'PRIVATE');
});
test('missing, archived and malformed company profiles fail closed',async()=>{
    for(const patch of [{isArchived:true},{ownerId:'other'},{emails:[]},{emails:{extra:{}}},{altreSedi:[null]},{allegati:{}}]){
        const f=fixture();Object.assign(f.record,patch);await assert.rejects(f.read('contacts'));
    }
    assert.throws(()=>createCompanyProfileSource({uid:'owner',companyId:'../bad',repository:{},normalizeContacts:companyProfileContacts}));
});
for(const boundary of ['lock','change','abort','relink'])test(`company linked credential rejects late ${boundary}`,async()=>{
    const f=fixture(),link=(await f.read('contacts'))[0].link;let release;
    f.context.read=()=>new Promise(resolve=>{release=resolve;});
    const pending=f.links.readPassword(link),denied=assert.rejects(pending,/VAULT_LOCKED|AUTH_CHANGED|VIEW_DISPOSED|PROFILE_LINK_CHANGED/);
    while(!release)await new Promise(resolve=>setImmediate(resolve));
    if(boundary==='abort')f.controller.abort();else if(boundary==='relink')f.record.emails.pec.linkedAccountId='other';else f[boundary]();
    release('late');await denied;
});
