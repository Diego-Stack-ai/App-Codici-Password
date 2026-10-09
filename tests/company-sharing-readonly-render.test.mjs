import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const source = (await readFile(new URL('azienda/dettaglio-azienda-sharing.js', modules), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');

function fixture() {
    let active = true;
    const classes = new Set(['hidden']);
    const list = {children: [], appendChild(node) { this.children.push(node); }};
    const section = {classList: {toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }}};
    const context = vm.createContext({
        createElement: (tag, props, children) => ({tag, ...props, children}),
        clearElement: node => { node.children = []; },
        document: {getElementById: id => id === 'guests-list' ? list : section}
    });
    vm.runInContext(source, context);
    context.initSharingModule({isActive: () => active});
    return {context, list, classes, expire: () => { active = false; }};
}

test('mappa canonica mostra soltanto i nomi di pending e accepted', () => {
    const f = fixture();
    const account = {visibility: 'shared', sharedWith: {
        a: {email: 'accepted@example.invalid', status: 'accepted'},
        p: {email: 'pending@example.invalid', status: 'pending'},
        r: {email: 'rejected@example.invalid', status: 'rejected'},
        s: {email: 'suspended@example.invalid', status: 'suspended'}
    }};
    const names = new Map([['accepted@example.invalid', 'Accettato Sintetico'], ['pending@example.invalid', 'In attesa Sintetico']]);
    f.context.renderSharingMap(account, names);
    assert.deepEqual(f.list.children.map(item => item.children[0].textContent), ['Accettato Sintetico', 'In attesa Sintetico']);
    assert.equal(f.classes.has('hidden'), false);
    const rendered = JSON.stringify(f.list.children);
    assert.doesNotMatch(rendered, /@|status_|revoke|action/i);
});

test('array legacy resta visualizzabile senza scritture o lookup inviti', async () => {
    const f = fixture();
    const guests = ['legacy@example.invalid'];
    await f.context.renderGuests(guests, new Map([['legacy@example.invalid', 'Legacy Sintetico']]));
    assert.deepEqual(guests, ['legacy@example.invalid']);
    assert.equal(f.list.children[0].children[0].textContent, 'Legacy Sintetico');
});

test('una vista scaduta non esegue rendering tardivo', () => {
    const f = fixture();
    f.expire();
    f.context.renderSharingMap({visibility: 'shared', sharedWith: {a: {email: 'late@example.invalid', status: 'accepted'}}});
    assert.equal(f.list.children.length, 0);
});

test('il modulo non contiene percorsi mutanti', () => {
    assert.doesNotMatch(source, /runTransaction|updateDoc|setDoc|deleteDoc|showConfirmModal|revokeRecipient|inviteIdForGuest/);
});
