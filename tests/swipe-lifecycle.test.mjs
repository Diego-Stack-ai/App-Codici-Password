import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../Frontend/public/assets/js/', import.meta.url);
const source = await readFile(new URL('swipe-list-v6.js', root), 'utf8');
const listSource = await readFile(new URL('modules/shared/account-list-view.js', root), 'utf8');
const events = ['touchstart', 'touchmove', 'touchend', 'mousedown', 'mousemove', 'mouseup', 'click'];

function fixture() {
    const document = new EventTarget(), timers = new Set();
    const container = {};
    document.getElementById = () => container;
    const context = vm.createContext({
        document, AbortController, crypto, LOG() {}, logError() {}, showToast() {},
        setTimeout: callback => {
            const timer = () => { timers.delete(timer); callback(); };
            timers.add(timer); return timer;
        },
        clearTimeout: callback => timers.delete(callback),
        createElement: (tag, props, children) => ({tag, props, children}),
        setChildren: (target, children) => { target.children = children; },
        clearElement: target => { target.children = []; },
        t: value => value,
        accountModeFromRecord: () => 'account-private',
        createCardSecretResolver: () => async () => 'fixture',
    });
    vm.runInContext(source.replace(/^\uFEFF/, '').replace(/^import .*;$/gm, '').replace('export class', 'class'), context);
    vm.runInContext(listSource.replace(/^import .*;$/gm, '').replace('export function', 'function'), context);
    return {document, timers, context, run: code => vm.runInContext(code, context)};
}

test('initialization/remount has one listener per event; destroy removes all seven', () => {
    const f = fixture();
    const swipe = f.run("new SwipeList('.fixture')");
    swipe.init(); swipe.init();
    for (const name of events) assert.equal(getEventListeners(f.document, name).length, 1);
    swipe.destroy(); swipe.destroy();
    for (const name of events) assert.equal(getEventListeners(f.document, name).length, 0);
});

test('repeated real account-list rendering and empty search do not accumulate handlers', () => {
    const f = fixture();
    const view = f.run("createAccountListView({themes: {standard: {}}, getSubtitle: () => 'fixture'})");
    for (let n = 0; n < 20; n++) view.render([{id: 'fixture', nomeAccount: 'Demo'}]);
    for (const name of events) assert.equal(getEventListeners(f.document, name).length, 1);
    view.render([]);
    for (const name of events) assert.equal(getEventListeners(f.document, name).length, 0);
    view.render([{id: 'fixture'}]);
    view.destroy();
    for (const name of events) assert.equal(getEventListeners(f.document, name).length, 0);
});

test('destroy cancels pending swipe callbacks before any record action', () => {
    const f = fixture();
    let mutations = 0;
    f.context.onSwipeLeft = () => mutations++;
    const swipe = f.run("new SwipeList('.fixture', {onSwipeLeft})");
    const item = {style: {}, querySelector: () => ({style: {}}), remove() {}};
    swipe.completeSwipe(item, 'left');
    assert.equal(f.timers.size, 1);
    swipe.destroy();
    for (const callback of f.timers) callback();
    assert.equal(f.timers.size, 0);
    assert.equal(mutations, 0);
});

test('active swipe still calls its action exactly once', () => {
    const f = fixture();
    let mutations = 0;
    f.context.onSwipeLeft = () => mutations++;
    const swipe = f.run("new SwipeList('.fixture', {onSwipeLeft})");
    const item = {style: {}, querySelector: () => ({style: {}}), remove() {}};
    swipe.completeSwipe(item, 'left');
    for (const callback of [...f.timers]) callback();
    assert.equal(mutations, 1);
    swipe.destroy();
    assert.equal(f.timers.size, 0);
});

test('destroy prevents a pending reveal from writing plaintext into the old card', async () => {
    const f = fixture();
    let resolve;
    const pending = new Promise(yes => { resolve = yes; });
    f.context.createCardSecretResolver = () => () => pending;
    const view = f.run("createAccountListView({themes: {standard: {}}, getSubtitle: () => 'fixture'})");
    view.render([{id: 'fixture', password: 'ciphertext', _encrypted: true}]);
    function find(nodes) {
        for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
            if (node?.tag === 'button' && node.children?.[0]?.props.textContent === 'visibility') return node;
            const nested = node?.children && find(node.children);
            if (nested) return nested;
        }
    }
    const button = find(f.document.getElementById().children);
    const value = {textContent: '••••••••'}, icon = {};
    f.document.getElementById = () => value;
    const revealing = button.props.onclick({stopPropagation() {}, currentTarget: {querySelector: () => icon}});
    view.destroy();
    resolve('must-not-be-shown');
    await revealing;
    assert.equal(value.textContent, '••••••••');
    assert.equal(icon.textContent, undefined);
});
