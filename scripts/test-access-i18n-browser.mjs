import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const publicRoot = path.resolve(import.meta.dirname, '../Frontend/public');
const languages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
const pages = ['login-v115', 'registrati', 'imposta_nuova_password', 'contatto_condiviso'];
const contentTypes = new Map([
    ['.css', 'text/css'], ['.html', 'text/html'], ['.js', 'text/javascript'], ['.json', 'application/json'],
    ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.svg', 'image/svg+xml'], ['.woff2', 'font/woff2']
]);

const bootstrap = `<script type="module">
    import { applyGlobalTranslations, getMissingTranslationKeys, loadLanguage } from '/assets/js/translations.js';
    const language = new URLSearchParams(location.search).get('lang') || 'it';
    await loadLanguage(language);
    applyGlobalTranslations();
    window.__accessI18n = { language, missingKeys: getMissingTranslationKeys() };
</script>`;

const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (url.pathname === '/favicon.ico') {
            response.writeHead(204);
            response.end();
            return;
        }
        const file = path.resolve(publicRoot, `.${url.pathname}`);
        assert.ok(file === publicRoot || file.startsWith(publicRoot + path.sep));
        let content = await readFile(file);
        if (pages.some(page => url.pathname === `/${page}.html`)) {
            content = Buffer.from(content.toString('utf8')
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/data-i18n="(?:ready|loading)"/g, 'data-i18n="loading"')
                .replace('</body>', `${bootstrap}</body>`));
        }
        response.setHeader('Content-Type', contentTypes.get(path.extname(file)) || 'application/octet-stream');
        response.end(content);
    } catch {
        response.writeHead(404);
        response.end();
    }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
    browser = await chromium.launch({
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true,
        args: ['--no-first-run', '--no-default-browser-check']
    });
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error?.message || error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

    for (const language of languages) {
        for (const pageId of pages) {
            await page.goto(`${origin}/${pageId}.html?lang=${language}`, { waitUntil: 'networkidle' });
            await page.waitForFunction(() => Boolean(window.__accessI18n));
            const state = await page.evaluate(() => {
                const translatedAttributes = [
                    ['placeholder', 'tPlaceholder'], ['aria-label', 'tAria'], ['title', 'tTitle'], ['alt', 'tAlt']
                ];
                const untranslated = [];
                for (const element of document.querySelectorAll('[data-t],[data-t-placeholder],[data-t-aria],[data-t-title],[data-t-alt]')) {
                    if (element.dataset.t && element.textContent.trim() === element.dataset.t) untranslated.push(element.dataset.t);
                    for (const [attribute, datasetKey] of translatedAttributes) {
                        if (element.dataset[datasetKey] && element.getAttribute(attribute) === element.dataset[datasetKey]) {
                            untranslated.push(element.dataset[datasetKey]);
                        }
                    }
                }
                return {
                    language: document.documentElement.lang,
                    fallback: document.documentElement.dataset.i18nFallback || '',
                    missingKeys: window.__accessI18n.missingKeys,
                    untranslated,
                    title: document.title,
                    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
                    submitIcon: document.querySelector('#login-submit-btn .material-symbols-outlined, #register-submit-btn .material-symbols-outlined, #new-pass-submit-btn .material-symbols-outlined')?.textContent.trim() || null
                };
            });
            assert.equal(state.language, language, `${pageId}/${language}: attributo lang`);
            assert.equal(state.fallback, '', `${pageId}/${language}: fallback inatteso`);
            assert.deepEqual(state.missingKeys, [], `${pageId}/${language}: chiavi mancanti`);
            assert.deepEqual(state.untranslated, [], `${pageId}/${language}: chiavi tecniche visibili`);
            assert.ok(state.title && !state.title.includes('_document_title'), `${pageId}/${language}: titolo non tradotto`);
            assert.equal(state.overflow, false, `${pageId}/${language}: overflow orizzontale`);
            if (pageId !== 'contatto_condiviso') assert.ok(state.submitIcon, `${pageId}/${language}: icona submit rimossa`);
        }
    }
    assert.deepEqual(errors, []);
    console.log(`Accesso i18n browser: ${languages.length * pages.length}/${languages.length * pages.length} combinazioni tradotte, senza fallback, errori o overflow.`);
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
