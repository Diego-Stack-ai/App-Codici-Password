// The caller owns the dialog. No credential is retained after settlement.
export function requestMaster(dialog, {signal}) {
    return new Promise((resolve, reject) => {
        const form = dialog.querySelector('form');
        const input = dialog.querySelector('input');
        const cancelButton = dialog.querySelector('[data-cancel-master]');
        function finish(error, value) {
            form.removeEventListener('submit', submit);
            dialog.removeEventListener('cancel', cancel);
            cancelButton.removeEventListener('click', cancel);
            signal.removeEventListener('abort', abort);
            input.value = '';
            dialog.close();
            if (error) reject(error); else resolve(value);
        }
        function submit(event) { event.preventDefault(); finish(null, input.value); }
        function cancel(event) { event.preventDefault(); finish(new Error('UNLOCK_CANCELLED')); }
        function abort() { finish(new Error('UNLOCK_CANCELLED')); }
        if (signal.aborted) { reject(new Error('UNLOCK_CANCELLED')); return; }
        form.addEventListener('submit', submit);
        dialog.addEventListener('cancel', cancel);
        cancelButton.addEventListener('click', cancel);
        signal.addEventListener('abort', abort, {once: true});
        input.value = '';
        dialog.showModal();
        input.focus();
    });
}
