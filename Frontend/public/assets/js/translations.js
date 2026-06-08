import { LOG } from './logger.js';

/**
 * TRANSLATIONS LAZY LOADER (V2.0 — Auto-generato il 2026-06-06)
 * Italiano caricato inline (fallback universale, ~9.5 KB).
 * Altre 7 lingue caricate on-demand via import() dinamico da ./translations/{lang}.js
 *
 * API pubblica:
 *   loadLanguage(lang) — async, chiama all'avvio PRIMA di qualsiasi render
 *   t(key)            — sincrona, traduce la chiave nella lingua attiva
 *   applyGlobalTranslations() — applica data-t, data-t-placeholder, data-t-aria al DOM
 *
 * Rigenera le lingue con: node scripts/split-translations.mjs
 */

// ─── Dizionario runtime (lingua attiva) ──────────────────────────────────────
let _dict = {};

// ─── Italiano inline (fallback universale) ────────────────────────────────────
const _it = {
        account_archive: "Archivio Account",
        account_archive_desc: "Gestisci gli account archiviati",
        add_address: "Aggiungi Indirizzo",
        add_doc: "Aggiungi Documento",
        add_email: "Aggiungi Email",
        add_logo: "Aggiungi Logo",
        add_phone: "Aggiungi Numero",
        add_short: "Aggiungi",
        add_utility: "Aggiungi Utenza",
        address: "Indirizzo",
        address_placeholder: "Via / Piazza",
        analyzing_data: "Analisi dati...",
        app_info_security_desc: "Sviluppata per offrire massima crittografia e facilità di condivisione tramite standard base.",
        app_info_title: "Informazioni sull'App",
        archive: "Archivio",
        archive_all: "Tutti gli archiviati",
        archive_private_only: "Solo Archivio Privato",
        archive_search_placeholder: "Cerca nell'archivio...",
        area_privata_title: "Area Privata",
        aria_toggle_section: "Espandi o comprimi sezione",
        auth_button: "Accedi",
        back_to_login_link: "Torna all'accesso",
        banking_hint: "Puoi attivare le coordinate bancarie e carte di credito in modalità Modifica.",
        body_label: "Corpo",
        camera: "Camera",
        cancel: "Annulla",
        cancel_short: "Annulla",
        cap: "CAP",
        card_documents_desc: "Gestione avvisi per Documenti e Scadenze Varie",
        card_documents_note: "Imposta i criteri di avviso automatico per Documenti d'Identità, Patenti e scadenze personali.",
        card_documents_title: "Documenti",
        card_general_desc: "Configura oggetti e testi per scadenze generiche",
        card_general_note: "Configura le regole per scadenze varie non categorizzate (Corsi, Affitti, Abbonamenti).",
        card_general_title: "Regole Generali",
        card_vehicles_desc: "Configura oggetti, periodi e frequenze email per veicoli",
        card_vehicles_note: "Definisci giorni di preavviso e frequenza per Assicurazioni, Bolli e scadenze dei mezzi.",
        card_vehicles_title: "Automezzi",
        cciaa_number: "N. CCIAA",
        change_password: "Cambio Password",
        change_password_desc: "Aggiorna la tua chiave d'accesso",
        city: "Città",
        codice_societa: "Codice Società",
        company_logo: "Logo Azienda",
        company_name: "Ragione Sociale",
        company_notes: "Note Aziendali",
        company_notes_placeholder: "Dati aggiuntivi (Telefono, Fax, Note...)",
        confirm: "Conferma",
        confirm_delete_card: "Sei sicuro di voler eliminare questa carta?",
        confirm_delete_company_msg: "Sei sicuro di voler eliminare \\\"{name}\\\"? Questa operazione cancellerà anche tutti gli account associati.",
        confirm_delete_company_title: "ELIMINAZIONE DEFINITIVA",
        confirm_delete_forever_msg: "Scrivi 'SI' per confermare l'eliminazione definitiva.",
        confirm_delete_forever_title: "ELIMINA PER SEMPRE",
        confirm_delete_item: "Eliminare voce?",
        confirm_delete_msg: "Sei sicuro di voler eliminare definitivamente questo account?",
        confirm_delete_title: "Conferma eliminazione",
        confirm_empty_trash_msg: "Scrivi 'SVUOTA' per eliminare tutto definitivamente.",
        confirm_empty_trash_title: "SVUOTA CESTINO",
        confirm_new_password: "Conferma Password",
        confirm_password_label: "Conferma Password",
        confirm_revoke_msg: "Vuoi rimuovere l'accesso per questo collaboratore?",
        confirm_revoke_title: "REVOCA ACCESSO",
        contact_removed: "Contatto rimosso con successo",
        copied: "Copiato!",
        create_account_btn: "Nuova registrazione",
        data_tag: "[Data]",
        deadlines_total: "Scadenze Totali",
        delete: "Elimina",
        delete_mode_select: "Seleziona l'azienda da eliminare",
        doc_tag: "[Doc]",
        docs_owners: "Documenti & Proprietari",
        document: "Documento",
        document_types: "Tipi Documento",
        documents_config_title: "Configurazione Documenti",
        edit_short: "Edita",
        email_address: "Indirizzo Email",
        email_address_label: "Indirizzo Email",
        email_label: "Email",
        email_placeholder: "mario.rossi@email.com",
        email_subjects: "Oggetti Email",
        email_templates: "Testo E-Mail",
        email_type_placeholder: "TIPO EMAIL (ES. ORDINI)",
        empty_contacts: "La tua rubrica è vuota",
        empty_trash: "Svuota Cestino",
        error_auth_failed: "Email o Password errati",
        error_config_save: "Errore salvataggio",
        error_generic: "Si è verificato un errore.",
        error_invalid_email: "Inserisci un'email valida",
        error_link_expired: "Il link di recupero è scaduto.",
        error_missing_fields: "Campi obbligatori mancanti",
        error_only_owner_archive: "Solo il proprietario può archiviare.",
        error_only_owner_delete: "Impossibile eliminare account condivisi.",
        error_password_mismatch: "Le password non coincidono",
        error_password_too_short: "Minimo 12 caratteri richiesti",
        error_reauth_required: "Rieffettua il login per motivi di sicurezza.",
        error_weak_pass_complex: "Servono almeno 3 MAIUSCOLE e 3 Simboli!",
        expired: "Scaduto",
        expiry_rules: "Regole invio scadenze",
        expiry_rules_title_page: "Regole Scadenze",
        face_id: "Sblocco con Face ID",
        fax: "Fax",
        filter_all: "Tutte",
        filter_completed: "Completate",
        filter_expiring: "In scadenza",
        filter_urgent: "Urgenti",
        forgot_password: "Password dimenticata?",
        gallery: "Galleria",
        general_config_title: "Configurazione Generali",
        general_deadline_types: "Tipi Scadenza",
        general_settings: "Impostazioni Generali",
        greeting_afternoon: "Buon pomeriggio,",
        greeting_evening: "Buona sera,",
        greeting_morning: "Buon giorno,",
        have_account_text: "Hai già un account?",
        identity_registered: "Identità registrata correttamente",
        invite_accept: "Accetta",
        invite_received_msg: "ha condiviso un account con te:",
        invite_received_title: "Nuovo Invito",
        invite_reject: "Rifiuta",
        invite_search_placeholder: "Cerca contatto o inserisci email...",
        label_account: "Account",
        label_address: "Indirizzo",
        label_app_code: "Codice App",
        label_birth_data: "Dati Nascita",
        label_cf: "Codice Fiscale",
        label_expiry_date: "Data di Scadenza",
        label_id_number: "Numero Identificazione",
        label_issue_date: "Data di Emissione",
        label_issued_by: "Emessa da",
        label_locality: "Località",
        label_name: "Nome",
        label_name_surname: "Nome & Cognome",
        label_password: "Password",
        label_pin: "PIN",
        label_puk: "PUK",
        label_release_place: "Luogo Rilascio",
        label_surname: "Cognome",
        label_user: "Utente",
        language_title: "Lingua App",
        legal_form: "Forma Giuridica",
        loading: "Caricamento...",
        loading_data: "Ricezione Dati...",
        lock_inactivity: "Tempo di Inattività",
        login_now_link: "Accedi ora",
        login_subtitle: "Accesso Sicuro",
        login_title: "Accedi",
        logout: "Esci dall'account",
        logout_confirm: "Vuoi davvero uscire dal sistema?",
        logout_confirm_msg: "Dovrai effettuare nuovamente il login per accedere.",
        logout_confirm_title: "Vuoi uscire?",
        manage_account_data: "Gestisci Account",
        modal_title_add: "AGGIUNGI",
        models_plates: "Modelli & Targhe",
        new: "Nuovo",
        new_company: "Nuova Azienda",
        new_contact: "Nuovo Contatto",
        new_password: "Nuova Password",
        no_accounts_found: "Nessun account trovato.",
        no_active_data: "Nessun dato attivo",
        no_attachments: "Nessun allegato caricato",
        no_data: "Nessun dato",
        no_data_configured: "Nessun dato configurato",
        no_deadlines_found: "Nessuna scadenza trovata",
        no_utilities: "Nessuna utenza registrata",
        notes: "Note",
        notes_attachments: "Note & Allegati",
        notes_placeholder: "Note aggiuntive...",
        notification_recipients: "Destinatari Notifica",
        notifications_history_title: "Storico Notifiche",
        numero_iscrizione: "Numero Iscrizione",
        object_tag: "[Oggetto]",
        office_type_placeholder: "TIPO SEDE (ES. OPERATIVA)",
        page_title_profile: "Profilo Utente",
        password_label: "Password",
        password_label_reg: "Password",
        password_placeholder_reg: "********",
        password_req_title: "Scegli una password sicura",
        password_success: "Password aggiornata con successo!",
        pec_address: "Indirizzo PEC",
        pec_address_placeholder: "email@pec.it",
        placeholder_type_doc: "Es. Patente",
        placeholder_type_general: "Es. Assicurazione Generica",
        placeholder_type_vehicle: "Inserisci il nome (es. Revisione)",
        plate_tag: "[Targa]",
        primary_email_label: "Email Primaria",
        privacy_1_text: "Il Titolare del trattamento è: Boschetto Diego. Per richieste privacy e diritti GDPR è possibile contattare il titolare tramite i recapiti indicati nell’app.",
        privacy_1_title: "1. Titolare del Trattamento",
        privacy_10_text: "L’app non è destinata a minori di 16 anni. Non è prevista la raccolta intenzionale di dati di minori.",
        privacy_10_title: "10. Minori",
        privacy_11_text: "Questa informativa può essere aggiornata. In caso di modifiche rilevanti, l’utente verrà informato tramite la pagina o avviso in app.",
        privacy_11_title: "11. Modifiche all'informativa",
        privacy_2_text: "I dati sono trattati per: registrazione e accesso, salvataggio nel vault, condivisione controllata, sicurezza, prevenzione abusi e manutenzione tecnica.",
        privacy_2_title: "2. Finalità del trattamento",
        privacy_3_1_text: "Email, nome o nickname, avatar (se presente).",
        privacy_3_1_title: "3.1 Dati di registrazione e profilo",
        privacy_3_2_text: "Password, credenziali, note personali, codici, accessi e allegati. L’utente è responsabile dei contenuti inseriti.",
        privacy_3_2_title: "3.2 Dati inseriti nel vault (contenuti)",
        privacy_3_3_text: "Log di autenticazione, eventi di sistema, informazioni di debug e token di notifica.",
        privacy_3_3_title: "3.3 Dati tecnici e log",
        privacy_3_title: "3. Tipologie di dati trattati",
        privacy_4_text: "Esecuzione del servizio richiesto (art. 6.1.b GDPR), legittimo interesse alla sicurezza (art. 6.1.f GDPR) e consenso (art. 6.1.a GDPR).",
        privacy_4_title: "4. Base giuridica del trattamento",
        privacy_5_text: "Utilizziamo HTTPS/TLS, Firebase Auth, Security Rules e separazione logica. ⚠️ Nota: in questa fase di sviluppo, alcune info potrebbero essere memorizzate in chiaro prima della cifratura definitiva.",
        privacy_5_title: "5. Modalità e misure di sicurezza",
        privacy_6_text: "L’app utilizza Google Firebase (Authentication, Firestore, Storage, Hosting). I dati sono conservati su infrastrutture cloud distribuite.",
        privacy_6_title: "6. Dove vengono conservati i dati",
        privacy_7_text: "I dati non sono venduti. Sono condivisi solo su azione esplicita dell’utente o con i fornitori tecnici necessari (Google Firebase).",
        privacy_7_title: "7. Comunicazione e condivisione",
        privacy_8_text: "I dati sono conservati finché l’account è attivo. Alla cancellazione, i dati vengono rimossi entro tempi tecnici compatibili con la piattaforma.",
        privacy_8_title: "8. Periodo di conservazione",
        privacy_9_text: "Accesso, rettifica, cancellazione, limitazione, portabilità e opposizione. È possibile revocare il consenso alle notifiche dalle impostazioni.",
        privacy_9_title: "9. Diritti dell’utente (GDPR)",
        privacy_extended_intro: "La presente informativa descrive le modalità di trattamento dei dati personali effettuato tramite l’applicazione “App Codici Password”.",
        privacy_policy_title: "Informativa sul trattamento dei dati",
        privacy_short_details_link: "📌 Per i dettagli completi: leggi l’Informativa Estesa.",
        privacy_short_title: "Informativa Privacy (Sintesi)",
        privacy_title: "Trattamento dati personali",
        privacy_update_text: "Ultimo aggiornamento: Gennaio 2026",
        profile_addresses: "Residenza",
        profile_addresses_utilities: "Indirizzi & Utenze",
        profile_docs_digital: "Documenti Digitali",
        profile_emails: "Email",
        profile_guide_step1: "Gestisci i tuoi dati (Anagrafica, Residenza, Documenti) selezionando le varie sezioni.",
        profile_guide_step2: "Seleziona la spunta QR per scegliere quali dati mostrare nella condivisione.",
        profile_guide_title: "Guida Profilo",
        profile_notes: "Note Anagrafica",
        profile_personal: "Dati Personali",
        profile_phones: "Contatti Telefonici",
        prompt_days_notice: "Giorni di Periodo (Preavviso):",
        prompt_freq_days: "Giorni di Frequenza:",
        prompt_new_doc_detail: "Nuovo Dettaglio (Es. AH12345 - Patente - Rossi Mario):",
        prompt_new_doc_type: "Nuovo Tipo Documento:",
        prompt_new_email_text: "Nuovo Testo Email:",
        prompt_new_general_type: "Nuovo Tipo Scadenza:",
        prompt_new_subject: "Nuovo Oggetto Email:",
        prompt_new_vehicle: "Nuovo Veicolo (Modello - Targa):",
        province: "Prov.",
        referent_details: "Dati Referente",
        referent_role: "Ruolo / Titolo",
        referent_role_placeholder: "es. Amministratore",
        register_link: "Registrazione nuovo utente",
        register_page_title: "Registrati",
        register_subtitle: "Crea il tuo account sicuro",
        registration_date: "Data Iscri.",
        reset_hint: "Ti invieremo un collegamento sicuro per impostare una nuova chiave d'accesso.",
        reset_page_title: "Recupero",
        restore: "Ripristina",
        revoke: "Revoca",
        rubrica_shared_label: "Condivisi",
        rubrica_title: "Rubrica Contatti",
        save: "Salva",
        save_contact: "Salva Contatto",
        save_new_pass: "Salva nuova password",
        save_short: "Salva",
        sdi_code: "Codice SDI / Univoco",
        search_deadlines_placeholder: "Cerca scadenze...",
        searching_archives: "Ricerca archivi...",
        secondary_email_label: "Email Secondaria",
        section_company_title: "Azienda",
        section_deadlines_title: "Scadenze",
        section_email_template: "Testo E-Mail",
        section_note: "Note",
        section_personal_accounts: "Account Personali",
        section_private_title: "Privato",
        section_security: "Sicurezza",
        section_shared_accounts: "Account Condivisi",
        section_shared_note: "Note Condivise",
        section_support: "Supporto",
        section_syntax_title: "Sintassi Automatica",
        section_urgencies_title: "Urgenze",
        select_email: "Seleziona email...",
        select_language: "Seleziona Lingua",
        select_source: "Seleziona Sorgente",
        send_instructions_btn: "Invia istruzioni",
        set_password_page_title: "Nuova Password",
        settings_title: "Impostazioni",
        show_hide_data: "Mostra/Nascondi Dati",
        sort_date_far: "DATA (LONTANA)",
        sort_date_near: "DATA (VICINA)",
        sort_name_az: "NOME (A-Z)",
        sort_name_za: "NOME (Z-A)",
        status_accepted: "Accettato",
        status_pending: "In attesa",
        subject_label: "Oggetto",
        success_archived: "Account archiviato",
        success_auth: "Accesso autorizzato!",
        success_config_saved: "Configurazione salvata",
        success_deleted: "Account eliminato",
        success_deleted_forever: "Eliminato definitivamente",
        success_registration: "Account creato! Verifica la tua email.",
        success_reset_sent: "Link inviato! Controlla la tua casella postale.",
        success_restored: "Account ripristinato",
        success_save: "Dati salvati con successo!",
        success_trash_emptied: "Cestino svuotato",
        terms_1_text: "Il servizio è gestito da: Boschetto Diego.",
        terms_1_title: "1. Titolare del servizio",
        terms_10_text: "Si applica la legge italiana e la normativa europea vigente (GDPR).",
        terms_10_title: "10. Legge applicabile",
        terms_2_text: "L’app consente di registrarsi, accedere, e gestire dati personali e credenziali in un vault sicuro con funzioni opzionali.",
        terms_2_title: "2. Descrizione del servizio",
        terms_3_text: "L’utente è responsabile della riservatezza delle credenziali, della protezione del dispositivo e di tutti i contenuti caricati nell'app.",
        terms_3_title: "3. Account e responsabilità",
        terms_4_text: "È vietato l’uso per attività illegali, accessi non autorizzati, inserimento di malware o abuso del sistema.",
        terms_4_title: "4. Uso corretto",
        terms_5_text: "Nessun sistema garantisce rischio zero. L’utente accetta i rischi residui dei servizi cloud e lo stato di sviluppo del progetto.",
        terms_5_title: "5. Sicurezza e limitazioni",
        terms_6_text: "Il servizio può essere modificato, sospeso o interrotto in qualunque momento per motivi tecnici o di sicurezza.",
        terms_6_title: "6. Disponibilità del servizio",
        terms_7_text: "Il titolare non risponde di perdite dati esterne, accessi per credenziali compromesse dall'utente o uso improprio dell'app.",
        terms_7_title: "7. Limitazione di responsabilità",
        terms_8_text: "Il trattamento dei dati personali è regolato dall’Informativa Privacy dedicata.",
        terms_8_title: "8. Privacy",
        terms_9_text_alt: "L’uso continuato dell’app dopo l’aggiornamento dei termini equivale ad accettazione dei nuovi Termini.",
        terms_9_title: "9. Modifiche ai Termini",
        terms_page_subtitle: "Condizioni d'uso del servizio",
        terms_page_title: "Termini e Condizioni",
        terms_short_details_link: "📌 Leggi i Termini e Condizioni completi.",
        terms_short_title: "Termini e Condizioni",
        terms_update_text: "Ultimo aggiornamento: Gennaio 2026",
        text_notice: "Preavviso",
        text_replica: "Replica",
        theme_auto: "Automatico",
        theme_dark: "Scuro",
        theme_desc: "Personalizza il look",
        theme_light: "Chiaro",
        theme_title: "Tema App",
        title_archive_accounts: "Archivio Account",
        title_settings: "Impostazioni",
        today: "Oggi",
        tomorrow: "Domani",
        top_used_access: "TOP 10 PIÙ USATI",
        two_factor_auth: "Autenticazione a due fattori",
        uploaded: "Caricato",
        user_default: "Utente",
        username_label: "Username",
        username_placeholder: "Email o Username",
        vat_number: "Partita IVA",
        vehicles_config_title: "Configurazione Automezzi",
        without_name: "Senza Nome",
        back: "Indietro",
        ok: "Ho Capito",
        delete_short: "Elimina"
};

// ─── Metadati lingue ─────────────────────────────────────────────────────────
export const supportedLanguages = [
    { code: 'it', name: 'Italiano',        flag: '\u{1F1EE}\u{1F1F9}' },
    { code: 'en', name: 'English',         flag: '\u{1F1FA}\u{1F1F8}' },
    { code: 'es', name: 'Español',         flag: '\u{1F1EA}\u{1F1F8}' },
    { code: 'fr', name: 'Français',        flag: '\u{1F1EB}\u{1F1F7}' },
    { code: 'de', name: 'Deutsch',         flag: '\u{1F1E9}\u{1F1EA}' },
    { code: 'zh', name: '简体中文',           flag: '\u{1F1E8}\u{1F1F3}' },
    { code: 'hi', name: 'हिन्दी',            flag: '\u{1F1EE}\u{1F1F3}' },
    { code: 'pt', name: 'Português',       flag: '\u{1F1F5}\u{1F1F9}' }
];

export function getCurrentLanguage() {
    return localStorage.getItem('app_language') || 'it';
}

/**
 * Carica la lingua attiva. Da chiamare ALL'AVVIO prima di qualsiasi render.
 * Italiano è disponibile immediatamente senza alcuna fetch (inline).
 * @param {string} lang - Codice lingua (es. 'it', 'en')
 */
export async function loadLanguage(lang = 'it') {
    lang = lang || 'it';
    if (lang === 'it') {
        _dict = _it;
        LOG('[i18n] Lingua attiva: it (inline)');
        return;
    }
    try {
        // Risolve il percorso relativo a questo modulo
        const baseUrl = import.meta.url.replace(/[^/]+$/, '');
        const module = await import(`${baseUrl}translations/${lang}.js`);
        _dict = module.default;
        LOG(`[i18n] Lingua attiva: ${lang} (${Object.keys(_dict).length} chiavi)`);
    } catch (e) {
        console.warn(`[i18n] Lingua '${lang}' non disponibile — fallback a 'it'`);
        _dict = _it;
    }
}

/**
 * Traduce una chiave nella lingua attiva.
 * Fallback: chiave italiana → chiave grezza se non trovata.
 * SINCRONA — funziona solo dopo che loadLanguage() è stato chiamato.
 */
export function t(key) {
    return _dict[key] || _it[key] || key;
}

/**
 * Applica le traduzioni agli elementi DOM con data-t, data-t-placeholder, data-t-aria.
 * Da richiamare dopo loadLanguage() e dopo ogni cambio lingua.
 */
export function applyGlobalTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.dataset.t;
        if (!key) return;
        const val = t(key);
        if (val && val !== key) el.textContent = val;
    });
    document.querySelectorAll('[data-t-placeholder]').forEach(el => {
        const key = el.dataset.tPlaceholder;
        if (!key) return;
        const val = t(key);
        if (val && val !== key) el.placeholder = val;
    });
    document.querySelectorAll('[data-t-aria]').forEach(el => {
        const key = el.dataset.tAria;
        if (!key) return;
        const val = t(key);
        if (val && val !== key) el.setAttribute('aria-label', val);
    });
    document.documentElement.setAttribute('data-i18n', 'ready');
}

// Compatibilità con vecchi moduli
