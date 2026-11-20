# How-To: Configure Charts from Google Sheets in the Browser

In Dev Mode, you can turn any public Google Sheet table into an interactive chart without writing code. The **Chart Setup** drawer lets you connect a spreadsheet, pick a cell range, choose a visualization type, and preview the live chart before saving.

---

## Before You Begin: Share Your Google Sheet

For the site to read live spreadsheet data, the Google Sheet must allow public read access:

1. Open your spreadsheet in **Google Sheets** and click **Share**.
2. Under **General access**, change **Restricted** to **Anyone with the link**.
3. Keep the role set to **Viewer**.

> [!TIP]
> You do **not** need to export CSV files manually. Standard Google Sheets share URLs (`https://docs.google.com/spreadsheets/d/.../edit`) work directly.

---

## Step 1: Open the Chart Setup Drawer

- **To add a new chart**: Inside any Document Canvas section in Dev Mode, click **`+`** (**Insert element**) and choose **Chart**.
- **To edit an existing chart**: Hover over a chart (or a pending chart placeholder) and click its **Edit** button.

---

## Step 2: Connect Your Sheet (`Source & Range`)

On Tab **1 (`Source & Range`)**:

1. **Paste & Verify URL**: Paste your Google Sheets URL into the spreadsheet field and click **Verify**.
   - If the sheet is still private, an **Enable Link Sharing** notice appears with an **Open Sheet ↗** shortcut and **Re-verify Link** button after you update sharing permissions.
2. **Select a Tab**: Choose the worksheet tab from **2. Select a Tab**. Click **Refresh** anytime to pull recent spreadsheet edits.
3. **Select Range**: Click **Select** under **3. Select Range**, choose the cell rectangle in the preview grid alongside the drawer (for example, `A1:D10`), and click **Done**.
4. Click **Next: Chart Setup →**.

---

## Step 3: Pick Chart Type, Shape Data & Style (`Chart Setup`)

On Tab **2 (`Chart Setup`)**, the live chart preview updates immediately as you adjust settings:

1. **Choose Chart Type**: Use the segmented **Chart Type** switcher to pick **Bar**, **Line**, **Donut**, **Scatter**, or **Histogram**.
2. **Shape the Data**:
   - **Table Orientation**: Expand **Shape the Data** and toggle **Transpose data** if your headers are in the first column instead of the first row.
   - **Columns, Series & Sorting**: Pick the category/label column, toggle which data series to display, and choose sorting order (as-is, alphabetical, or by value). For **Scatter**, map X, Y, Label, and optional Group columns; for **Histogram**, pick the numeric column and binning strategy.
3. **Encode the Visual**:
   - Configure chart-specific visual encodings: **Auto | Zero** axis baseline toggle, horizontal/stacked bars, area fill or smooth curves, donut style, and Scatter regression/scale controls.
4. **Polish & Label**:
   - Customize the chart title, subtitle, X/Y axis labels, units, and value label visibility.

---

## Step 4: Save to Draft & Publish

1. Click **Add to Canvas & Save** (when creating a new chart) or **Save in Draft** (when updating an existing chart).
2. Review how the chart looks on the page in Dev Mode.
3. When ready for visitors to see it, follow [How-To: Use History, Undo & Publish Changes](file:///Users/francisdave/Documents/folio/docs/folio-engine/how-to/end-users/05-history-undo-and-publishing.md).
