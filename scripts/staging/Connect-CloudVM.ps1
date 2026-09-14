# No Linux console typing. / Без писане в Linux конзолата.
[CmdletBinding()]
param([switch]$Status)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$local = Join-Path $root '.local-staging\cloud'
$connection = Get-Content (Join-Path $local 'connection.json') -Raw | ConvertFrom-Json
$arguments = @('-i',(Join-Path $local 'keys\client'),'-o','HostKeyAlias=gridex-auto','-o',('UserKnownHostsFile='+(Join-Path $local 'known_hosts')),'-o','StrictHostKeyChecking=yes',('gridex@'+$connection.Address))
if ($Status) { $arguments += 'sudo cat /var/lib/gridex-bootstrap/status; sudo journalctl -u gridex-bootstrap -n 20 --no-pager' }
& ssh.exe @arguments
exit $LASTEXITCODE
