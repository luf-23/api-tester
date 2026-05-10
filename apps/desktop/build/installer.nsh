; Install into the same folder as the setup .exe ($EXEDIR).
; Runs before initMultiUser, which reads HKCU InstallLocation into $INSTDIR (electron-builder multiUser.nsh).

; After quitAndInstall, Electron may still leave GPU/utility processes holding the exe — NSIS then shows
; "cannot close the app". End the whole process tree before copying files (must match packaged exe name).
!macro customInit
  ExecWait 'taskkill /F /IM "API Tester.exe" /T' $R0
  Sleep 400
!macroend

!macro preInit
  StrCpy $R9 "$EXEDIR"
  SetRegView 64
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation $R9
  SetRegView 32
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation $R9
!macroend
