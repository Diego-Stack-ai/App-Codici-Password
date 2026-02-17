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

// Recupero parametri da Firebase Params//
//const clientEmail = getParams().gmail.client_email.value();//
const clientEmail = "gmail-sender@halogen-acumen-473312-f4.iam.gserviceaccount.com";

//const privateKey = getParams().gmail.private_key.value().replace(/\\n/g, '\n');//

const privateKey = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDP+7cWpJ6eaVrB\nFn2ZVQ4n2GpEzRtUOX1k31zyN3B1klIXhxe8T5oNWZ+vBiUIZ0mt51LjslhnTyP4\n9cTh10I/drCVzE8vELfIBKbpCkKC1GjVP8Rad8Ln/hZ0nDY/ktAZKqiZ34qiQU1V\nrcIVU81MHMhj2MWwhkKROq1vCpIonjcnEKfslWov7fwBsBmFDqgapTvDRGaTz3/M\nq5Xs3GEFAyfdcUCcPdTfwT9L08obogr7R21ibMS9Pdo9uqGLgOqhQVUa/J7K/97w\nGI2xdoAkc5Xc1mfVgjDb+V/DYFRxQUvALCFdbWV/xN02uky11HgobcyKKIJ7pFUJ\ngR0zx8slAgMBAAECggEAAvkTv0/pfiIxzE8uytS1N+SXQElReeOIfO4+CeHsMM7Z\nCMHczDHnGQgnvC/xf5LaZSrIiIpLSs7BMntw4QZbfN5Zdj3nzXU6Hn9sICpBYSIs\n89kBf+zBhuEFUsCY4rfA7PTEv2funcfvlXXyYq1CYszwIF1AFit7ibZPaSYhiLfg\nbxwGLIyxf8BOFztUnt5bg7JRZWZzgIFr/mqEi5QfTSyRpon3LeX1ePzkrOfqbeba\nHR8eTny5ebjoF+8sh0RZtf0mkjJtgl8Y0z4EyCksgq3cJlEa1S5RRdfJbTsrp3Y5\nWKIGyB78cmpVbWXiicacSPOIc61FYlTKxGGgP+v/gQKBgQD5s4mty3V0uNqcAx5D\nR3FljQef2ptCWdJiOZ3LIU2ryb2xgkfQWBiMs70imnAPRHdIxkaHO+dsXS6NeT8K\nfF90WMXX5TOW9xMnFRF6kVug6FeoGXj6hsORKUQc+jKfsPiOdVAYUaz+qiELErd2\nDoJtYLcSGjXSQAIWq0KDZx1YrQKBgQDVOsfGKRX/nl7zP/wf+CemHka8/zhOtGFS\n9g6DY/grJhnXcnCs3DXZnwSIMqYm/wrWG76YikGVkziPNzzwdkvTNjYI3aDiqcjd\nsV6DxfAO7vIOSeiXGDahLz+gS0+RfYey5H/waUYKMgK+UePP+B0Cz6I7axrXsU+G\naNltbz+zWQKBgQDlssnBDTu0LuQyxg+NtmfTEgPkghV22OfWocfM94rar4+HfiAP\nwSp8LE+dSFIzSTktwe9ZMbr2jVVooRNj0vuALLV6oAZwJkMBHblhddvDTlhsc1o9\no8C9hSd6PJJbIlHTwoj2hhPMhLY22HXZ7QkAEwr1ZRUDnwwMzGg4Np/hVQKBgHmW\nDPhH0U1zBv15zNCF9kXZGckHVxo57Q0bVWdCh+5CyZV6ohlPcD1pWXI4P1oZMBqq\ns2HT5FXgHu47Nzp+mfoT/XfMuMLGwcz4KMbHBX3ebpQLPN97ZRtAD+3dQ7/Ybppp\nhTKXNOL3ZW0U0OxztEc4EnADQMkhSBGClAi82PvxAoGBAPX3E4+KfYeZjAh6jzBZ\nqtJvPUKI5fZLyNhEuCn/8g1eAGk5qkf2gHNVtDi+6uMgI/Wzoeqi2OVdbVbCY+j1\n/EcdLg2onANNxQhZoYtTZYwLMJW5yF1sv4imtf3jzhlwgEinWiNo1QQmOqjib38K\nj9X1ibdne6rvj6XbFFYAZSlA\n-----END PRIVATE KEY-----\n`

// Email account da usare come mittente
const MAIL_USER = "amministrazione.bmservice@gmail.com";

// JWT client per Gmail API
const jwtClient = new google.auth.JWT(
  clientEmail,
  null,
  privateKey,
  ["https://www.googleapis.com/auth/gmail.send"]
);

// Funzione helper per generare access token valido
async function getAccessToken() {
  await jwtClient.authorize();
  return jwtClient.credentials.access_token;
}

// Crea transporter Nodemailer con OAuth2
async function createTransporter() {
  const accessToken = await getAccessToken();

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: MAIL_USER,
      accessToken: accessToken
    }
  });
}

// Funzione schedulata per controllare scadenze
exports.checkDeadlines = onSchedule("0 8 * * *", async () => {
  const db = admin.firestore();
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

  const mailOptions = {
    from: `"BM SERVICE - Protocollo" <${MAIL_USER}>`,
    to: recipient,
    subject: `[SCADENZA] ${scadenza.type}`,
    text: `Gentile ${scadenza.name || "Cliente"},\n\nTi ricordiamo la seguente scadenza:\n\n` +
      `Oggetto: ${scadenza.type}\n` +
      `Data Scadenza: ${scadenza.dueDate}\n` +
      `Note: ${scadenza.notes || "-"}\n\nCordiali saluti,\nBM Service s.r.l.`
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
