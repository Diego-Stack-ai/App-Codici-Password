// Owns command listeners, not the authenticated session or its credentials.
export function createShellCommands({session, signIn, getSelectedRoute, navigateList,
    controls, setBusy, clearMessage, showError, refreshControls}) {
    const bound = [];
    let current = null, disposed = false;
    const valid = attempt => !disposed && attempt.valid;
    const report = error => {if (!disposed) {try {showError(error);} catch { /* Observer boundary. */ }}};
    function dispose() {
        if (disposed) return;
        disposed = true;
        if (current) current.valid = false;
        for (const [target, handler] of bound.splice(0)) target.removeEventListener('click', handler);
    }
    async function run(action) {
        if (disposed || current) return;
        const attempt = {valid: true};
        current = attempt;
        try {
            setBusy(true); clearMessage(); refreshControls();
            if (valid(attempt)) await action(attempt);
        } catch (error) {if (valid(attempt)) report(error);}
        finally {
            current = null;
            // A lock invalidates continuation, not the physical single-flight.
            // Release busy only when the outstanding operation actually settles.
            if (!disposed) {
                try {setBusy(false);} catch (error) {report(error);}
                if (!disposed) {try {refreshControls();} catch (error) {report(error);}}
            }
        }
    }
    const handlers = {
        login: () => {void run(async attempt => {
            await signIn();
            if (valid(attempt)) await session.navigate(getSelectedRoute());
        });},
        unlock: () => {void run(async attempt => {
            await session.unlock();
            if (valid(attempt)) await session.navigate(getSelectedRoute());
        });},
        logout: () => {void run(() => session.logout());},
        lock: () => {
            if (disposed) return;
            if (current) current.valid = false;
            try {session.lock();} catch (error) {report(error);}
        }
    };
    for (const route of ['private', 'profile', 'companies', ...(controls.resume ? ['resume'] : [])]) handlers[route] = () => {
        if (disposed) return;
        // Routes retain their existing independence from authentication commands.
        try {Promise.resolve(navigateList(route)).catch(report);} catch (error) {report(error);}
    };
    try {
        for (const [name, handler] of Object.entries(handlers)) {
            const target = controls[name];
            if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
                throw new TypeError(`Invalid shell control: ${name}`);
            }
            bound.push([target, handler]);
            target.addEventListener('click', handler);
        }
    } catch (error) {dispose(); throw error;}
    return Object.freeze({dispose});
}
