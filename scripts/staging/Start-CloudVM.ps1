# Single UAC launcher. / Launcher с едно UAC потвърждение.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$local = Join-Path $root '.local-staging\cloud'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $PSCommandPath
    Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList $arguments
    exit
}
try {
    & (Join-Path $PSScriptRoot 'Deploy-CloudVM.ps1')
    @{ Status='SSH_READY'; Next='Inspect automatic bootstrap status'; ServiceAcceptance='NOT_RUN' } | ConvertTo-Json | Set-Content (Join-Path $local 'deployment-result.json') -Encoding UTF8
} catch {
    @{ Status='BLOCKED'; ErrorType=$_.Exception.GetType().Name; ScriptLine=$_.InvocationInfo.ScriptLineNumber; ScriptFile=(Split-Path $_.InvocationInfo.ScriptName -Leaf); ServiceAcceptance='NOT_RUN' } | ConvertTo-Json | Set-Content (Join-Path $local 'deployment-result.json') -Encoding UTF8
    exit 1
}