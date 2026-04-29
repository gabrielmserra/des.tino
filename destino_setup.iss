; Inno Setup 6 — Instalador do des.tino
; Download Inno Setup (gratuito): https://jrsoftware.org/isinfo.php
;
; Como usar:
;   1. Compile o app primeiro:  python -m PyInstaller FinancasApp.spec
;   2. Abra este arquivo no Inno Setup Compiler e clique em "Build > Compile"
;   3. O instalador será gerado em installer\destino_setup.exe

#define AppName    "des.tino"
#define AppVersion "2.2"
#define AppExe     "destino.exe"
#define AppPublisher "Gabriel Serra"
#define AppURL     "https://github.com/gabrisera/des.tino"

[Setup]
AppId={{A3F82C1B-7E4D-4F9A-BC31-2D5E6A8F0C47}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
; O instalador gerado vai para a pasta installer\
OutputDir=installer
OutputBaseFilename=destino_setup_v{#AppVersion}
SetupIconFile=assets\app.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; Requer Windows 10+
MinVersion=10.0
; Não precisa de admin se instalar em %LocalAppData%
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar ícone na Área de Trabalho"; GroupDescription: "Atalhos:"

[Files]
; O executável compilado
Source: "dist\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}";        Filename: "{app}\{#AppExe}"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "Abrir {#AppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Remove a pasta de dados do app criada pelo próprio app (se existir)
Type: dirifempty; Name: "{app}"
