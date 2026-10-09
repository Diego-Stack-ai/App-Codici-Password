"use strict";

// Account tecnico creato esclusivamente per il collaudo controllato dei motori
// M7/M8/M10. Il valore non e un segreto: il vincolo autorevole e l'email
// firmata nel token Firebase Authentication, non un dato inviato dal client.
const MATURITY_TEST_EMAIL = "codex-collaudo-20261009@example.invalid";

function isMaturityTestActor(auth) {
    return Boolean(auth &&
        typeof auth.uid === "string" && auth.uid.length > 0 &&
        typeof auth.token?.email === "string" &&
        auth.token.email.toLowerCase() === MATURITY_TEST_EMAIL &&
        auth.token.firebase?.sign_in_provider === "password");
}

module.exports = {MATURITY_TEST_EMAIL, isMaturityTestActor};
