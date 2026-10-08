import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyPdfActions} from './company-summary-browser.mjs';
function fixture(extra = {}) {
    let shared = 0, clicked = 0; const revoked = [];
    const anchor = {click() {clicked++;}, remove() {}, removeAttribute() {}};
    const actions = createCompanyPdfActions({assertActive() {}, navigatorApi: {canShare: () => true, share(value) {shared++; assert.equal(value.files[0].type, 'application/pdf'); return Promise.resolve();}},
        documentApi: {createElement: () => anchor, body: {append() {}}}, urlApi: {createObjectURL: () => 'blob:synthetic', revokeObjectURL: url => revoked.push(url)}, ...extra});
    return {actions, revoked, get shared() {return shared;}, get clicked() {return clicked;}};
}
test('share is called synchronously with a PDF file and download URLs are revoked on exit', async () => {
    const f = fixture(), bytes = new Uint8Array([1, 2]); assert.equal(f.actions.canShare(bytes), true);
    const promise = f.actions.share(bytes); assert.equal(f.shared, 1); await promise;
    f.actions.download(bytes); assert.equal(f.clicked, 1); f.actions.dispose();
    assert.deepEqual(f.revoked, ['blob:synthetic']); assert.throws(() => f.actions.download(bytes));
});
test('unsupported native file sharing leaves the download fallback available', () => {
    const f = fixture({navigatorApi: {}}); assert.equal(f.actions.canShare(new Uint8Array([1])), false);
    f.actions.download(new Uint8Array([1])); assert.equal(f.clicked, 1); f.actions.dispose();
});
test('disposal during lazy generator loading prevents later font reads or generation', async () => {
    let release, fetched = false, generated = false;
    const f = fixture({loadGenerator: () => new Promise(resolve => {release = resolve;}), fetchImpl: async () => {fetched = true;}});
    const pending = f.actions.generate({}); const rejected = assert.rejects(pending, /VIEW_DISPOSED/);
    f.actions.dispose(); release({generateCompanySummaryPdf() {generated = true;}}); await rejected;
    assert.equal(fetched, false); assert.equal(generated, false);
});
