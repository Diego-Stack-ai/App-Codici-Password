import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, mkdir} from 'node:fs/promises';
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

const recordVisual = async (page, name) => {
  if (!process.env.UI_OVERLAP_ARTIFACTS) return;
  await mkdir(process.env.UI_OVERLAP_ARTIFACTS, {recursive: true});
  await page.screenshot({path: path.join(process.env.UI_OVERLAP_ARTIFACTS, name + '.png'), animations: 'disabled'});
};

for (const [name, label] of [['profilo_privato.html', 'private profile'], ['dati_azienda.html', 'company profile']]) {
test(`${label} header occludes text and controls while scrolling`, {timeout: 120000}, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.emulateMedia({reducedMotion: 'reduce'});
    const source = await pageSource(name);
    const nav = source.match(/<nav\b[^>]*class="[^"]*\bprofile-tabs\b[^"]*"[^>]*>[\s\S]*?<\/nav>/)?.[0];
    const header = source.match(/<header\b[^>]*id="header-placeholder"[^>]*><\/header>/)?.[0];
    const bodyClass = source.match(/<body\b[^>]*class="([^"]+)"/)?.[1];
    assert.ok(nav && header);
    const controls = '<div class="header-balanced-container"><div class="header-left"><button id="header-action" class="btn-icon-header" aria-label="Indietro sintetico">←</button></div><h1 class="header-title">Profilo sintetico</h1><div class="header-right"><button class="btn-icon-header" aria-label="Home sintetica">⌂</button></div></div>';
    for (const viewport of [{width: 320, height: 852}, {width: 393, height: 852}, {width: 1280, height: 900}]) {
      await page.setViewportSize(viewport);
      for (const dark of [false, true]) for (const palette of ['blue', 'lavender']) {
        await page.setContent(`<!doctype html><html class="${dark ? 'dark' : ''}" data-color-theme="${palette}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${await fixtureStyles(name)}</style></head><body class="${bodyClass}"><div class="base-container">${header.replace('</header>', controls + '</header>')}<main class="base-main"><div class="page-container pt-header-extra pb-footer-extra"><div class="hero-profile-header"><div style="height:220px">Profilo inventato</div></div>${nav}<section class="form-section"><div style="height:100px"></div><button id="under-header" style="display:block;height:44px;width:260px;max-width:100%;background:repeating-linear-gradient(45deg,#e00000 0 8px,#000 8px 16px);color:white;border:0;font-size:20px">SEZIONE E AZIONI</button><div style="height:1800px"></div></section></div></main><footer class="base-footer"></footer></div></body></html>`);
        const geometry = await page.evaluate(async () => {
          window.fixtureClicks = {header: 0, underlying: 0};
          document.querySelector('#header-action').onclick = () => window.fixtureClicks.header++;
          document.querySelector('#under-header').onclick = () => window.fixtureClicks.underlying++;
          await document.fonts.ready;
          const main = document.querySelector('.base-main');
          const scroller = getComputedStyle(main).overflowY === 'auto' ? main : document.scrollingElement;
          // Only the synthetic scroller: prevent anchoring from moving the probe
          // after its height changes, then wait for actual rendered geometry.
          scroller.style.overflowAnchor = 'none';
          scroller.style.scrollBehavior = 'auto';
          const bar = document.querySelector('.base-header').getBoundingClientRect();
          document.querySelector('#under-header').style.height = `${bar.height - 2}px`;
          // Reduced motion can retain a very short height transition: a single
          // animation frame may still report the original 44px probe.
          const heightStarted = performance.now();
          let heightFrames = 0;
          while (heightFrames < 2) {
            await new Promise(requestAnimationFrame);
            const height = document.querySelector('#under-header').getBoundingClientRect().height;
            heightFrames = height === bar.height - 2 ? heightFrames + 1 : 0;
            if (heightFrames < 2 && performance.now() - heightStarted > 2000) {
              throw new Error('synthetic probe height did not settle: ' + JSON.stringify({height, expected: bar.height - 2}));
            }
          }
          const probe = document.querySelector('#under-header').getBoundingClientRect();
          scroller.scrollTop += (probe.top + probe.bottom - bar.top - bar.bottom) / 2;
          let previous = '';
          let stableFrames = 0;
          let result;
          const started = performance.now();
          do {
            await new Promise(requestAnimationFrame);
            const band = document.querySelector('.base-header').getBoundingClientRect();
            const target = document.querySelector('#under-header').getBoundingClientRect();
            result = {bar: band.toJSON(), probe: target.toJSON(), scrollTop: scroller.scrollTop,
              scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight,
              overflowY: getComputedStyle(scroller).overflowY, fontsStatus: document.fonts.status};
            const signature = JSON.stringify(result);
            stableFrames = signature === previous ? stableFrames + 1 : 0;
            previous = signature;
            if (stableFrames >= 2 && target.top >= band.top && target.bottom <= band.bottom) {
              return {...result, stable: true};
            }
          } while (performance.now() - started < 2000);
          return {...result, stable: false};
        });
        assert.ok(geometry.stable && geometry.probe.top >= geometry.bar.top && geometry.probe.bottom <= geometry.bar.bottom,
          'put stable contrasting content inside the header band before checking visibility: ' +
          JSON.stringify({name, viewport, dark, palette, ...geometry}));
        const clip = {x: Math.ceil(geometry.bar.left), y: Math.ceil(geometry.bar.top),
          width: Math.floor(geometry.bar.width), height: Math.floor(geometry.bar.height)};
        const shown = await page.screenshot({clip, animations: 'disabled'});
        await recordVisual(page, `header-${label.replaceAll(' ', '-')}-${viewport.width}-${palette}-${dark ? 'dark' : 'light'}`);
        await page.locator('#under-header').evaluate(button => {button.style.visibility = 'hidden';});
        const hidden = await page.screenshot({clip, animations: 'disabled'});
        assert.equal(shown.equals(hidden), true,
          `${label}/${viewport.width}/${palette}/${dark}: underlying content must not change any header pixel`);
        await page.locator('#under-header').evaluate(button => {button.style.visibility = 'visible';});
        await page.locator('#header-action').click();
        assert.deepEqual(await page.evaluate(() => window.fixtureClicks), {header: 1, underlying: 0});
      }
    }
  } finally {await browser.close();}
});
}

test('profile attachment metadata stays outside its delete control on narrow cards and enlarged text', {timeout: 120000}, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); await page.route('**/*', route => route.abort());
    await page.emulateMedia({reducedMotion: 'reduce'});
    for (const viewport of [{width: 320, height: 852}, {width: 360, height: 852}, {width: 393, height: 852}, {width: 1280, height: 900}]) {
      await page.setViewportSize(viewport);
      for (const dark of [false, true]) for (const fontSize of [16, 24, 32]) {
        const cards = [true, false].map((image, index) => `<article class="profile-document-inline-card"><button id="open-${index}" class="profile-document-inline-item ${image ? 'is-image' : 'is-file'}" aria-label="Apri allegato sintetico ${index}">${image ? '<span>Immagine inventata</span>' : '<span>PDF</span><span class="profile-document-inline-name">documento_sintetico_esteso.pdf</span>'}</button><div class="profile-document-inline-footer"><div class="profile-document-inline-meta"><span class="profile-document-inline-name">documento_sintetico_con_nome_molto_lungo.${image ? 'jpg' : 'pdf'}</span><span class="profile-document-inline-status">123.45 MB · 09/11/2026</span></div><button id="delete-${index}" type="button" class="btn-delete-attachment profile-document-inline-delete" aria-label="Elimina allegato sintetico ${index}"><span class="material-symbols-outlined">×</span></button></div></article>`).join('');
        await page.setContent(`<!doctype html><html class="${dark ? 'dark' : ''}" style="font-size:${fontSize}px"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${await fixtureStyles()}</style></head><body class="base-bg"><div class="base-container"><main class="base-main"><div class="page-container" style="padding-top:40px"><section class="form-card"><div class="profile-document-inline-gallery">${cards}</div></section><div style="height:100px"></div></div></main></div></body></html>`);
        await page.evaluate(() => {
          window.fixtureClicks = {open: 0, remove: 0};
          document.querySelectorAll('.profile-document-inline-item').forEach(button => {button.onclick = () => window.fixtureClicks.open++;});
          document.querySelectorAll('.profile-document-inline-delete').forEach(button => {button.onclick = event => {event.stopPropagation(); window.fixtureClicks.remove++;};});
        });
        await recordVisual(page, `attachments-${viewport.width}-${fontSize}-${dark ? 'dark' : 'light'}`);
        const cardsGeometry = await page.locator('.profile-document-inline-card').evaluateAll(cards => cards.map(card => {
          const meta = card.querySelector('.profile-document-inline-meta').getBoundingClientRect();
          const status = card.querySelector('.profile-document-inline-status');
          const action = card.querySelector('.profile-document-inline-delete').getBoundingClientRect();
          const rect = card.getBoundingClientRect();
          const range = document.createRange(); range.selectNodeContents(status);
          const textRects = [...range.getClientRects()];
          return {card: rect.toJSON(), action: action.toJSON(), meta: meta.toJSON(),
            overflow: status.scrollWidth - status.clientWidth,
            visible: getComputedStyle(status).visibility !== 'hidden' && getComputedStyle(status).display !== 'none',
            text: textRects.map(part => part.toJSON()),
            overlap: textRects.some(part => part.left < action.right && part.right > action.left && part.top < action.bottom && part.bottom > action.top)};
        }));
        for (const geometry of cardsGeometry) {
          assert.equal(geometry.visible, true); assert.ok(geometry.text.length > 0, 'metadata must actually render');
          assert.ok(geometry.text.every(rect => rect.width > 0 && rect.height > 0));
          assert.ok(geometry.overflow <= 1, `metadata overflow: ${JSON.stringify({viewport, fontSize, geometry})}`);
          assert.equal(geometry.overlap, false, 'painted metadata must not intersect Delete');
          assert.ok(geometry.action.left >= geometry.card.left && geometry.action.right <= geometry.card.right);
          assert.ok(geometry.action.top >= geometry.meta.bottom + 5 || geometry.action.left >= geometry.meta.right + 5,
            'metadata and the destructive control need distinct space');
          assert.ok(geometry.action.width >= 44 && geometry.action.height >= 44, 'preserve the app touch target');
          assert.ok(geometry.text.every(rect => rect.right <= geometry.meta.right + 1 && rect.bottom <= geometry.card.bottom));
        }
        await page.locator('#delete-0').click();
        assert.deepEqual(await page.evaluate(() => window.fixtureClicks), {open: 0, remove: 1});
      }
    }
  } finally {await browser.close();}
});
