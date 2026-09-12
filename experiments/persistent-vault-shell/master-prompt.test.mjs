import test from 'node:test';
import assert from 'node:assert/strict';
import {requestMaster} from './master-prompt.mjs';
function fixture() {
    const dialog = new EventTarget(), form = new EventTarget(), cancelButton = new EventTarget();
    const input = {value: '', focus() {}};
    dialog.querySelector = selector => ({form, input, '[data-cancel-master]': cancelButton})[selector];
    dialog.showModal = () => { dialog.open = true; };
    dialog.closeCount = 0;
    dialog.close = () => { dialog.open = false; dialog.closeCount++; };
    return {dialog, form, input, cancelButton};
}
test('submit returns the value once, then clears input and closes dialog', async () => {
    const {dialog, form, input} = fixture();
    const controller = new AbortController();
    const result = requestMaster(dialog, {signal: controller.signal});
    input.value = 'synthetic-master'; form.dispatchEvent(new Event('submit', {cancelable: true}));
    assert.equal(await result, 'synthetic-master'); assert.equal(input.value, ''); assert.equal(dialog.open, false);
    const next = requestMaster(dialog, {signal: new AbortController().signal});
    controller.abort(); assert.equal(dialog.open, true);
    input.value = 'second'; form.dispatchEvent(new Event('submit'));
    assert.equal(await next, 'second');
});
for (const action of ['abort', 'cancel']) test(`${action} rejects and removes entered secret`, async () => {
    const {dialog, input} = fixture(), controller = new AbortController();
    const result = requestMaster(dialog, {signal: controller.signal}); input.value = 'synthetic-master';
    if (action === 'abort') controller.abort(); else dialog.dispatchEvent(new Event('cancel', {cancelable: true}));
    await assert.rejects(result, /UNLOCK_CANCELLED/);
    assert.equal(input.value, ''); assert.equal(dialog.open, false);
});
test('already aborted requests do not open a dialog', async () => {
    const {dialog} = fixture(), controller = new AbortController(); controller.abort();
    await assert.rejects(requestMaster(dialog, {signal: controller.signal}), /UNLOCK_CANCELLED/);
    assert.notEqual(dialog.open, true);
});

test('cancel button clears the secret and leaves no listeners affecting a later prompt', async () => {
    const {dialog, input, cancelButton} = fixture(), controller = new AbortController();
    const result = requestMaster(dialog, {signal: controller.signal});
    input.value = 'synthetic-master';
    const click = new Event('click', {cancelable: true});
    cancelButton.dispatchEvent(click);
    await assert.rejects(result, /UNLOCK_CANCELLED/);
    assert.equal(click.defaultPrevented, true);
    assert.equal(input.value, '');
    assert.equal(dialog.open, false);
    assert.equal(dialog.closeCount, 1);

    // A late event from the old request must not affect the next dialog.
    const next = requestMaster(dialog, {signal: new AbortController().signal});
    input.value = 'second-master';
    controller.abort();
    assert.equal(dialog.open, true);
    assert.equal(input.value, 'second-master');
    assert.equal(dialog.closeCount, 1);
    cancelButton.dispatchEvent(new Event('click', {cancelable: true}));
    await assert.rejects(next, /UNLOCK_CANCELLED/);
    assert.equal(input.value, '');
    assert.equal(dialog.open, false);
    assert.equal(dialog.closeCount, 2, 'only the current click listener may close the dialog');
    cancelButton.dispatchEvent(new Event('click'));
    assert.equal(dialog.closeCount, 2, 'settlement removes the final click listener');
});
