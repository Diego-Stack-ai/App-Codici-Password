// Static application strings only. Further languages can extend this map.
export const DOCUMENTATION_UI_LABELS = Object.freeze({
    'guide.ui.open': 'Aiuto su questa pagina',
    'guide.ui.start': 'Guida e primi passi',
    'guide.ui.close': 'Chiudi guida',
    'guide.ui.title': 'Guida dell’app',
    'guide.ui.page': 'Pagina da conoscere',
    'guide.ui.firstSteps': 'Primi passi',
    'guide.ui.context': 'Questa pagina',
    'guide.ui.related': 'Schede correlate',
    'guide.ui.privacy': 'La guida spiega i comandi senza leggere i tuoi dati, sbloccare il Vault o eseguire operazioni.',
    'guide.ui.fallback': 'Le istruzioni di questa edizione sono disponibili in italiano.',
    'guide.ui.loading': 'Caricamento della guida…',
    'guide.ui.error': 'La guida non è disponibile. Riprova; per usarla offline prepara prima la shell dell’app.',
    'guide.ui.busy': 'Chiudi il dialogo corrente prima di aprire la guida.',
    'guide.ui.version': 'Edizione delle istruzioni'
});

export function documentationLabel(key) {
    return DOCUMENTATION_UI_LABELS[key] || key;
}
