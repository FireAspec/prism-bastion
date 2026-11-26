$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Test-Application([string] $Exe, [string] $Name) {
    if (!(Test-Path -LiteralPath $Exe)) { throw "Missing application: $Exe" }
    $report = Join-Path $env:RUNNER_TEMP "prism-smoke-$Name.json"
    Remove-Item -LiteralPath $report -Force -ErrorAction SilentlyContinue
    $env:PRISM_SMOKE_REPORT = $report
    $process = Start-Process -FilePath $Exe -ArgumentList '--desktop-smoke-test' -PassThru
    try {
        $limit = (Get-Date).AddSeconds(120)
        while (!(Test-Path -LiteralPath $report) -and (Get-Date) -lt $limit) {
            Start-Sleep -Milliseconds 250
        }
        if (!(Test-Path -LiteralPath $report)) { throw "$Name did not produce a smoke report" }
        $result = Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
        if (!$result.ok) { throw ($result | ConvertTo-Json) }
        Write-Host "$Name : $($result | ConvertTo-Json -Compress)"
        if (!$process.WaitForExit(30000)) { throw "$Name did not exit" }
        if ($process.ExitCode -ne 0) { throw "$Name exited with code $($process.ExitCode)" }
    } finally {
        if (!$process.HasExited) { & taskkill.exe /F /T /PID $process.Id | Out-Null }
        Remove-Item Env:PRISM_SMOKE_REPORT -ErrorAction SilentlyContinue
    }
}
$release = (Resolve-Path release).Path
$portable = @(Get-ChildItem -LiteralPath $release -Filter '*-portable.exe')
$setup = @(Get-ChildItem -LiteralPath $release -Filter '*-setup.exe')
if ($portable.Count -ne 1 -or $setup.Count -ne 1) { throw 'Expected one portable and one installer EXE' }
Test-Application (Join-Path $release 'win-unpacked/Prism Bastion.exe') 'unpacked'
Test-Application $portable[0].FullName 'portable'
# NSIS expects /D as its last argument; the installation path deliberately includes Cyrillic.
$install = Join-Path $env:RUNNER_TEMP 'Проверка игры'
$installer = Start-Process -FilePath $setup[0].FullName -ArgumentList "/S /D=$install" -PassThru
if (!$installer.WaitForExit(120000)) {
    & taskkill.exe /F /T /PID $installer.Id | Out-Null
    throw 'Installer did not exit'
}
if ($installer.ExitCode -ne 0) { throw "Installer returned $($installer.ExitCode)" }
Test-Application (Join-Path $install 'Prism Bastion.exe') 'installed'
