/**
 * SCADENZE NOTIFIER (V2.0)
 * Cloud Function aggiornata per Gmail OAuth2 + FCM
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const { getParams } = require("firebase-functions/params");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10, region: "europe-west1" });

// Recupero parametri da Firebase Params (OAuth disabilitato per App Password)
//const clientEmail = getParams().gmail.client_email.value();
const clientEmail = "gmail-sender@halogen-acumen-473312-f4.iam.gserviceaccount.com";

// Email account da usare come mittente
const MAIL_USER = "boschettodiego@gmail.com";
// TODO: INSERISCI LA TUA PASSWORD PER LE APP QUI SOTTO
const MAIL_APP_PASSWORD = "nhwrwwhfetubfvif";

// Crea transporter Nodemailer con App Password
async function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: MAIL_USER,
      pass: MAIL_APP_PASSWORD
    }
  });
}

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

exports.onNotificationTrigger = onDocumentCreated("users/{userId}/notifications/{notificationId}", async (event) => {
  const data = event.data.data();
  const userId = event.params.userId;

  console.log(`[TRIGGER] Analizzando nuova notifica per ${userId}. Titolo: ${data.title}`);

  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.warn(`[TRIGGER ERROR] Utente ${userId} non trovato nel DB.`);
      return;
    }

    const userData = userDoc.data();
    // Cerchiamo i token in fcmTokens e deduplichiamo
    let rawTokens = userData.fcmTokens || [];
    if (userData.fcmToken && !rawTokens.includes(userData.fcmToken)) {
      rawTokens.push(userData.fcmToken);
    }

    // Rimuovi eventuali duplicati o valori vuoti
    const tokens = [...new Set(rawTokens.filter(t => !!t))];

    const pushAllowed = userData.prefs_push !== false;

    console.log(`[TRIGGER DEBUG] Tokens unici: ${tokens.length}. Push abilitato: ${pushAllowed}`);

    if (pushAllowed && tokens.length > 0) {
      const payload = {
        notification: {
          title: data.title,
          body: data.message
        },
        android: {
          priority: "high",
          notification: {
            channelId: "default",
            clickAction: "FLUTTER_NOTIFICATION_CLICK"
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: data.title,
                body: data.message
              },
              sound: "default",
              badge: 1,
              "content-available": 1
            }
          },
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert"
          }
        },
        webpush: {
          headers: {
            Urgency: "high",
            TTL: "86400"
          },
          notification: {
            title: data.title,
            body: data.message,
            icon: "https://appcodici-password.web.app/assets/images/app-icon.jpg",
            badge: "https://appcodici-password.web.app/assets/images/app-icon.jpg",
            requireInteraction: true
          },
          fcmOptions: {
            link: "https://appcodici-password.web.app/notifiche_storia.html"
          }
        },
        data: {
          type: data.type || "generic",
          scadenzaId: data.scadenzaId || ""
        }
      };

      const response = await admin.messaging().sendEachForMulticast({ tokens, ...payload });
      console.log(`[TRIGGER SUCCESS] Utente ${userId}. Successi: ${response.successCount}, Fallimenti: ${response.failureCount}.`);

      // 🔄 HEARTBEAT PATCH: Aggiorna lastUsed per i token validi
      if (response.successCount > 0) {
        await updateLastUsedForSuccessfulTokens(db, userId, response, tokens);
      }

      // Log dettagliato se ci sono fallimenti
      if (response.failureCount > 0) {
        response.responses.forEach((res, idx) => {
          if (!res.success) {
            console.error(`[TRIGGER FAIL] Token ${tokens[idx].substring(0, 10)}... Errore:`, res.error.message);
          }
        });
      }

      // Cleanup token morti
      if (response.failureCount > 0) {
        const tokensToRemove = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            console.warn(`[TRIGGER CLEANUP] Errore token ${tokens[idx]}: ${errCode}`);
            // Se il token non è più registrato o è diventato invalido, lo segnamo per la rimozione
            if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
              tokensToRemove.push(tokens[idx]);
            }
          }
        });

        if (tokensToRemove.length > 0) {
          const updateObj = {
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove)
          };

          // Rimuovi anche dai metadati se presenti (prevenzione sicura)
          tokensToRemove.forEach(t => {
            updateObj[new admin.firestore.FieldPath("tokensMetadata", t)] = admin.firestore.FieldValue.delete();
          });

          await db.collection("users").doc(userId).update(updateObj);
          console.log(`[TRIGGER CLEANUP] Rimossi ${tokensToRemove.length} token e relativi metadati dal profilo ${userId}.`);
        }
      }
    } else {
      console.log(`[TRIGGER SKIP] Invio ignorato per ${userId}: pushAllowed=${pushAllowed}, tokenCount=${tokens.length}`);
    }
  } catch (e) {
    console.error("[TRIGGER CRITICAL ERROR]", e);
  }
});

async function runChecks(db) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  console.log(`[START] Controllo scadenze e notifiche: ${todayStr}`);

  try {
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const ownerUid = userDoc.id;
      const ownerData = userDoc.data();

      const ownerPrefs = {
        emailFallback: ownerData.prefs_email_sharing !== false,
        pushEnabled: ownerData.prefs_push !== false
      };

      const scadenzeRef = db.collection("users").doc(ownerUid).collection("scadenze");
      const scadenzeSnap = await scadenzeRef.where("status", "==", "active").get();

      for (const scadDoc of scadenzeSnap.docs) {
        const scadenza = scadDoc.data();
        const scadenzaId = scadDoc.id;

        if (!scadenza.dueDate || !scadenza.emails || scadenza.emails.length === 0) continue;

        const dueDate = new Date(scadenza.dueDate);
        const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

        if (diffDays <= (scadenza.notificationDaysBefore || 14)) {
          const lastSent = scadenza.lastNotificationSent ? scadenza.lastNotificationSent.toDate() : null;
          let shouldNotify = !lastSent || ((now - lastSent) / (1000 * 60 * 60 * 24)) >= (scadenza.notificationFrequency || 7);

          if (shouldNotify) {
            console.log(`[NOTIFY] Elaborazione scadenza ${scadenzaId} per ${ownerUid}`);
            for (const email of scadenza.emails) {
              await processNotificationChannel(db, email, scadenza, ownerPrefs, ownerUid, scadenzaId);
            }

            await scadenzeRef.doc(scadenzaId).update({
              lastNotificationSent: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("[CRITICAL ERROR]", error);
  }
}

/**
 * HEALTH CHECK & AUTO CLEANIING (V5.2)
 * Analizza i token degli utenti, rimuove zombie e assicura il limite (3).
 */
async function runHealthCheck(db) {
  console.log(`[START] Health Check & Watchdog Token`);
  try {
    const usersSnap = await db.collection("users").get();
    let totRemoved = 0;

    for (const docSnap of usersSnap.docs) {
      const data = docSnap.data();
      let fcmTokens = data.fcmTokens || [];
      const tokensMetadata = data.tokensMetadata || {};

      let needsUpdate = false;
      const updateObj = {};

      if (data.fcmToken !== undefined) {
        updateObj["fcmToken"] = admin.firestore.FieldValue.delete();
        needsUpdate = true;
      }

      if (fcmTokens.length > 3) {
        // Watchdog backend
        fcmTokens.sort((a, b) => {
          const timeA = tokensMetadata[a]?.lastUsed || "";
          const timeB = tokensMetadata[b]?.lastUsed || "";
          return timeB.localeCompare(timeA);
        });
        const tokensToRemove = fcmTokens.slice(3);
        fcmTokens = fcmTokens.slice(0, 3);

        updateObj["fcmTokens"] = fcmTokens;
        tokensToRemove.forEach(t => {
          updateObj[new admin.firestore.FieldPath("tokensMetadata", t)] = admin.firestore.FieldValue.delete();
        });
        totRemoved += tokensToRemove.length;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.collection("users").doc(docSnap.id).update(updateObj);
      }
    }
    console.log(`[HEALTH CHECK FINISHED] Rimossi ${totRemoved} token zombie complessivi.`);
  } catch (error) {
    console.error("[HEALTH CHECK ERROR]", error);
  }
}

// Funzione schedulata ordinaria (Cron)
exports.checkDeadlines = onSchedule("0 8 * * *", async () => {
  const db = admin.firestore();
  await runHealthCheck(db);
  await runChecks(db);
});

// Funzione temporanea HTTP per test immediato ORA
exports.testScadenzeOra = onRequest(async (req, res) => {
  const targetUid = "aebi78Ja4rOvbYcmTlr4m2Or1AE2";
  const db = admin.firestore();

  try {
    // RUN DEADLINE CRON!
    await runHealthCheck(db);
    await runChecks(db);

    const userDoc = await db.collection("users").doc(targetUid).get();
    const data = userDoc.exists ? userDoc.data() : {};
    const tokens = data.fcmTokens || [];
    const metadata = data.tokensMetadata || {};

    console.log(`[DEBUG] Current tokens for ${targetUid}:`, tokens);

    res.send({
      message: "✅ Diagnostica Token V5.2",
      tokenCount: tokens.length,
      tokens: tokens,
      metadata: metadata,
      watchdogLimit: 3
    });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

/**
 * Gestisce invio su Push o Email (Fallback)
 */
async function processNotificationChannel(db, recipientEmail, scadenza, ownerPrefs, ownerUid, scadenzaId) {
  let notificationSent = false;

  // 1️⃣ Push
  try {
    const userQuery = await db.collection("users").where("email", "==", recipientEmail).limit(1).get();
    if (!userQuery.empty) {
      const recipientData = userQuery.docs[0].data();
      const tokens = recipientData.fcmTokens || [];
      const pushAllowed = recipientData.prefs_push !== false;

      if (pushAllowed && tokens.length > 0) {
        const payload = {
          notification: {
            title: `Scadenza: ${scadenza.type}`,
            body: `Ti ricordiamo ${scadenza.type} in data ${scadenza.dueDate}.`
          },
          android: {
            priority: "high",
            notification: {
              channelId: "default",
              clickAction: "FLUTTER_NOTIFICATION_CLICK"
            }
          },
          webpush: {
            headers: {
              Urgency: "high"
            },
            notification: {
              icon: "https://appcodici-password.web.app/assets/images/app-icon.jpg",
              requireInteraction: true
            },
            fcmOptions: {
              link: `https://appcodici-password.web.app/dettaglio_scadenza.html?id=${scadenzaId}`
            }
          },
          data: { scadenzaId, ownerId: ownerUid, click_action: "FLUTTER_NOTIFICATION_CLICK" }
        };

        const response = await admin.messaging().sendEachForMulticast({ tokens, ...payload });
        if (response.successCount > 0) {
          notificationSent = true;
          console.log(`[PUSH SUCCESS] Inviata a ${recipientEmail} (${response.successCount} dispositivi)`);
          await logNotification(db, ownerUid, scadenzaId, recipientEmail, "push");

          // 🔄 HEARTBEAT PATCH: Rinnova lastUsed per dispositivi validi
          await updateLastUsedForSuccessfulTokens(db, userQuery.docs[0].id, response, tokens);
        }

        // Cleanup token obsoleti anche dalle operazioni batch
        if (response.failureCount > 0) {
          const tokensToRemove = [];
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errCode = resp.error?.code;
              console.warn(`[CRON CLEANUP] Errore token: ${errCode}`);
              if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
                tokensToRemove.push(tokens[idx]);
              }
            }
          });

          if (tokensToRemove.length > 0) {
            const updateObj = {
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove)
            };
            tokensToRemove.forEach(t => {
              updateObj[new admin.firestore.FieldPath("tokensMetadata", t)] = admin.firestore.FieldValue.delete();
            });
            await db.collection("users").doc(userQuery.docs[0].id).update(updateObj);
            console.log(`[CRON CLEANUP] Rimossi ${tokensToRemove.length} token non validi per ${recipientEmail}.`);
          }
        }
      }
    }
  } catch (e) {
    console.warn(`[PUSH FAILED] Errore FCM per ${recipientEmail}:`, e);
  }

  // 2️⃣ Fallback Email
  if (!notificationSent && ownerPrefs.emailFallback) {
    try {
      await sendNotificationEmail(scadenza, recipientEmail);
      console.log(`[EMAIL SUCCESS] Fallback inviato a ${recipientEmail}`);
      await logNotification(db, ownerUid, scadenzaId, recipientEmail, "email");
    } catch (e) {
      console.error(`[EMAIL FAILED] Errore OAuth Gmail per ${recipientEmail}:`, e);
    }
  }
}

// Invia email tramite Gmail OAuth2
async function sendNotificationEmail(scadenza, recipient) {
  const transporter = await createTransporter();

  // Parsing Allegati
  const mailAttachments = [];
  if (scadenza.attachments && Array.isArray(scadenza.attachments)) {
    scadenza.attachments.forEach(att => {
      mailAttachments.push({
        filename: att.name || "allegato_scadenza",
        path: att.url // Nodemailer scarica automaticamente il file pubblico
      });
    });
  }

  const mailOptions = {
    from: `"Codex Scadenze" <${MAIL_USER}>`,
    to: recipient,
    subject: `[SCADENZA] ${scadenza.type}`,
    text: `Gentile ${scadenza.name || "Cliente"},\n\nTi ricordiamo la seguente scadenza:\n\n` +
      `Oggetto: ${scadenza.type}\n` +
      `Data Scadenza: ${scadenza.dueDate}\n` +
      `Note: ${scadenza.notes || "-"}\n\nCordiali saluti,\nCodex Team.`,
    attachments: mailAttachments
  };

  return transporter.sendMail(mailOptions);
}

// Registra log notifiche in Firestore
async function logNotification(db, uid, scadId, recipient, type) {
  await db.collection("users").doc(uid).collection("scadenze").doc(scadId).update({
    notificationLogs: admin.firestore.FieldValue.arrayUnion({
      sentAt: new Date().toISOString(),
      recipient,
      type
    })
  });
}

/**
 * HEARTBEAT PATCH V5.3
 * Aggiorna il timestamp `lastUsed` solo per i token su cui la notifica è andata a buon fine.
 * - Evita write storm: Esegue max 1 updateDoc() atomico sull'oggetto globale `tokensMetadata` per chiamata.
 * - Sicurezza atomica: usa instanza FieldPath() inibendo sovrascrittura radicale JSON,
 *   toccando unicamente la chiave `lastUsed` del singolo dispositivo.
 * - Evita Race Condition: l'identificativo esplicito per token ignora asincronicità
 *   e si fonda sull'Update server-timestamp o ISO locale senza interferire tra devices.
 * - HealthCheck Sinergia: Il pruning esegue l'amputazione. Questo nega il pruning sui terminali silenti ma validi.
 */
async function updateLastUsedForSuccessfulTokens(db, uid, response, requestTokens) {
  try {
    const successfulTokens = [];
    response.responses.forEach((res, idx) => {
      if (res.success) successfulTokens.push(requestTokens[idx]);
    });

    if (successfulTokens.length === 0) return;

    const now = new Date().toISOString();
    const updateObj = {};

    // Iniettiamo un update selettivo solo sui token win
    // L'utilizzo di `tokensMetadata.{token}.lastUsed` (scritto formattato con FieldPath)
    // consente un aggiornamento profondo parziale salvaguardando il createdAt e proprietà originali.
    successfulTokens.forEach(t => {
      updateObj[new admin.firestore.FieldPath("tokensMetadata", t, "lastUsed")] = now;
    });

    // Unico write per utente, batching opzionale se superasse 1000 campi ma i maxTokens per user sono ~3 in V5.3+
    await db.collection("users").doc(uid).update(updateObj);
    console.log(`[HEARTBEAT] Aggiornato lastUsed per ${successfulTokens.length} token di ${uid}.`);
  } catch (error) {
    console.warn(`[HEARTBEAT ERROR] Impossibile aggiornare heartbeat di ${uid}:`, error.message);
  }
}
