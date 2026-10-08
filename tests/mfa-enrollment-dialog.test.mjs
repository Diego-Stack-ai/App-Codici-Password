import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const source = await readFile(new URL('../Frontend/public/assets/js/modules/core/mfa-manager.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('function requestEnrollmentCode('), source.indexOf('export async function enrollTotp('));
const qrSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/qr_code_utils.js', import.meta.url), 'utf8');
const qrBody = qrSource.slice(qrSource.indexOf('export function renderQRCode(')).replace('export function', 'function');
test('enrollment cannot continue after the current Auth user changes across an await', async () => {
  const enrollmentBody = source.slice(source.indexOf('export async function enrollTotp('), source.indexOf('export async function unenrollTotp(')).replace('export async', 'async');
  for (const boundary of ['session', 'secret', 'dialog', 'enroll', 'unchanged']) {
    let writes = 0, refreshes = 0, dialogs = 0;
    const user = {uid: 'synthetic', emailVerified: true, email: 'synthetic@example.invalid', getIdToken: async () => {refreshes++;}};
    const auth = {currentUser: user};
    const change = phase => {if (phase === boundary) auth.currentUser = {...user};};
    const context = {auth, getTotpEnrollment: () => null,
      multiFactor: () => ({getSession: async () => {change('session'); return {};}, enroll: async () => {writes++; change('enroll');}}),
      TotpMultiFactorGenerator: {generateSecret: async () => {change('secret'); return {secretKey: 'synthetic', generateQrCodeUrl: () => 'synthetic-uri'};}, assertionForEnrollment: () => ({})},
      requestEnrollmentCode: async () => {dialogs++; change('dialog'); return '123456';}};
    const enroll = vm.compileFunction(`${enrollmentBody}; return enrollTotp;`, Object.keys(context))(...Object.values(context));
    if (boundary === 'unchanged') assert.equal(await enroll(user), true);
    else await assert.rejects(enroll(user), /Sessione cambiata/);
    assert.equal(writes, ['enroll', 'unchanged'].includes(boundary) ? 1 : 0);
    assert.equal(refreshes, boundary === 'unchanged' ? 1 : 0);
    if (['session', 'secret'].includes(boundary)) assert.equal(dialogs, 0);
  }
});
test('bundled QR encoder round-trips the exact synthetic TOTP URI through an independent decoder', async () => {
  const require = createRequire(import.meta.url);
  const Decoder = require('@zxing/library/cjs/core/qrcode/decoder/Decoder').default;
  const BitMatrix = require('@zxing/library/cjs/core/common/BitMatrix').default;
  const vendor = await readFile(new URL('../Frontend/public/assets/js/vendor/qrcode.min.js', import.meta.url), 'utf8');
  const context = {navigator: {userAgent: 'synthetic-node'}, document: {documentElement: {tagName: 'html'}}};
  vm.runInNewContext(vendor, context);
  let model;
  function QRCode(container, options) {model = new context.QRCode(container, options)._oQRCode;}
  QRCode.CorrectLevel = context.QRCode.CorrectLevel;
  const render = vm.compileFunction(`${qrBody}; return renderQRCode;`, ['QRCode'])(QRCode);
  for (const label of ['Synthetic:test', encodeURIComponent('Codici & Password:prova@example.invalid')]) {
    const uri = `otpauth://totp/${label}?secret=JBSWY3DPEHPK3PXP&issuer=Synthetic&algorithm=SHA1&digits=6&period=30`;
    const container = {querySelectorAll: () => [], childNodes: [{offsetWidth: 210, offsetHeight: 210, style: {}}]};
    render(container, uri, {exactText: true, correctLevel: 2, width: 210, height: 210});
    const size = model.getModuleCount(), matrix = new BitMatrix(size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (model.isDark(y, x)) matrix.set(x, y);
    assert.equal(new Decoder().decodeBitMatrix(matrix).getText(), uri);
    assert.equal(container.title, uri);
  }
});
test('TOTP QR renderer preserves the exact URI and does not retry or log encoder errors', () => {
  const uri = 'otpauth://totp/Synthetic:test?secret=SYNTHETICONLY&issuer=Synthetic';
  for (const fail of [false, true]) {
    let calls = 0, logs = 0;
    function QRCode(_container, options) {
      calls++;
      assert.equal(options.text, uri);
      assert.equal(options.correctLevel, 0);
      if (fail) throw Error('SYNTHETIC_ENCODING_FAILURE');
    }
    const render = vm.compileFunction(`${qrBody}; return renderQRCode;`, ['QRCode', 'console'])(QRCode, {error: () => {logs++;}});
    const invoke = () => render({querySelectorAll: () => []}, uri, {exactText: true, correctLevel: 0});
    if (fail) assert.throws(invoke, /SYNTHETIC_ENCODING_FAILURE/); else invoke();
    assert.equal(calls, 1); assert.equal(logs, 0);
  }
});
test('exact QR mode fails explicitly when the loaded script did not expose QRCode', () => {
  const render = vm.compileFunction(`${qrBody}; return renderQRCode;`, ['QRCode'])(undefined);
  assert.throws(() => render({}, 'synthetic', {exactText: true}), /QR non disponibile/);
  assert.doesNotThrow(() => render({}, 'synthetic'));
});
function fixture(load, render = () => {}) {
  const nodes = [];
  let renders = 0;
  let observer, unsubscribed = 0;
  const createElement = (tag, props = {}, children = []) => {
    const node = {...props, children, value: '', removed: false, remove() {this.removed = true;}, focus() {}, setCustomValidity() {},
      replaceChildren(...values) {this.children = values;}, removeAttribute(name) {delete this[name];}};
    nodes.push(node); return node;
  };
  const context = {createElement, setChildren() {}, document: {body: {appendChild() {}}},
    auth: {currentUser: {uid: 'synthetic'}},
    onAuthStateChanged: (_auth, callback) => {observer = callback; return () => {unsubscribed++;};},
    ensureQRCodeLib: load, renderQRCode: (target, uri, options) => {assert.equal(options.exactText, true); target.title = uri; target.children = ['synthetic-qr']; renders++; render();}};
  const open = vm.compileFunction(`${body}; return requestEnrollmentCode;`, Object.keys(context))(...Object.values(context));
  return {open, nodes, renders: () => renders, changeUser: user => observer(user), unsubscribed: () => unsubscribed};
}
test('Auth change closes the enrollment dialog before QR loading finishes and unsubscribes', async () => {
  let done;
  const f = fixture(() => new Promise(resolve => {done = resolve;}));
  const result = f.open('synthetic-uri', 'synthetic-secret');
  await Promise.resolve();
  f.changeUser(null);
  await assert.rejects(result, /Sessione cambiata/);
  assert.equal(f.unsubscribed(), 1);
  assert.equal(f.nodes.find(node => node.className === 'mfa-secret').textContent, '');
  assert.equal(f.nodes.find(node => node.id === 'mfa-enrollment-modal').removed, true);
  done();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.renders(), 0);
});
test('QR loading or rendering failure rejects enrollment and removes the secret dialog', async () => {
  for (const mode of ['load', 'render']) {
    const f = fixture(() => mode === 'load' ? Promise.reject(Error('SYNTHETIC_QR')) : Promise.resolve(),
      () => {throw Error('SYNTHETIC_QR');});
    await assert.rejects(f.open('synthetic-uri', 'synthetic-secret'), /SYNTHETIC_QR/);
    assert.equal(f.nodes.find(node => node.id === 'mfa-enrollment-modal').removed, true);
    assert.equal(f.nodes.find(node => node.className === 'mfa-secret').textContent, '');
    assert.deepEqual(f.nodes.find(node => node.id === 'mfa-qr-target').children, []);
    assert.equal(f.nodes.find(node => node.id === 'mfa-qr-target').title, undefined);
  }
});
test('cancel during QR loading settles once and suppresses late rendering or rejection', async () => {
  for (const fails of [false, true]) {
    let resolve, reject;
    const loading = new Promise((yes, no) => {resolve = yes; reject = no;});
    const f = fixture(() => loading);
    const result = f.open('synthetic-uri', 'synthetic-secret');
    f.nodes.find(node => node.textContent === 'Annulla').onclick();
    assert.equal(await result, null);
    if (fails) reject(Error('SYNTHETIC_QR')); else resolve();
    await new Promise(done => setImmediate(done));
    assert.equal(f.renders(), 0);
    assert.equal(f.nodes.find(node => node.id === 'mfa-enrollment-modal').removed, true);
  }
});
test('successful QR setup accepts a six digit code and removes the dialog', async () => {
  const f = fixture(() => Promise.resolve());
  const result = f.open('synthetic-uri', 'synthetic-secret');
  await new Promise(done => setImmediate(done));
  assert.equal(f.renders(), 1);
  const input = f.nodes.find(node => node.id === 'mfa-enrollment-code');
  const button = f.nodes.find(node => node.textContent === 'Attiva 2FA');
  input.value = 'invalid'; button.onclick();
  assert.equal(f.nodes.find(node => node.id === 'mfa-enrollment-modal').removed, false);
  input.value = '123456'; button.onclick();
  assert.equal(await result, '123456');
  assert.equal(input.value, '');
  assert.equal(f.nodes.find(node => node.className === 'mfa-secret').textContent, '');
  assert.deepEqual(f.nodes.find(node => node.id === 'mfa-qr-target').children, []);
  assert.equal(f.nodes.find(node => node.id === 'mfa-qr-target').title, undefined);
  assert.equal(f.nodes.find(node => node.id === 'mfa-enrollment-modal').removed, true);
});
