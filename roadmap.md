# Roadmap

- [x] Add supplied branding, favicon, fonts, splash, and blank startup state
- [x] Refactor document selector, responsive sizing, typography, and header spacing
- [x] Implement unlimited measured pagination, custom minimum pages, print, and multi-page PDF export
- [x] Add keyboard shortcuts and undo/redo history
- [x] Upgrade saved documents with time grouping, categories, and custom folders
- [x] Add first-run setup/restore and browser fallback storage
- [x] Add secure Electron preload/IPC storage, folder sync, silent PDFs, selective export, and backups
- [x] Harden Electron and configure Windows NSIS installer privileges and install-directory selection
- [x] Optimize rendering and deferred startup work
- [x] Verify browser behavior, printing/PDFs, desktop configuration, and packaging workflow

## Complete persistence and management upgrade
- [x] Apply uploaded logo and icon
- [x] Implement stable disk save, Save As, folders, export, backup, and restore
- [x] Add date-filtered history and management dialogs
- [x] Add company-details settings with four save scopes
- [x] Fix multi-page editing and overflow
- [x] Verify browser behavior, filesystem logic, production build, and packaging configuration

## Invoice header alignment and typography
- [x] Align document number, document date, and due date in one responsive row
- [x] Position the document title directly beneath the metadata row
- [x] Reduce the four requested text weights by one step
- [x] Verify desktop, tablet, and mobile rendering

## Reference invoice corrections
- [x] Stack document metadata as aligned label/value rows
- [x] Remove the Export PDFs toolbar action
- [x] Keep all three footer details on one line without clipping
- [x] Preserve the top accent rule in print output
- [x] Verify desktop, mobile, and print/PDF rendering
