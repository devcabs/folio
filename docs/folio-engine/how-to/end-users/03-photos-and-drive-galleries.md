# How-To: Manage Photos & Google Drive Galleries

In Dev Mode, you can add standalone photos (uploaded directly or linked by URL) and connect public Google Drive folders that automatically populate interactive photo galleries.

---

## 1. Add or Update a Single Photo

You can edit existing page images (including hero or milestone photos) via **`✎ Edit`**, or insert a new image inside a Document Canvas via **`+` → Photo → Single Photo**.

1. Under **Photo Source**, choose one of two options:
   - **Upload Photo**: Click **Upload Photo** and pick a `PNG`, `JPEG`, `WebP`, or `GIF` image from your computer.
   - **Photo URL**: Paste a direct, publicly accessible image URL.
2. Fill in the descriptive caption or alt text if prompted.
3. Save your changes to preview the photo in your draft.

---

## 2. Prepare Your Google Drive Folder (Required for Galleries)

Before linking a Google Drive folder, make sure the folder can be read publicly:

1. Open the folder in **Google Drive**.
2. Click **Share**.
3. Under **General access**, change **Restricted** to **Anyone with the link**.
4. Keep the role set to **Viewer** and copy the folder link (`https://drive.google.com/drive/folders/...`).

---

## 3. Link a Google Drive Folder or Photo Gallery

### Option A: Link a Folder Attachment Badge
1. In Dev Mode, click **Attach Drive Folder** (or **`✎ Edit`** on an existing folder card).
2. In the **Link Folder** dialog:
   - Enter a **Folder Label** (for example, `Media & Documentation Folder`).
   - Paste your **Google Drive Folder URL**.
   - Click **Verify** to check public permissions. You should see `✓ Public folder verified`. (You can also click **Test Link ↗** to verify it opens in a new tab.)
3. Click **Save**.

### Option B: Insert a Photo Gallery in the Document Canvas
1. Click **`+`** (**Insert element**) inside a section, hover or click **Photo**, and select **Photo Gallery**.
2. Paste your public **Google Drive URL** into the gallery setup modal and save.

---

## 4. Sync New Drive Photos & Customize Photo Titles

Because Google Drive folders can be updated at any time outside the website, Folio lets you re-sync a gallery on demand:

1. Hover or view the gallery in Dev Mode and click **↻ Sync** (or **↻ Sync Photos** below the gallery).
2. A status notification reports the sync result (for example, `Synced 12 photos (+3 added, -1 removed)`).
3. If the folder shows **No Photos Found in Drive Folder**, upload image files to that Drive folder, wait a few seconds, and click **↻ Sync Photos** again.

### Rename Gallery Photos
Raw camera filenames (such as `IMG_2048.jpg`) can be replaced with clean captions:

1. Click the edit button on an individual photo card in the gallery.
2. In **Edit Photo Title**, enter a descriptive title (for example, `Community Stakeholders Assembly`) and save.

---

## Next Steps

- Publish your updated photos and galleries live using [How-To: Use History, Undo & Publish Changes](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/end-users/05-history-undo-and-publishing.md).
