import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';

test('local synthetic recovery fixture stays usable in English, Chinese and Hindi at mobile/desktop sizes', {timeout: 45000}, async () => {
    const project = fileURLToPath(new URL('../', import.meta.url));
    const publicRoot = path.join(project, 'Frontend/public');
    const settings = path.join(publicRoot, 'assets/js/modules/settings');
    const ui = (await readFile(path.join(settings, 'complete-recovery-ui.js'), 'utf8')).replace(/^import[^;]+;\r?\n/gm, '').replace(/^export /gm, '');
    const catalogs = (await readFile(path.join(publicRoot, 'assets/js/translations/recovery.js'), 'utf8')).replace(/^export /gm, '');
    const baseLabels = {};
    for (const language of ['en','zh','hi']) {
        const source = await readFile(path.join(publicRoot, `assets/js/translations/${language}.js`), 'utf8');
        const {default: catalog} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
        baseLabels[language] = {cancel: catalog.cancel, confirm: catalog.confirm};
    }
    const content = `import {createElement,setChildren} from '../../dom-utils.js';
import {evaluatePassword} from '../core/password-policy.js';
${catalogs}
const COMPLETE_RECOVERY_ENABLED=false, COMPLETE_RECOVERY_REAUTH_PATH='/login.html?recovery=complete&reauth=complete-recovery';
let language='en', mounted;
const baseLabels=${JSON.stringify(baseLabels)};
const t=key=>recoveryCatalogs[language][key] || baseLabels[language][key] || key;
const tf=(key,values)=>t(key).replace(/\\{([^}]+)\\}/g,(_all,name)=>String(values[name]));
const prepareCompleteRecovery=async()=>({ownerUid:'synthetic',backupId:'synthetic-backup',contentDigest:'a'.repeat(64),counts:{records:224,assets:17,externalReferences:2}});
const executeCompleteRecovery=async()=>{window.fixtureRpc++;return {status:'complete'};};
const releaseCompleteRecovery=()=>{};
${ui}
window.mountRecoveryFixture=locale=>{language=locale;mounted?.dispose();window.fixtureRpc=0;
mounted=mountCompleteRecoveryUi({root:document.querySelector('.page-container'),uid:'synthetic',enabled:true,
getCurrentUid:()=> 'synthetic',invoke:async()=>{window.fixtureRpc++;return {};},
locator:{load:()=>null,remember:()=>{},clear:()=>{}}});return recoveryCatalogs[locale];};`;
    const result = await build({stdin: {contents: content, resolveDir: settings, loader: 'js'}, bundle: true, format: 'iife', platform: 'browser', write: false});
    const script = result.outputFiles[0].text;
    const cssSeen = new Set();
    const localCss = async file => {
        if (cssSeen.has(file)) return ''; cssSeen.add(file);
        let content = await readFile(file, 'utf8');
        for (const match of [...content.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/g)]) {
            const target = path.resolve(path.dirname(file), match[1]);
            content = content.replace(match[0], target.startsWith(publicRoot + path.sep) ? await localCss(target) : '');
        }
        for (const match of [...content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]) {
            if (match[1].startsWith('data:')) continue;
            try {
                const target = path.resolve(path.dirname(file), match[1]);
                if (!target.startsWith(publicRoot + path.sep)) { content = content.replace(match[0], 'none'); continue; }
                const mime = path.extname(target) === '.woff2' ? 'font/woff2' : path.extname(target) === '.woff' ? 'font/woff' : 'application/octet-stream';
                content = content.replace(match[0], `url(data:${mime};base64,${(await readFile(target)).toString('base64')})`);
            } catch { content = content.replace(match[0], 'none'); }
        }
        return content;
    };
    let styles = '';
    for (const name of ['core.css','core_fonts.css','core_fascie.css','core_ui.css','impostazioni.css']) styles += await localCss(path.join(publicRoot, 'assets/css', name));
    const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        `<style>${styles}</style></head><body class="base-bg"><div class="base-container"><main class="base-main"><div class="page-container pt-header-extra pb-footer-extra"></div></main></div></body></html>`;
    let browser;
    try {
        browser = await chromium.launch({channel: 'chrome', headless: true});
        const artifacts = path.join(project, '.codex-tmp/complete-recovery-ui'); await mkdir(artifacts, {recursive: true});
        for (const language of ['en','zh','hi']) for (const viewport of [{width:393,height:852},{width:1280,height:900}]) {
            const page = await browser.newPage({viewport}); const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => route.abort());
            await page.setContent(html); await page.addScriptTag({content: script});
            const catalog = await page.evaluate(language => window.mountRecoveryFixture(language), language);
            const formLayout = await page.locator('.complete-recovery-form').evaluate(node => {
                const css = getComputedStyle(node);
                return {inline: node.hasAttribute('style'), transform: css.transform, overflow: css.overflow,
                    maxHeight: css.maxHeight, maxWidth: parseFloat(css.maxWidth), expectedMaxWidth: 44 * parseFloat(getComputedStyle(document.documentElement).fontSize)};
            });
            assert.equal(formLayout.inline, false); assert.equal(formLayout.transform, 'none');
            assert.equal(formLayout.overflow, 'visible'); assert.equal(formLayout.maxHeight, 'none');
            assert.ok(Math.abs(formLayout.maxWidth - formLayout.expectedMaxWidth) < 0.1);
            await page.locator('#complete-recovery-file').setInputFiles({name:'synthetic.cpbackup',mimeType:'application/x-codici-password-backup',buffer:Buffer.from('synthetic fixture only')});
            await page.locator('#complete-recovery-key').fill('synthetic fixture key');
            const password = ['Synthetic','Master',Date.now(),'aA!'].join('-');
            await page.locator('#complete-recovery-password').fill(password); await page.locator('#complete-recovery-repeat').fill(password);
            assert.equal(await page.locator('input[type=password]').evaluateAll(nodes => nodes.every(node => !!node.closest('form'))), true);
            await page.getByRole('button', {name:catalog.recovery_verify, exact:true}).click();
            const dialog = page.getByRole('dialog'); await dialog.waitFor();
            assert.equal(await dialog.locator('.complete-recovery-counts').evaluate(node => !node.hasAttribute('style') && getComputedStyle(node).whiteSpace === 'pre-line'), true);
            assert.ok((await dialog.textContent()).includes(catalog.recovery_external_notice.replace('{count}','2')));
            assert.equal(await dialog.getByRole('button', {name:catalog.recovery_start,exact:true}).isDisabled(), true);
            await dialog.getByRole('checkbox').check();
            const start = dialog.getByRole('button', {name:catalog.recovery_start,exact:true});
            const bounds = await start.boundingBox(); assert.ok(bounds && bounds.y + bounds.height <= viewport.height + 1);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
            assert.equal(await page.evaluate(() => window.fixtureRpc), 0);
            if (viewport.width === 393) await page.screenshot({path:path.join(artifacts, `${language}-mobile-preview.png`)});
            await page.keyboard.press('Escape'); await dialog.waitFor({state:'detached'});
            assert.equal(await page.locator('input[type=password]').evaluateAll(nodes => nodes.every(node => node.value === '')), true);
            assert.equal(await page.locator('#complete-recovery-file').evaluate(node => node.files.length), 0);
            assert.deepEqual(errors, []); await page.close();
        }
    } finally { await browser?.close(); }
});
