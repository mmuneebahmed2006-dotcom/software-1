# Document Management Upgrade

## Overview
Expand the current document editor into a complete local document workspace while preserving the existing four document types, paper sizing, branding, and editable canvas.

## What will change

### Saved Documents sidebar
- Add a collapsible left sidebar titled **Saved Documents** with a prominent **New Document** action.
- Persist documents in the browser, including title, document type, paper size, content, and last-updated time.
- Add instant search by saved title or document number.
- Support selecting a saved item to restore it, inline title renaming, and deletion with a confirmation step.
- Clearly mark the active document and show a useful empty state when no documents match.

### Top action bar
- Reorganize the top bar to retain document type, currency, and paper-size controls while adding:
  - **Save Document** to create or update the active saved document.
  - **Download PDF** for a direct, high-resolution client-side PDF export of the paper only.
  - **Print (Color)** for standard print output.
  - **Print (B&W)** with a temporary grayscale print mode.
- Keep controls compact and usable on narrower screens, with icon labels and tooltips where appropriate.

### Document layout and calculations
- Preserve the centered uploaded logo, dark `#171717` top accent, document tabs, currency options, and exact paper dimensions.
- Increase separation below the logo and shift the metadata block farther right with wider label/value spacing.
- Keep table headers `#FAFAFA`, header text/accent elements `#171717`, and borders `#E0E0E0`.
- Make the tax percentage editable for Invoice, Quotation, and Sales Tax Invoice; recalculate tax and total immediately. Delivery Challan remains price-free.
- Replace the three bank fields with one editable **Payment Info** text block.
- Add an **Authorized Signature** line beneath Payment Info while retaining editable italic Terms & Conditions and the three-column dark footer.

### Print and export behavior
- Continue injecting the selected paper size into `@page` and resizing the onscreen paper.
- Hide the sidebar, toolbar, search, buttons, row controls, and other editor-only UI from print and PDF output.
- Apply grayscale only for the B&W print action, then automatically return the editor to color mode after printing.
- Export the exact paper bounds at a high rendering scale so the downloaded PDF matches the selected A4, A5, Letter, or Legal dimensions.

## Technical details
- Extend the document model with saved-document metadata and a single payment-info field, including safe migration from the current bank-field shape.
- Add an SSR-safe browser storage hook so saved data loads after hydration and avoids random-ID hydration mismatches.
- Extract the sidebar and top controls into focused components; keep the document paper responsible only for editable paper content.
- Use a browser-compatible PDF library and DOM renderer; no server or account setup is needed.
- Verify save/load/rename/delete/search/new flows, all four document types, tax math, each paper size, PDF dimensions, color and grayscale printing, desktop layout, and mobile sidebar behavior.
