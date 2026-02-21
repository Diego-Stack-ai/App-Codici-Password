# V3.1 sharing architecture Test Plan

This document details the functional and end-to-end testing phases required to ensure the correct behavior and integrity of the rewritten sharing architecture.

## Scope of Testing
The testing process focuses relentlessly on:
- Idempotency and transaction success during concurrent sharing operations.
- Deterministic behavior logic independent of real-time polling or external scripts.
- Integrity between UI presentation and correct data fetching derived from `type`, `visibility`, and `sharedWith`.
- Absolute zero regressions across `account/memo/azienda` forms, `area_privata` lists, and `account_privati` module features.

### 1. Functional Testing: Creating and Updating Accounts
**Goal:** Verify a newly created or modified account generates a V3 node exactly conforming to schema.

1. **Test: Create Private Account**
   - Action: Disable "Share" and "Memo" flags on UI, then submit the form.
   - Expected `type`: `account`
   - Expected `visibility`: `private`
   - Expected Map: `sharedWith` contains 0 members.

2. **Test: Create Shared Memo**
   - Action: Enable "Share Memo" and type multiple valid emails, then submit form.
   - Expected `type`: `memo`
   - Expected `visibility`: `shared`
   - Expected Map: `sharedWith` array matches entered emails with `status = "pending"`.
   - Expected Output: Atomic `setDoc` generates an `invites` document containing precise metadata linked exactly mapping sender and recipient.

3. **Test: Modifying Existing Account from Private to Shared**
   - Action: Open a Private account, add a guest via `shared-section` UI, click Save.
   - Expected Output: Target is appended to `sharedWith` Map via `deleteField()` replacements and atomic increments logic.

### 2. Functional Testing: Accepting, Rejecting, and Revoking Invites
**Goal:** Verify the `main.js` Global listener handles response interactions synchronously inside transactions without race conditionals.

1. **Test: Recipient Accepts Pending Invite**
   - Action: "Guest" clicks "Accept" via prompt.
   - Script executed: `handleInviteResponse(inviteId, inviteData, 'accepted')` in `main.js`.
   - Expected Result: `invites` status is "accepted". Account `acceptedCount` augments. The guest's email entry in `sharedWith` receives their literal `uid`. Return UI redirects and filters to `Account Privati`.

2. **Test: Recipient Rejects Pending Invite**
   - Action: "Guest" clicks "Reject" via prompt.
   - Expected Result: The owner is notified (`senderNotified = false` in `invites`). The guest's `email` entry in `sharedWith` reflects `status: rejected`.
   - *Vital Rule Case*: If the rejecting guest was the ONLY active share pending/accepted, `visibility` must revert automatically to `private`.

3. **Test: Owner Revokes Guest Access V3.1**
   - Action: Owner goes inside `Dettaglio Account (Privato/Azienda)`, clicks the trash icon by the guest name inside "Condivisi con:".
   - Script executed: `revokeRecipientV3(email)` running atomic transactions.
   - Expected Result: Removes guest key from `sharedWith` Map using atomic update logic, reduces `acceptedCount`, and drops target's literal technical UID `invites` instance document.

### 3. UI/UX Verification
**Goal:** Assess structural integrity among conditional renderings.

1. **Test: Access Levels (Guest view)**
   - Action: A "Guest" opens a shared account from `account_privati.js` -> redirects to `dettaglio_account_privato` or `dettaglio_account_azienda`.
   - Expected Result: `isReadOnly` flag is true. Actions (edit, trash, revoke button) do not render inside `setupReadOnlyUI()`. The password inputs show "Copied" functions but cannot click save.

2. **Test: Listing Filter Correctness (`account_privati.js`)**
   - Action: The UI provides filters "Standard", "Condivisi", "Memorandum".
   - Expected Result: 
        * V3 "memo" -> `type: memo` displays only in Memorandum.
        * V3 "shared" -> `visibility: shared` renders exclusively across "Shared" tab.
        * Standard -> `type: account`, `visibility: private`.

### 4. Security Rules Testing
**Goal:** Penetration scenarios enforcing the `firestore.rules` configuration.

1. **Test: Unauthorized Access Attempt**
   - Action: A user manipulates browser debugger to execute a `getDoc` read on an `accountId` belonging to another user.
   - Expected Firebase Result: `permission-denied`. (Fails owner check AND isn't found inside `sharedWith` map where `status == 'accepted'`).

2. **Test: Cross-Tampering Write Attempt**
   - Action: Guest intercepts update packet and triggers an `updateDoc` changing `acc.password` or `acc.visibility = public`.
   - Expected Firebase Result: Blocked due to `.affectedKeys().hasOnly(['sharedWith', 'acceptedCount', 'updatedAt'])`. Guests can only write to the map for response sync.

### Summary Status
If these tests succeed under continuous integration (CI) environments or a full-scale manual simulation framework, the legacy structural bugs are permanently obsolete.
