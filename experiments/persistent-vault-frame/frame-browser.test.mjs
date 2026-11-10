import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {startFrameLab} from './serve.mjs';
import {PRIVATE_FRAME_PATHS} from './frame-policy.mjs';

const launch = () => chromium.launch({headless: true,
  ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH}
    : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});
async function fixture(run) {
  const lab = await startFrameLab(); let browser;
  try {
    browser = await launch();
    const page = await browser.newPage(), external = [];
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === lab.origin) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    await page.goto(lab.origin + '/app.html');
    await run({page, lab, browser, child: () => page.frameLocator('#private-frame')});
    assert.deepEqual(external, [], 'the lab must not even attempt Firebase or external requests');
  } finally {try {await browser?.close();} finally {await lab.close();}}
}
const opened = async child => child.getByText('Accesso sintetico aperto', {exact: true}).waitFor();

test('real iframe: default DENY, ten documents, back/forward, reload and logout', {timeout: 60_000}, async () => {
  await fixture(async ({page, child}) => {
    await page.getByText('Fixture disabilitata · accesso negato', {exact: true}).waitFor();
    assert.equal(await page.locator('#unlocks').textContent(), '0');
    await page.locator('#enable').click(); await opened(child());
    for (const path of PRIVATE_FRAME_PATHS.slice(1)) {
      await child().getByRole('link', {name: path, exact: true}).click();
      await child().getByRole('heading', {name: path, exact: true}).waitFor(); await opened(child());
      assert.equal(new URL(page.url()).searchParams.get('route'), path);
    }
    assert.equal(await page.locator('#unlocks').textContent(), '1');
    for (const path of [PRIVATE_FRAME_PATHS.at(-2), PRIVATE_FRAME_PATHS.at(-3)]) {
      await page.goBack(); await child().getByRole('heading', {name: path, exact: true}).waitFor(); await opened(child());
      assert.equal(new URL(page.url()).searchParams.get('route'), path);
    }
    for (const path of [PRIVATE_FRAME_PATHS.at(-2), PRIVATE_FRAME_PATHS.at(-1)]) {
      await page.goForward(); await child().getByRole('heading', {name: path, exact: true}).waitFor(); await opened(child());
      assert.equal(new URL(page.url()).searchParams.get('route'), path);
    }
    assert.equal(await page.locator('#unlocks').textContent(), '1');
    const route = new URL(page.url()).searchParams.get('route');
    await page.reload();
    await page.getByText('Fixture disabilitata · accesso negato', {exact: true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('route'), route);
    assert.equal(await page.locator('#unlocks').textContent(), '0');
    await page.locator('#enable').click(); await opened(child());
    await page.locator('#logout').click();
    await page.getByText('Fixture disabilitata · accesso negato', {exact: true}).waitFor();
    await page.waitForFunction(() => document.querySelector('iframe').contentWindow.location.href === 'about:blank');
  });
});

test('direct links preserve allowed queries; child reload keeps continuity and a new tab has no session', {timeout: 45_000}, async () => {
  await fixture(async ({page, lab, browser, child}) => {
    for (const path of ['/dettaglio_account_privato.html?id=fixture-1', '/scadenze.html?filter=urgenti', '/profilo_privato.html?profileTab=digital-card']) {
      await page.goto(lab.origin + '/app.html?route=' + encodeURIComponent(path));
      await page.locator('#enable').click(); await opened(child());
      assert.equal(new URL(page.url()).searchParams.get('route'), path);
      assert.equal(await page.locator('iframe').evaluate(frame => frame.contentWindow.location.pathname + frame.contentWindow.location.search), path);
      const navigation = page.waitForEvent('framenavigated', {predicate: frame => frame.parentFrame() === page.mainFrame()});
      await page.locator('iframe').evaluate(frame => frame.contentWindow.location.reload());
      await navigation;
      await opened(child()); assert.equal(await page.locator('#unlocks').textContent(), '1');
      await page.reload(); await page.getByText('Fixture disabilitata · accesso negato', {exact: true}).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('route'), path);
    }
    await page.locator('#enable').click(); await opened(child());
    const other = await browser.newPage(); await other.goto(page.url());
    await other.getByText('Fixture disabilitata · accesso negato', {exact: true}).waitFor();
    assert.equal(await other.locator('#unlocks').textContent(), '0'); await other.close();
  });
});

test('same-route browser reload ignores the previous document READY and denied routes revoke access', {timeout: 45_000}, async () => {
  await fixture(async ({page, child}) => {
    await page.addInitScript(() => {
      if (parent !== window) addEventListener('message', event => {
        if (event.source === parent && event.origin === location.origin && event.data?.kind === 'ready') window.fixtureReady = event.data;
      });
    });
    await page.reload(); await page.locator('#enable').click(); await opened(child());
    const previous = await page.locator('iframe').evaluate(frame => frame.contentWindow.fixtureReady);
    assert.ok(previous?.childNonce);
    const navigation = page.waitForEvent('framenavigated', {predicate: frame => frame.parentFrame() === page.mainFrame()});
    await page.locator('iframe').evaluate(frame => frame.contentWindow.location.reload()); await navigation; await opened(child());
    const current = await page.locator('iframe').evaluate(frame => frame.contentWindow.fixtureReady);
    assert.notEqual(current.childNonce, previous.childNonce); assert.notEqual(current.documentNonce, previous.documentNonce);
    await page.locator('iframe').evaluate((frame, ready) => frame.contentWindow.postMessage(ready, location.origin), previous);
    // A stale READY must neither clear current material nor install its nonce.
    page.once('dialog', dialog => dialog.accept()); await child().locator('#sensitive').click();
    await child().getByText('Operazione sintetica autorizzata una volta', {exact: true}).waitFor();
    assert.equal(await page.locator('#unlocks').textContent(), '1');
    await page.locator('iframe').evaluate(frame => {frame.src = 'about:blank';});
    await page.getByText('Fixture abilitata · sessione bloccata', {exact: true}).waitFor();
  });
});

test('real iframe: both lock buttons retire the child; fresh confirmation cancels or authorizes one action', {timeout: 45_000}, async () => {
  await fixture(async ({page, child}) => {
    await page.locator('#enable').click(); await opened(child());
    page.once('dialog', dialog => dialog.dismiss()); await child().locator('#sensitive').click();
    await child().getByText('Operazione annullata o negata', {exact: true}).waitFor();
    page.once('dialog', dialog => dialog.accept()); await child().locator('#sensitive').click();
    await child().getByText('Operazione sintetica autorizzata una volta', {exact: true}).waitFor();
    assert.equal(await page.locator('#confirmations').textContent(), '2');
    for (const fromChild of [true, false]) {
      if (fromChild) await child().locator('#child-lock').click(); else await page.locator('#lock').click();
      await page.getByText('Fixture abilitata · sessione bloccata', {exact: true}).waitFor();
      await page.waitForFunction(() => document.querySelector('iframe').contentWindow.location.href === 'about:blank');
      await page.locator('#resume').click(); await opened(child());
    }
    assert.equal(await page.locator('#unlocks').textContent(), '3');
  });
});

test('lab headers deny external framing; material is absent from persisted data, URLs, DOM and logs', {timeout: 45_000}, async () => {
  await fixture(async ({page, lab, browser, child}) => {
    const logs = []; page.on('console', message => logs.push(message.text()));
    const root = await page.request.get(lab.origin + '/app.html');
    const privatePage = await page.request.get(lab.origin + PRIVATE_FRAME_PATHS[0]);
    assert.equal(root.status(), 200); assert.equal(privatePage.status(), 200);
    assert.equal(root.headers()['x-frame-options'], 'DENY');
    assert.match(root.headers()['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(privatePage.headers()['x-frame-options'], 'SAMEORIGIN');
    assert.match(privatePage.headers()['content-security-policy'], /frame-ancestors 'self'/);
    assert.equal((await page.request.get(lab.origin + '/unknown.html')).status(), 404);
    await page.locator('#enable').click(); await opened(child());
    const persisted = await page.evaluate(async () => ({
      local: {...localStorage}, session: {...sessionStorage}, cookies: document.cookie,
      databases: await indexedDB.databases(), caches: await caches.keys(), url: location.href,
      dom: document.documentElement.outerHTML, childDom: document.querySelector('iframe').contentDocument.documentElement.outerHTML,
    }));
    assert.deepEqual(persisted.local, {}); assert.deepEqual(persisted.session, {});
    assert.deepEqual(persisted.databases, []); assert.deepEqual(persisted.caches, []); assert.equal(persisted.cookies, '');
    assert.doesNotMatch(JSON.stringify(persisted) + logs.join('\n'), /synthetic-only-/);
    const attacker = await browser.newPage();
    await attacker.setContent(`<iframe src="${lab.origin}${PRIVATE_FRAME_PATHS[0]}"></iframe>`);
    await attacker.waitForLoadState('load');
    assert.equal(await attacker.frameLocator('iframe').locator('#access').count(), 0);
    await attacker.close();
  });
});
