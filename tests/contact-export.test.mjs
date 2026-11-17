import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../Frontend/public/assets/js/modules/shared/contact-export-model.js', import.meta.url), 'utf8');
const {contactVCardFileName, createContactFileActions} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const value = 'BEGIN:VCARD\nFN:Persona Sintetica\nEND:VCARD';
const filename = 'contatto-Persona-Sintetica.vcf';
function fixture({boundary, share = true, picker = true, shareError, permitCheck} = {}) {
    let active = true, timer;
    const calls = [], downloads = [], urls = [];
    const check = () => {if (!active) throw Error('SESSION_CHANGED');};
    const cross = where => {if (boundary === where) active = false;};
    const writable = {
        async write(bytes) {calls.push('write'); downloads.push(new TextDecoder().decode(bytes)); cross('write');},
        async close() {calls.push('close'); cross('close');},
        async abort() {calls.push('abort');}
    };
    const environment = {File, Blob, TextEncoder,
        navigator: {canShare: ({files}) => share && files[0].name === filename,
            async share({files}) {calls.push('share'); downloads.push({name: files[0].name, value: await files[0].text()});
                if (shareError) throw Object.assign(Error('synthetic'), {name: shareError}); cross('share');}},
        URL: {createObjectURL: blob => {calls.push('url'); downloads.push(blob); return 'blob:synthetic';}, revokeObjectURL: url => urls.push(url)},
        document: {body: {append() {}}, createElement: () => ({click() {calls.push('click'); calls.push(this.download);}, remove() {}})},
        setTimeout: callback => {timer = callback; return 1;}, clearTimeout() {}
    };
    if (picker) environment.showSaveFilePicker = async options => {
        calls.push('picker'); assert.equal(options.suggestedName, filename); cross('picker');
        return {name: 'nome-scelto.vcf', async createWritable() {calls.push('create'); cross('create'); return writable;}};
    };
    const actions = createContactFileActions({value, filename, assertActive: check, checkCurrent: async () => {check(); permitCheck?.();}, environment});
    return {actions, calls, downloads, urls, revoke: () => {active = false;}, timer: () => timer?.()};
}

test('vCard names identify the holder and safely retain the extension', () => {
    assert.equal(contactVCardFileName({name: 'Maria', surname: 'Rossi'}), 'contatto-Maria-Rossi.vcf');
    assert.equal(contactVCardFileName({company: true, companyName: 'Ditta QA S.r.l.'}), 'contatto-azienda-Ditta-QA-S-r-l.vcf');
    assert.equal(contactVCardFileName({company: true, companyName: '../Ditta\\QA:<X>\u202e'}), 'contatto-azienda-Ditta-QA-X.vcf');
    assert.equal(contactVCardFileName({name: 'Élodie', surname: '李'}), 'contatto-Élodie-李.vcf');
    assert.equal(contactVCardFileName(), 'contatto.vcf');
    assert.equal(contactVCardFileName({company: true}), 'contatto-azienda.vcf');
    assert.ok(contactVCardFileName({name: 'a'.repeat(1000)}).length <= 133);
    assert.ok(new TextEncoder().encode(contactVCardFileName({company: true, companyName: '𠮷'.repeat(1000)})).length <= 180);
});

test('save starts in the click, writes once, closes and reports the name selected in the picker', async () => {
    const f = fixture(); const pending = f.actions.save();
    assert.deepEqual(f.calls, ['picker'], 'the native picker opens before any await');
    assert.deepEqual(await pending, {kind: 'saved', name: 'nome-scelto.vcf'});
    assert.deepEqual(f.calls, ['picker', 'create', 'write', 'close']); assert.equal(f.downloads[0], value);
    f.actions.dispose();
});

for (const boundary of ['picker', 'create', 'write']) test(`revocation after ${boundary} prevents further writes/commit`, async () => {
    const f = fixture({boundary}); await assert.rejects(f.actions.save(), /SESSION_CHANGED/);
    assert.equal(f.calls.includes('close'), false);
    assert.equal(f.calls.includes('write'), boundary === 'write');
    assert.equal(f.calls.includes('abort'), boundary !== 'picker'); f.actions.dispose();
});

test('revocation after native close does not report success or attempt a second export', async () => {
    const f = fixture({boundary: 'close'}); await assert.rejects(f.actions.save(), /SESSION_CHANGED/);
    assert.equal(f.calls.filter(x => x === 'close').length, 1); assert.equal(f.calls.includes('click'), false); f.actions.dispose();
});

test('the session permit is rechecked after the picker before creating a writable', async () => {
    let permitted = true;
    const f = fixture({permitCheck: () => {if (!permitted) throw Error('PERMIT_REVOKED');}});
    const pending = f.actions.save(); permitted = false;
    await assert.rejects(pending, /PERMIT_REVOKED/); assert.deepEqual(f.calls, ['picker']); f.actions.dispose();
});

test('closing the export while a picker is pending prevents a late write', async () => {
    const f = fixture(); const pending = f.actions.save(); f.actions.dispose();
    await assert.rejects(pending, /CONTACT_EXPORT_CLOSED/); assert.deepEqual(f.calls, ['picker']);
});

test('a second click does not open a second picker', async () => {
    const f = fixture(); const first = f.actions.save(); await assert.rejects(f.actions.save(), /CONTACT_EXPORT_BUSY/);
    await first; assert.equal(f.calls.filter(x => x === 'picker').length, 1); f.actions.dispose();
});

test('download reports initiation, uses the announced name/MIME and revokes only its object URL', async () => {
    const f = fixture(); assert.deepEqual(await f.actions.download(), {kind: 'download-started', name: filename});
    assert.ok(f.calls.includes(filename)); assert.equal(f.downloads[0].type, 'text/vcard;charset=utf-8');
    assert.equal(await f.downloads[0].text(), value); f.timer();
    assert.deepEqual(f.urls, ['blob:synthetic']); f.actions.dispose(); assert.equal(await f.downloads[0].text(), value);
});

test('share starts in the click and delivers the announced file without claiming a saved path', async () => {
    const f = fixture(); const pending = f.actions.share(); assert.deepEqual(f.calls, ['share']);
    assert.deepEqual(await pending, {kind: 'shared', name: filename});
    assert.deepEqual(f.downloads, [{name: filename, value}]); f.actions.dispose();
});

for (const shareError of ['AbortError', 'NotAllowedError', 'DataError']) test(`share ${shareError} never triggers an automatic download`, async () => {
    const f = fixture({shareError}); await assert.rejects(f.actions.share(), error => error.name === shareError);
    assert.deepEqual(f.calls, ['share']); f.actions.dispose();
});

test('unavailable native actions are explicit and do not choose another export', async () => {
    const f = fixture({share: false, picker: false}); assert.equal(f.actions.canSave(), false); assert.equal(f.actions.canShare(), false);
    await assert.rejects(f.actions.save(), error => error.name === 'NotSupportedError');
    await assert.rejects(f.actions.share(), error => error.name === 'NotSupportedError');
    assert.deepEqual(f.calls, []); f.actions.dispose();
});
