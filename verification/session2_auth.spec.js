const { test, expect } = require('@playwright/test');

const LOCAL_URL = 'http://localhost:8888/Frontend/public';

test.describe("Flusso di Autenticazione Completo", () => {

    test("Dovrebbe permettere a un utente di registrarsi, verificare l'email e fare il login", async ({ page }) => {
        // **1. Registrazione**
        await page.goto(`${LOCAL_URL}/registrati.html`);
        await expect(page.locator('a[href="/Frontend/public/home_page.html"]')).toBeVisible();
        await expect(page.locator('a[href="/Frontend/public/index.html"]').first()).toBeVisible();

        const randomEmail = `test.user.${Date.now()}@example.com`;
        await page.fill('#nome', 'Test');
        await page.fill('#cognome', 'User');
        await page.fill('#email', randomEmail);
        await page.fill('#password', 'Password123');
        await page.click('button[type="submit"]');

        // **2. Verifica Email**
        await page.waitForURL('**/verifica_email.html');
        await expect(page).toHaveTitle('Verifica Email');
        await expect(page.locator('a[href="/Frontend/public/home_page.html"]')).toBeVisible();
        await expect(page.locator('a[href="/Frontend/public/registrati.html"]')).toBeVisible();

        const verificationCode = await page.evaluate((email) => {
            const users = JSON.parse(localStorage.getItem('utenti'));
            const user = users.find(u => u.email === email);
            return user.verificationCode;
        }, randomEmail);

        await page.fill('#code-input', verificationCode);
        await page.click('button[type="submit"]');

        // **3. Login**
        await page.waitForURL('**/home_page.html');
        await expect(page).toHaveTitle('Home Page');

        await page.click('#logout-button');
        await page.waitForURL('**/index.html');

        await page.goto(`${LOCAL_URL}/index.html`);
        await expect(page).toHaveTitle('Accedi');
        await expect(page.locator('a[href="/Frontend/public/home_page.html"]')).toBeVisible();
        await expect(page.locator('.copy-button[data-copy-target="email"]')).toBeVisible();
        await expect(page.locator('.copy-button[data-copy-target="password"]')).toBeVisible();

        await page.fill('#email', randomEmail);
        await page.fill('#password', 'Password123');
        await page.click('button[type="submit"]');

        // **4. Verifica Finale**
        await page.waitForURL('**/home_page.html');
        await expect(page).toHaveTitle('Home Page');

        // Verifica che un messaggio di benvenuto sia presente, senza controllare il nome specifico
        await expect(page.locator('h2')).toBeVisible();
    });

});
