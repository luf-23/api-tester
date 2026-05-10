; Install into the same folder as the setup .exe ($EXEDIR) on first install only.
; On auto-update the Setup runs from %TEMP%; writing EXEDIR there breaks $INSTDIR and triggers bogus
; "cannot close the app" / copy retries. electron-updater passes /D when installDirectory is set (see updater.ts).

; After quitAndInstall, Electron may still leave GPU/utility processes holding the exe — NSIS then shows
; "cannot close the app". End the whole process tree (${PRODUCT_FILENAME}.exe = packaged main binary).
!macro customInit
  ExecWait 'taskkill /F /IM "${PRODUCT_FILENAME}.exe" /T' $R0
  Sleep 500
!macroend

!macro preInit
  ${GetParameters} $R8
  ClearErrors
  ${GetOptions} $R8 "--updated" $R7
  ${IfNot} ${Errors}
    Goto preInit_done
  ${EndIf}
  StrCpy $R9 "$EXEDIR"
  SetRegView 64
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation $R9
  SetRegView 32
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation $R9
  preInit_done:
!macroend
