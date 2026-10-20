param([Parameter(Mandatory)][string]$Version)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$project = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$zip = Join-Path $project "release/collate-$Version-windows-x64-portable.zip"
$work = Join-Path $env:RUNNER_TEMP ('Collate portable test ' + [Guid]::NewGuid().ToString('N'))
$roots = @((Join-Path $env:APPDATA 'collate'), (Join-Path $env:LOCALAPPDATA 'collate'))
$profileOverride = [Environment]::GetEnvironmentVariable('WEBVIEW2_USER_DATA_FOLDER', 'Process')
$application = $null

# Check rendered page content, not merely the asynchronously created host window.
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
function Wait-PortableHome([System.Diagnostics.Process]$Application) {
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    $condition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty, '＋ 选择 PDF 文件')
    do {
        if ($Application.HasExited) { throw 'Portable app exited before its home page loaded.' }
        $Application.Refresh()
        try {
            $window = [System.Windows.Automation.AutomationElement]::FromHandle($Application.MainWindowHandle)
            if ($window -and $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)) { return }
        } catch [System.Windows.Automation.ElementNotAvailableException] {
            # The WebView2 accessibility provider can change during navigation.
        }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'Portable home page did not finish rendering within 45 seconds.'
}

function Snapshot-InstalledData {
    $rows = foreach ($root in $roots) {
        if (Test-Path $root) {
            "directory:$root"
            Get-ChildItem $root -Recurse -Force | ForEach-Object {
                if ($_.PSIsContainer) { "directory:$($_.FullName)" }
                else { '{0}|{1}|{2}' -f $_.FullName, $_.Length, $_.LastWriteTimeUtc.Ticks }
            }
        }
    }
    return (($rows | Sort-Object) -join "`n")
}

function Wait-WebViewExit([string]$Folder) {
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        $running = @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
            Where-Object { $_.CommandLine -and $_.CommandLine.Contains($Folder, [StringComparison]::OrdinalIgnoreCase) })
        if ($running.Count -eq 0) { return }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'Portable WebView2 processes did not exit; files may still be locked.'
}

try {
    $before = Snapshot-InstalledData
    New-Item -ItemType Directory $work | Out-Null
    Expand-Archive -LiteralPath $zip -DestinationPath $work
    $folder = Join-Path $work 'Collate Portable'
    if (-not (Test-Path (Join-Path $folder 'collate.portable') -PathType Leaf)) { throw 'Portable marker missing.' }
    # A pre-existing host setting must not redirect this portable copy outside Data.
    $env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $work 'unexpected external profile'
    foreach ($iteration in 1..2) {
        if ($iteration -eq 2) {
            $moved = Join-Path $work 'Moved portable copy'
            Move-Item -LiteralPath $folder -Destination $moved
            $folder = $moved
        }
        $profile = Join-Path $folder 'Data/LocalAppData/collate/WebView2'
        # WebView2 appends EBWebView to the configured userDataFolder.
        $browserData = Join-Path $profile 'EBWebView'
        $settings = Join-Path $folder 'Data/Settings/window-state.json'
        if ($iteration -eq 2 -and -not (Test-Path $settings)) { throw 'Settings did not survive the folder move.' }
        # Deliberately start from a different working directory.
        $application = Start-Process (Join-Path $folder 'collate.exe') -WorkingDirectory $env:WINDIR -PassThru
        $deadline = [DateTime]::UtcNow.AddSeconds(45)
        $browser = @()
        do {
            if ($application.HasExited) { throw "Portable application exited: $($application.ExitCode)" }
            $application.Refresh()
            $browser = @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
                Where-Object { $_.ParentProcessId -eq $application.Id -and $_.CommandLine -like '*--user-data-dir=*' })
            if ($browser.Count -gt 0 -and $application.MainWindowHandle -ne 0) { break }
            Start-Sleep -Milliseconds 250
        } while ([DateTime]::UtcNow -lt $deadline)
        if ($browser.Count -eq 0 -or $application.MainWindowHandle -eq 0) { throw 'Portable UI/WebView2 failed to start.' }
        foreach ($process in $browser) {
            if (-not $process.CommandLine.Contains($profile, [StringComparison]::OrdinalIgnoreCase)) {
                throw "WebView2 profile escaped portable folder: $($process.CommandLine)"
            }
        }
        Wait-PortableHome $application
        # A sentinel proves the same profile survives moving the entire directory.
        $sentinel = Join-Path $profile 'collate-portable-test.txt'
        if ($iteration -eq 1) { Set-Content $sentinel 'retained' }
        elseif ((Get-Content $sentinel -Raw).Trim() -ne 'retained') { throw 'Portable profile was lost after moving.' }
        if (-not $application.CloseMainWindow()) { throw 'Cannot close portable window gracefully.' }
        if (-not $application.WaitForExit(30000)) { throw 'Portable close timed out.' }
        if ($application.ExitCode -ne 0) { throw "Portable close failed: $($application.ExitCode)" }
        Wait-WebViewExit $profile
        $preferences = Join-Path $browserData 'Default/Preferences'
        if (-not (Test-Path $preferences -PathType Leaf)) {
            Write-Host "Expected persisted WebView2 preferences: $preferences"
            Get-ChildItem $profile -Recurse -Depth 3 -Name | Write-Host
            throw 'WebView2 did not persist its portable profile.'
        }
        if (-not (Test-Path $settings)) { throw 'Window settings were not saved inside Data.' }
        $state = Get-Content $settings -Raw | ConvertFrom-Json
        if (-not $state) { throw 'Window settings are empty.' }
        if ($iteration -eq 1) {
            # Seed a non-default size after the app exits. After moving, the
            # second run must load it and save the actual window size back.
            $state.main = @{ x = 30; y = 30; width = 900; height = 620; maximized = $false; fullScreen = $false }
            $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $settings -Encoding utf8NoBOM
        } elseif ($state.main.width -ne 900 -or $state.main.height -ne 620) {
            throw "Window size was not restored after relocation: $($state.main.width)x$($state.main.height)"
        }
        foreach ($dir in @('Settings', 'Cache', 'Logs', 'Temp', 'AppData', 'LocalAppData')) {
            if (-not (Test-Path (Join-Path $folder "Data/$dir") -PathType Container)) { throw "Missing portable $dir directory." }
        }
    }
    if (Test-Path (Join-Path $work 'unexpected external profile')) { throw 'Inherited WebView2 profile override was used.' }
    if ((Snapshot-InstalledData) -cne $before) { throw 'Portable app changed installed-user settings/cache directories.' }
    Write-Host 'Portable profile, settings, graceful restart/move, and installed-profile isolation checks passed.'
} finally {
    if ($application -and -not $application.HasExited) { Stop-Process -Id $application.Id -Force }
    $env:WEBVIEW2_USER_DATA_FOLDER = $profileOverride
    if (Test-Path $work) { Remove-Item -LiteralPath $work -Recurse -Force }
}
