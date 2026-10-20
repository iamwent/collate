param([Parameter(Mandatory)][string]$Version)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$project = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$inner = Join-Path $project "build/windows-amd64/collate Setup $Version amd64.exe"
if (-not (Test-Path $inner -PathType Leaf)) { throw "MyGo installer is missing: $inner" }
$release = Join-Path $project 'release'
New-Item -ItemType Directory -Force $release | Out-Null
$work = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $work | Out-Null
try {
    $runtime = Join-Path $work 'webview2-setup.exe'
    # Microsoft's signed bootstrapper downloads the runtime only when needed.
    $runtimeUri = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703'
    Invoke-WebRequest -Uri $runtimeUri -OutFile $runtime -MaximumRetryCount 3
    $signature = Get-AuthenticodeSignature $runtime
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation(?:,|$)') {
        throw 'The downloaded WebView2 installer does not have a valid Microsoft signature.'
    }
    $tool = Get-Command makensis -ErrorAction SilentlyContinue
    $compiler = if ($tool) { $tool.Source } else { $null }
    if (-not $compiler) {
        foreach ($programFiles in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
            if (-not $programFiles) { continue }
            $candidate = Join-Path $programFiles 'NSIS/makensis.exe'
            if (Test-Path $candidate -PathType Leaf) { $compiler = $candidate; break }
        }
    }
    if (-not $compiler) {
        # Reuse NSIS already downloaded by the pinned MyGo build.
        $cache = Join-Path $env:LOCALAPPDATA 'mygo'
        $compiler = Get-ChildItem $cache -Recurse -Filter makensis.exe -File |
            Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $compiler) { throw 'NSIS compiler was not installed by MyGo.' }
    $output = Join-Path $release "collate-$Version-windows-x64-setup.exe"
    & $compiler '-V3' "-DAPP_VERSION=$Version" "-DAPP_INSTALLER=$inner" "-DWEBVIEW2_INSTALLER=$runtime" "-DOUTPUT_FILE=$output" (Join-Path $PSScriptRoot 'windows-installer.nsi')
    if ($LASTEXITCODE -ne 0) { throw "NSIS compilation failed: $LASTEXITCODE" }
    if (-not (Test-Path $output -PathType Leaf)) { throw 'Final Windows installer was not produced.' }
    $size = (Get-Item $output).Length
    Write-Host ("Windows installer: {0:N2} MiB" -f ($size / 1MB))
    if ($size -gt 30MB) {
        throw 'The default installer exceeds 30 MiB; check for accidentally bundled offline dependencies.'
    }
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force
}
