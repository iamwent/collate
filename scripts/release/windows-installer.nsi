; Bootstrap the MyGo installer with the full offline WebView2 installer.
; The inner installer owns app files, shortcuts and uninstall registration.
Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
Name "Collate ${APP_VERSION}"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\collate"
RequestExecutionLevel user
BrandingText "Collate"

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WordFunc.nsh"
!include "x64.nsh"

!define MUI_FINISHPAGE_RUN "$INSTDIR\collate.exe"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"

; Return 1 if a sufficiently recent Evergreen runtime is installed.
; Registry views/keys follow Microsoft's WebView2 distribution guide.
Function HasWebView2
  StrCpy $2 0
  SetRegView 32
  ReadRegStr $0 HKLM "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $0 != ""
    ${VersionCompare} "$0" "140.0.0.0" $1
    ${If} $1 != "2"
      StrCpy $2 1
    ${EndIf}
  ${EndIf}
  ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $0 != ""
    ${VersionCompare} "$0" "140.0.0.0" $1
    ${If} $1 != "2"
      StrCpy $2 1
    ${EndIf}
  ${EndIf}
  Push $2
FunctionEnd

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "This installer requires 64-bit Windows." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
FunctionEnd

Section "Collate"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  Call HasWebView2
  Pop $0
  ${If} $0 != 1
    DetailPrint "Installing Microsoft Edge WebView2 Runtime..."
    File /oname=webview2-setup.exe "${WEBVIEW2_INSTALLER}"
    ClearErrors
    ExecWait '"$PLUGINSDIR\webview2-setup.exe" /silent /install' $0
    ${If} ${Errors}
      MessageBox MB_ICONSTOP "Unable to start the WebView2 Runtime installer." /SD IDOK
      SetErrorLevel 1
      Abort
    ${EndIf}
    Call HasWebView2
    Pop $1
    ${If} $1 != 1
      MessageBox MB_ICONSTOP "WebView2 Runtime installation failed (exit code $0). Collate was not installed." /SD IDOK
      SetErrorLevel 1
      Abort
    ${EndIf}
  ${EndIf}
  DetailPrint "Installing Collate..."
  File /oname=collate-app-setup.exe "${APP_INSTALLER}"
  ClearErrors
  ; /D must be last and unquoted, including when the directory has spaces.
  ExecWait '"$PLUGINSDIR\collate-app-setup.exe" /S /D=$INSTDIR' $0
  ${If} ${Errors}
    MessageBox MB_ICONSTOP "Unable to start the Collate installer." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "Collate installation failed (exit code $0)." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}
  IfFileExists "$INSTDIR\collate.exe" installed
    MessageBox MB_ICONSTOP "Collate application files were not installed." /SD IDOK
    SetErrorLevel 1
    Abort
  installed:
  SetErrorLevel 0
SectionEnd
