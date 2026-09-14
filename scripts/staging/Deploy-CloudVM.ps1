# One administrator action, then unattended. / Едно администраторско действие, после автоматично.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$local = Join-Path $root '.local-staging\cloud'
$name = 'gridex-auto'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this launcher as administrator / Стартирайте launcher-а като администратор.'
}
$null = Get-VM -ErrorAction Stop
if (Get-VM -Name $name -ErrorAction SilentlyContinue) { throw 'VM exists; inspect it, do not overwrite / VM съществува; без презаписване.' }
$checks = Get-Content (Join-Path $local 'artifact-checks.json') -Raw | ConvertFrom-Json
$base = Join-Path $local 'ubuntu-base.vhd'
$seed = Join-Path $local 'seed.iso'
if ((Get-FileHash $base -Algorithm SHA256).Hash.ToLowerInvariant() -ne $checks.vhdSHA256) { throw 'Base disk hash mismatch' }
if ((Get-FileHash $seed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $checks.seedSHA256) { throw 'Seed hash mismatch' }
$switch = Get-VMSwitch -Name 'Default Switch' -ErrorAction Stop
if ($switch.SwitchType -ne 'Internal') { throw 'Expected internal Default Switch' }
$hostIP = @(Get-NetIPAddress -InterfaceAlias 'vEthernet (Default Switch)' -AddressFamily IPv4 -PolicyStore ActiveStore | Where-Object AddressState -eq Preferred)
if ($hostIP.Count -ne 1) { throw 'Default Switch address is ambiguous; stop / Нееднозначен адрес; стоп.' }
$hostPrefix = $hostIP[0].IPAddress + '/32'
$vmDirectory = Join-Path $local 'vm'
if (Test-Path $vmDirectory) { throw 'VM directory exists; inspect partial deployment' }
if ((Get-Volume -DriveLetter C).SizeRemaining -lt 90GB) { throw 'Need 90 GiB free / Нужни са 90 GiB свободни.' }
$old = Get-VM -Name 'gridex-cpu-staging' -ErrorAction SilentlyContinue
if ($old -and $old.State -eq 'Running') {
    # Preserve the old session and release RAM. / Запазва старата сесия и освобождава RAM.
    Save-VM -VM $old
}
if ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory -lt (10GB / 1KB)) { throw 'Need 10 GiB free RAM / Нужни са 10 GiB свободна RAM.' }
New-Item -ItemType Directory -Path $vmDirectory | Out-Null
$disk = Join-Path $vmDirectory 'ubuntu.vhdx'
Convert-VHD -Path $base -DestinationPath $disk -VHDType Dynamic
Resize-VHD -Path $disk -SizeBytes 80GB
if (-not (Test-VHD -Path $disk)) { throw 'Hyper-V VHD validation failed' }
New-VM -Name $name -Generation 2 -MemoryStartupBytes 8GB -VHDPath $disk -Path $vmDirectory | Out-Null
Get-VMNetworkAdapter -VMName $name | Remove-VMNetworkAdapter
Set-VMProcessor -VMName $name -Count 4
Set-VMMemory -VMName $name -DynamicMemoryEnabled $false
Set-VM -Name $name -AutomaticCheckpointsEnabled $false -AutomaticStartAction Nothing -AutomaticStopAction ShutDown
Set-VMFirmware -VMName $name -EnableSecureBoot On -SecureBootTemplate MicrosoftUEFICertificateAuthority
Add-VMDvdDrive -VMName $name -Path $seed
# Add disconnected adapter; install ALL ACLs before connecting or booting.
# Несвързана карта; ВСИЧКИ ACL преди свързване или старт.
Add-VMNetworkAdapter -VMName $name -Name 'Provisioning'
$nic = Get-VMNetworkAdapter -VMName $name -Name 'Provisioning'
function Add-Rule($Action, $Direction, $Weight, $RemoteIP, $Protocol, $LocalPort, $RemotePort, $Stateful = $false) {
    $arguments = @{VMNetworkAdapter=$nic; Action=$Action; Direction=$Direction; Weight=$Weight}
    if ($RemoteIP) { $arguments.RemoteIPAddress=$RemoteIP }
    if ($Protocol) { $arguments.Protocol=$Protocol }
    if ($LocalPort) { $arguments.LocalPort=$LocalPort }
    if ($RemotePort) { $arguments.RemotePort=$RemotePort }
    if ($Stateful) { $arguments.Stateful=$true }
    Add-VMNetworkAdapterExtendedAcl @arguments
}
foreach ($direction in @('Inbound','Outbound')) {
    Add-Rule Deny $direction 1 $null $null $null $null
    Add-Rule Deny $direction 600 '::/0' $null $null $null
}
foreach ($prefix in @('0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.168.0.0/16','224.0.0.0/4','240.0.0.0/4')) {
    Add-Rule Deny Outbound 300 $prefix $null $null $null
}
# DHCP, DNS through host, and host-initiated SSH only. / DHCP, DNS през host и SSH само от host.
Add-Rule Allow Outbound 700 '255.255.255.255/32' UDP 68 67
Add-Rule Allow Outbound 700 $hostPrefix UDP 68 67
Add-Rule Allow Inbound 700 $hostPrefix UDP 68 67
Add-Rule Allow Outbound 700 $hostPrefix UDP $null 53
Add-Rule Allow Inbound 700 $hostPrefix UDP $null 53
Add-Rule Allow Outbound 700 $hostPrefix TCP $null 53 $true
Add-Rule Allow Inbound 700 $hostPrefix TCP 22 $null $true
foreach ($port in @('80','443')) { Add-Rule Allow Outbound 100 '0.0.0.0/0' TCP $null $port $true }
$rules = @(Get-VMNetworkAdapterExtendedAcl -VMNetworkAdapter $nic)
if ($rules.Count -ne 23) { throw 'ACL count mismatch; VM remains off and disconnected' }
Set-VMNetworkAdapter -VMNetworkAdapter $nic -DhcpGuard On -RouterGuard On -MacAddressSpoofing Off
Connect-VMNetworkAdapter -VMNetworkAdapter $nic -SwitchName $switch.Name
Start-VM -Name $name
Write-Output 'VM started; waiting for DHCP/SSH / VM стартира; изчакване на DHCP/SSH.'
$guestIP = $null
$deadline = (Get-Date).AddMinutes(8)
do {
    $guestIP = (Get-VMNetworkAdapter -VMName $name).IPAddresses | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' -and $_ -notmatch '^169\.254\.' } | Select-Object -First 1
    if ($guestIP) { break }
    Start-Sleep -Seconds 5
} while ((Get-Date) -lt $deadline)
if (-not $guestIP) { throw 'No DHCP address reported; inspect VM console. No compatibility claim.' }
# Addresses and credentials stay local. / Адресите и credentials остават локални.
@{ VM=$name; Address=$guestIP; User='gridex'; Runtime='SSH_NOT_VERIFIED' } | ConvertTo-Json | Set-Content (Join-Path $local 'connection.json') -Encoding UTF8
$key = Join-Path $local 'keys\client'
$known = Join-Path $local 'known_hosts'
& ssh.exe -i $key -o BatchMode=yes -o ConnectTimeout=10 -o HostKeyAlias=gridex-auto -o "UserKnownHostsFile=$known" -o StrictHostKeyChecking=yes "gridex@$guestIP" 'uname -m; systemd-detect-virt; sudo cat /var/lib/gridex-bootstrap/status'
if ($LASTEXITCODE -ne 0) { throw 'SSH not yet ready; use Connect-CloudVM.ps1 later / SSH още не е готов.' }
Write-Output 'SSH verified; Docker/image tests run automatically. / SSH проверен; Docker/image тестовете са автоматични.'
