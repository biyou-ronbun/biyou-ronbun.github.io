# ---------------------------------------------------------------
#  X への自動投稿
#
#  Windows のタスクスケジューラから、1時間おきに呼ばれます。
#  x\queue.json を見て、予定時刻を過ぎた投稿だけを出します。
#
#  手で試すとき（投稿せずに中身だけ見る）:
#      node auto\post-x.mjs --dry
#
#  ログ: auto\logs\x-<日付>.log
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir = Join-Path $Root 'auto\logs'
$Log    = Join-Path $LogDir ("x-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }

# タスクスケジューラから呼ばれると PATH が最小構成なので、読み直す
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

Set-Location $Root

$stamp = Get-Date -Format 'HH:mm:ss'
$out = & node (Join-Path $Root 'auto\post-x.mjs') 2>&1 | Out-String

Add-Content -Path $Log -Value "[$stamp] ----------------------------------------" -Encoding UTF8
Add-Content -Path $Log -Value $out.TrimEnd() -Encoding UTF8

Write-Output $out.TrimEnd()
