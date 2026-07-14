# ---------------------------------------------------------------
#  週次の点検
#
#  Windows のタスクスケジューラから、毎週日曜の朝10時に呼ばれます。
#  手で試したいときは:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\review.ps1
#
#  今週、機械が自動生成した記事を1本ずつ読み、
#  論文の使い方・構成のドリフト・重複を点検します。
#
#  なぜ要るか:
#    公開前の関門（verify.mjs）は機械的な検査だけで、
#    「毎回同じ結論」「論文の読み違い」は検出できません。
#    誰も読まないまま毎日記事が増えると、Google に量産ページと判定されます。
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "review_$Stamp.log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
  Write-Output $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

Set-Location $Root

Log '=========================================='
Log '週次の点検をはじめます'
Log '=========================================='

foreach ($cmd in @('node', 'git', 'claude')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

Log 'リポジトリを最新にします'
$dirty = git status --porcelain
if ($dirty) {
  Log '  未コミットの変更があるので、いったん退避します'
  git stash push -u -m "review $Stamp" 2>&1 | ForEach-Object { Log "  git: $_" }
  $stashed = $true
}
git pull --rebase origin main 2>&1 | ForEach-Object { Log "  git: $_" }
if ($stashed) {
  git stash pop 2>&1 | ForEach-Object { Log "  git: $_" }
}

# ---- .ps1 の文字コードを点検する ------------------------------------
#
#   ★ Claude が書いた .ps1 には、BOM が付かない。
#     Windows PowerShell 5.1 は、BOM の無い UTF-8 を **Shift-JIS として読む。**
#     日本語が化け、化けたバイト列の中に ' が現れて、文字列が閉じられなくなる。
#
#     **輪が1本、黙って動かなくなる。** ログに出るのは文字化けなので、原因に辿り着きにくい。
#     （2026-07-14 に、実際に踏んだ。register-*.ps1 が4本とも動かなかった）

Log ''
Log '.ps1 の文字コードを点検します'
& node (Join-Path $Root 'auto\check-encoding.mjs') 2>&1 | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) {
  Log ''
  Log '★ 動かない .ps1 があります。**輪が1本、止まっています。**'
  Log '  直すには: node auto/check-encoding.mjs --fix'
}

$prompt = Get-Content (Join-Path $Root 'auto\review-prompt.md') -Raw -Encoding UTF8

Log '記事を点検させます（20〜40分かかります）'
Log ''

$tools = 'Read Write Edit Glob Grep Bash WebFetch WebSearch TodoWrite Task'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log ''
Log '---------- 点検の報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '--------------------------------'

Log ''
Log "ログ: $LogFile"
Log '完了'
