# Document Workspace and Export Upgrade

## Overview
Upgrade the existing document editor in place with richer saved-document details, native file saving, high-resolution PDF export, compact ten-row layouts, and exact amount alignment.

## What will change

### Saved documents
- Keep the collapsible sidebar and browser-session persistence.
- Show each saved document’s title/number, document date, and calculated total.
- Preserve instant loading, search, inline rename, delete, and active-document highlighting.
- Make **New Document** open a genuinely blank template without altering saved records.

### Save and PDF workflow
- **Save Document** will update browser storage and prompt for a JSON document file through the native save picker when supported.
- **Download PDF** will export only the paper at high resolution, automatically named from document type and number, and prompt for a destination through the native save picker when supported.
- Browsers without the File System Access API will use their standard download behavior.
- Export mode will hide editor controls and row actions before rendering.

### A4 layout and amounts
- Increase the row limit from 6 to 10 and block row 11 with the requested notification.
- Compact header, table, payment, closing, and footer spacing so ten rows fit within A4.
- Prevent wrapping in unit-price, amount, subtotal, tax, and total values.
- Widen the amount columns and summary block while preserving exact right-edge alignment with the table Amount column.
- Set Terms & Conditions and the closing message to semi-bold italic serif styling.

### Printing
- Keep one native **Print** action calling the browser print dialog.
- Use `@page { size: auto; margin: 0; }` so native paper size and orientation controls remain available.
- Continue hiding the sidebar, toolbar, controls, borders, and delete actions in print output.

## Verification
- Test save, fallback download, sidebar reload, New Document, PDF dimensions/content, and automatic filenames.
- Confirm row 10 fits on one A4 page and row 11 is rejected.
- Verify large currency values stay on one line and summary values align with the Amount column.
- Check print and exported PDF output visually on desktop and narrow layouts.
