# Read-only, sanitized output. / Само четене, без адреси и имена на съществуващи VM.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$os = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$volume = Get-Volume -DriveLetter C
$access = $false
$vmCount = $null
$switchTypes = @()
try {
    $vmCount = @(Get-VM -ErrorAction Stop).Count
    $switchTypes = @(Get-VMSwitch -ErrorAction Stop | Select-Object -ExpandProperty SwitchType)
    $access = $true
} catch { }
[pscustomobject]@{
    Elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    OS = $os.Caption
    Build = $os.BuildNumber
    HypervisorPresent = $computer.HypervisorPresent
    FreeMemoryGiB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    FreeDiskCGiB = [math]::Round($volume.SizeRemaining / 1GB, 2)
    HyperVManagementAccess = $access
    ExistingVMCount = $vmCount
    ExistingSwitchTypes = $switchTypes
    LinuxStartup = 'NOT_RUN'
} | ConvertTo-Json
if (-not $access) { throw 'Hyper-V management permission required / Нужни са права за управление на Hyper-V.' }
