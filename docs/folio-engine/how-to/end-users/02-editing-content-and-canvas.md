# How-To: Edit Page Copy & Build Document Canvas Blocks

Once you are unlocked in [Dev Mode](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/end-users/01-entering-dev-mode.md), you can edit existing page text, links, and titles, as well as build structured document pages using Sections, Subsections, Text, Photos, and Charts.

---

## 1. Edit Page Headlines, Text & Links (`✎ Edit`)

Throughout the home page, navigation milestones, and page headers, editable elements display a small **`✎ Edit`** button in Dev Mode.

1. Click **`✎ Edit`** next to the headline, subtitle, milestone label, link, or footer item you want to change.
2. Depending on the element type, update the fields in the dialog:
   - **Text / Copy**: Edit the **Content** field and save.
   - **Links**: Update the **URL** (e.g., `https://...` or `#overview`), **Label**, and optionally check **Open in new tab**.
   - **Section Titles**: Update **Section Title** and toggle **Numbered section** if you want automatic sequential numbering (e.g., `I`, `II`, `III`) before the heading.
3. Save your change. It updates immediately in your private draft preview.

---

## 2. Add New Blocks to a Document Canvas

Open any milestone or node page to access its Document Canvas.

### Starting an Empty Canvas
If the page has no content yet, click **Click to add the first Section** to create your opening section.

### Inserting Elements Anywhere on the Page
Look for the **`+`** (**Insert element**) pill button above, inside, or below sections:

1. Click **`+`** to open the **Add Element Palette**.
2. Choose the block type you want to insert:
   - **Section**: A major page divider/group (can be numbered or unnumbered).
   - **Subsection**: A nested sub-heading inside a Section.
   - **Text**: A narrative text block for paragraphs and explanations.
   - **Photo**: Hover or click **Photo** to choose between:
     - **Single Photo** (one standalone image with optional caption)
     - **Photo Gallery** (a grid gallery linked to a Google Drive folder)
   - **Document**: Hover or click **Document** to choose between:
     - **Single PDF** (an inline Google Drive PDF viewer with optional title and caption)
     - **PDF Folder** (a synced list of PDF documents from a Google Drive folder)
   - **Chart**: Opens the **Chart Setup** drawer to connect a Google Sheet visualization.
3. Fill in the block details and save to insert it at that exact spot.

---

## 3. Reorder, Edit, or Delete Canvas Blocks

Hover your cursor over any Section, Subsection, Text block, Photo, or Chart in Dev Mode to reveal its **Item Authoring Controls** toolbar in the corner of the block:

| Control | Action |
| :--- | :--- |
| **`⋮⋮`** | **Drag to reorder**: Grab the handle and drop the block onto a new position. |
| **`↑`** | **Move Up**: Swap the block one position earlier. |
| **`↓`** | **Move Down**: Swap the block one position later. |
| **Pencil (`Edit`)** | Open the editor modal (or **Chart Setup** drawer for chart blocks). |
| **Trash (`Delete`)** | Remove the block after confirming the delete prompt. |

> [!TIP]
> **Made a mistake while deleting or moving?** Click **Undo** on the floating Dev Mode bar (or press `Cmd + Z` / `Ctrl + Z`) immediately to restore the previous layout.

---

## Next Steps

- Learn how to upload photos and sync Drive folders in [How-To: Manage Photos & Drive Galleries](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/end-users/03-photos-and-drive-galleries.md).
- Learn how to publish your draft live in [How-To: Use History, Undo & Publish Changes](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/end-users/05-history-undo-and-publishing.md).


---

## Working with Nested Subpages

1. **Adding a Subpage**: Open the **Add** bar inside any section or subsection and choose **Add Page**. Enter a title (auto-generates a unique URL slug) and an optional 1-line summary. A `CanvasPageLink` card is added to the current page and links 1:1 to the new nested subpage.
2. **Editing Title, Slug, or Summary**:
   - Click the inline `<PageTitle>` at the top of any subpage to rename it everywhere at once (card, header dropdown, and breadcrumb).
   - Or click **Edit** on a `CanvasPageLink` card to update the title, customize the URL slug (with live folder URL preview), or edit the summary.
3. **Reordering Subpages**: Reordering `CanvasPageLink` cards on a chapter canvas automatically updates the Level 2 dropdown order in the top navigation bar.
4. **Guarded Branch Deletion**: Deleting a subpage with nested child pages opens a guarded confirmation modal showing the exact descendant count and requiring you to type `DELETE ALL SUBPAGES` before confirming. Press `Cmd+Z` (`Ctrl+Z`) immediately to restore the entire deleted branch if needed.
