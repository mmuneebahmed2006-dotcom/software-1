; Document Studio installer customisation.
; Keeps application workspace data outside the user Documents folder so the
; installed app never interferes with normal file saves in Documents.

Var DataRootDir

!macro preInit
  StrCpy $DataRootDir "$APPDATA\Document Generator\workspace"
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_HEADER_TEXT "Document Studio Application Data"
  !define MUI_PAGE_HEADER_SUBTEXT "Application data is stored separately from your personal Documents folder."
  !define MUI_DIRECTORYPAGE_TEXT_TOP "Document Studio will keep its internal documents, backups and settings in its own application-data folder."
  !define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Document Studio application data folder"
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
