/**
 * BACKEND CORE (RESET V6.0)
 * Tutte le funzioni corrotte sono state rimosse per rifare il sistema da zero.
 * Sistema Push ed Email rimosso integralmente.
 */

const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions");

admin.initializeApp();
setGlobalOptions({
  maxInstances: 10,
  region: "europe-west1"
});

// Post-Reset: Nessuna funzione attiva al momento.
