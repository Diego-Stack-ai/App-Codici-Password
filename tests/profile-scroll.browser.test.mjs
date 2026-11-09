import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

const cssRoot = fileURLToPath(new URL('../Frontend/public/assets/css/', import.meta.url));
const stylesheet = name => readFile(path.join(cssRoot, name), 'utf8');
const publicRoot = new URL('../Frontend/public/', import.meta.url);
const launchBrowser = () => chromium.launch({headless: true,
  ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH}
    : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});
const pageSource = name => readFile(new URL(name, publicRoot), 'utf8');
const fixtureStyles = async (name = 'profilo_privato.html') => {
  const html = await pageSource(name);
  const names = [...html.matchAll(/<link\b[^>]*href="assets\/css\/([^"?]+)(?:\?[^"\s]*)?"[^>]*>/g)].map(match => match[1]);
  assert.ok(names.includes('core_fascie.css') && names.includes('profile-layout.css'));
  return (await Promise.all(names.map(stylesheet))).join('\n').replace(/url\([^)]*\)/g, 'none');
};

test('real CSS token colors remain valid after channel expansion and controls retain their backgrounds', {timeout: 30000}, async () => {
  const sources = await Promise.all((await readdir(cssRoot)).filter(name => name.endsWith('.css')).map(stylesheet));
  const colors = sources.flatMap(source => source.match(/rgba?\(var\(--accent-rgb(?:,[^)]*)?\)\s*[,/]\s*[\d.%]*\s*\)/g) || []);
  assert.ok(colors.length >= 110, 'exercise the app color declarations, not an empty fixture');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    for (const dark of [false, true]) {
      await page.setContent(`<!doctype html><html class="${dark ? 'dark' : ''}"><head><style>${await fixtureStyles()}</style></head><body><button class="btn-upload-trigger">Aggiungi numero</button><button class="btn-edit-section">Modifica</button><button class="btn-action-mini">Copia</button></body></html>`);
      const result = await page.evaluate(values => {
        const channels = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
        return {
          invalid: values.filter(value => !CSS.supports('color', value.replace(/var\(--accent-rgb(?:,[^)]*)?\)/g, channels))),
          controls: [...document.querySelectorAll('button')].map(button => getComputedStyle(button).backgroundColor),
        };
      }, colors);
      assert.deepEqual(result.invalid, [], dark ? 'dark color expansion' : 'light color expansion');
      for (const background of result.controls) {
        assert.notEqual(background, 'rgba(0, 0, 0, 0)');
        assert.notEqual(background, 'transparent');
      }
    }
  } finally { await browser.close(); }
});

for (const [name, label] of [['profilo_privato.html', 'private profile'], ['dati_azienda.html', 'company profile']]) {
test(`${label} tabs follow the shared header height and cover scrolled section actions`, {timeout: 45000}, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    const source = await pageSource(name);
    const nav = source.match(/<nav\b[^>]*class="[^"]*\bprofile-tabs\b[^"]*"[^>]*>[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav, 'use the navigation markup from the real page');
    const bodyClass = source.match(/<body\b[^>]*class="([^"]+)"/)?.[1];
    for (const viewport of [{width: 393, height: 852}, {width: 1280, height: 900}]) {
    await page.setViewportSize(viewport);
    for (const dark of [false, true]) for (const headerHeight of [85, 100]) {
      const content = ['Contatti Telefonici', 'Indirizzi & Utenze', '2 allegati'].map((label, i) =>
        `<section class="form-section"><div class="form-section-header"><h3>${label}</h3></div><button id="add-${i}" class="btn-upload-trigger${i === 2 ? ' profile-document-add-trigger' : ''}">Aggiungi ${i}</button><div style="height:900px">Dati sintetici</div></section>`).join('');
      await page.setContent(`<!doctype html><html class="${dark ? 'dark' : ''}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${await fixtureStyles(name)}</style></head><body class="${bodyClass}"><div class="base-container"><header class="base-header"><div class="header-balanced-container"><h1>${label}</h1></div></header><main class="base-main"><div class="page-container pt-header-extra pb-footer-extra"><div class="hero-profile-header"><div style="height:220px">Profilo sintetico</div></div>${nav}<div class="detail-content-wrap">${content}</div></div></main><footer class="base-footer"></footer></div></body></html>`);
      if (headerHeight !== 85) await page.evaluate(height => document.documentElement.style.setProperty('--header-height', `${height}px`), headerHeight);
      assert.equal(await page.locator('.base-header').evaluate(header => header.getBoundingClientRect().height), headerHeight);
      for (const top of [300, 600, 1000]) {
        await page.evaluate(scrollTop => {
          const main = document.querySelector('.base-main');
          const scroller = getComputedStyle(main).overflowY === 'auto' ? main : document.scrollingElement;
          scroller.scrollTop = scrollTop;
        }, top);
        const geometry = await page.evaluate(() => {
          const nav = document.querySelector('.profile-tabs');
          const rect = nav.getBoundingClientRect();
          const header = document.querySelector('.base-header').getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return {headerBottom: header.bottom, tabsTop: rect.top, tabsBottom: rect.bottom,
            background: getComputedStyle(nav).backgroundColor, tabsInFront: nav.contains(hit),
            mainScroll: document.querySelector('.base-main').scrollTop,
            documentScroll: document.scrollingElement.scrollTop};
        });
        assert.ok(geometry.mainScroll > 0 || geometry.documentScroll > 0, 'the fixture must actually scroll');
        assert.ok(geometry.tabsTop >= geometry.headerBottom - 1, JSON.stringify(geometry));
        assert.notEqual(geometry.background, 'rgba(0, 0, 0, 0)');
        assert.equal(geometry.tabsInFront, true, 'section actions must not cover the tabs');
        if (viewport.width === 393) assert.equal(geometry.documentScroll, 0, 'keep the existing single mobile scroll container');
      }
      await page.evaluate(() => {
        const main = document.querySelector('.base-main');
        const scroller = getComputedStyle(main).overflowY === 'auto' ? main : document.scrollingElement;
        const nav = document.querySelector('.profile-tabs').getBoundingClientRect();
        const button = document.querySelector('#add-2').getBoundingClientRect();
        scroller.scrollTop += (button.top + button.bottom - nav.top - nav.bottom) / 2;
      });
      const collision = await page.evaluate(() => {
        const nav = document.querySelector('.profile-tabs');
        const bar = nav.getBoundingClientRect();
        const action = document.querySelector('#add-2').getBoundingClientRect();
        const hit = document.elementFromPoint((action.left + action.right) / 2, (bar.top + bar.bottom) / 2);
        return {intersects: action.top < bar.bottom && action.bottom > bar.top, tabsInFront: nav.contains(hit), bar: bar.toJSON(), action: action.toJSON()};
      });
      assert.equal(collision.intersects, true, JSON.stringify({viewport, dark, headerHeight, collision}));
      assert.equal(collision.tabsInFront, true, 'the intersecting action must remain behind the tabs');
      await page.evaluate(() => {
        const main = document.querySelector('.base-main');
        const scroller = getComputedStyle(main).overflowY === 'auto' ? main : document.scrollingElement;
        scroller.scrollTop -= 120;
      });
      await page.locator('#add-2').scrollIntoViewIfNeeded();
      await page.locator('#add-2').click({trial: true});
    }
    }
  } finally { await browser.close(); }
});
}
