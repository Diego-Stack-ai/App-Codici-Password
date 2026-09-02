/**
 * BACKEND CORE (V7.3 - NODEMAILER + APP PASSWORD)
 * Sistema notifiche scadenze via Gmail (App Password).
 *
 * Due funzioni:
 * 1. checkDeadlines    → schedulata ogni giorno alle 09:00 (repliche + avviso finale)
 * 2. onScadenzaCreated → trigger Firestore, invio immediato se preavviso già nella finestra
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { setGlobalOptions } = require("firebase-functions");
const {
    generateRecoveryCode,
    nextRecoveryAttemptState,
    normalizeRecoveryCode,
    recoveryAttemptId,
    recoveryCodeHash
} = require("./recovery-security");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10, region: "europe-west1" });

// Segreti cifrati (salvati su Google Secret Manager)
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const FIREBASE_WEB_API_KEY = "AIzaSyDDt-PacoHtUQg6Ow7-1UxvrGVZLXVYx-o";

exports.createMfaRecoveryCodes = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        const authAgeSeconds = Math.floor(Date.now() / 1000) - Number(request.auth.token.auth_time || 0);
        if (authAgeSeconds > 300) {
            throw new HttpsError("failed-precondition", "Accedi nuovamente prima di generare i codici.");
        }
        const user = await admin.auth().getUser(request.auth.uid);
        const hasTotp = user.multiFactor?.enrolledFactors?.some((factor) => factor.factorId === "totp");
        if (!hasTotp) throw new HttpsError("failed-precondition", "Attiva prima la 2FA Authenticator.");

        const codes = Array.from({ length: 10 }, generateRecoveryCode);
        await admin.firestore().collection("mfaRecovery").doc(user.uid).set({
            codeHashes: codes.map(recoveryCodeHash),
            remaining: codes.length,
            version: 1,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { codes };
    }
);

exports.recoverMfaWithCode = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        const email = String(request.data?.email || "").trim().toLowerCase();
        const password = String(request.data?.password || "");
        const codeHash = recoveryCodeHash(request.data?.recoveryCode);
        if (!email || !password || normalizeRecoveryCode(request.data?.recoveryCode).length !== 16) {
            throw new HttpsError("invalid-argument", "Dati di recupero non validi.");
        }

        const db = admin.firestore();
        const ipAddress = request.rawRequest?.ip || request.rawRequest?.socket?.remoteAddress || "unknown";
        const attemptRef = db.collection("mfaRecoveryAttempts").doc(recoveryAttemptId(email, ipAddress));
        let recoveryAttemptAllowed = false;
        await db.runTransaction(async (transaction) => {
            const attemptSnap = await transaction.get(attemptRef);
            const next = nextRecoveryAttemptState(attemptSnap.exists ? attemptSnap.data() : null);
            recoveryAttemptAllowed = next.allowed;
            transaction.set(attemptRef, {
                emailHash: crypto.createHash("sha256").update(email, "utf8").digest("hex"),
                attempts: next.attempts || 0,
                windowStartedAt: next.windowStartedAt || Date.now(),
                blockedUntil: next.blockedUntil || 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        if (!recoveryAttemptAllowed) {
            throw new HttpsError("resource-exhausted", "Troppi tentativi. Riprova più tardi.");
        }

        // Verifica il primo fattore con Firebase Auth senza creare una sessione applicativa.
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password, returnSecureToken: true })
        });
        const authResult = await response.json();
        const firstFactorAccepted = response.ok || String(authResult?.error?.message || "").startsWith("MFA_REQUIRED");
        if (!firstFactorAccepted) throw new HttpsError("permission-denied", "Credenziali o codice di recupero non validi.");

        const user = await admin.auth().getUserByEmail(email);
        const recoveryRef = db.collection("mfaRecovery").doc(user.uid);
        await db.runTransaction(async (transaction) => {
            const recovery = await transaction.get(recoveryRef);
            const hashes = recovery.exists ? recovery.data().codeHashes || [] : [];
            if (!hashes.includes(codeHash)) {
                throw new HttpsError("permission-denied", "Credenziali o codice di recupero non validi.");
            }
            const remainingHashes = hashes.filter((hash) => hash !== codeHash);
            transaction.set(recoveryRef, {
                codeHashes: remainingHashes,
                remaining: remainingHashes.length,
                recoveryPendingAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        await admin.auth().updateUser(user.uid, { multiFactor: { enrolledFactors: null } });
        await admin.auth().revokeRefreshTokens(user.uid);
        await recoveryRef.set({
            recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
            recoveryPendingAt: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await attemptRef.delete();
        return { ok: true };
    }
);

exports.revokeAllSessions = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        await admin.auth().revokeRefreshTokens(request.auth.uid);
        return { ok: true };
    }
);

function sanitizeEmail(email) {
    return String(email || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "_") || "unknown_guest";
}

function pushText(scadenza, diffDays) {
    const tipo = String(scadenza.type || scadenza.templateText || "Scadenza").trim();
    const veicolo = String(scadenza.veicolo_modello || "").trim();
    const when = diffDays === 0 ? "Scade oggi" : diffDays === 1 ? "Scade domani" : `Scadenza tra ${diffDays} giorni`;
    return { title: "Codici & Password", body: `${tipo}${veicolo ? ` · ${veicolo}` : ""}\n${when}` };
}

function shouldSendPush(scadenza, diffDays, forceImmediate = false) {
    if (diffDays === 0) return true;
    if (forceImmediate) return true;
    const frequency = Math.max(1, Number(scadenza.notif_frequency || 7));
    if (!scadenza.lastPushNotifiedAt) return true;
    const lastPush = new Date(scadenza.lastPushNotifiedAt);
    lastPush.setHours(0, 0, 0, 0);
    if (Number.isNaN(lastPush.getTime())) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today - lastPush) / (1000 * 60 * 60 * 24)) >= frequency;
}

async function activePushDevices(db, uid) {
    const snap = await db.collection("users").doc(uid).collection("pushDevices")
        .where("enabled", "==", true).get();
    return snap.docs.filter((item) => item.data().notificationScope === "deadlines" && item.data().token);
}

async function sendDeadlinePush(db, uid, deadlineId, scadenza, diffDays, options = {}) {
    if (!shouldSendPush(scadenza, diffDays, options.forceImmediate === true)) return;
    const dueVersion = String(scadenza.dueDate || "").replace(/[^0-9]/g, "").slice(0, 14);
    const previousPush = String(scadenza.lastPushNotifiedAt || "initial").replace(/[^0-9a-zA-Z]/g, "");
    const stage = diffDays === 0 ? "D0" : `after_${previousPush}`;
    const notificationId = `${deadlineId}_${dueVersion}_${stage}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const notificationRef = db.collection("users").doc(uid).collection("deadlineNotifications").doc(notificationId);
    await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(notificationRef);
        if (!existing.exists) {
            transaction.set(notificationRef, {
                eventType: "deadline", deadlineId, dueDate: String(scadenza.dueDate), diffDays,
                status: "unread", createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    });

    const devices = await activePushDevices(db, uid);
    const text = pushText(scadenza, diffDays);
    let acceptedCount = 0;
    let retryableFailure = false;

    for (const device of devices) {
        const deliveryId = `${notificationId}_${device.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
        const deliveryRef = db.collection("users").doc(uid).collection("notificationDeliveries").doc(deliveryId);
        const reserved = await db.runTransaction(async (transaction) => {
            const existing = await transaction.get(deliveryRef);
            if (existing.exists && existing.data().status === "sent") return false;
            if (existing.exists && existing.data().status === "sending") {
                const updatedAt = existing.data().updatedAt?.toMillis?.() || 0;
                if (Date.now() - updatedAt < 10 * 60 * 1000) return false;
            }
            transaction.set(deliveryRef, {
                eventType: "deadline", deadlineId, deviceId: device.id, channel: "push", stage,
                dueDate: String(scadenza.dueDate), status: "sending", attempts: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        });
        if (!reserved) continue;

        try {
            await admin.messaging().send({
                token: device.data().token,
                data: {
                    eventType: "deadline", deadlineId, notificationId, title: text.title, body: text.body,
                    deliveryTag: deliveryId
                },
                webpush: { headers: { TTL: diffDays === 0 ? "21600" : "86400", Urgency: "high" } }
            });
            await deliveryRef.set({ status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            acceptedCount += 1;
        } catch (error) {
            const invalid = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]
                .includes(error.code);
            await deliveryRef.set({
                status: "failed", errorCode: String(error.code || "unknown").slice(0, 120),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            if (invalid) await device.ref.set({ enabled: false, status: "invalid", invalidatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            else retryableFailure = true;
            console.error(`[PUSH FAILED] ${deadlineId}/${device.id}:`, error.code || error.message);
        }
    }

    if ((acceptedCount > 0 || devices.length === 0) && !retryableFailure) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await db.collection("users").doc(uid).collection("scadenze").doc(deadlineId).update({
            lastPushNotifiedAt: today.toISOString().split("T")[0]
        });
    }
}

exports.sendDeadlinePushTest = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        const deviceId = String(request.data?.deviceId || "");
        if (!/^[a-f0-9-]{36}$/i.test(deviceId)) throw new HttpsError("invalid-argument", "Dispositivo non valido.");
        const db = admin.firestore();
        const deviceRef = db.collection("users").doc(request.auth.uid).collection("pushDevices").doc(deviceId);
        const device = await deviceRef.get();
        if (!device.exists || !device.data().enabled || device.data().notificationScope !== "deadlines") {
            throw new HttpsError("failed-precondition", "Notifiche non attive su questo dispositivo.");
        }
        const now = Date.now();
        const lastTest = device.data().lastTestAt?.toMillis?.() || 0;
        if (now - lastTest < 60000) {
            return { ok: false, cooldownSeconds: Math.ceil((60000 - (now - lastTest)) / 1000) };
        }
        await deviceRef.set({ lastTestAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlines = await db.collection("users").doc(request.auth.uid).collection("scadenze")
            .where("completed", "==", false).get();
        const upcoming = deadlines.docs.map((item) => {
            const data = item.data();
            const dueDate = new Date(data.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return { id: item.id, data, dueDate };
        }).filter((item) => !Number.isNaN(item.dueDate.getTime()) && item.dueDate >= today)
            .sort((left, right) => left.dueDate - right.dueDate)[0];

        const deadlineId = upcoming?.id || "";
        const diffDays = upcoming ? Math.ceil((upcoming.dueDate - today) / (1000 * 60 * 60 * 24)) : 0;
        const text = upcoming
            ? pushText(upcoming.data, diffDays)
            : { title: "Codici & Password", body: "Notifica scadenza di prova" };
        try {
            await admin.messaging().send({
                token: device.data().token,
                data: {
                    eventType: "deadline", deadlineId, title: text.title, body: text.body,
                    deliveryTag: `deadline-test-${deviceId}-${now}`
                },
                webpush: { headers: { TTL: "300", Urgency: "high" } }
            });
            return { ok: true, opensDeadline: Boolean(deadlineId) };
        } catch (error) {
            console.error("[PUSH TEST FAILED]", error.code || error.message);
            throw new HttpsError("internal", "Invio della notifica di prova non riuscito.");
        }
    }
);

exports.respondToInvitation = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        const inviteId = String(request.data?.inviteId || "");
        const status = String(request.data?.status || "");
        if (!inviteId || !["accepted", "rejected"].includes(status)) {
            throw new HttpsError("invalid-argument", "Risposta invito non valida.");
        }

        const uid = request.auth.uid;
        const email = String(request.auth.token.email || "").toLowerCase().trim();
        if (!email) throw new HttpsError("permission-denied", "Email verificabile mancante.");

        const firestore = admin.firestore();
        const inviteRef = firestore.collection("invites").doc(inviteId);
        await firestore.runTransaction(async (transaction) => {
            const inviteSnap = await transaction.get(inviteRef);
            if (!inviteSnap.exists) throw new HttpsError("not-found", "Invito non trovato.");
            const invite = inviteSnap.data();
            if (invite.status !== "pending") throw new HttpsError("failed-precondition", "Invito già elaborato.");
            if (String(invite.recipientEmail || "").toLowerCase().trim() !== email) {
                throw new HttpsError("permission-denied", "Non sei il destinatario dell'invito.");
            }

            const accountPath = invite.aziendaId
                ? `users/${invite.ownerId}/aziende/${invite.aziendaId}/accounts/${invite.accountId}`
                : `users/${invite.ownerId}/accounts/${invite.accountId}`;
            const accountRef = firestore.doc(accountPath);
            const accountSnap = await transaction.get(accountRef);
            if (!accountSnap.exists) throw new HttpsError("not-found", "Account condiviso non trovato.");

            const account = accountSnap.data();
            const sharedWith = { ...(account.sharedWith || {}) };
            const guestKey = sanitizeEmail(email);
            const guest = sharedWith[guestKey];
            if (!guest || String(guest.email || "").toLowerCase().trim() !== email) {
                throw new HttpsError("permission-denied", "Destinatario non presente nella condivisione.");
            }
            sharedWith[guestKey] = { ...guest, status, uid: status === "accepted" ? uid : null };
            const acceptedGuests = Object.values(sharedWith).filter((item) => item?.status === "accepted" && item?.uid);
            const sharedWithUids = [...new Set(acceptedGuests.map((item) => item.uid))];
            const hasActive = Object.values(sharedWith).some((item) => ["pending", "accepted"].includes(item?.status));

            transaction.update(accountRef, {
                sharedWith,
                sharedWithUids,
                acceptedCount: acceptedGuests.length,
                visibility: hasActive ? "shared" : "private",
                updatedAt: new Date().toISOString()
            });
            transaction.update(inviteRef, {
                status,
                guestUid: status === "accepted" ? uid : null,
                respondedAt: new Date().toISOString()
            });
        });
        return { ok: true, status };
    }
);

// ─────────────────────────────────────────────────────────────
// UTILITY — Crea il trasportatore Nodemailer
// ─────────────────────────────────────────────────────────────
function createTransporter(gmailUser, gmailPass) {
    return nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
    });
}

// ─────────────────────────────────────────────────────────────
// UTILITY — Componi e invia una email per una scadenza
// ─────────────────────────────────────────────────────────────
async function sendScadenzaEmail(transporter, gmailUser, s, diffDays, docRef) {
    const dueDate = new Date(s.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const dueDateFormatted = dueDate.toLocaleDateString("it-IT", {
        day: "2-digit", month: "long", year: "numeric",
    });

    const templateText = s.templateText || s.type || "una scadenza";
    const veicolo = s.veicolo_modello ? ` ${s.veicolo_modello}` : "";

    const giorniLabel =
        diffDays === 0 ? "⚠️ OGGI" :
        diffDays === 1 ? "domani" :
        `tra ${diffDays} giorni`;

    const emailBody = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 12px; padding: 30px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 20px; }
    .label { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .value { color: #222; font-size: 16px; font-weight: bold; margin-bottom: 16px; }
    .badge { display: inline-block; background: #fff3cd; color: #856404; border-radius: 20px; padding: 6px 16px; font-size: 14px; font-weight: bold; margin-bottom: 20px; }
    .footer { color: #aaa; font-size: 11px; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>⏰ Promemoria Scadenza</h1>
    </div>
    <p>Gentile <strong>${s.name || "Utente"}</strong>,</p>
    <p>ti ricordiamo che sta per scadere:</p>

    <div class="label">Oggetto</div>
    <div class="value">📋 ${templateText}${veicolo}</div>

    <div class="label">Categoria</div>
    <div class="value">🏷️ ${s.type || "—"}</div>

    <div class="label">Data scadenza</div>
    <div class="value">📅 ${dueDateFormatted}</div>

    <div class="badge">⏳ Scade ${giorniLabel}</div>

    ${s.notes ? `<div class="label">Note</div><div class="value" style="font-weight:normal;color:#555;">${s.notes}</div>` : ""}

    <p style="color:#555;font-size:14px;">Provvedi al rinnovo per tempo.</p>

    <div class="footer">
      — Codex Security System &nbsp;|&nbsp; Notifica automatica<br>
      <strong>Inviato da Codex</strong>
    </div>
  </div>
</body>
</html>`;

    const recipients = [s.email1, s.email2].filter(Boolean).join(", ");

    await transporter.sendMail({
        from: `"Codex Notifiche" <${gmailUser}>`,
        to: recipients,
        subject: `⚠️ Scadenza in arrivo — ${s.type || templateText}`,
        html: emailBody,
    });

    // Aggiorna lastNotifiedAt per evitare duplicati dallo scheduler
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await docRef.update({
        lastNotifiedAt: today.toISOString().split("T")[0],
    });

    console.log(`[OK] Email inviata → ${recipients} (diffDays: ${diffDays})`);
}

// ─────────────────────────────────────────────────────────────
// FUNZIONE 1 — Schedulata ogni giorno alle 09:00
// ─────────────────────────────────────────────────────────────
exports.checkDeadlines = onSchedule(
    {
        schedule: "0 9 * * *",
        timeZone: "Europe/Rome",
        secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 120,
    },
    async () => {
        const db = admin.firestore();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const gmailUser = GMAIL_USER.value();
        const gmailPass = GMAIL_APP_PASSWORD.value();
        const transporter = createTransporter(gmailUser, gmailPass);

        console.log(`[SCHEDULER] Controllo scadenze: ${today.toISOString().split("T")[0]}`);

        try {
            const usersSnap = await db.collection("users").get();

            for (const userDoc of usersSnap.docs) {
                const uid = userDoc.id;
                const scadenzeSnap = await db
                    .collection("users").doc(uid)
                    .collection("scadenze")
                    .where("completed", "==", false)
                    .get();

                for (const sDoc of scadenzeSnap.docs) {
                    const s = sDoc.data();
                    if (!s.dueDate) continue;

                    const dueDate = new Date(s.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    const diffMs = dueDate - today;
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                    const daysBefore = s.notif_days_before || 14;
                    const freqDays = s.notif_frequency || 7;

                    // Scadenze già passate: stop
                    if (diffDays < 0) continue;
                    // Fuori dalla finestra: troppo presto
                    if (diffDays > daysBefore) continue;

                    // Il canale Push usa un registro separato e non interferisce con le email.
                    try {
                        await sendDeadlinePush(db, uid, sDoc.id, s, diffDays);
                    } catch (pushErr) {
                        console.error(`[PUSH FAILED] ${sDoc.id}:`, pushErr.message);
                    }

                    if (!s.email1) continue;

                    // Giorno 0: invia SEMPRE
                    // Altri giorni: rispetta la frequenza
                    if (diffDays > 0) {
                        const lastNotified = s.lastNotifiedAt
                            ? new Date(s.lastNotifiedAt) : null;
                        if (lastNotified) {
                            const daysSinceLast = Math.floor(
                                (today - lastNotified) / (1000 * 60 * 60 * 24)
                            );
                            if (daysSinceLast < freqDays) continue;
                        }
                    }

                    try {
                        await sendScadenzaEmail(transporter, gmailUser, s, diffDays, sDoc.ref);
                    } catch (emailErr) {
                        console.error(`[EMAIL FAILED] ${sDoc.id}:`, emailErr.message);
                    }
                }
            }

            console.log("[SCHEDULER] Controllo completato.");
        } catch (err) {
            console.error("[CRITICAL ERROR]", err.message);
        }
    }
);

// ─────────────────────────────────────────────────────────────
// FUNZIONE 2 — Trigger Firestore: invio immediato alla creazione
// ─────────────────────────────────────────────────────────────
exports.onScadenzaCreated = onDocumentCreated(
    {
        document: "users/{uid}/scadenze/{scadenzaId}",
        secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
    },
    async (event) => {
        const s = event.data.data();
        const docRef = event.data.ref;

        // Verifica campi minimi
        if (!s.dueDate || s.completed) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(s.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        const diffMs = dueDate - today;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const daysBefore = s.notif_days_before || 14;

        // Scadenza già passata o fuori dalla finestra → niente da fare
        if (diffDays < 0 || diffDays > daysBefore) return;

        try {
            await sendDeadlinePush(admin.firestore(), event.params.uid, event.params.scadenzaId, s, diffDays, {
                forceImmediate: true
            });
        } catch (pushErr) {
            console.error(`[TRIGGER PUSH FAILED] ${event.params.scadenzaId}:`, pushErr.message);
        }

        if (!s.email1) return;

        console.log(`[TRIGGER] Nuova scadenza creata — diffDays: ${diffDays}, preavviso: ${daysBefore}`);

        const gmailUser = GMAIL_USER.value();
        const gmailPass = GMAIL_APP_PASSWORD.value();
        const transporter = createTransporter(gmailUser, gmailPass);

        try {
            await sendScadenzaEmail(transporter, gmailUser, s, diffDays, docRef);
            console.log(`[TRIGGER] Email immediata inviata per scadenza ${event.params.scadenzaId}`);
        } catch (err) {
            console.error(`[TRIGGER EMAIL FAILED]:`, err.message);
        }
    }
);

exports.onScadenzaUpdated = onDocumentUpdated(
    {
        document: "users/{uid}/scadenze/{scadenzaId}",
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
    },
    async (event) => {
        const before = event.data.before.data();
        const after = event.data.after.data();
        const completedNow = !before.completed && after.completed === true;
        const dueDateChanged = String(before.dueDate || "") !== String(after.dueDate || "");
        if (!completedNow && !dueDateChanged) return;

        const db = admin.firestore();
        const notifications = await db.collection("users").doc(event.params.uid)
            .collection("deadlineNotifications")
            .where("deadlineId", "==", event.params.scadenzaId).get();
        const batch = db.batch();
        notifications.docs.forEach((item) => batch.set(item.ref, {
            status: "resolved",
            resolvedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true }));
        if (dueDateChanged) {
            batch.update(event.data.after.ref, {
                lastPushNotifiedAt: admin.firestore.FieldValue.delete(),
                lastNotifiedAt: admin.firestore.FieldValue.delete()
            });
        }
        await batch.commit();
    }
);
