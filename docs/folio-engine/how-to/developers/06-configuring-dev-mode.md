# How-To: Configure Dev Mode in Your App

This guide shows application developers how to wire, secure, and customize **Dev Mode** in a web app built with `@devcabs/folio-engine` so editorial end-users can authenticate and edit content safely in the browser.

> [!NOTE]
> Looking for the non-technical user guide for coordinators editing in the browser? Share [End-User How-To: Entering & Managing Dev Mode](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/end-users/01-entering-dev-mode.md) with your team.

---

## Option A: Using the Pre-Wired `<App />` Shell (Fastest)

If your application mounts `<App config={...} />` from `@devcabs/folio-engine`, Dev Mode is already wired with `MigrationProvider`, `DeveloperModeProvider`, `UndoRedoProvider`, and all required modals (`DevPinModal`, `DevLockBlockedModal`, `DevExitConfirmModal`, and `DevModeBadge`).

You only need to provide your `EngineConfig` and environment variables:

```tsx
import { App, type EngineConfig } from '@devcabs/folio-engine';
import '@devcabs/folio-engine/style.css';

const config: Partial<EngineConfig> = {
  appId: 'my-portal',
  appNamespace: 'my_portal',
  securitySalt: import.meta.env.VITE_DEV_SALT,
  expectedPinHash: import.meta.env.VITE_DEV_PIN_HASH,
  features: {
    enableEditorMode: true,
    enableChartDrawer: true,
    enableHistoryLedger: true,
  },
  branding: {
    appName: 'My Editorial Portal',
  },
};

export default function Main() {
  return <App config={config} />;
}
```

---

## Step 1: Generate a 4-Digit PIN Hash & Salt

Dev Mode authenticates users with a **4-digit numeric PIN** (`0000`–`9999`), never stored in cleartext. `devSecurity.ts` computes:

```
SHA-256("${salt}:${pin}")
```

1. Pick a unique salt per application (e.g., `my_portal_salt_2026`) and a 4-digit PIN (e.g., `4829`).
2. Generate the SHA-256 hex digest:

```bash
echo -n "my_portal_salt_2026:4829" | shasum -a 256
```

Or compute it in Node.js:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('my_portal_salt_2026:4829').digest('hex'))"
```

3. Store the values in your `.env` (or pass them via `EngineConfig`):

```env
VITE_DEV_SALT=my_portal_salt_2026
VITE_DEV_PIN_HASH=<64-char-hex-digest>

# Optional: Cloud persistence & single-coordinator mutex lock
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key

# Optional: Google Drive photo verification & folder sync
VITE_GOOGLE_DRIVE_API_KEY=your-google-api-key
```

> [!IMPORTANT]
> **Fallback Resolution Order**: `verifyPin()` checks `EngineConfig.expectedPinHash` first, then `import.meta.env.VITE_DEV_PIN_HASH`, and finally falls back to the built-in default hash. Always configure your own `VITE_DEV_SALT` and `VITE_DEV_PIN_HASH` before deploying to production.

---

## Step 2: Custom App Shells (Manual Provider & Chrome Wiring)

If you compose Folio Engine components inside a custom layout instead of `<App />`, wrap your root with the context providers and mount the Dev Mode chrome:

```tsx
import {
  setEngineConfig,
  MigrationProvider,
  DeveloperModeProvider,
  UndoRedoProvider,
  DevPinModal,
  DevLockBlockedModal,
  DevExitConfirmModal,
  DevModeBadge,
} from '@devcabs/folio-engine';
import '@devcabs/folio-engine/style.css';

const engineConfig = setEngineConfig({
  appId: 'custom-portal',
  appNamespace: 'custom_portal',
  securitySalt: import.meta.env.VITE_DEV_SALT,
  expectedPinHash: import.meta.env.VITE_DEV_PIN_HASH,
});

export function CustomRoot({ children }: { children: React.ReactNode }) {
  return (
    <MigrationProvider engineConfig={engineConfig}>
      <DeveloperModeProvider>
        <UndoRedoProvider>
          {children}
          <DevPinModal />
          <DevLockBlockedModal />
          <DevExitConfirmModal />
          <DevModeBadge />
        </UndoRedoProvider>
      </DeveloperModeProvider>
    </MigrationProvider>
  );
}
```

### Triggering Dev Mode Programmatically

Once wrapped in `DeveloperModeProvider`, users can enter Dev Mode via three built-in triggers:
- **Keyboard shortcut**: `Cmd + Shift + D` (macOS) or `Ctrl + Shift + D` (Windows/Linux)
- **URL query parameter**: `?dev=true` or `?mode=developer`
- **Header seal tap**: Clicking the `AppHeader` geometric logo 5 times within 3 seconds

To expose your own custom button, consume `useDeveloperMode()`:

```tsx
import { useDeveloperMode } from '@devcabs/folio-engine';

export function CustomAdminButton() {
  const { isDevMode, isDesktop, openPinModal, requestExitDevMode } = useDeveloperMode();

  if (!isDesktop) return null;

  return isDevMode ? (
    <button type="button" onClick={requestExitDevMode}>
      Exit Dev Mode
    </button>
  ) : (
    <button type="button" onClick={() => openPinModal(false)}>
      Edit Page
    </button>
  );
}
```

---

## Step 3: Security & Viewport Guardrails

By default, `devSecurity.ts` and `DeveloperModeContext.tsx` enforce:

| Rule | Value | Purpose |
| :--- | :--- | :--- |
| **Desktop-only editing** | Viewport `>= 1024px` (or `>= 720px` with a fine pointer) | Prevents accidental edits on mobile/touch-only devices |
| **Session timeout** | `30 minutes` (`SESSION_DURATION_MS`) | Auto-prompts for renewal or expires idle browser sessions |
| **Brute-force lockout** | `5` failed attempts → `60s` cooldown (`MAX_ATTEMPTS`, `LOCKOUT_DURATION_MS`) | Persists across tabs/refreshes via `localStorage` |
| **Distributed lock** | 1 active coordinator at a time (via Supabase `engine_lock`) | Displays `DevLockBlockedModal` if another user is editing |

---

## Step 4: Verify Wiring in Development

Call `verifyEngineWiring()` (or let `<App />` run it automatically in dev builds) to catch missing stylesheets, invalid `EngineConfig` fields, or malformed accent syntax early:

```ts
import { verifyEngineWiring } from '@devcabs/folio-engine';

const check = verifyEngineWiring();
if (!check.ok) {
  console.error(check.errors);
}
```
