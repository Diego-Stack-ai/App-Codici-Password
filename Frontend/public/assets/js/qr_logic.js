
// --- QR CODE LOGIC ---
window.updateQRCode = function () {
    const container = document.getElementById('qrcode-container');
    if (!container) return;

    // Clear previous
    container.innerHTML = '';

    // Collect data based on flags
    const data = {};

    // 1. Personal Data
    if (qrConfig.nome) data.nome = document.getElementById('nome-view')?.textContent || '';
    if (qrConfig.cognome) data.cognome = document.getElementById('cognome-view')?.textContent || '';
    if (qrConfig.cf) data.cf = document.getElementById('cf-view')?.textContent || '';
    if (qrConfig.birth_date) data.nascita = document.getElementById('birth_date-view')?.textContent || '';
    if (qrConfig.birth_place) data.luogo_nascita = document.getElementById('birth_place-view')?.textContent || '';

    // 2. Residence
    if (qrConfig.residence_address) data.indirizzo = document.getElementById('residence_address-view')?.textContent || '';
    if (qrConfig.residence_city) data.citta = document.getElementById('residence_city-view')?.textContent || '';
    if (qrConfig.residence_cap) data.cap = document.getElementById('residence_cap-view')?.textContent || '';

    // 3. Contacts
    if (qrConfig.mobile_private) data.cellulare = document.getElementById('mobile_private-view')?.textContent || '';
    if (qrConfig.phone_private) data.telefono = document.getElementById('phone_private-view')?.textContent || '';

    // Emails (only those with qr flag = true)
    const qrEmails = contactEmails.filter(e => e.qr).map(e => e.address);
    if (qrEmails.length > 0) data.emails = qrEmails;

    // Filter out empty ' - ' or '-'
    Object.keys(data).forEach(k => {
        if (data[k] === '-' || data[k] === ' - ') delete data[k];
    });

    // Generate String (vCard or JSON? Let's use simple JSON for density or vCard for standard compatibility. 
    // Using structured text for custom reader or vCard 3.0 for broad compatibility)
    // Let's use a simple key-value text format to be robust and readable
    const qrText = JSON.stringify(data);

    try {
        new QRCode(container, {
            text: qrText,
            width: 100,
            height: 100,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });
    } catch (e) {
        console.error("QR Generation Error", e);
        container.innerHTML = '<span class="text-xs text-red-400">Error</span>';
    }
};

// Initial call
setTimeout(window.updateQRCode, 1000);

// Attach listeners to QR checkboxes
document.querySelectorAll('.checkbox-qr').forEach(chk => {
    chk.addEventListener('change', (ev) => {
        const field = ev.target.dataset.qrField;
        if (field) {
            qrConfig[field] = ev.target.checked;
            window.updateQRCode();
        }
    });
});

window.openQRZoom = function () {
    // Implement zoom modal logic if needed, or simple alert/overlay
    // For now, just a placeholder or could reuse the image
    const img = document.querySelector('#qrcode-container img');
    if (img) {
        // Create a modal on the fly
        const modal = document.createElement('div');
        modal.className = "fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-pointer animate-in fade-in duration-200";
        modal.onclick = () => modal.remove();
        modal.innerHTML = `<img src="${img.src}" class="w-64 h-64 bg-white p-4 rounded-xl shadow-2xl scale-100 hover:scale-105 transition-transform">`;
        document.body.appendChild(modal);
    }
}
