// La preferenza del tema è condivisa soltanto tra queste prove grafiche.
(() => {
    const TEMI = ['auto', 'chiaro', 'scuro'];
    const leggi = () => { try { return localStorage.getItem('ui-prove-tema') || 'auto'; } catch { return 'auto'; } };
    document.getElementById('tema-tutte').addEventListener('click', () => {
        const prossimo = TEMI[(TEMI.indexOf(leggi()) + 1) % TEMI.length];
        try { localStorage.setItem('ui-prove-tema', prossimo); } catch { /* Solo comodità locale. */ }
        const scuro = prossimo === 'scuro' || (prossimo === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.dataset.tema = scuro ? 'scuro' : 'chiaro';
    });
})();
