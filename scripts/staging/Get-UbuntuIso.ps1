# Download and checksum only; no installation. / Само изтегляне и checksum, без инсталация.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$directory = Join-Path $root '.local-staging\downloads'
$fileName = 'ubuntu-24.04.5-live-server-amd64.iso'
$expected = '97f3d7ffb032c3eb3b23d2c8be9cc76e60c2c1f2c0146ba5ba9fe01cafae0fd8'
$target = Join-Path $directory $fileName
New-Item -ItemType Directory -Path $directory -Force | Out-Null
if (-not (Test-Path -LiteralPath $target)) {
    & curl.exe --fail --location --retry 3 --continue-at - --output "$target.partial" "https://releases.ubuntu.com/24.04/$fileName"
    if ($LASTEXITCODE -ne 0) { throw 'Download failed / Изтеглянето е неуспешно.' }
    if ((Get-FileHash -LiteralPath "$target.partial" -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
        throw 'SHA256 mismatch; do not boot / Различен SHA256; не стартирайте.'
    }
    Move-Item -LiteralPath "$target.partial" -Destination $target
}
if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    throw 'SHA256 mismatch / Различен SHA256.'
}
[pscustomobject]@{ File=$fileName; SHA256=$expected; Checksum='PASS'; Signature='NOT_VERIFIED' } | ConvertTo-Json
