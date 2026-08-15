param(
  [string]$TaskName = "Goodminton Hot Articles",
  [string]$ProjectRoot = "D:\Goodminton-website-maintenance\goodminton-academy",
  [string]$OutDir = "content\articles\_candidates",
  [string]$At = "08:20"
)

$ErrorActionPreference = "Stop"

$npm = (Get-Command npm.cmd).Source
$argument = "/c cd /d `"$ProjectRoot`" && `"$npm`" run articles:hot -- --out `"$OutDir`""

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "Installed scheduled task '$TaskName' to run daily at $At."
Write-Host "Output path: $ProjectRoot\$OutDir"
