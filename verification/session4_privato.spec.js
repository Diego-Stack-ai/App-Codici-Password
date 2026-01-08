const { test, expect } = require('@playwright/test');

const LOCAL_URL = 'http://localhost:8888/Frontend/public';

test.describe("Flusso Sezione Privato - Sessione 4", () => {

    test.beforeEach(async ({ page }) => {
        // Esegue il login per ottenere una sessione valida
        await page.goto(`${LOCAL_URL}/index.html`);
        const randomEmail = `test.user.${Date.now()}@example.com`;
        // Quick registration and verification to get a valid session
        await page.evaluate(async (email) => {
            const users = JSON.parse(localStorage.getItem('utenti') || '[]');
            const newUser = {
                id: Date.now().toString(),
                nome: 'Test',
                cognome: 'User',
                email: email,
                password: 'Password123',
                verified: true,
            };
            users.push(newUser);
            localStorage.setItem('utenti', JSON.stringify(users));
            sessionStorage.setItem('loggedInUser', JSON.stringify({ email: email, nome: 'Test' }));
        }, randomEmail);

        // Ora che siamo loggati, andiamo alla home
        await page.goto(`${LOCAL_URL}/home_page.html`);
    });

    test("Dovrebbe gestire la navigazione e le funzionalità della sezione privata", async ({ page }) => {
        // 1. Naviga da Home ad Account Privati
        await page.click('a[href="/Frontend/public/account_privati.html"]');
        await page.waitForURL('**/account_privati.html');
        await expect(page).toHaveTitle('Account Privati');

        // 2. Verifica UI in Account Privati
        await expect(page.locator('a[href="/Frontend/public/home_page.html"]')).toHaveCount(2); // Home e Indietro

        // 3. Verifica schede espandibili
        const firstCardBody = page.locator('.account-card .account-body').first();
        const firstCardHeader = page.locator('.account-header').first();
        await expect(firstCardBody).toBeHidden();
        await firstCardHeader.click();
        await expect(firstCardBody).toBeVisible();

        // 4. Verifica password-toggle e copy-to-clipboard
        const passwordInputLocator = 'input[id^="password-"]';
        await expect(firstCardBody.locator(passwordInputLocator)).toHaveAttribute('type', 'password');
        await firstCardBody.locator('.toggle-password').click();
        await expect(firstCardBody.locator(passwordInputLocator)).toHaveAttribute('type', 'text');

        await expect(firstCardBody.locator('.copy-button')).toBeVisible();

        // 5. Naviga ad Aggiungi Account
        await page.click('a[href="/Frontend/public/aggiungi_account_privato.html"]');
        await page.waitForURL('**/aggiungi_account_privato.html');
        await expect(page).toHaveTitle('Aggiungi Account Privato');
        await expect(page.locator('a[href="/Frontend/public/account_privati.html"]')).toBeVisible(); // Indietro

        // 6. Torna indietro e naviga a Dettaglio Account
        await page.goBack();
        await firstCardHeader.click(); // Riapri la scheda
        await page.click('a[href="/Frontend/public/dettaglio_account_privato.html"]');
        await page.waitForURL('**/dettaglio_account_privato.html');
        await expect(page).toHaveTitle('Dettaglio Account Privato');

        // 7. Naviga a Dati Anagrafici (simulato, non c'è link diretto)
        await page.goto(`${LOCAL_URL}/dati_anagrafici_privato.html`);
        await expect(page).toHaveTitle('Dati Anagrafici Privato');

        // Verifica modalità modifica
        await expect(page.locator('#edit-actions')).toBeHidden();
        await page.click('#edit-button');
        await expect(page.locator('#edit-actions')).toBeVisible();
        await page.click('#cancel-button');
        await expect(page.locator('#edit-actions')).toBeHidden();
    });
});
