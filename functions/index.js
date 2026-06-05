/**
 * BACKEND CORE (V7.0 - NODEMAILER + APP PASSWORD)
 * Sistema notifiche scadenze via Gmail (App Password).
 * Schedulato ogni mattina alle 08:00 (Europe/Rome).
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { setGlobalOptions } = require("firebase-functions");

admin.initializeApp();
setGlobalOptions({ maxInstances: 10, region: "europe-west1" });

// Segreti cifrati (salvati su Google Secret Manager)
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

// ─────────────────────────────────────────────
// FUNZIONE SCHEDULATA — ogni giorno alle 08:00
// ─────────────────────────────────────────────
exports.checkDeadlines = onSchedule(
    {
        schedule: "0 8 * * *",
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

        // Configura trasportatore Nodemailer con App Password
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: gmailUser,
                pass: gmailPass,
            },
        });

        console.log(`[START] Controllo scadenze: ${today.toISOString().split("T")[0]}`);

        try {
            // Legge tutti gli utenti
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

                    // Controlla che abbia almeno un destinatario e una data
                    if (!s.email1 || !s.dueDate) continue;

                    // Calcola giorni mancanti alla scadenza
                    const dueDate = new Date(s.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    const diffMs = dueDate - today;
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                    const daysBefore = s.notif_days_before || 14;
                    const freqDays = s.notif_frequency || 7;

                    // Scadenze già passate: nessuna email
                    if (diffDays < 0) continue;

                    // Fuori dalla finestra di preavviso: troppo presto
                    if (diffDays > daysBefore) continue;

                    // Giorno della scadenza (diffDays == 0): invia SEMPRE l'email finale
                    // Negli altri giorni: rispetta la frequenza
                    if (diffDays > 0) {
                        const lastNotified = s.lastNotifiedAt
                            ? new Date(s.lastNotifiedAt)
                            : null;

                        if (lastNotified) {
                            const daysSinceLast = Math.floor(
                                (today - lastNotified) / (1000 * 60 * 60 * 24)
                            );
                            if (daysSinceLast < freqDays) continue;
                        }
                    }

                    // Componi il testo dell'email
                    const templateText = s.templateText || s.type || "una scadenza";
                    const veicolo = s.veicolo_modello ? ` ${s.veicolo_modello}` : "";
                    const dueDateFormatted = dueDate.toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                    });

                    const giorniLabel =
                        diffDays === 0
                            ? "⚠️ OGGI"
                            : diffDays === 1
                                ? "domani"
                                : `tra ${diffDays} giorni`;

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
      — Codex Security System &nbsp;|&nbsp; Notifica automatica
    </div>
  </div>
</body>
</html>`;

                    const recipients = [s.email1, s.email2]
                        .filter(Boolean)
                        .join(", ");

                    const mailOptions = {
                        from: `"Codex Notifiche" <${gmailUser}>`,
                        to: recipients,
                        subject: `⚠️ Scadenza in arrivo — ${s.type || templateText}`,
                        html: emailBody,
                    };

                    try {
                        await transporter.sendMail(mailOptions);
                        console.log(`[OK] Email inviata per scadenza ${sDoc.id} → ${recipients}`);

                        // Aggiorna lastNotifiedAt per evitare duplicati
                        await sDoc.ref.update({
                            lastNotifiedAt: today.toISOString().split("T")[0],
                        });
                    } catch (emailErr) {
                        console.error(`[EMAIL FAILED] Scadenza ${sDoc.id}:`, emailErr.message);
                    }
                }
            }

            console.log("[END] Controllo scadenze completato.");
        } catch (err) {
            console.error("[CRITICAL ERROR]", err.message);
        }
    }
);
