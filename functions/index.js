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
    // Cerchiamo i token in fcmTokens o fcmToken (compatibilità legacy)
    let tokens = userData.fcmTokens || [];
    if (userData.fcmToken && !tokens.includes(userData.fcmToken)) {
      tokens.push(userData.fcmToken);
    }

    const pushAllowed = userData.prefs_push !== false;

    console.log(`[TRIGGER DEBUG] Tokens trovati: ${tokens.length}. Push abilitato in prefs: ${pushAllowed}`);

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
        webpush: {
          headers: {
            Urgency: "high"
          },
          notification: {
            icon: "https://appcodici-password.web.app/assets/images/app-icon.jpg",
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
      console.log(`[TRIGGER SUCCESS] Risultato invio a ${userId}: ${response.successCount} successi, ${response.failureCount} fallimenti.`);

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
          await db.collection("users").doc(userId).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove)
          });
          console.log(`[TRIGGER CLEANUP] Rimossi ${tokensToRemove.length} token non validi dal profilo ${userId}.`);
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

// Funzione schedulata ordinaria (Cron)
exports.checkDeadlines = onSchedule("0 8 * * *", async () => {
  await runChecks(admin.firestore());
});

// Funzione temporanea HTTP per test immediato ORA
exports.testScadenzeOra = onRequest(async (req, res) => {
  await runChecks(admin.firestore());
  res.send("✅ Test Eseguito! L'avviso per e-mail e notifiche push urgenti è stato appena processato sui server!");
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
