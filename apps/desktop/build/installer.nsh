; Layout: <setup-dir>\API-Tester\app = program, <setup-dir>\API-Tester\data = user data (Electron userData, see main/index.ts).
; Normal install: always under $EXEDIR\API-Tester\app — not LocalAppData\Programs or Program Files.
; Auto-update: setup runs from %TEMP% with /D=... — preInit must NOT overwrite InstallLocation (--updated).

!include "FileFunc.nsh"

; electron-builder CHECK_APP_RUNNING uses PowerShell Win32_Process Path.StartsWith($INSTDIR) — easy false positives.
; Uninstall-old-version retry loop uses the same "$(appCannotBeClosed)" string — killing here helps both.
!macro apitester_kill_tree
  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}" /T`
  Pop $R0
  Sleep 600
  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}" /T`
  Pop $R0
  Sleep 400
!macroend

!macro customCheckAppRunning
  !insertmacro apitester_kill_tree
!macroend

!macro customInit
  !insertmacro apitester_kill_tree

  ; initMultiUser has already set $INSTDIR from registry + optional /D (auto-update uses /D to real app folder).
  ${GetParameters} $R8
  ClearErrors
  ${GetOptions} $R8 "--updated" $R7
  ${IfNot} ${Errors}
    Goto apitester_done
  ${EndIf}

  ; Fresh install / manual run: force layout next to setup.exe (never stay on C: default roots).
  ReadEnvStr $R7 LOCALAPPDATA
  StrCpy $R8 "$R7\Programs"
  StrLen $R9 $R8
  StrCmp $R9 0 apitester_pf64
  StrCpy $R6 "$INSTDIR" $R9
  StrCmp $R6 $R8 apitester_use_exedir apitester_pf64

  apitester_pf64:
  StrLen $R9 "$PROGRAMFILES64"
  StrCmp $R9 0 apitester_pf32
  StrCpy $R6 "$INSTDIR" $R9
  StrCmp $R6 "$PROGRAMFILES64" apitester_use_exedir apitester_pf32

  apitester_pf32:
  StrLen $R9 "$PROGRAMFILES"
  StrCmp $R9 0 apitester_fix_legacy
  StrCpy $R6 "$INSTDIR" $R9
  StrCmp $R6 "$PROGRAMFILES" apitester_use_exedir apitester_fix_legacy

  apitester_fix_legacy:
  ; Old bug: InstallLocation was only $EXEDIR — repair to ...\API-Tester\app
  StrCmp "$INSTDIR" "$EXEDIR" apitester_use_exedir
  ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    Goto apitester_done
  ${EndIf}
  StrCmp "$INSTDIR" "$EXEDIR\API-Tester\app" apitester_done apitester_use_exedir

  apitester_use_exedir:
  ReadEnvStr $R7 LOCALAPPDATA
  StrCpy $R8 "$R7\Temp"
  StrLen $R9 $R8
  StrCmp $R9 0 apitester_reloc_ok
  StrCpy $R6 "$EXEDIR" $R9
  StrCmp $R6 $R8 apitester_abort_temp apitester_reloc_ok

  apitester_abort_temp:
  MessageBox MB_OK|MB_ICONSTOP "不能从系统临时目录安装。请将 API-Tester-Setup.exe 复制到普通文件夹后再运行。"
  Abort

  apitester_reloc_ok:
  IfSilent apitester_skip_msg apitester_show_msg
  apitester_show_msg:
  MessageBox MB_OK|MB_ICONINFORMATION "安装目录已设为安装包所在位置：$\r$\n$EXEDIR\API-Tester\"
  apitester_skip_msg:
  StrCpy $INSTDIR "$EXEDIR\API-Tester\app"
  SetRegView 64
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
  SetRegView 32
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"

  apitester_done:
!macroend

!macro preInit
  ${GetParameters} $R8
  ClearErrors
  ${GetOptions} $R8 "--updated" $R7
  ${IfNot} ${Errors}
    Goto preInit_done
  ${EndIf}
  ; Full app path so initMultiUser does not set $INSTDIR to $EXEDIR alone (that broke detection / layout).
  StrCpy $R9 "$EXEDIR\API-Tester\app"
  SetRegView 64
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation $R9
  SetRegView 32
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation $R9
  preInit_done:
!macroend

; Shortcut targets ${APP_EXECUTABLE_FILENAME} (win.executableName in package.json — no spaces; avoids broken .lnk / “正在查找 …exe”).
!macro customInstall
  CreateShortcut "$INSTDIR\${SHORTCUT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "${APP_DESCRIPTION}"
!macroend

!macro customUnInstall
  Delete "$INSTDIR\${SHORTCUT_NAME}.lnk"
!macroend
