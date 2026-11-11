# How-To: Enter & Manage Dev Mode in the Webapp

**Dev Mode** lets editors and coordinators update page copy, sections, photos, and charts directly inside the live website. Everything you change is saved as a private draft until you publish it, so public visitors never see work in progress.

---

## Before You Begin

- **Use a desktop or laptop**: Dev Mode requires a desktop-sized browser window (`1024px` or wider, or at least `720px` wide with a mouse/trackpad). It is disabled on phones and touch-only tablets.
- **Have your 4-digit PIN ready**: Ask your site administrator if you do not have the 4-digit Dev Mode PIN.

---

## Step 1: Open the PIN Prompt

You can open the **Developer Authentication** window using any of these three methods:

1. **Header Logo Tap**: Click the geometric brand logo in the top-left header **5 times within 3 seconds**.
2. **Keyboard Shortcut**: Press **`Cmd + Shift + D`** (Mac) or **`Ctrl + Shift + D`** (Windows/Linux).
3. **Direct URL**: Add **`?dev=true`** (or **`?mode=developer`**) to the end of the page URL and press `Enter`.

---

## Step 2: Unlock with Your 4-Digit PIN

1. In the **Developer Authentication** modal, type your **4-digit numeric PIN**.
2. The form submits automatically as soon as you enter the 4th digit (or press `Enter`).
3. Once authenticated, the floating **Dev Mode** capsule bar appears at the bottom of your screen, and `✎ Edit` controls appear across editable parts of the page.

> [!WARNING]
> **5 Failed Attempts Lockout**: Entering the wrong PIN 5 times in a row locks the prompt for **60 seconds** (persisting across page refreshes and browser tabs). Wait for the countdown timer to finish before trying again.

---

## Step 3: Understand the Floating Dev Mode Bar

While Dev Mode is active, a floating toolbar stays pinned near the bottom of your browser:

- **Dev Mode & Timer (`30m left`)**: Shows that you are editing privately and displays how many minutes remain in your 30-minute session. If the timer expires, a **Renew Developer Session** PIN prompt opens so you can continue without losing drafts.
- **Sync Indicator**: Displays `Saving...` while syncing drafts to the cloud, or `⚠ Sync error` if your connection drops.
- **Undo / Redo**: Step backward (`Cmd + Z` / `Ctrl + Z`) or forward (`Shift + Cmd + Z` / `Ctrl + Shift + Z`) through edits made during your session.
- **History**: Opens the **History** drawer to view past published versions or restore the system baseline.
- **Publish**: Saves your private draft changes live for all visitors.
- **Exit**: Leaves Dev Mode.

---

## Handling "Developer Mode is active elsewhere"

Only one person can edit at a time so two editors never overwrite each other. If someone else currently holds the editing session, you will see **Developer Mode is active elsewhere**:

- View when their session **Started** and watch the **Auto-refresh** countdown (checks every `10s`).
- Click **Check Status** to re-check immediately, or **Close** to continue browsing in read-only mode.
- Inactive sessions automatically release after **1 minute of inactivity** (or immediately when the other editor closes their tab or clicks **Exit**).

---

## Step 4: Exit Dev Mode Safely

Click **Exit** on the floating Dev Mode bar (or press **`Cmd/Ctrl + Shift + D`** again):

- **If you have no unpublished changes**: Click **Exit** to return to the public view (or **Cancel** to stay).
- **If you have unpublished changes**: Choose one of three options in the **Unpublished Changes** prompt:
  - **Keep Editing**: Stay in Dev Mode without losing anything.
  - **Discard Draft & Exit**: Throw away all unpublished draft edits from this session and return to the public site.
  - **Publish & Exit**: Open the **Publish Changes** prompt, publish your edits live, and then exit Dev Mode.
