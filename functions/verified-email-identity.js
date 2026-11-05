"use strict";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function verifiedRequestEmail(request, HttpsError) {
  const token = request?.auth?.token || {};
  const email = normalizeEmail(token.email);
  if (token.email_verified !== true || !email) {
    throw new HttpsError("permission-denied", "Verifica l'indirizzo email prima di continuare.");
  }
  return email;
}

async function verifiedUserByEmail(auth, email) {
  try {
    const user = await auth.getUserByEmail(normalizeEmail(email));
    return user.emailVerified === true ? user : null;
  } catch (error) {
    if (error?.code === "auth/user-not-found") return null;
    throw error;
  }
}

module.exports = {normalizeEmail, verifiedRequestEmail, verifiedUserByEmail};
