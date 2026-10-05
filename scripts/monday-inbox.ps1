# Monday 6:30 AM job (Windows Task Scheduler "Sitekit inbox"): pull Muse's new
# prospect batch, import it, and gather scaffold briefs. Writing the demos
# (/scaffold-sites) and reviewing them stay manual, in a Claude Code session.
# Log: sites/.inbox-log/<date>.log (gitignored with the rest of sites/).

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8  # read node's UTF-8 output correctly
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$logDir = Join-Path $repo 'sites\.inbox-log'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ((Get-Date -Format 'yyyy-MM-dd') + '.log')

function Step($label, $nodeArgs) {
  "`n=== $label  $(Get-Date -Format 'HH:mm:ss')" | Out-File $log -Append -Encoding utf8
  & node @nodeArgs 2>&1 | ForEach-Object { "$_" } | Out-File $log -Append -Encoding utf8
  return $LASTEXITCODE
}

$code = Step 'inbox' @('scripts/site.mjs', 'inbox')
if ($code -eq 0) {
  Step 'scaffold' @('scripts/site.mjs', 'scaffold') | Out-Null
} else {
  "`ninbox failed (exit $code); scaffold skipped." | Out-File $log -Append -Encoding utf8
}
"`n=== done  $(Get-Date -Format 'HH:mm:ss'). Next: open Claude Code and run /scaffold-sites." | Out-File $log -Append -Encoding utf8
