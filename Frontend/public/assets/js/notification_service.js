import { db } from './firebase-config.js';
import { collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { buildEmailBody, buildEmailSubject, DEADLINE_RULES } from './scadenza_templates.js';

/**
 * Checks all active deadlines for a user and returns a list of notifications to send.
 * @param {string} userId 
 * @returns {Promise<Array>} List of notification objects
 */
export async function checkDeadlines(userId) {
    if (!userId) return [];

    const notifications = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        // Updated to matching sub-collection path used in db.js
        const q = query(
            collection(db, "users", userId, "scadenze"),
            where("status", "==", "active")
        );

        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const dueDate = new Date(data.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            // Calculate Difference in Days
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Get Rules (Saved in doc or from constants)
            const primoAvviso = parseInt(data.notificationDaysBefore) || 14;
            const replica = parseInt(data.notificationFrequency) || 7;

            // CHECK LOGIC
            // Condition 1: Inside Alert Period (0 <= diffDays <= primoAvviso)
            if (diffDays >= 0 && diffDays <= primoAvviso) {
                let shouldSend = false;

                // Urgency Check (Case A): 
                // If we are in the alert period BUT have never sent a notification for this deadline, send immediately.
                // This covers late creation (e.g., created 8 days before deadline when primoAvviso is 56).
                // We check if 'lastNotificationDate' exists.
                const lastSentStr = data.lastNotificationDate;
                let neverSent = !lastSentStr;

                // Also check if sent TODAY to avoid spamming if script runs multiple times
                const todayStr = new Date().toISOString().split('T')[0];
                const sentToday = lastSentStr === todayStr;

                if (sentToday) {
                    shouldSend = false; // Already handled today
                } else {
                    // Logic:
                    // 1. If never sent -> SEND (Urgency)
                    // 2. If deadline day (diffDays == 0) -> SEND (Final Warning)
                    // 3. Math Check: (primoAvviso - diffDays) % replica === 0 -> SEND (Replica)

                    if (neverSent && diffDays < primoAvviso) {
                        shouldSend = true;
                            window.LOG(`[Urgency] Sending first alert for ${doc.id} (Late Start)`);
                    } else if (diffDays === 0) {
                        shouldSend = true;
                            window.LOG(`[Deadline] Sending final alert for ${doc.id}`);
                    } else {
                        // Math Check
                        // Example: Primo 56, Rec 6. Today Diff 50. 
                        // Passed: 56-50 = 6. 6 % 6 == 0. SEND.
                        const daysPassedInAllerta = primoAvviso - diffDays;
                        if (daysPassedInAllerta >= 0 && (daysPassedInAllerta % replica === 0)) {
                            shouldSend = true;
                        }
                    }
                }

                if (shouldSend) {
                    // TRIGGER NOTIFICATION
                    let subject = data.title;

                    if (diffDays === 0) {
                        subject = "ULTIMO AVVISO " + subject;
                    }

                    // data.dueDate is YYYY-MM-DD
                    const dateParts = data.dueDate.split('-');
                    const dateIt = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

                    const body = buildEmailBody(
                        data.email_testo_selezionato,
                        data.veicolo_targa,
                        dateIt
                    );

                    notifications.push({
                        id: doc.id,
                        deadlineId: doc.id,
                        type: data.type,
                        subject: subject,
                        body: body,
                        to: data.emails,
                        daysLeft: diffDays,
                        whatsappEnabled: data.whatsappEnabled
                    });
                }
            }
        });

    } catch (error) {
        console.error("Error checking deadlines:", error);
    }

    return notifications;
}

/**
 * Mock function to simulate sending emails.
 * IMPORTANT: In production, this must update the Firestore doc with 'lastNotificationDate'.
 */
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

export async function sendNotificationBatch(notifications, userId) {
    if (!notifications || notifications.length === 0) return { sent: 0 };

    console.group("SIMULAZIONE INVIO E-MAIL");

    let sentCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    for (const n of notifications) {
        window.LOG(`--- EMAIL TO: [${n.to.join(', ')}] ---`);
        window.LOG(`OGGETTO: ${n.subject}`);
        window.LOG(`CORPO: ${n.body}`);
        window.LOG(`-----------------------------------`);

        // Update Firestore to mark as sent
        if (userId) {
            try {
                const docRef = doc(db, "users", userId, "scadenze", n.deadlineId);
                await updateDoc(docRef, {
                    lastNotificationDate: todayStr
                });
                sentCount++;
            } catch (e) {
                console.error("Failed to update notification date:", e);
            }
        }
    }
    console.groupEnd();

    return { sent: sentCount };
}
