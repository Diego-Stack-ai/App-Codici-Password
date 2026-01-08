const { test, expect } = require('@playwright/test');

const LOCAL_URL = 'http://localhost:8888/Frontend/public';

test.describe("Flusso di Navigazione - Sessione 3", () => {

    // Esegue il login prima di ogni test in questa suite
    test.beforeEach(async ({ page }) => {
        // Esegue una registrazione e una verifica rapida per creare un utente
        await page.goto(`${LOCAL_URL}/registrati.html`);
        const randomEmail = `test.user.${Date.now()}@example.com`;
        await page.fill('#nome', 'Test');
        await page.fill('#cognome', 'Nav');
        await page.fill('#email', randomEmail);
        await page.fill('#password', 'Password123');
        await page.click('button[type="submit"]');

        await page.waitForURL('**/verifica_email.html');

        const verificationCode = await page.evaluate((email) => {
            const users = JSON.parse(localStorage.getItem('utenti'));
            const user = users.find(u => u.email === email);
            return user.verificationCode;
        }, randomEmail);

        await page.fill('#code-input', verificationCode);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/home_page.html');
    });

    test("Dovrebbe navigare correttamente dalla Home alle sezioni principali", async ({ page }) => {
        // A questo punto, siamo già autenticati e sulla home page
        await expect(page).toHaveTitle('Home Page');

        // **2. Naviga a Lista Aziende**
        await page.click('a[href="/Frontend/public/lista_aziende.html"]');
        await page.waitForURL('**/lista_aziende.html');
        await expect(page).toHaveTitle('Lista Aziende');

        // Controlla i pulsanti HOME/INDIETRO
        await expect(page.locator('a[href="/Frontend/public/home_page.html"]')).toHaveCount(2);

        // Verifica la funzionalità delle schede espandibili
        const firstCardBody = page.locator('.account-card .account-body').first();
        await expect(firstCardBody).toBeHidden();
        await page.locator('.account-card .account-header').first().click();
        await expect(firstCardBody).toBeVisible();

        // **3. Torna alla Home e naviga a Scadenze**
        await page.goto(`${LOCAL_URL}/home_page.html`);
        await page.click('a[href="/Frontend/public/scadenze.html"]');
        await page.waitForURL('**/scadenze.html');
        await expect(page).toHaveTitle('Scadenze');

        // Controlla i pulsanti INDIETRO e HOME
        await expect(page.locator('a[href="/Frontend/public/home_page.html"]')).toHaveCount(2);

        // **4. Torna alla Home e naviga a Gestione Allegati (dalla nav bar)**
        await page.goto(`${LOCAL_URL}/home_page.html`);
        await page.goto(`${LOCAL_URL}/lista_aziende.html`);
        await page.click('a[href="/Frontend/public/gestione_allegati.html"]');
        await page.waitForURL('**/gestione_allegati.html');
        await expect(page).toHaveTitle('Gestione Allegati');

        // Controlla i pulsanti HOME/INDIETRO
        await expect(page.locator('a[href="/Frontend/public/home_page.html"]')).toHaveCount(2);
    });
});
