/**
 * TITANIUM TRANSLATIONS SYSTEM
 * Dizionario centralizzato per il supporto multilingua.
 */

export const translations = {
    it: {
        // GLOBAL
        home: "Home",
        back: "Indietro",
        save: "Salva",
        cancel: "Annulla",
        loading: "Caricamento...",
        success_save: "Dati salvati con successo!",
        error_generic: "Si è verificato un errore.",
        logout: "Esci dall'account",
        version: "Titanium Protocol v5.1 Build 400",

        // PASSWORD CHANGE PAGE
        new_password: "Nuova Password",
        confirm_new_password: "Conferma Password",
        save_new_pass: "Salva nuova password",
        password_mismatch: "Le password non coincidono!",
        password_success: "Password aggiornata con successo!",
        password_requirements: "Protocollo 12-3-3",
        req_min_chars: "Minimo 12 caratteri totali",
        req_upper: "Almeno 3 Lettere Maiuscole",
        req_symbols: "Almeno 3 Simboli Speciali",

        // SETTINGS PAGE
        settings_title: "Impostazioni",
        manage_account_data: "Gestisci Dati Account",
        section_security: "Sicurezza",
        section_general: "Generale",
        section_presentation: "Presentazione",
        section_support: "Supporto",

        // SECURITY SECTION
        change_password: "Cambio Password",
        two_factor_auth: "Autenticazione a due fattori",
        face_id: "Face ID",
        auto_lock: "Blocco Automatico",
        auto_lock_subtitle: "Sblocco con username e password o attiva face id dell'app",
        lock_inactivity: "Tempo di Inattività",
        lock_immediately: "Subito",
        lock_1min: "1 Min",
        lock_3min: "3 Min",
        lock_5min: "5 Min",

        // GENERAL SECTION
        notifications: "Notifiche",
        archive: "Archivio",
        language: "Lingua",
        language_current: "Italiano",
        select_language: "Seleziona Lingua",
        expiry_rules: "Regole invio scadenze",

        // PRESENTATION & SUPPORT
        app_info_title: "Informazioni sull'App",
        app_info_subtitle: "Scopri cosa fa App Codici Password",
        rules_title: "Le regole da ricordare",
        rules_subtitle: "Linee guida per la condivisione",
        help_faq: "Aiuto e FAQ",
        privacy_policy_title: "Privacy Policy",
        privacy_policy_subtitle: "Trattamento dati e diritti"
    },
    en: {
        home: "Home",
        back: "Back",
        save: "Save",
        cancel: "Cancel",
        loading: "Loading...",
        success_save: "Data saved successfully!",
        error_generic: "An error occurred.",
        logout: "Log out",
        version: "Titanium Protocol v5.1 Build 400",
        new_password: "New Password",
        confirm_new_password: "Confirm Password",
        save_new_pass: "Save new password",
        password_mismatch: "Passwords do not match!",
        password_success: "Password updated successfully!",
        password_requirements: "Protocollo 12-3-3",
        req_min_chars: "Minimum 12 characters",
        req_upper: "At least 3 Uppercase letters",
        req_symbols: "At least 3 Special symbols",
        settings_title: "Settings",
        manage_account_data: "Manage Account Data",
        section_security: "Security",
        section_general: "General",
        section_presentation: "Presentation",
        section_support: "Support",
        change_password: "Change Password",
        two_factor_auth: "Two-Factor Authentication",
        face_id: "Face ID",
        auto_lock: "Auto Lock",
        auto_lock_subtitle: "Unlock with username and password or enable app Face ID",
        lock_inactivity: "Inactivity Timeout",
        lock_immediately: "Immediately",
        lock_1min: "1 Min",
        lock_3min: "3 Min",
        lock_5min: "5 Min",
        notifications: "Notifications",
        archive: "Archive",
        language: "Language",
        language_current: "English",
        select_language: "Select Language",
        expiry_rules: "Expiry Rules",
        app_info_title: "App Information",
        app_info_subtitle: "Discover what App Codici Password does",
        rules_title: "Rules to Remember",
        rules_subtitle: "Sharing guidelines",
        help_faq: "Help & FAQ",
        privacy_policy_title: "Privacy Policy",
        privacy_policy_subtitle: "Data processing and rights"
    },
    es: {
        language_current: "Español",
        select_language: "Seleccionar Idioma",
        settings_title: "Ajustes",
    },
    fr: {
        language_current: "Français",
        select_language: "Choisir la langue",
        settings_title: "Paramètres",
    },
    de: {
        language_current: "Deutsch",
        select_language: "Sprache auswählen",
        settings_title: "Einstellungen",
    },
    zh: {
        language_current: "中文",
        select_language: "选择语言",
        settings_title: "设置",
        home: "首页",
        logout: "退出登录"
    },
    hi: {
        language_current: "हिन्दी",
        select_language: "भाषा चुनें",
        settings_title: "सेटिंग्स",
        home: "होम",
        logout: "लॉग आउट"
    },
    pt: {
        language_current: "Português",
        select_language: "Selecionar Idioma",
        settings_title: "Configurações",
        home: "Início",
        logout: "Sair da conta"
    }
};

/**
 * Lingue supportate con i loro metadati
 */
export const supportedLanguages = [
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'zh', name: '简体中文', flag: '🇨🇳' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' }
];

/**
 * Funzione di utilità per ottenere la lingua corrente
 */
export function getCurrentLanguage() {
    return localStorage.getItem('app_language') || 'it';
}

/**
 * Funzione di traduzione t()
 */
export function t(key) {
    const lang = getCurrentLanguage();
    return translations[lang]?.[key] || translations['it'][key] || key;
}
