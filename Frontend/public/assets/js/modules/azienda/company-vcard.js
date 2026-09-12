export function buildCompanyVCard(input) {
    const escape = value => String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
    const encode = value => typeof value === 'string' ? escape(value) : Array.isArray(value) ? value.map(encode) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item)])) : value;
    const data = encode(input);
    const config = data.qrConfig || {};
    let v = "BEGIN:VCARD\nVERSION:3.0\n";

    // Ragione Sociale (FN, ORG)
    // Default true if config missing (retrocompatibility), explicit false check
    if (config.ragioneSociale !== false) {
        v += `FN:${data.ragioneSociale || 'Azienda'}\nORG:${data.ragioneSociale || ''}\n`;
    }

    // Referente
    const nome = (config.referenteNome !== false) ? (data.referenteNome || '') : '';
    const cognome = (config.referenteCognome !== false) ? (data.referenteCognome || '') : '';
    const titolo = (config.referenteTitolo !== false) ? (data.referenteTitolo || '') : '';

    if (nome || cognome) {
        v += `N:${cognome};${nome};;;\n`;
    }
    if (titolo) {
        v += `TITLE:${titolo}\n`;
    }

    // Cellulare Referente
    if (config.referenteCellulare !== false && data.referenteCellulare) {
        v += `TEL;TYPE=CELL:${data.referenteCellulare}\n`;
    }

    // Email (PEC)
    const pecEmail = data.emails?.pec?.email || data.aziendaEmail;
    if (config.aziendaEmail !== false && pecEmail) {
        v += `EMAIL;TYPE=WORK,INTERNET:${pecEmail}\n`;
    }

    // Email (Amministrazione)
    const adminEmail = data.emails?.amministrazione?.email;
    if (config.adminEmail && adminEmail) {
        v += `EMAIL;TYPE=WORK,INTERNET:${adminEmail}\n`;
    }

    // Email (Personale)
    const persEmail = data.emails?.personale?.email;
    if (config.persEmail && persEmail) {
        v += `EMAIL;TYPE=HOME,INTERNET:${persEmail}\n`;
    }

    // Extra Emails
    if (data.emails?.extra && Array.isArray(data.emails.extra)) {
        data.emails.extra.forEach(e => {
            if (e.qr !== false && e.email) {
                v += `EMAIL;TYPE=WORK,INTERNET:${e.email}\n`;
            }
        });
    }

    // Extra Data in NOTE or Custom Fields
    let notes = [];
    if (config.partitaIva !== false && data.partitaIva) notes.push(`P.IVA: ${data.partitaIva}`);
    if (config.codiceSDI !== false && data.codiceSDI) notes.push(`SDI: ${data.codiceSDI}`);
    if (config.numeroCCIAA !== false && data.numeroCCIAA) notes.push(`CCIAA: ${data.numeroCCIAA}`);

    if (config.dataIscrizione !== false && data.dataIscrizione) {
        const d = data.dataIscrizione.split('-');
        const dIT = d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : data.dataIscrizione;
        notes.push(`Iscr: ${dIT}`);
    }

    // Sede Legale (qrLegale)
    if (config.qrLegale !== false) {
        const addr = data.indirizzoSede || '';
        const civ = data.civicoSede || '';
        const cit = data.cittaSede || '';
        const prov = data.provinciaSede || '';
        const cap = data.capSede || '';
        if (addr || cit) {
            v += `ADR;TYPE=WORK,PREF:;;${addr} ${civ};${cit};${prov};${cap};Italiana\n`;
        }
    }

    // Altre Sedi (Dynamic Loop)
    if (data.altreSedi && Array.isArray(data.altreSedi)) {
        data.altreSedi.forEach(sede => {
            if (sede.qr !== false && (sede.indirizzo || sede.citta)) {
                let typeParams = 'WORK';
                const tLower = (sede.tipo || '').toLowerCase();
                if (tLower.includes('amm')) typeParams = 'WORK,POSTAL';
                else if (tLower.includes('oper') || tLower.includes('magazz') || tLower.includes('logis')) typeParams = 'WORK,PARCEL';

                v += `ADR;TYPE=${typeParams}:;;${sede.indirizzo || ''} ${sede.civico || ''};${sede.citta || ''};${sede.provincia || ''};${sede.cap || ''};Italiana\n`;

                // Add to notes for visibility if reader doesn't support multiple ADRs well
                notes.push(`${sede.tipo || 'Sede'}: ${sede.indirizzo || ''} ${sede.citta || ''}`);
            }
        });
    }

    if (notes.length > 0) {
        v += `NOTE:${notes.join(' - ')}\n`;
    }

    v += "END:VCARD";
    return v;
}
