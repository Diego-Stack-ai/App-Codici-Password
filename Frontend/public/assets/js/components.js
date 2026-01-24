/**
 * TITANIUM COMPONENTS SYSTEM
 * Utility per caricare Header e Footer in modo asincrono
 */

export async function initComponents() {
    try {
        const [headerRes, footerRes] = await Promise.all([
            fetch('assets/components/header.html'),
            fetch('assets/components/footer.html')
        ]);

        const headerHtml = await headerRes.text();
        const footerHtml = await footerRes.text();

        const headerTarget = document.getElementById('header-placeholder');
        const footerTarget = document.getElementById('footer-placeholder');

        if (headerTarget) headerTarget.innerHTML = headerHtml;
        if (footerTarget) footerTarget.innerHTML = footerHtml;

        console.log("Titanium Components Loaded.");
    } catch (e) {
        console.error("Errore caricamento componenti:", e);
    }
}
