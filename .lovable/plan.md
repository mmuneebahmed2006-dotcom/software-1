# Fix Windows installer compilation

## Changes
- Remove the unsupported `MUI_HEADER_TEXT` call from the unused NSIS page callback causing `makensis` to fail.
- Keep the custom documents-folder directory page, folder creation, and path persistence unchanged.
- Validate the installer script references, icon path, and NSIS configuration after the edit.

## Verification
- Confirm the failing macro is absent and all referenced installer resources exist.
- Run a focused NSIS/electron-builder configuration check without changing application features.
