import test from 'node:test';
import assert from 'node:assert/strict';
import {createTourHarness} from '../scripts/lib/view-tour-harness.mjs';
import {inspectDynamicPaint} from '../scripts/dynamic-visual-map.mjs';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
const livery = JSON.parse(await readFile(new URL('../scripts/ui-livery-contract.json', import.meta.url), 'utf8'));
const coverage = {'contact-export': new Set(), 'company-card-qr': new Set()};
const cover = (component, ...states) => states.forEach(state => coverage[component].add(state));
const registeredPaintPass = (values, paint) => values.length > 0 && values.every(value => value.visible && value.rolePass && (!paint.minimum || value.contrast?.pass));

// Real page/controller/renderer; synthetic identity, Vault and native adapters.
// These tests never open an OS picker, write a real contact or certify a device.
test('private and company contact commands announce names and save through a trusted native click', {timeout: 120000}, async () => {
    const harness = await createTourHarness({memory: true});
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const company of [false, true]) {
            const f = await harness.open(company ? 'dati_azienda.html' : 'profilo_privato.html', {graphics,
                query: company ? '?id=doc-0&profileTab=digital-card' : '?profileTab=digital-card'});
            try {
                const filename = company ? 'contatto-azienda-Azienda-inventata-0.vcf' : 'contatto-Nome-fittizio-Locale.vcf';
                const savesBefore = harness.assets.nativeSavePickers;
                const entry = livery.contactExport.entries.find(entry => entry.page === (company ? 'dati_azienda.html' : 'profilo_privato.html'));
                assert.ok(entry);
                await f.page.locator(entry.selector).filter({hasText: /^Salva contatto…$/}).click();
                const dialog = f.page.getByRole('dialog', {name: 'Salva o condividi il contatto'});
                await dialog.waitFor(); assert.equal(await dialog.locator('.contact-export-name').textContent(), filename);
                cover('contact-export', 'open');
                assert.equal(harness.assets.nativeSavePickers, savesBefore, 'the announcement does not start a file operation');
                await dialog.getByRole('button', {name: 'Scegli dove salvare…', exact: true}).click();
                await f.page.waitForFunction(() => document.querySelector('#contact-export-modal [role=status]')?.textContent?.startsWith('File salvato:'));
                assert.deepEqual(await f.page.evaluate(() => window.__viewTourLastSave), {name: filename, active: true, writes: 1, closed: 1, aborted: 0});
                assert.equal(await dialog.locator('[role=status]').textContent(), 'File salvato: ' + filename);
                cover('contact-export', 'saved');
                await dialog.getByRole('button', {name: 'Condividi o salva…', exact: true}).click();
                await f.page.waitForFunction(() => document.querySelector('#contact-export-modal [role=status]')?.textContent?.startsWith('File consegnato al sistema per la condivisione:'));
                assert.equal(await dialog.locator('[role=status]').textContent(), 'File consegnato al sistema per la condivisione: ' + filename);
                cover('contact-export', 'shared');
                await dialog.getByRole('button', {name: 'Chiudi', exact: true}).click();
                assert.equal(await f.page.locator('#contact-export-modal').count(), 0);
                assert.deepEqual(await f.page.evaluate(() => window.__viewTour.errors), []);
            } finally {await f.context.close();}
        }
        assert.equal(harness.assets.nativeSavePickers, 4);
    } finally {await harness.close();}
});

test('unsupported sharing and rejected or cancelled native actions always have an explicit result', {timeout: 120000}, async () => {
    const harness = await createTourHarness({memory: true});
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const company of [false, true]) {
            const f = await harness.open(company ? 'dati_azienda.html' : 'profilo_privato.html', {
                graphics, query: company ? '?id=doc-0&profileTab=digital-card' : '?profileTab=digital-card'});
            try {
                await f.page.evaluate(() => {
                    Object.defineProperty(window, 'showSaveFilePicker', {configurable: true, value: undefined});
                    Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => false});
                    document.addEventListener('click', event => {
                        const link = event.target.closest('a[download]');
                        if (link) {event.preventDefault(); (window.contactDownloads ||= []).push(link.download);}
                    });
                });
                const entry = f.page.locator('.digital-card-actions').getByRole('button', {name: 'Condividi', exact: true});
                await entry.click();
                const dialog = f.page.locator('#contact-export-modal'); await dialog.waitFor();
                assert.equal(await dialog.getByText('Scegli dove salvare…', {exact: true}).isVisible(), false, 'unsupported picker is visually absent');
                assert.equal(await dialog.getByRole('button', {name: 'Condividi o salva…', exact: true}).isDisabled(), true);
                assert.match(await dialog.locator('[role=status]').textContent(), /non è disponibile/);
                cover('contact-export', 'save-unavailable', 'share-unavailable');
                assert.equal(await f.page.evaluate(() => window.contactDownloads?.length || 0), 0, 'no automatic fallback');
                const announced = await dialog.locator('.contact-export-name').textContent();
                await dialog.getByRole('button', {name: 'Scarica file', exact: true}).click();
                await f.page.waitForFunction(() => document.querySelector('#contact-export-modal [role=status]')?.textContent?.startsWith('Download avviato:'));
                assert.deepEqual(await f.page.evaluate(() => window.contactDownloads), [announced]);
                assert.equal(await dialog.locator('[role=status]').textContent(), 'Download avviato: ' + announced);
                cover('contact-export', 'download-started');
                await f.page.keyboard.press('Escape'); assert.equal(await dialog.count(), 0);
                assert.equal(await entry.evaluate(element => element === document.activeElement), true);
                for (const method of ['share', 'save']) for (const name of ['NotAllowedError', 'AbortError']) {
                    await f.page.evaluate(({name, method}) => {
                        Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => true});
                        Object.defineProperty(navigator, 'share', {configurable: true, value: async () => {
                            window.contactShareActive = navigator.userActivation.isActive;
                            throw new DOMException('Synthetic native result', name);
                        }});
                        if (method === 'save') Object.defineProperty(window, 'showSaveFilePicker', {configurable: true, value: async () => {
                            window.contactShareActive = navigator.userActivation.isActive;
                            throw new DOMException('Synthetic native result', name);
                        }});
                    }, {name, method});
                    await entry.click(); await dialog.waitFor();
                    await dialog.getByRole('button', {name: method === 'share' ? 'Condividi o salva…' : 'Scegli dove salvare…', exact: true}).click();
                    const expected = name === 'AbortError' ? 'Operazione annullata.' : 'Operazione non riuscita. Riprova oppure scegli un altro comando.';
                    await f.page.waitForFunction(expected => document.querySelector('#contact-export-modal [role=status]')?.textContent === expected, expected);
                    assert.equal(await f.page.evaluate(() => window.contactShareActive), true);
                    cover('contact-export', name === 'AbortError' ? 'cancelled' : method + '-error');
                    assert.deepEqual(await f.page.evaluate(() => window.contactDownloads), [announced], 'no export after a rejected/cancelled share');
                    await dialog.getByRole('button', {name: 'Chiudi', exact: true}).click();
                }
                assert.deepEqual(await f.page.evaluate(() => window.__viewTour.errors), []);
            } finally {await f.context.close();}
        }
    } finally {await harness.close();}
});

test('a pending native picker cannot write after lock and re-entry with the same identity', {timeout: 120000}, async () => {
    const harness = await createTourHarness({memory: true});
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const company of [false, true]) {
            const f = await harness.open(company ? 'dati_azienda.html' : 'profilo_privato.html', {
                graphics, query: company ? '?id=doc-0&profileTab=digital-card' : '?profileTab=digital-card'});
            try {
                await f.page.evaluate(() => {
                    window.lateContactWrites = 0;
                    Object.defineProperty(window, 'showSaveFilePicker', {configurable: true, value: () => new Promise(resolve => {
                        window.releaseContactPicker = () => resolve({name: 'late.vcf', createWritable: async () => {
                            window.lateContactWrites++; return {write: async () => {window.lateContactWrites++;}, close: async () => {window.lateContactWrites++;}, abort: async () => {}};
                        }});
                    })});
                });
                await f.page.getByRole('button', {name: 'Salva contatto…', exact: true}).click();
                await f.page.locator('#contact-export-modal').getByRole('button', {name: 'Scegli dove salvare…', exact: true}).click();
                await f.page.waitForFunction(() => typeof window.releaseContactPicker === 'function');
                await f.page.evaluate(() => {window.dispatchEvent(new Event('vault-session-locked')); window.dispatchEvent(new Event('vault-session-unlocked'));});
                assert.equal(await f.page.locator('#contact-export-modal').count(), 0);
                await f.page.evaluate(() => window.releaseContactPicker());
                await f.page.waitForFunction(() => !document.querySelector('#contact-export-modal'));
                assert.equal(await f.page.evaluate(() => window.lateContactWrites), 0);
                cover('contact-export', 'revoked');
                assert.deepEqual(await f.page.evaluate(() => window.__viewTour.errors), []);
            } finally {await f.context.close();}
        }
    } finally {await harness.close();}
});

test('pending contact actions remain closable and ignore late native completion', {timeout: 120000}, async () => {
    const harness = await createTourHarness({memory: true});
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const company of [false, true]) for (const method of ['share', 'save']) {
            const f = await harness.open(company ? 'dati_azienda.html' : 'profilo_privato.html', {
                graphics, query: company ? '?id=doc-0&profileTab=digital-card' : '?profileTab=digital-card'});
            try {
                await f.page.evaluate(method => {
                    window.lateContactWrites = 0;
                    const held = () => new Promise(resolve => {window.releaseHeldContact = () => resolve(method === 'share' ? undefined : {
                        name: 'late.vcf', createWritable: async () => {window.lateContactWrites++; return {write: async () => {window.lateContactWrites++;}, close: async () => {window.lateContactWrites++;}, abort: async () => {}};}
                    });});
                    Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => true});
                    Object.defineProperty(navigator, 'share', {configurable: true, value: held});
                    Object.defineProperty(window, 'showSaveFilePicker', {configurable: true, value: held});
                }, method);
                const entry = f.page.getByRole('button', {name: 'Salva contatto…', exact: true});
                await entry.click();
                const dialog = f.page.locator('#contact-export-modal'); await dialog.waitFor();
                await dialog.getByRole('button', {name: method === 'share' ? 'Condividi o salva…' : 'Scegli dove salvare…', exact: true}).click();
                await f.page.waitForFunction(() => typeof window.releaseHeldContact === 'function');
                assert.match(await dialog.locator('[role=status]').textContent(), /Attendi la finestra/);
                for (const label of ['Scegli dove salvare…', 'Condividi o salva…', 'Scarica file']) assert.equal(await dialog.getByRole('button', {name: label, exact: true}).isDisabled(), true);
                const close = dialog.getByRole('button', {name: 'Chiudi', exact: true});
                assert.equal(await close.isEnabled(), true);
                assert.equal(await close.evaluate(element => element === document.activeElement), true, 'pending immediately keeps keyboard focus inside the dialog');
                await f.page.keyboard.press('Tab');
                assert.equal(await close.evaluate(element => element === document.activeElement), true);
                if (method === 'save') await close.click(); else await f.page.keyboard.press('Escape');
                assert.equal(await dialog.count(), 0);
                await entry.click(); await dialog.waitFor();
                await f.page.evaluate(() => window.releaseHeldContact());
                await f.page.waitForFunction(() => document.querySelector('#contact-export-modal [role=status]')?.textContent === '');
                assert.equal(await f.page.evaluate(() => window.lateContactWrites), 0);
                assert.equal(await dialog.count(), 1, 'late result does not reopen or replace the new dialog');
                await dialog.getByRole('button', {name: 'Chiudi', exact: true}).click();
                assert.deepEqual(await f.page.evaluate(() => window.__viewTour.errors), []);
                cover('contact-export', 'pending');
            } finally {await f.context.close();}
        }
    } finally {await harness.close();}
});

test('company digital-card zoom uses the current unsaved selection and retains the header QR', {timeout: 120000}, async () => {
    const harness = await createTourHarness({memory: true}), contexts = [];
    await mkdir('.codex-tmp/contact-export-verification', {recursive: true});
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const large of [false, true]) {
            const memorySeeds = large ? [{path: 'users/synthetic-local-only/aziende/doc-0', value: {
                ragioneSociale: 'Azienda QA ' + 'QA '.repeat(210), revision: 1, isArchived: false, sedi: [], phones: [], emails: [], qrConfig: {ragioneSociale: true}
            }}] : [];
            const f = await harness.open('dati_azienda.html', {graphics, memorySeeds, query: '?id=doc-0&profileTab=digital-card'});
            try {
                await f.page.waitForFunction(() => document.querySelector('.company-qr-preview')?.title?.includes('BEGIN:VCARD') && document.querySelector('#qrcode-container')?.title?.includes('BEGIN:VCARD'));
                const preview = () => f.page.locator('.company-qr-preview').getAttribute('title').then(value => value.trim());
                const header = (await f.page.locator('#qrcode-container').getAttribute('title')).trim();
                const trigger = f.page.locator(livery.companyCardQr.entries[0].selector);
                assert.equal(await trigger.isVisible(), true);
                assert.equal(await f.page.locator('.company-qr-preview canvas').evaluate(canvas => canvas.width), 220);
                cover('company-card-qr', 'card-inline');
                await trigger.focus(); await f.page.keyboard.press('Enter');
                await f.page.locator('#qr-zoom-modal.active').waitFor();
                assert.equal((await f.page.locator('#qrcode-zoom-container').getAttribute('title')).trim(), await preview());
                cover('company-card-qr', 'card-zoom');
                assert.equal(await f.page.locator('#qrcode-zoom-container canvas').evaluate(canvas => {
                    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                    let black = false, white = false;
                    for (let index = 0; index < data.length; index += 4) {
                        if (data[index] !== data[index + 1] || data[index] !== data[index + 2]) return false;
                        black ||= data[index] === 0; white ||= data[index] === 255;
                    }
                    return black && white;
                }), true, 'QR ink/quiet zone remain functional grayscale');
                if (graphics === 'tre-livelli' && large) {
                    await f.page.setViewportSize({width: 390, height: 844});
                    await f.page.screenshot({path: '.codex-tmp/contact-export-verification/company-qr-zoom-phone.png'});
                }
                assert.equal(await f.page.locator('#btn-close-qr').evaluate(element => element === document.activeElement), true);
                for (const key of ['Tab', 'Shift+Tab']) {await f.page.keyboard.press(key); assert.equal(await f.page.locator('#btn-close-qr').evaluate(element => element === document.activeElement), true);}
                await f.page.keyboard.press('Escape'); assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
                assert.equal(await f.page.locator('#qrcode-zoom-container').getAttribute('title'), null);
                cover('company-card-qr', 'closed');
                const manage = f.page.locator('.digital-card-fields .manage-toggle');
                if (await manage.count()) await manage.click();
                await f.page.locator('.digital-card-choice input').first().uncheck();
                assert.notEqual(await preview(), header, 'the changed local selection differs from the saved header payload');
                await trigger.focus(); await f.page.keyboard.press('Space'); await f.page.locator('#qr-zoom-modal.active').waitFor();
                assert.equal((await f.page.locator('#qrcode-zoom-container').getAttribute('title')).trim(), await preview());
                cover('company-card-qr', 'unsaved-selection-zoom');
                for (const width of [320, 390, 1280]) {
                    await f.page.setViewportSize({width, height: 844});
                    for (const theme of livery.themes) for (const palette of livery.palettes) {
                    await f.page.evaluate(({theme, palette}) => {document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.dataset.colorTheme = palette;}, {theme, palette});
                    for (const paint of livery.companyCardQr.paints.filter(paint => paint.states.includes('unsaved-selection-zoom'))) {
                        const values = await inspectDynamicPaint(f.page, paint, {theme, graphics});
                        assert.ok(values.length > 0 && values.every(value => value.visible && value.rolePass && (!paint.minimum || value.contrast?.pass)), JSON.stringify({graphics, large, width, theme, palette, paint, values}));
                    }
                    const geometry = await f.page.locator('#qr-zoom-modal .modal-box').boundingBox();
                    const image = await f.page.locator('#qrcode-zoom-container img').boundingBox();
                    assert.ok(geometry.x >= -1 && geometry.x + geometry.width <= width + 1);
                    assert.ok(image && image.width > 180 && image.x >= geometry.x && image.x + image.width <= geometry.x + geometry.width + 1);
                    const paints = await inspectDynamicPaint(f.page, {selector: '#btn-close-qr [data-t=close]', property: 'color', role: '--text-primary', minimum: 4.5}, {theme, graphics});
                    assert.ok(paints.length === 1 && paints[0].visible && paints[0].contrast?.pass, JSON.stringify({graphics, large, width, theme, palette, paints}));
                    contexts.push({graphics, large, width, theme, palette});
                    }
                }
                await f.page.locator('#btn-close-qr').click();
                await f.page.locator('#btn-zoom-qr').click(); await f.page.locator('#qr-zoom-modal.active').waitFor();
                assert.equal((await f.page.locator('#qrcode-zoom-container').getAttribute('title')).trim(), header, 'header retains its saved payload');
                cover('company-card-qr', 'header-zoom');
                await f.page.evaluate(() => window.dispatchEvent(new Event('vault-session-locked')));
                assert.equal(await f.page.locator('#qr-zoom-modal.active').count(), 0);
                assert.equal(await f.page.locator('#qrcode-zoom-container canvas,#qrcode-zoom-container img').count(), 0);
                cover('company-card-qr', 'revoked');
                assert.equal(await f.page.evaluate(() => window.__viewTourWrites || 0), 0, 'zoom never saves the selection');
                assert.deepEqual(await f.page.evaluate(() => window.__viewTour.errors), []);
            } finally {await f.context.close();}
        }
    } finally {await harness.close();}
    assert.equal(contexts.length, 168);
    await writeFile('.codex-tmp/contact-export-verification/qr-themes.json', JSON.stringify({kind: 'synthetic QR/UI; not a physical scan', contexts}, null, 2));
});

test('contact export stays readable and contained in all seven themes and both graphics', {timeout: 240000}, async () => {
    const harness = await createTourHarness({memory: true}), contexts = [], failures = [];
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const company of [false, true]) {
            const f = await harness.open(company ? 'dati_azienda.html' : 'profilo_privato.html', {graphics,
                query: company ? '?id=doc-0&profileTab=digital-card' : '?profileTab=digital-card'});
            try {
                await f.page.evaluate(() => Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => false}));
                await f.page.getByRole('button', {name: 'Salva contatto…', exact: true}).click(); await f.page.locator('#contact-export-modal').waitFor();
                for (const width of [320, 1280]) {
                    await f.page.setViewportSize({width, height: 844});
                    for (const theme of livery.themes) for (const palette of livery.palettes) {
                        await f.page.evaluate(({theme, palette}) => {document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.dataset.colorTheme = palette;}, {theme, palette});
                        const label = `${company ? 'company' : 'private'}/${graphics}/${width}/${theme}/${palette}`;
                        const paints = await inspectDynamicPaint(f.page, {selector: '#contact-export-modal .modal-title,#contact-export-modal .contact-export-name,#contact-export-modal .modal-description,#contact-export-modal button:not([hidden]):not(:disabled)', property: 'color', role: '--text-primary', minimum: 4.5}, {theme, graphics});
                        for (const paint of paints) if (paint.visible && !paint.contrast?.pass) failures.push({label, contrast: paint.contrast, actual: paint.actual, own: paint.own});
                        for (const paint of livery.contactExport.paints.filter(paint => paint.states.includes('open'))) {
                            const values = await inspectDynamicPaint(f.page, paint, {theme, graphics});
                            if (!registeredPaintPass(values, paint)) failures.push({label, paint, values});
                        }
                        const bounds = await f.page.locator('.contact-export-dialog').boundingBox();
                        assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, label + ': dialog fits horizontally');
                        const overflow = await f.page.locator('.contact-export-dialog').evaluate(element => element.scrollWidth > element.clientWidth + 1);
                        assert.equal(overflow, false, label + ': no horizontal clipping');
                        contexts.push({company, graphics, width, theme, palette});
                    }
                }
                if (!company && graphics === 'tre-livelli') {
                    await f.page.setViewportSize({width: 390, height: 844});
                    await f.page.locator('.contact-export-dialog').evaluate(element => {element.scrollTop = 0;});
                    await mkdir('.codex-tmp/contact-export-verification', {recursive: true});
                    await f.page.screenshot({path: '.codex-tmp/contact-export-verification/private-contact-phone.png'});
                }
                await f.page.addStyleTag({content: '#contact-export-modal .contact-export-name{color:transparent!important}'});
                const negative = await inspectDynamicPaint(f.page, {selector: '.contact-export-name', property: 'color', role: '--text-primary', minimum: 4.5});
                assert.ok(negative.some(paint => !paint.rolePass && !paint.contrast?.pass), 'invisible file names are rejected');
                await f.page.evaluate(() => {document.documentElement.classList.remove('dark'); document.documentElement.dataset.colorTheme = 'blue';});
                await f.page.addStyleTag({content: 'html[data-color-theme=blue]:not(.dark) .contact-export-name{display:none!important}'});
                const identityPaint = livery.contactExport.paints.find(paint => paint.selector === '.contact-export-name');
                assert.equal(registeredPaintPass(await inspectDynamicPaint(f.page, identityPaint, {theme: 'light', graphics}), identityPaint), false, 'a name hidden in only one palette is rejected');
                await f.page.locator('.contact-export-name').evaluate(element => element.remove());
                assert.equal(registeredPaintPass(await inspectDynamicPaint(f.page, identityPaint, {theme: 'light', graphics}), identityPaint), false, 'a missing target cannot count as a passed paint');
            } finally {await f.context.close();}
        }
    } finally {await harness.close();}
    await mkdir('.codex-tmp/contact-export-verification', {recursive: true});
    await writeFile('.codex-tmp/contact-export-verification/themes.json', JSON.stringify({kind: 'synthetic UI/native adapters; no physical-device certification', contexts, failures}, null, 2));
    assert.equal(contexts.length, 112); assert.deepEqual(failures, []);
});

test('native contact and QR registry states match the browser paths actually exercised', async () => {
    for (const [component, registry] of [['contact-export', livery.contactExport], ['company-card-qr', livery.companyCardQr]]) {
        assert.deepEqual([...coverage[component]].sort(), [...registry.states].sort(), component + ': no missing or invented state coverage');
        assert.deepEqual([...new Set(registry.tests.flatMap(test => test.states))].sort(), [...registry.states].sort(), component + ': all declared tests bind known states');
    }
    await mkdir('.codex-tmp/contact-export-verification', {recursive: true});
    await writeFile('.codex-tmp/contact-export-verification/states.json', JSON.stringify({kind: 'functional synthetic UI; native adapters, not physical-device certification', states: Object.fromEntries(Object.entries(coverage).map(([name, states]) => [name, [...states]]))}, null, 2));
});
