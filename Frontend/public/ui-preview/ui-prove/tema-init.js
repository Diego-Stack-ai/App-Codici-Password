// Applica il tema prima del disegno della pagina, per evitare il lampo bianco/scuro.
(() => {
    let tema = 'auto';
    try { tema = localStorage.getItem('ui-prove-tema') || 'auto'; } catch { /* Archivio locale non disponibile. */ }
    const scuro = tema === 'scuro' || (tema !== 'chiaro' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.tema = scuro ? 'scuro' : 'chiaro';
})();
