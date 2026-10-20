param([Parameter(Mandatory)][string]$Version)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$project = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$exe = Join-Path $project 'build/windows-amd64/collate.exe'
if (-not (Test-Path $exe -PathType Leaf)) { throw "Application is missing: $exe" }
$release = Join-Path $project 'release'
New-Item -ItemType Directory -Force $release | Out-Null
$work = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString('N'))
$folder = Join-Path $work 'Collate Portable'
New-Item -ItemType Directory -Force $folder | Out-Null
try {
    Copy-Item $exe (Join-Path $folder 'collate.exe')
    New-Item -ItemType File (Join-Path $folder 'collate.portable') | Out-Null
    Copy-Item (Join-Path $project 'LICENSE') $folder
    Copy-Item (Join-Path $project 'docs/windows-portable.md') (Join-Path $folder 'README.md')
    $output = Join-Path $release "collate-$Version-windows-x64-portable.zip"
    Compress-Archive -LiteralPath $folder -DestinationPath $output -Force
    Write-Host ("Portable archive: {0:N2} MiB" -f ((Get-Item $output).Length / 1MB))
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force
}
