# Complete Document Studio persistence and management upgrade

## Goal
Make the Windows app’s document lifecycle fully functional on disk, with reliable first-run setup, save/update/save-as behavior, folders, date history, PDF export, backup/restore, company defaults, multi-page editing, and the supplied branding.

## User-visible result
- The uploaded 8 Ways logo appears cleanly in every document header at 60–80px high.
- The uploaded yellow check icon becomes the browser favicon and the Windows shortcut/taskbar/EXE icon.
- First launch asks once for Fresh Install or Restore Backup. Fresh Install asks for a writable storage folder, remembers it, and never asks again.
- Normal launches never request administrator access.
- Save writes both editable document data and a real PDF under the selected root, organized as `Invoice`, `Quotation`, `Delivery Challan`, or `Sales Tax Invoice`, plus an optional custom subfolder.
- Existing documents update the same files. Save As uses an in-app name/folder dialog and creates an independent copy.
- New Folder uses an in-app dialog and creates the folder inside the currently selected document type.
- The sidebar can filter history by 3, 4, or 6 months or a custom date range, showing number, client, date, total, and folder.
- Export PDFs filters by folders and date range, then creates a ZIP of matching PDFs for download/save.
- Download PDF immediately exports the current document using its type and number.
- Backup & Restore exports/imports one ZIP containing the folder tree, editable records, PDFs, and saved company defaults.
- Company Details can be edited or cleared in Settings and applied to: current document, future documents, previous documents, or all past and future documents.
- Long descriptions wrap, large totals fit, and all rows remain editable across every generated page.

## Implementation

### 1. Branding and Windows packaging
- Upload the new logo through the project asset flow and replace the current header image reference.
- Generate a padded 64px favicon from the uploaded icon and generate a multi-size Windows `.ico` for packaging.
- Point the browser head, Electron window, and Windows build configuration to the new icon.
- Change the app executable execution level to `asInvoker`; keep elevation limited to the per-machine NSIS installer.

### 2. Persistent desktop workspace
- Extend the secure desktop bridge with typed operations for folders, save/update/save-as, export ZIP, backup ZIP, restore ZIP, and company defaults.
- Store the selected workspace root in the app settings folder and create the four human-readable type folders there.
- Give each saved document stable file metadata so updating preserves its original name and location.
- Use safe path validation for every disk operation and create missing folders automatically.
- Keep browser preview support using local storage and browser downloads, while real disk assertions remain desktop-only.

### 3. First-run setup and restore
- Keep the existing three-second splash.
- Read the persistent initialized flag after the splash; show setup only when it is false.
- Fresh Install opens the one-time folder chooser, initializes the workspace, and persists completion.
- Restore Backup accepts the exported backup ZIP, restores its validated contents into a chosen workspace, and persists completion.
- Add a separate Restore Backup action in Settings for later recovery without resetting first-run state.

### 4. Save, Save As, folders, and sidebar
- Replace browser prompts with compact in-app dialogs.
- New documents open Save As automatically; existing documents use Save to overwrite their same JSON/PDF pair.
- Save As asks for document name and a folder from the current type, with an option to create a folder, then writes a new ID/file pair.
- New Folder creates and immediately exposes the real tab-specific folder.
- Refresh sidebar state after every save, folder creation, restore, or delete.
- Add quick/custom date filters and richer document rows; clicking a result opens it.

### 5. Export, download, backup, and restore
- Build PDFs from every rendered paper page and reuse the same output for Save and Download.
- Download PDF keeps the `Type_Number.pdf` naming rule and starts immediately.
- Export PDFs selects type/custom folders plus a quick/custom date range and packages matching stored PDFs into one ZIP.
- Backup exports all allowed workspace folders, editable records, PDFs, and settings/defaults into one portable ZIP.
- Restore validates archive paths and data before writing, then reloads documents and folders.

### 6. Company Details and scope control
- Add a Settings dialog with editable/clearable address, phone, email, website, and payment/business text.
- Separate company defaults from each document snapshot.
- Detect inline company-detail edits when saving and show the four-scope dialog.
- Apply scope precisely: current only; future defaults only; all existing records only; or both existing and defaults.
- Re-render PDFs for retroactively updated saved documents so stored PDFs match their editable records.

### 7. Multi-page editing and overflow
- Render repeated editable header/company information on continuation pages rather than a read-only continuation label.
- Keep one shared state model, stable row IDs, and editable controls on every page.
- Improve row-height allocation and wrapping for long descriptions; prevent fixed-height clipping.
- Widen and dynamically size amount/total fields for six-digit and larger values while preserving A4 legibility.
- Keep clean print/PDF page breaks and hide only editor controls during output.

## Verification
- Run the code check and focused logic tests for date ranges, file naming, scope application, safe paths, update-in-place, and backup manifests.
- Use browser automation to verify branding, dialogs, date filtering, Save/Save As state, single-PDF download, scope choices, overflow, and editable second-page fields.
- Run Electron against a temporary workspace and verify on disk: all four type saves, custom-folder creation, update-in-place, independent Save As, filtered ZIP export, backup, restore, and persisted first-run completion.
- Build the Windows package configuration and inspect the generated executable metadata/configuration for the `.ico` and `asInvoker` setting. A live Windows UAC/taskbar check cannot be executed in this Linux preview, so packaging assertions will be verified from the built artifacts and configuration.
