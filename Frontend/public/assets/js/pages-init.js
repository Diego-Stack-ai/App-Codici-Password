/**
 * PAGES INIT ROUTER (V5.0 ADAPTER)
 * Mappa le funzioni di inizializzazione per tutte le pagine.
 * 
 * Strategia Ibrida:
 * - Moduli V5.0: Importa ed esegue initPage(user).
 * - Moduli Legacy -> V5.0: Importa dinamicamente il file e chiama la funzione init esportata.
 */

import { initComponents } from './components.js';

// --- 1. MODULI V5.0 (Puri/Passivi) ---
import { initAreaPrivata as initAreaPrivataModule } from './modules/privato/area_privata.js';

export async function initAreaPrivata(user) {
    await initAreaPrivataModule(user);
}

// --- 2. MODULI LEGACY & AUTH (Import Dinamico) ---
export async function initRegistrati() {
    const module = await import('./modules/auth/registrati.js');
    await module.initRegistrati();
}

export async function initIndex() {
    const module = await import('./modules/auth/login.js');
    await module.initLogin();
}

export async function initResetPassword() {
    const module = await import('./modules/auth/reset_password.js');
    await module.initResetPassword();
}

export async function initImpostaNuovaPassword() {
    const module = await import('./modules/auth/imposta_nuova_password.js');
    await module.initImpostaNuovaPassword();
}

export async function initHomePage(user) {
    console.log("[Router] Loading Home V5.0...");
    const module = await import('./modules/home/home.js');
    await module.initHomePage(user);
}

export async function initArchivioAccount(user) {
    const module = await import('./modules/settings/archivio_account.js');
    await module.initArchivioAccount(user);
}

export async function initProfiloPrivato(user) {
    const module = await import('./modules/privato/profilo_privato.js');
    await module.initProfiloPrivato(user);
}

export async function initImpostazioni(user) {
    const module = await import('./modules/settings/impostazioni.js');
    await module.initImpostazioni(user);
}

// --- CONFIG SCADENZE ---
export async function initRegoleScadenze(user) {
    console.log("[Router] Init Regole Scadenze (Static)");
}

export async function initConfigurazioneAutomezzi(user) {
    const module = await import('./modules/scadenze/configurazione_automezzi.js');
    await module.initConfigurazioneAutomezzi(user);
}

export async function initConfigurazioneDocumenti(user) {
    const module = await import('./modules/scadenze/configurazione_documenti.js');
    await module.initConfigurazioneDocumenti(user);
}

export async function initConfigurazioneRegoleGenerali(user) {
    const module = await import('./modules/scadenze/configurazione_generali.js');
    await module.initConfigurazioneGenerali(user);
}

export async function initStoricoNotifiche(user) {
    const module = await import('./modules/settings/notifiche_storia.js');
    await module.initNotificheStoria(user);
}

export async function initPrivacy() { console.log("[Router] Privacy Page Loaded"); }
export async function initTermini() { console.log("[Router] Termini Page Loaded"); }

// --- 3. MODULI ACCOUNT PRIVATI ---
export async function initAccountPrivati(user) {
    const module = await import('./modules/privato/account_privati.js');
    await module.initAccountPrivati(user);
}

export async function initFormAccountPrivato(user) {
    const module = await import('./modules/privato/form_account_privato.js');
    await module.initFormAccountPrivato(user);
}

export async function initDettaglioAccountPrivato(user) {
    const module = await import('./modules/privato/dettaglio_account_privato.js');
    await module.initDettaglioAccountPrivato(user);
}

// --- 4. MODULI SCADENZE ---
export async function initScadenze(user) {
    const module = await import('./modules/scadenze/scadenze.js');
    await module.initScadenze(user);
}

export async function initAggiungiScadenza(user) {
    const module = await import('./modules/scadenze/aggiungi_scadenza.js');
    await module.initAggiungiScadenza(user);
}

export async function initDettaglioScadenza(user) {
    const module = await import('./modules/scadenze/dettaglio_scadenza.js');
    await module.initDettaglioScadenza(user);
}

// --- 5. MODULI AZIENDA (V5.0) ---
export async function initListaAziende(user) {
    const module = await import('./modules/azienda/lista_aziende.js');
    if (module.initListaAziende) await module.initListaAziende(user);
}

export async function initAggiungiAzienda(user) {
    const module = await import('./modules/azienda/aggiungi_azienda.js');
    if (module.initAggiungiAzienda) await module.initAggiungiAzienda(user);
}

export async function initModificaAzienda(user) {
    const module = await import('./modules/azienda/modifica_azienda.js');
    if (module.initModificaAzienda) await module.initModificaAzienda(user);
}

export async function initDatiAzienda(user) {
    const module = await import('./modules/azienda/dati_azienda.js');
    if (module.initDatiAzienda) await module.initDatiAzienda(user);
}

export async function initAccountAziendaList(user) {
    const module = await import('./modules/azienda/account_azienda.js');
    if (module.initAccountAziendaList) await module.initAccountAziendaList(user);
}

export async function initAggiungiNuovaAzienda(user) {
    const module = await import('./modules/azienda/aggiungi_azienda.js');
    if (module.initAggiungiAzienda) await module.initAggiungiAzienda(user);
}

export async function initAggiungiAccountAzienda(user) {
    const module = await import('./modules/azienda/aggiungi_account_azienda.js');
    if (module.initAggiungiAccountAzienda) await module.initAggiungiAccountAzienda(user);
}

export async function initModificaAccountAzienda(user) {
    const module = await import('./modules/azienda/modifica_account_azienda.js');
    if (module.initModificaAccountAzienda) await module.initModificaAccountAzienda(user);
}

export async function initDettaglioAccountAzienda(user) {
    const module = await import('./modules/azienda/dettaglio_account_azienda.js');
    if (module.initDettaglioAccountAzienda) await module.initDettaglioAccountAzienda(user);
}

export async function initFormAccountAzienda(user) {
    const module = await import('./modules/azienda/form_account_azienda.js');
    if (module.initFormAccountAzienda) await module.initFormAccountAzienda(user);
}

// --- 6. UTILITIES ---
export async function initGestioneAllegati(user) {
    const module = await import('./modules/azienda/gestione_allegati.js');
    if (module.initGestioneAllegati) await module.initGestioneAllegati(user);
}
