import test from 'node:test';
import assert from 'node:assert/strict';
import {createTourHarness} from '../scripts/lib/view-tour-harness.mjs';
import {inspectDynamicPaint} from '../scripts/dynamic-visual-map.mjs';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
const livery = JSON.parse(await readFile(new URL('../scripts/ui-livery-contract.json', import.meta.url), 'utf8'));
const coverage = {'contact-export': new Set(), 'company-card-qr': new Set()};
const cover = (component, ...states) => states.forEach(state => coverage[component].add(state));
const registeredPaintPass = (values, paint) => values.length > 0 && values.every(value => value.visible && value.rolePass && (!paint.minimum || value.contrast?.pass));
const entryName = 'Salva o condividi contatto…';

// Real page/controller/native launcher; synthetic identity, Vault and OS adapters.
async function openContact(f) {
    await f.page.evaluate(() => {
        window.contactPreparationSeen = false;
        const observer = new MutationObserver(() => {
            const modal = document.querySelector('#contact-export-modal');
            if (modal?.dataset.exportState === 'preparing' && modal.getBoundingClientRect().width > 0 &&
                modal.querySelector('.contact-export-primary')?.disabled) window.contactPreparationSeen = true;
        });
        observer.observe(document.body, {subtree: true, childList: true, attributes: true});
    });
    const entry = f.page.locator('[data-contact-export]');
    assert.equal(await entry.count(), 1, 'one contact command per card');
    assert.equal(await entry.textContent(), entryName);
    await entry.click();
    const dialog = f.page.locator('#contact-export-modal'); await dialog.waitFor();
    await f.page.waitForFunction(() => document.querySelector('#contact-export-modal')?.dataset.exportState === 'ready');
    assert.equal(await f.page.evaluate(() => window.contactPreparationSeen), true);
    assert.equal(await f.page.locator('.modal-overlay.active [role=dialog]').count(), 1, 'one active final panel');
    assert.equal(await dialog.locator('button').count(), 2, 'one primary and Close');
    cover('contact-export', 'open', 'preparing', 'ready');
    return dialog;
}
async function choose(dialog, name) {
    const method = dialog.locator('#contact-export-method');
    if (await method.inputValue() !== name) {
        const details = dialog.locator('.contact-export-options');
        if (await details.getAttribute('open') === null) await details.locator('summary').click();
        await method.selectOption(name); cover('contact-export', 'options-open');
    }
    if (await dialog.getAttribute('data-export-state') === 'result') {
        await dialog.locator('.contact-export-primary').click();
        await dialog.page().waitForFunction(() => document.querySelector('#contact-export-modal')?.dataset.exportState === 'ready');
    }
}
async function openFixture(harness, company, graphics) {
    return harness.open(company ? 'dati_azienda.html' : 'profilo_privato.html', {
        graphics, query: company ? '?id=doc-0&profileTab=digital-card' : '?profileTab=digital-card'});
}

test('contact export controls stay compact and reachable on private and company pages', {timeout: 120000}, async () => {
    const harness = await createTourHarness({memory: true}), measurements = [];
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const company of [false, true])
        for (const picker of [false, true]) for (const share of [false, true]) {
            const f = await openFixture(harness, company, graphics);
            try {
                await f.page.evaluate(({picker, share}) => {
                    if (!picker) Object.defineProperty(window, 'showSaveFilePicker', {configurable: true, value: undefined});
                    Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => share});
                    document.documentElement.classList.remove('dark'); document.documentElement.dataset.colorTheme = 'blue';
                }, {picker, share});
                const dialog = await openContact(f);
                const expected = share ? 'share' : picker ? 'save' : 'download';
                assert.equal(await dialog.locator('#contact-export-method').inputValue(), expected);
                assert.equal(await dialog.locator('option[value=save]').count(), Number(picker));
                assert.equal(await dialog.locator('option[value=share]').count(), Number(share));
                assert.equal(await dialog.locator('option[value=download]').count(), Number(!picker && !share), 'download is only the sole fallback');
                assert.equal(await dialog.locator('.contact-export-options').isVisible(), picker && share, 'no alternatives menu for one operation');
                assert.doesNotMatch(await dialog.textContent(), /Scarica file/);
                if (!picker && !share) assert.equal(await dialog.locator('.contact-export-primary').textContent(), 'Salva file contatto');
                if (!picker) cover('contact-export', 'save-unavailable');
                if (!share) cover('contact-export', 'share-unavailable');
                if (!picker && !share) {
                    assert.equal(await dialog.locator('.contact-export-options').isVisible(), false);
                    assert.match(await dialog.locator('.contact-export-download-help').textContent(), /browser/);
                }
                for (const width of [320, 390, 1280]) for (const height of [568, 844]) {
                    await f.page.setViewportSize({width, height});
                    const sizes = await dialog.locator('button').evaluateAll(buttons => buttons.map(button => {
                        const rect = button.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(button);
                        const text = range.getBoundingClientRect();
                        return {label: button.textContent, height: rect.height,
                            compact: rect.height >= 44 && rect.height <= parseFloat(getComputedStyle(document.documentElement).fontSize) * 5.5,
                            textFits: text.top >= rect.top && text.bottom <= rect.bottom && text.left >= rect.left && text.right <= rect.right};
                    }));
                    const label = `${company ? 'company' : 'private'}/${graphics}/${picker}/${share}/${width}x${height}`;
                    assert.equal(sizes.length, 2); assert.ok(sizes.every(size => size.compact && size.textFits), label + JSON.stringify(sizes));
                    const bounds = await dialog.boundingBox(); assert.ok(bounds.y >= -1 && bounds.y + bounds.height <= height + 1, label);
                    const close = dialog.getByRole('button', {name: 'Chiudi', exact: true}); await close.focus(); await close.scrollIntoViewIfNeeded();
                    const b = await close.boundingBox(); assert.ok(b.y >= 0 && b.y + b.height <= height + 1, label + ': reachable');
                    measurements.push({label, sizes});
                    if (!picker && share && graphics === 'tre-livelli' && width === 390 && height === 844) {
                        await dialog.evaluate(element => {element.scrollTop = 0;}); await mkdir('.codex-tmp/contact-export-compact', {recursive: true});
                        await f.page.screenshot({path: `.codex-tmp/contact-export-compact/${company ? 'company' : 'private'}-phone.png`});
                    }
                }
                assert.deepEqual(await f.page.evaluate(() => window.__viewTour.errors), []);
            } finally {await f.context.close();}
        }
    } finally {await harness.close();}
    await writeFile('.codex-tmp/contact-export-compact/measurements.json', JSON.stringify({kind: 'synthetic native adapters', measurements}, null, 2));
    assert.equal(measurements.length, 96);
});

test('private and company contact commands announce names and save through a trusted native click', {timeout: 120000}, async () => {
    const harness = await createTourHarness({memory: true});
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const company of [false, true]) {
            const f = await openFixture(harness, company, graphics);
            try {
                const filename = company ? 'contatto-azienda-Azienda-inventata-0.vcf' : 'contatto-Nome-fittizio-Locale.vcf';
                const before = harness.assets.nativeSavePickers;
                const dialog = await openContact(f);
                assert.equal(await dialog.locator('.contact-export-name').textContent(), filename);
                assert.equal(harness.assets.nativeSavePickers, before);
                await choose(dialog, 'save');
                assert.equal(harness.assets.nativeSavePickers, before, 'changing the alternative cannot export');
                await dialog.locator('.contact-export-primary').click();
                await f.page.waitForFunction(() => document.querySelector('#contact-export-modal [role=status]')?.textContent?.startsWith('File salvato:'));
                assert.deepEqual(await f.page.evaluate(() => window.__viewTourLastSave), {name: filename, active: true, writes: 1, closed: 1, aborted: 0});
                cover('contact-export', 'saved');
                await choose(dialog, 'share'); await dialog.locator('.contact-export-primary').click();
                await f.page.waitForFunction(() => document.querySelector('#contact-export-modal [role=status]')?.textContent?.startsWith('File consegnato al sistema'));
                assert.equal(await dialog.locator('[role=status]').textContent(), 'File consegnato al sistema per la condivisione: ' + filename);
                cover('contact-export', 'shared');
                await dialog.getByRole('button', {name: 'Chiudi', exact: true}).click();
                assert.equal(await dialog.count(), 0); assert.deepEqual(await f.page.evaluate(() => window.__viewTour.errors), []);
            } finally {await f.context.close();}
        }
        assert.equal(harness.assets.nativeSavePickers, 4);
    } finally {await harness.close();}
});

test('unsupported sharing and rejected or cancelled native actions always have an explicit result', {timeout: 120000}, async () => {
    const harness = await createTourHarness({memory: true});
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const company of [false, true]) {
            const f = await openFixture(harness, company, graphics);
            try {
                await f.page.evaluate(() => {
                    Object.defineProperty(window, 'showSaveFilePicker', {configurable: true, value: undefined});
                    Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => false});
                    document.addEventListener('click', event => {
                        const link = event.target.closest('a[download]'); if (link) {event.preventDefault(); (window.contactDownloads ||= []).push(link.download);}
                    });
                });
                let dialog = await openContact(f); const announced = await dialog.locator('.contact-export-name').textContent();
                assert.equal(await f.page.evaluate(() => window.contactDownloads?.length || 0), 0);
                await dialog.locator('.contact-export-primary').click();
                await f.page.waitForFunction(() => document.querySelector('#contact-export-modal [role=status]')?.textContent?.startsWith('Salvataggio del file avviato:'));
                assert.deepEqual(await f.page.evaluate(() => window.contactDownloads), [announced]); cover('contact-export', 'download-started');
                await f.page.keyboard.press('Escape'); assert.equal(await dialog.count(), 0);
                for (const method of ['share', 'save']) for (const name of ['NotAllowedError', 'AbortError', 'NotSupportedError', 'DataError']) {
                    await f.page.evaluate(({name, method}) => {
                        Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => true});
                        const fail = async () => {window.contactActivation = navigator.userActivation.isActive; throw new DOMException('Synthetic result', name);};
                        Object.defineProperty(navigator, 'share', {configurable: true, value: fail});
                        Object.defineProperty(window, 'showSaveFilePicker', {configurable: true, value: method === 'save' ? fail : undefined});
                    }, {name, method});
                    dialog = await openContact(f); await choose(dialog, method); await dialog.locator('.contact-export-primary').click();
                    const expected = name === 'AbortError' ? 'Operazione annullata.' : name === 'NotSupportedError' && method === 'share'
                        ? 'La condivisione di file non è disponibile. Prepara di nuovo il contatto per verificare le funzioni disponibili.'
                        : 'Operazione non riuscita. Prepara di nuovo il contatto e riprova.';
                    await f.page.waitForFunction(expected => document.querySelector('#contact-export-modal [role=status]')?.textContent === expected, expected);
                    assert.equal(await f.page.evaluate(() => window.contactActivation), true);
                    cover('contact-export', name === 'AbortError' ? 'cancelled' : method + '-error');
                    assert.deepEqual(await f.page.evaluate(() => window.contactDownloads), [announced], 'no automatic fallback');
                    assert.equal(await dialog.locator('option[value=download]').count(), 0, 'native errors never introduce a download alternative');
                    assert.equal(await dialog.locator('.contact-export-options').isVisible(), method === 'save');
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
            const f = await openFixture(harness, company, graphics);
            try {
                await f.page.evaluate(() => {
                    window.lateContactWrites = 0;
                    Object.defineProperty(window, 'showSaveFilePicker', {configurable: true, value: () => new Promise(resolve => {
                        window.releaseContactPicker = () => resolve({name: 'late.vcf', createWritable: async () => {
                            window.lateContactWrites++; return {write: async () => {window.lateContactWrites++;}, close: async () => {window.lateContactWrites++;}, abort: async () => {}};
                        }});
                    })});
                });
                const dialog = await openContact(f); await choose(dialog, 'save'); await dialog.locator('.contact-export-primary').click();
                await f.page.waitForFunction(() => typeof window.releaseContactPicker === 'function');
                await f.page.evaluate(() => {window.dispatchEvent(new Event('vault-session-locked')); window.dispatchEvent(new Event('vault-session-unlocked'));});
                assert.equal(await dialog.count(), 0); await f.page.evaluate(() => window.releaseContactPicker());
                assert.equal(await f.page.evaluate(() => window.lateContactWrites), 0); cover('contact-export', 'revoked');
                assert.deepEqual(await f.page.evaluate(() => window.__viewTour.errors), []);
            } finally {await f.context.close();}
        }
    } finally {await harness.close();}
});

test('pending contact actions remain closable and ignore late native completion', {timeout: 120000}, async () => {
    const harness = await createTourHarness({memory: true});
    try {
        for (const graphics of ['classica', 'tre-livelli']) for (const company of [false, true]) for (const method of ['share', 'save']) {
            const f = await openFixture(harness, company, graphics);
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
                let dialog = await openContact(f); await choose(dialog, method); await dialog.locator('.contact-export-primary').click();
                await f.page.waitForFunction(() => typeof window.releaseHeldContact === 'function');
                assert.match(await dialog.locator('[role=status]').textContent(), /Attendi la finestra/);
                assert.equal(await dialog.locator('.contact-export-primary').isDisabled(), true);
                const close = dialog.getByRole('button', {name: 'Chiudi', exact: true});
                assert.equal(await close.evaluate(element => element === document.activeElement), true);
                if (method === 'save') await close.click(); else await f.page.keyboard.press('Escape');
                assert.equal(await dialog.count(), 0);
                dialog = await openContact(f); await f.page.evaluate(() => window.releaseHeldContact());
                await f.page.waitForFunction(() => document.querySelector('#contact-export-modal')?.dataset.exportState === 'ready');
                assert.equal(await f.page.evaluate(() => window.lateContactWrites), 0);
                assert.equal(await dialog.locator('[role=status]').textContent(), '');
                await dialog.getByRole('button', {name: 'Chiudi', exact: true}).click(); cover('contact-export', 'pending');
                assert.deepEqual(await f.page.evaluate(() => window.__viewTour.errors), []);
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
                await f.page.evaluate(() => Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => true}));
                await openContact(f);
                await f.page.locator('.contact-export-options summary').click();
                assert.equal(await f.page.locator('#contact-export-method').isVisible(), true);
                cover('contact-export', 'options-open');
                for (const width of [320, 1280]) {
                    await f.page.setViewportSize({width, height: 844});
                    for (const theme of livery.themes) for (const palette of livery.palettes) {
                        await f.page.evaluate(({theme, palette}) => {document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.dataset.colorTheme = palette;}, {theme, palette});
                        const label = `${company ? 'company' : 'private'}/${graphics}/${width}/${theme}/${palette}`;
                        const paints = await inspectDynamicPaint(f.page, {selector: '#contact-export-modal .modal-title,#contact-export-modal .contact-export-name,#contact-export-modal .modal-description,#contact-export-modal button:not([hidden]):not(:disabled)', property: 'color', role: '--text-primary', minimum: 4.5}, {theme, graphics});
                        for (const paint of paints) if (paint.visible && !paint.contrast?.pass) failures.push({label, contrast: paint.contrast, actual: paint.actual, own: paint.own});
                        for (const paint of livery.contactExport.paints.filter(paint => paint.states.includes('options-open'))) {
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
                await f.page.addStyleTag({content: '#contact-export-method{color:#B87333!important}'});
                const selectPaint = livery.contactExport.paints.find(paint => paint.selector === '#contact-export-method' && paint.property === 'color');
                const wrongSelect = await inspectDynamicPaint(f.page, selectPaint, {graphics});
                assert.ok(wrongSelect.some(paint => !paint.rolePass), 'a fixed copper select is rejected');
                await f.page.addStyleTag({content: '#contact-export-method{display:none!important}'});
                assert.equal(registeredPaintPass(await inspectDynamicPaint(f.page, selectPaint, {graphics}), selectPaint), false, 'hidden alternatives are rejected');
                const labelPaint=livery.contactExport.paints.find(paint=>paint.selector==='.contact-export-options label');
                await f.page.locator('.contact-export-options label').evaluate(element=>element.remove());
                assert.equal(registeredPaintPass(await inspectDynamicPaint(f.page,labelPaint,{graphics}),labelPaint),false,'missing method label is rejected');
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
