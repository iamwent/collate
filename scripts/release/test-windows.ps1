param([Parameter(Mandatory)][string]$Version)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$project = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$setup = Join-Path $project "release/collate-$Version-windows-x64-setup.exe"
# Exercise /D with spaces, through both installer layers.
$destination = Join-Path $env:RUNNER_TEMP 'Collate install smoke test'
$application = $null
try {
    $install = Start-Process -FilePath $setup -ArgumentList "/S /D=$destination" -PassThru
    if (-not $install.WaitForExit(300000)) { $install.Kill(); throw 'Installer timed out.' }
    if ($install.ExitCode -ne 0) { throw "Installer failed: $($install.ExitCode)" }
    $executable = Join-Path $destination 'collate.exe'
    if (-not (Test-Path $executable)) { throw 'Installed executable is missing.' }
    if (-not (Test-Path (Join-Path $destination 'Uninstall.exe'))) { throw 'Uninstaller is missing.' }
    $application = Start-Process -FilePath $executable -PassThru
    # A missing runtime or an immediate native startup failure must fail the release.
    if ($application.WaitForExit(10000)) { throw "Application exited during startup: $($application.ExitCode)" }
    Write-Host 'Installer and application startup smoke test passed.'
} finally {
    if ($application -and -not $application.HasExited) {
        Stop-Process -Id $application.Id -Force
        $application.WaitForExit()
    }
    $uninstaller = Join-Path $destination 'Uninstall.exe'
    if (Test-Path $uninstaller) {
        $uninstall = Start-Process -FilePath $uninstaller -ArgumentList "/S _?=$destination" -PassThru
        if (-not $uninstall.WaitForExit(60000)) { $uninstall.Kill(); throw 'Uninstaller timed out.' }
        if ($uninstall.ExitCode -ne 0) { throw "Uninstaller failed: $($uninstall.ExitCode)" }
    }
    if (Test-Path $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
}
