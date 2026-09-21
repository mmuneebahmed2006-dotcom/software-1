; Document Studio installer customisation.
; Asks for a documents save location on every install and creates the
; four document-type folders inside it, then records the path for the app.

Var DataRootDir

!macro preInit
  StrCpy $DataRootDir "$PROFILE\Document Studio"
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_HEADER_TEXT "Choose Documents Folder"
  !define MUI_PAGE_HEADER_SUBTEXT "Select where Document Studio should save your documents."
  !define MUI_DIRECTORYPAGE_TEXT_TOP "Invoices, quotations, delivery challans and sales tax invoices are stored in separate folders inside the location you choose below."
  !define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Documents folder"
  !define MUI_DIRECTORYPAGE_VARIABLE $DataRootDir
  !insertmacro MUI_PAGE_DIRECTORY
!macroend

!macro customInstall
  CreateDirectory "$DataRootDir"
  CreateDirectory "$DataRootDir\Invoice"
  CreateDirectory "$DataRootDir\Quotation"
  CreateDirectory "$DataRootDir\Delivery Challan"
  CreateDirectory "$DataRootDir\Sales Tax Invoice"
  CreateDirectory "$DataRootDir\AutoBackups"

  CreateDirectory "$APPDATA\Document Generator"
  FileOpen $0 "$APPDATA\Document Generator\data-root.txt" w
  FileWrite $0 "$DataRootDir"
  FileClose $0

  FileOpen $0 "$INSTDIR\data-root.txt" w
  FileWrite $0 "$DataRootDir"
  FileClose $0
!macroend
