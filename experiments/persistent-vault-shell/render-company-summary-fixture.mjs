import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {generateCompanySummaryPdf} from './company-summary-pdf.mjs';

// Synthetic rendering fixture only; no Firebase, authentication or user data.
const model = {title: 'Scheda aziendale', sections: [
    {title: 'Azienda', rows: [{label: 'Ragione sociale', value: 'Società Dimostrativa S.r.l.'}]},
    {title: 'Dati fiscali', rows: [{label: 'Partita IVA', value: '00000000000 (dato dimostrativo)'}, {label: 'Codice SDI', value: 'DEMO123'}]},
    {title: 'Referente', rows: [{label: 'Nome', value: 'Referente dimostrativo'}, {label: 'Ruolo', value: 'Amministrazione'}]},
    {title: 'Contatti', rows: [{label: 'Telefono', value: '+39 000 0000000'}, {label: 'PEC', value: 'azienda@example.invalid'}]},
    {title: 'Sede legale', rows: [{label: 'Indirizzo', value: 'Via della Città, 10'}, {label: 'Città', value: 'Località dimostrativa'}, {label: 'CAP', value: '00000'}]},
    {title: 'Altra sede - prova testo lungo', rows: [{label: 'Indirizzo dimostrativo', value: 'Recapito sintetico per verificare impaginazione e continuità del testo. '.repeat(75) + 'FINE-TESTO-DIMOSTRATIVO'}]}
]};
const regularFont = await readFile(new URL('./assets/pdf/LiberationSans-Regular.ttf', import.meta.url));
const boldFont = await readFile(new URL('./assets/pdf/LiberationSans-Bold.ttf', import.meta.url));
const bytes = await generateCompanySummaryPdf(model, {regularFont, boldFont, assertActive() {}});
const output = new URL('../../output/pdf/', import.meta.url); await mkdir(output, {recursive: true});
await writeFile(new URL('scheda-azienda-fixture.pdf', output), bytes);
console.log('Synthetic PDF written to output/pdf/scheda-azienda-fixture.pdf');
