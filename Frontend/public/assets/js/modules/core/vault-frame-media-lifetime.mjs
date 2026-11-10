// Lifecycle only: no key, preference, persistence or independent session timer.
export function createFrameMediaLifetime({window: win, document: doc, signal: parentSignal,
  stopWhenHidden = true, isCurrent = () => true} = {}) {
  const controller = new AbortController(), removers = [];
  let disposed = false;
  const cancel = () => {if (!controller.signal.aborted) controller.abort();};
  const listen = (target, name, callback) => {target.addEventListener(name, callback); removers.push(() => target.removeEventListener(name, callback));};
  const valid = () => !disposed && !controller.signal.aborted && win.document === doc && isCurrent() && (!stopWhenHidden || !doc.hidden);
  for (const name of ['pagehide', 'vault-session-locked', 'private-auth-blocked']) listen(win, name, cancel);
  listen(doc, 'freeze', cancel);
  if (stopWhenHidden) listen(doc, 'visibilitychange', () => {if (doc.hidden) cancel();});
  if (parentSignal) {listen(parentSignal, 'abort', cancel); if (parentSignal.aborted) cancel();}
  if (!valid()) cancel();
  return Object.freeze({signal: controller.signal, valid, cancel, dispose() {
    if (disposed) return; disposed = true; cancel(); for (const remove of removers) remove();
  }});
}
