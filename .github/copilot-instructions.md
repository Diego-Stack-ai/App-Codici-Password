# AppCodiciPassword - AI Agent Development Guidelines

This is a **Firebase-based password management application** (Italian: "App Codici Password") for managing credentials, company accounts, deadlines, and shared access across individuals and organizations.

## Architecture Overview

**Stack**: Frontend-only serverless architecture
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, Tailwind CSS
- **Database & Auth**: Google Firebase (Firestore + Authentication)
- **Hosting**: Firebase Hosting (static files + cloud functions)
- **Mobile**: PWA-enabled (manifest.json, offline capable)

**Data Model** (Firestore structure):
- `/users/{uid}` - User profile (nome, cognome, email, settings, theme)
- `/users/{uid}/accounts` - Stored credentials (privato/azienda type accounts)
- `/users/{uid}/scadenze` - Deadline reminders (vehicle maintenance, document renewals)
- `/invites/{inviteId}` - Shared access invitations (cross-user collaboration)

## Key Development Patterns

### 1. Firebase Integration
- **SDK**: Firebase v11.1.0 (CDN-based, modular imports)
- **Auth Flow**: Email/password registration with verification via [auth.js](Frontend/public/assets/js/auth.js)
- **DB Access**: Centralized via [db.js](Frontend/public/assets/js/db.js) with query helpers
- **Security Model**: User-scoped read/write - `/users/{userId}/{document=**}` only readable by owner (firestore.rules)

**Critical Pattern**: Always check `request.auth.uid == userId` before accessing user data.

### 2. Frontend Architecture
- **Page Structure**: Each feature is a standalone HTML page (e.g., `account_azienda.html`, `scadenze.html`)
- **Page Scripts**: Each page has a corresponding JS file that handles DOMContentLoaded and state management
- **Shared Utilities**: [main.js](Frontend/public/assets/js/main.js), [utils.js](Frontend/public/assets/js/utils.js), [swipe-list-v6.js](Frontend/public/assets/js/swipe-list-v6.js)
- **CSS Framework**: Tailwind CSS only - NO custom .css files except global configs

**Pattern Example** (account_azienda.html):
```javascript
// Imports Firebase and db helpers
import { db, auth } from './firebase-config.js';
import { getAccounts } from './db.js';

// DOMContentLoaded: initialize UI + event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
  setupEventHandlers();
});
```

### 3. Critical Rendering Path (Mandatory Rule 0)
**Every page MUST appear instantly correct** (no flash of unstyled content):
1. Inline `<style>` block in `<head>` IMMEDIATELY after `<meta charset>` with `background-color`, `color`, theme detection
2. All scripts use `defer` attribute or placed before `</body>`
3. Heavy image assets use `<link rel="preload" as="image">`

Example from [index.html](Frontend/public/index.html#L7-L17):
```html
<script>
  // Instant theme detection - runs before CSS
  const savedTheme = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
    document.documentElement.classList.add('dark');
  }
</script>
```

### 4. Async Data Operations
- **Pattern**: Use `async/await` with `try/catch` for all Firebase calls
- **Error Handling**: Show user-facing notifications via `showNotification(message, 'error'|'success')`
- **Loading States**: Set disabled attributes on buttons during operations

```javascript
async function loadScadenze() {
  try {
    const scadenze = await getScadenze(userId);
    updateUI(scadenze);
  } catch (error) {
    console.error("Error loading scadenze:", error);
    showNotification("Errore nel caricamento", "error");
  }
}
```

### 5. Component Patterns
- **Swipe Gesture Support**: [swipe-list-v6.js](Frontend/public/assets/js/swipe-list-v6.js) for mobile delete/edit actions
- **Copy-to-Clipboard**: Use `data-copy-target` attribute + `.copy-button`/`.copy-btn` classes
- **Password Toggle**: `.toggle-password` button switches input type
- **Dark Mode**: Use Tailwind `dark:` prefix - avoid hardcoded colors

### 6. Company/Azienda Hierarchy
- **Accounts can be personal** (`type: 'privato'`) or **company-linked** (`type: 'azienda'`)
- Company accounts belong to `/aziende/{aziendaId}` documents
- Multi-user company access requires invitation system via `/invites` collection
- Shared data flags: `condiviso` (boolean), `memorandum` (notes visible to shared users)

## Critical Files to Understand

| File | Purpose |
|------|---------|
| [firebase-config.js](Frontend/public/assets/js/firebase-config.js) | SDK initialization, exports `auth`, `db`, `storage` |
| [auth.js](Frontend/public/assets/js/auth.js) | Login, registration, password reset, profile updates |
| [db.js](Frontend/public/assets/js/db.js) | CRUD operations: accounts, scadenze, aziende queries |
| [main.js](Frontend/public/assets/js/main.js) | Global event handlers (password toggles, copy buttons, navigation) |
| [notification_service.js](Frontend/public/assets/js/notification_service.js) | Toast/notification system, deadline alerts |
| [firestore.rules](firestore.rules) | Security rules - enforce user data isolation |

## Common Tasks

### Add a New Feature Page
1. Create `Frontend/public/new_feature.html` with inline theme styles
2. Create `Frontend/public/assets/js/new_feature.js` with imports and DOMContentLoaded handler
3. Use [db.js](Frontend/public/assets/js/db.js) helpers for Firestore access
4. Style with Tailwind utility classes only
5. Test responsive design and dark mode

### Modify Account/Scadenza Logic
- Edit [db.js](Frontend/public/assets/js/db.js) for query/mutation logic
- Update corresponding page scripts (e.g., `account_azienda.js`, `scadenze.js`)
- Add `try/catch` error handling with user notifications
- Test with both personal and company-linked data

### Deploy Changes
```bash
# Frontend: Push to Firebase Hosting
firebase deploy --only hosting

# Functions (if added): Deploy Cloud Functions
firebase deploy --only functions

# Preview before deploy
firebase hosting:channel:deploy BRANCH_NAME
```

## Design System (Dark Mode, Premium UI)

- **Glassmorphism**: `backdrop-blur`, semi-transparent backgrounds (`dark:bg-[#1C2733]`)
- **Primary Color**: Blue (`from-primary`, `#137fec` approximate)
- **Dark Theme**: Deep grays (`#1C2733`, `#101922`) instead of pure black
- **Micro-animations**: `transition-all duration-300`, hover states, scale feedback (`active:scale-[0.98]`)
- **Icons**: Material Symbols Outlined (CDN-loaded)

## Important Constraints

1. **No Server-Side Code** in Frontend → all auth/data access validates in Firestore rules
2. **No External Package Managers** (npm install avoided in favor of CDN Firebase)
3. **Italian Localization**: UI text, error messages, collection names are Italian
4. **Mobile-First**: All pages tested on mobile viewport (responsive design essential)
5. **Security**: Never expose Firebase credentials in version control (already in config file - handle carefully)

## Debugging & Testing

- **Console Errors**: Check browser DevTools for Firebase SDK errors
- **Auth State**: Verify `onAuthStateChanged` listener in page scripts
- **Firestore Rules**: Test with Firebase Emulator or check rules in [firestore.rules](firestore.rules)
- **PWA**: Test offline mode via DevTools Application tab
- **Playwright Tests**: Basic test setup in [package.json](package.json) - run via `npx playwright test`
