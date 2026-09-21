# Invoice Header Alignment and Typography Fix

## Changes
- Restructure the document metadata into one responsive three-column row for document number, document date, and due/valid date.
- Keep each label and editable value aligned consistently within its column, without fixed-position offsets.
- Place the document title directly below that row with consistent spacing and right alignment.
- Reduce only the requested weights: document title and Bill To from 700 to 600, Total label from 700 to 600, and closing thank-you text from 600 to 500.
- Preserve all other invoice spacing, fields, calculations, controls, and styling.

## Technical details
- Update the metadata markup in the document paper component so the title is separate from the metadata row.
- Use CSS Grid with equal `minmax(0, 1fr)` tracks, stable gaps, shrink-safe children, and no viewport-specific pixel positioning.
- Keep the two-column Bill To/metadata section intact; the paper itself remains fixed to the selected physical paper dimensions and scales inside narrow browser viewports.

## Verification
- Inspect the rendered invoice at desktop, tablet, and mobile viewport sizes.
- Confirm all three metadata columns share the same top and value baselines, do not overlap, and the title sits immediately beneath them.
- Confirm computed font weights are 600 for Invoice, Bill To, and Total, and 500 for the thank-you text.
- Capture screenshots of the invoice paper for visual confirmation.
