# Firestore Database Structure

This document outlines the main collections for the Firestore database.

## `utenti`

This collection stores information about the application's users.

- **Document ID:** `user_uid` (from Firebase Authentication)
- **Fields:**
  - `email`: (String) The user's email address.
  - `nome`: (String) The user's first name.
  - `cognome`: (String) The user's last name.
  - `ruolo`: (String) The user's role (e.g., 'admin', 'utente').
  - `createdAt`: (Timestamp) The date and time the user account was created.

## `aziende`

This collection stores information about the companies managed in the application.

- **Document ID:** Auto-generated ID
- **Fields:**
  - `nomeAzienda`: (String) The name of the company.
  - `partitaIva`: (String) The company's VAT number.
  - `codiceFiscale`: (String) The company's tax code.
  - `indirizzo`: (String) The company's address.
  - `proprietarioUid`: (String) The UID of the user who owns/manages this company (references a document in the `utenti` collection).
  - `createdAt`: (Timestamp) The date and time the company was added.

## `account_privati`

This collection stores private account credentials and information for each user.

- **Document ID:** Auto-generated ID
- **Fields:**
  - `userId`: (String) The UID of the user who owns this account information (references a document in the `utenti` collection).
  - `sitoWeb`: (String) The website URL for the account.
  - `username`: (String) The username for the account.
  - `password`: (String) The password for the account (encryption should be handled).
  - `note`: (String) Any additional notes.
  - `createdAt`: (Timestamp) The date and time the account was added.
  - `updatedAt`: (Timestamp) The date and time the account was last updated.

## `scadenze`

This collection stores deadlines and expiration dates.

- **Document ID:** Auto-generated ID
- **Fields:**
  - `userId`: (String) The UID of the user who owns this deadline (references a document in the `utenti` collection).
  - `titolo`: (String) The title of the deadline.
  - `descrizione`: (String) A description of the deadline.
  - `dataScadenza`: (Timestamp) The expiration date.
  - `notificaAttiva`: (Boolean) Whether a notification is active for this deadline.
  - `createdAt`: (Timestamp) The date and time the deadline was created.

## `allegati`

This collection stores information about uploaded files.

- **Document ID:** Auto-generated ID
- **Fields:**
  - `userId`: (String) The UID of the user who uploaded the file (references a document in the `utenti` collection).
  - `nomeFile`: (String) The name of the uploaded file.
  - `urlFile`: (String) The URL to the file in Firebase Storage.
  - `tipoFile`: (String) The MIME type of the file (e.g., 'image/jpeg', 'application/pdf').
  - `dimensioneFile`: (Number) The size of the file in bytes.
  - `riferimentoA`: (String) A reference to the document this attachment is related to (e.g., a document in the `scadenze` collection).
  - `createdAt`: (Timestamp) The date and time the file was uploaded.
