const https = require('https');

const REF_TOKEN = "1//09tpE_-3Dya-brg2MyBVbCEmA_S3F0C2TMzSni9WXHgbUh6LvQdPJY969KbA";
const CLIENT_ID = "563503831353-86id9e7l2f60p1on1s0n41o9o64q9on6.apps.googleusercontent.com";
const CLIENT_SECRET = "D-6V7Q-r-8lV8V-8";

function post(url, data) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }, res => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function run() {
    console.log("Exchanging refresh token...");
    const data = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${REF_TOKEN}&grant_type=refresh_token`;
    const tokens = await post('https://oauth2.googleapis.com/token', data);
    const accToken = tokens.access_token;

    if (!accToken) {
        console.error("Failed to get access token:", tokens);
        return;
    }
    console.log("Access token obtained.");

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/appcodici-password/databases/(default)/documents/users/aebi78Ja4rOvbYcmTlr4m2Or1AE2?updateMask.fieldPaths=fcmTokens&updateMask.fieldPaths=fcmToken`;

    const payload = JSON.stringify({
        fields: {
            fcmTokens: { arrayValue: { values: [] } }
            // fcmToken non incluso nel payload per via dell'updateMask lo elimina (se non fornito?)
            // In realtà per eliminare un campo via REST si usa updateMask ma non si fornisce il campo nei fields.
        }
    });

    const req = https.request(firestoreUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accToken}`,
            'Content-Type': 'application/json'
        }
    }, res => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
            console.log("REST_RESPONSE:", d);
        });
    });
    req.write(payload);
    req.end();
}

run().catch(console.error);
