param(
  [string]$TaskName = "Goodminton QA Prompts",
  [string]$ProjectRoot = "D:\Goodminton-website-maintenance\goodminton-academy",
  [string]$Out = "content\qa-prompts.json",
  [string]$At = "08:35"
)

$ErrorActionPreference = "Stop"

$npm = (Get-Command npm.cmd).Source
$argument = "/c cd /d `"$ProjectRoot`" && `"$npm`" run qa:hot -- --out `"$Out`""

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "Installed scheduled task '$TaskName' to run daily at $At."
Write-Host "Output path: $ProjectRoot\$Out"
