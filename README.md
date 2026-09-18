# SOFTWARE

Please extract and build this multi-document generator web application using the attached workspace ZIP file ("making software.zip"). Upgrade the application to strictly follow the reference layout, custom branding, exact color scheme, and interactive paper settings.

Implement all the following detailed requirements cleanly:

1. Dynamic Paper Size Controls:
   - Add a Paper Size Dropdown menu in the top UI control toolbar with options: "A4", "A5", "Letter", and "Legal".
   - Dynamically change the canvas preview width/height on screen according to the selected size.
   - Inject dynamic `@media print` CSS `@page { size: <selected_size>; margin: 0; }` so that browser printing and PDF generation strictly match the chosen paper dimensions.

2. Exact Header & Custom Logo Placement:
   - Replace the default "YOURLOGO" text placeholder with the user's uploaded logo image (`/logo.png` or uploaded logo asset inside the zip).
   - Display the logo centered prominently in the top header, sharp, high-res, and perfectly sized to match the template balance.
   - Top Accent Bar: Include a solid `#171717` color bar across the top edge.

3. Complete Visual Layout & Exact Color Code (#171717):
   - Primary Accent Color: Replace all red elements from the reference design with exact color code `#171717`.
   - Bill To Section (Top-Left): Bold "BILL TO" title, editable client info, with distinct icons for Phone, Email, Address, and Website.
   - Document Meta Section (Top-Right): Cleanly formatted "Invoice #", "Invoice Date", and "Due Date", with a prominent uppercase "INVOICE" title (or Quotation/Delivery Challan/Sales Tax Invoice title based on active tab) directly underneath.
   - Table Styling: Light header background (`#FAFAFA`), bold uppercase headers styled in `#171717` text color, and clean gray grid borders (`#E0E0E0`).
   - Summary & Totals (Right-Aligned): Subtotal and Taxes layout with a high-contrast solid `#171717` "TOTAL" banner box featuring crisp white text.
   - Terms & Bank Details: Italicized "Terms & Conditions" section, followed by a full-width light gray (`#E2E4E7`) strip for Bank Transfer & PayPal details.
   - Signature Section: Centered large italicized phrase "Thanks for your Business!" flanked by upper and lower subtle dividing lines.
   - Bottom Footer Bar: Solid `#171717` full-width footer containing 3 columns for Address, Phone, and Email separated by clean vertical dividers.

4. Multi-Document Support:
   - Retain full functional switching for 4 document types: Invoice, Quotation, Delivery Challan (hiding pricing/tax columns), and Sales Tax Invoice (including NTN/STRN and Tax Rate calculations).
   - Currency Toggle: Allow switching between Rs., $, €, £, and AED.

5. Print Optimization:
   - Use `@media print` rules to completely hide all toolbars, buttons, dropdowns, page-size selectors, and background wrappers during PDF export/printing.

Build and compile the updated application with these exact specifications.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3aeb4c72-e764-4dae-8972-b59f7a2b10e6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
