/**
 * Controllo storico dei cataloghi lingua.
 *
 * Fino alla release 1.2.257 questo file provava a ricreare i cataloghi da
 * translations.js. La sorgente inline non esiste piu: i file in
 * Frontend/public/assets/js/translations/ sono ora le fonti autorevoli.
 *
 * Il nome resta per compatibilita con eventuali comandi locali, ma il comando
 * e intenzionalmente non distruttivo: non scrive file e segnala le lingue che
 * non hanno ancora tutte le chiavi effettivamente usate dall'app.
 */

import { buildI18nInventory } from './audit-i18n-quality.mjs';

const inventory = buildI18nInventory();
const incomplete = [];

for (const language of inventory.declaredLanguages) {
    const keys = inventory.dictionaries[language]?.keys || 0;
    const missing = inventory.missingKeysByLanguage[language] || [];
    console.log(`${language}: ${keys} chiavi; ${missing.length} chiavi usate mancanti`);
    if (missing.length) incomplete.push({ language, missing });
}

if (incomplete.length) {
    console.error('\nCataloghi incompleti:');
    for (const item of incomplete) {
        console.error(`- ${item.language}: ${item.missing.length} chiavi usate mancanti`);
    }
    process.exitCode = 1;
} else {
    console.log('\nTutti i cataloghi contengono le chiavi effettivamente usate.');
}
