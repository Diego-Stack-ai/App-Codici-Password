# V3.1 Data Migration Strategy

## Overview
This document outlines the strategy for migrating existing account data from the legacy structure (`sharedWithEmails`, `shared`, `isMemoShared`, `hasMemo`) to the new deterministic V3.1 architecture (`type`, `visibility`, `sharedWith` map, `acceptedCount`). 

The migration is designed to be **safe, idempotent, and reversible**. It executes atomic transactions to ensure no partial states exist, and implements a rollback mechanism for safety.

## Execution Plan

### Phase 1: Snapshot and Backup
Before running any migration, a complete backup of the `users` and `invites` collections from the Firestore production database must be captured.

### Phase 2: Execution Scopes
The migration script will iterate through all existing documents in:
1. `users/{uid}/accounts/{accountId}`
2. `users/{uid}/aziende/{aziendaId}/accounts/{accountId}`

### Phase 3: Transformation Logic (Mapping)
For each account document, the script performs the following mapping:

1. **`type` Field Determination**:
    * If `hasMemo == true` OR `isMemoShared == true` -> `type = 'memo'`
    * Else -> `type = 'account'`
2. **`visibility` Field Determination**:
    * If `shared == true` OR `isMemoShared == true` or `(sharedWithEmails && sharedWithEmails.length > 0)` -> `visibility = 'shared'`
    * Else -> `visibility = 'private'`

3. **`sharedWith` Map Generation**:
    * If `sharedWithEmails` (array) is present, iterate over each email.
    * Sanitize the email using `email.replace(/[^a-zA-Z0-9]/g, '_')` to create the Map key.
    * Check the corresponding document in `invites` (`accountId_sanitizedEmail`) to get its `status` (`pending`, `accepted`, `rejected`).
    * Check `users` collection or auth metadata to get the UID for the recipient if their status is `accepted` (this can be queried via secondary lookup or fetched lazily).
    * Build the Map:
      ```json
      {
         "sanitizedEmail_key": {
             "email": "user@example.com",
             "status": "accepted|pending",
             "uid": "mapped_uid_if_available"
         }
      }
      ```
4. **`acceptedCount` Calculation**:
    * Count the number of entries in `sharedWith` where `status === 'accepted'`.

### Phase 4: Atomic Commit (Idempotency)
For each modified document, run an atomic `updateDoc` call. To maintain idempotency, the script first checks if `sharedWith` already exists as an object/map. If it does, and `visibility` and `type` fields exist, it skips the document.

### Phase 5: Legacy Field Cleanup
Once validation confirms the V3.1 mapping is 100% accurate, an aggressive cleanup script uses `deleteField()` to wipe `shared`, `isMemoShared`, `hasMemo`, and `sharedWithEmails` from all accounts to save bandwidth and storage.

---

## Technical Edge Cases & Rollback Scenarios

### 1. Migrating Emails to UIDs
Firebase Admin SDK can be utilized server-side (Node.js script) to retrieve UIDs by email (`admin.auth().getUserByEmail()`) and populate the `uid` property within the new `sharedWith` map. If executed client-side, this runs the risk of missing UIDs unless those users are actively logged in.
**Resolution**: Run the official migration via a restricted Firebase Cloud Function or Admin SDK Node script, not from the web client.

### 2. Discrepancy between `sharedWithEmails` and `invites` Collection
The legacy auto-healing logic was notorious for desyncs. What if an email exists in `sharedWithEmails` but has no matching `invites` document?
**Resolution**: The migration script assumes the user lost the invite. It removes them from the shared map and resets `visibility` to `private` if they are the only guest, inherently enforcing the strict determinism of V3.1.

### 3. Rollback Mechanism
Every document updated must have an automated `_v2Backup` object created prior to the update:
```json
{
   "_v2Backup": {
       "sharedWithEmails": ["email1", "email2"],
       "shared": true,
       "isMemoShared": false,
       "hasMemo": true
   }
}
```
If anything breaks, a fast-restore script loops through the database, copying the `_v2Backup` contents back to the root level while deleting logic from the V3 schema.

## Summary
By formalizing the mapping, committing inside atomic batches/transactions, and generating inline `_v2Backup` nodes, the migration bridges the gap to V3.1 while rendering structural anomalies impossible.
