import {assertLoopback, fail} from './c1-e2e-contract.mjs';

const guardedContexts = new WeakMap();
// Local prototype. No login, cloud operations, fallback unlock or account mutations.
// Selectors follow the published app; the fixture is NOT proof about production.
export async function createLocalC1Driver(page) {
  const origin = assertLoopback(page.url());
  const context = page.context();
  if (guardedContexts.has(context) && guardedContexts.get(context) !== origin) fail('C1_LOCAL_ONLY');
  if (!guardedContexts.has(context)) {
    if (context.serviceWorkers().length) fail('C1_LOCAL_ONLY');
    await context.route('**/*', route => {
      let allowed = false;
      try { allowed = new URL(route.request().url()).origin === origin; } catch { /* Deny. */ }
      return allowed ? route.continue() : route.abort();
    });
    guardedContexts.set(context, origin);
  }
  const timeout = 3000;
  const assertOwner = () => {
    assertLoopback(page.url());
    const url = new URL(page.url());
    if (url.origin !== origin || url.pathname !== '/app.html') fail('C1_DESTINATION_WRONG');
  };
  const child = () => page.frameLocator('#vault-frame');
  const master = () => page.locator('#protocol-input-modal-input');
  async function destination(path, {query = '', hash = ''} = {}) {
    assertOwner();
    if (await master().isVisible()) fail('C1_CONTINUITY_BROKEN');
    try {
      await page.waitForFunction(({path, query, hash}) => {
        const frame = document.querySelector('#vault-frame');
        return frame && !frame.hidden && !frame.inert &&
          frame.contentWindow.location.pathname === '/' + path &&
          frame.contentWindow.location.search === query &&
          frame.contentWindow.location.hash === hash &&
          !!frame.contentDocument.querySelector('main');
      }, {path, query, hash}, {timeout});
    } catch { fail('C1_DESTINATION_WRONG'); }
    if (await master().isVisible()) fail('C1_CONTINUITY_BROKEN');
    assertOwner();
    if (new URL(page.url()).searchParams.get('route') !== '/' + path + query + hash) fail('C1_DESTINATION_WRONG');
  }
  async function click(selector, path, options) {
    assertOwner();
    if (await master().isVisible()) fail('C1_CONTINUITY_BROKEN');
    await child().locator(selector).click({timeout});
    await destination(path, options);
  }
  async function history(action, path, options) {
    assertOwner();
    if (action === 'back') await page.goBack({waitUntil:'domcontentloaded'});
    else if (action === 'forward') await page.goForward({waitUntil:'domcontentloaded'});
    else fail('C1_OPTIONS_INVALID');
    await destination(path, options);
  }
  return Object.freeze({
    destination,
    async navigationCore() {
      await destination('home_page.html');
      await click('a[href="area_privata.html"]', 'area_privata.html');
      await click('a[href="account_privati.html?type=standard"]', 'account_privati.html', {query:'?type=standard'});
    },
    async historyCore() {
      await destination('account_privati.html', {query:'?type=standard'});
      await history('back', 'area_privata.html');
      await history('forward', 'account_privati.html', {query:'?type=standard'});
      await click('#header-left .btn-icon-header', 'area_privata.html');
    },
    async reloadOwner(unlockOnce) {
      assertOwner();
      if (typeof unlockOnce !== 'function') fail('C1_OPTIONS_INVALID');
      const before = await page.locator('#vault-frame').evaluate(frame =>
        ({path:frame.contentWindow.location.pathname.slice(1), query:frame.contentWindow.location.search, hash:frame.contentWindow.location.hash}));
      await page.reload({waitUntil:'domcontentloaded'});
      try { await master().waitFor({state:'visible',timeout}); }
      catch { fail('C1_UNLOCK_MISSING'); }
      assertOwner();
      await unlockOnce(page);
      await destination(before.path, {query:before.query,hash:before.hash});
      // One post-unlock event turn catches a repeat dialog; no automatic resubmission.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if (await master().isVisible()) fail('C1_UNLOCK_REPEATED');
    }
  });
}
