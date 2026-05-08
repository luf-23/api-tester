; Install into the same folder as the setup .exe ($EXEDIR).
; Runs before initMultiUser, which reads HKCU InstallLocation into $INSTDIR (electron-builder multiUser.nsh).
!macro preInit
  StrCpy $R9 "$EXEDIR"
  SetRegView 64
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation $R9
  SetRegView 32
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation $R9
!macroend
