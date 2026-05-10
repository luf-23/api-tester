; Install into the same folder as the setup .exe ($EXEDIR) on first install only.
; On auto-update the Setup runs from %TEMP%; writing EXEDIR there breaks $INSTDIR and triggers bogus
; "cannot close the app" / copy retries. electron-updater passes /D when installDirectory is set (see updater.ts).

; Layout: $Programs\API-Tester\app = application (installer only touches this tree).
; User data lives beside it in $Programs\API-Tester\data (created at runtime, not removed by upgrade).

; After quitAndInstall, Electron may still leave GPU/utility processes holding the exe — NSIS then shows
; "cannot close the app". End the whole process tree (${PRODUCT_FILENAME}.exe = packaged main binary).
!include "FileFunc.nsh"

!macro customInit
  ExecWait 'taskkill /F /IM "${PRODUCT_FILENAME}.exe" /T' $R0
  Sleep 500

  ; Runs after initMultiUser — $INSTDIR is default $Programs\${APP_FILENAME}, preInit EXEDIR, or /D from upgrade.
  ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    Goto apitester_layout_done
  ${EndIf}
  ${GetParent} $R4 "$INSTDIR"
  StrCmp "$INSTDIR" "$R4\${APP_FILENAME}" apitester_layout_std_default apitester_layout_nested_under_choice
  apitester_layout_std_default:
    StrCpy $INSTDIR "$R4\API-Tester\app"
    Goto apitester_layout_done
  apitester_layout_nested_under_choice:
  ; Install next to setup.exe (EXEDIR) or any custom folder: ...\API-Tester\app
  StrCpy $INSTDIR "$INSTDIR\API-Tester\app"
  apitester_layout_done:

  ; ---------------------------------------------------------------------------
  ; Block Windows default / system install roots on normal setup (not auto-update).
  ; Otherwise electron-builder falls back to %LOCALAPPDATA%\Programs (usually on C:).
  ; Auto-update (--updated) keeps /D so upgrades do not jump to EXEDIR (often %TEMP%).
  ; ---------------------------------------------------------------------------
  ${GetParameters} $R8
  ClearErrors
  ${GetOptions} $R8 "--updated" $R7
  ${IfNot} ${Errors}
    Goto apitester_forbid_done
  ${EndIf}

  ReadEnvStr $R7 LOCALAPPDATA
  StrCpy $R8 "$R7\Programs"
  StrLen $R9 $R8
  StrCmp $R9 0 apitester_chk_pf64
  StrCpy $R6 "$INSTDIR" $R9
  StrCmp $R6 $R8 apitester_reloc_exedir apitester_chk_pf64

  apitester_chk_pf64:
  StrLen $R9 "$PROGRAMFILES64"
  StrCmp $R9 0 apitester_chk_pf32
  StrCpy $R6 "$INSTDIR" $R9
  StrCmp $R6 "$PROGRAMFILES64" apitester_reloc_exedir apitester_chk_pf32

  apitester_chk_pf32:
  StrLen $R9 "$PROGRAMFILES"
  StrCmp $R9 0 apitester_forbid_done
  StrCpy $R6 "$INSTDIR" $R9
  StrCmp $R6 "$PROGRAMFILES" apitester_reloc_exedir apitester_forbid_done

  apitester_reloc_exedir:
  ReadEnvStr $R7 LOCALAPPDATA
  StrCpy $R8 "$R7\Temp"
  StrLen $R9 $R8
  StrCmp $R9 0 apitester_reloc_do
  StrCpy $R6 "$EXEDIR" $R9
  StrCmp $R6 $R8 apitester_abort_temp_exedir apitester_reloc_do

  apitester_abort_temp_exedir:
  MessageBox MB_OK|MB_ICONSTOP "不能从系统临时目录安装。请将 API-Tester-Setup.exe 复制到目标磁盘上的普通文件夹后再运行。"
  Abort

  apitester_reloc_do:
  IfSilent apitester_skip_reloc_msg apitester_show_reloc_msg
  apitester_show_reloc_msg:
  MessageBox MB_OK|MB_ICONINFORMATION "检测到系统默认安装目录（Program Files 或 AppData\Local\Programs）。$\r$\n已改为安装包所在目录：$\r$\n$EXEDIR\API-Tester\"
  apitester_skip_reloc_msg:
  StrCpy $INSTDIR "$EXEDIR\API-Tester\app"
  SetRegView 64
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$EXEDIR"
  SetRegView 32
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$EXEDIR"

  apitester_forbid_done:
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
