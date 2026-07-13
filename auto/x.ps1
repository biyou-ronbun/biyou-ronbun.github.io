# ---------------------------------------------------------------
#  X の投稿を補充する
#
#  Windows のタスクスケジューラから、毎日 6時に呼ばれます。
#  手で試したいときは:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\x.ps1
#
#  やること:
#    未投稿の在庫が 30 件を切っていたら、30 件になるまで補充する。
#    ネタ元は site/claims.json（51件）・news.json・memos.json・papers.json。
#    ★ 記事の告知は、記事の自動生成側がすでに3本ずつ作っています。ここでは作りません。
#
#  ★ 在庫が足りていれば、Claude を呼ばずに終わります。
#    「作れるから作る」をやると、同じネタの言い換えが並びます。
#    X でいちばん嫌われるのは、中身のない連投です。
#
#  ★ 補充したものは、必ず auto/verify-x.mjs を通します。
#    落ちた投稿は投稿されません（post-x.mjs も投稿の直前に同じ検査をします）。
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "x_$Stamp.log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
  Write-Output $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

Set-Location $Root

# ★ Node は UTF-8 で出力します。PowerShell は既定で Shift-JIS(CP932) として読みます。
#   これを直さないと、**ファイルに書く前の時点で、日本語がすでに壊れています。**
#   （Add-Content に -Encoding UTF8 を付けても手遅れです。壊れた文字列を保存するだけ）
#
#   ★ ただの見た目の問題ではありません。
#     **関門が「金の出口が開いた」と報告しても、その理由が読めなくなります。**
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8


Log '=========================================='
Log 'X の投稿を補充します'
Log '=========================================='

foreach ($cmd in @('node', 'claude')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

# ---- 在庫を数える ------------------------------------------------
#
# 連投の続き（replyToLocalId があるもの）は数えません。
# 単独では出さないので、在庫としては1本と数えるのが正しい。

$queue = Get-Content (Join-Path $Root 'x\queue.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$stock = @($queue.posts | Where-Object {
  $_.status -eq 'pending' -and -not $_.replyToLocalId
}).Count

$Target = 30   # 1日6本なので、5日ぶん

Log "未投稿の在庫: $stock 件（目標 $Target 件 = 5日ぶん）"

if ($stock -ge $Target) {
  Log ''
  Log '在庫は足りています。今回は何もせずに終了します。'
  Log '（作れるから作る、をやると同じネタの言い換えが並びます）'
  Log ''
  Log '完了'
  exit 0
}

Log "あと $($Target - $stock) 件、補充します"
Log ''

$prompt = Get-Content (Join-Path $Root 'auto\x-prompt.md') -Raw -Encoding UTF8

$tools = 'Read Write Edit Glob Grep Bash TodoWrite'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log '---------- 報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '--------------------------'

# ---- 関門をもう一度通す ------------------------------------------
#
# Claude が「通した」と言っていても、こちらで確かめます。
# 投稿は取り消せません。

Log ''
Log '検査します'
$verify = & node (Join-Path $Root 'auto\verify-x.mjs') 2>&1 | Out-String
foreach ($line in ($verify -split "`r?`n")) { Log $line }

if ($LASTEXITCODE -ne 0) {
  Log ''
  Log '★ 検査に落ちました。post-x.mjs も投稿の直前に同じ検査をするので、'
  Log '  このままでは1本も投稿されません。x/queue.json を直してください。'
  exit 1
}

$queue2 = Get-Content (Join-Path $Root 'x\queue.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$after = @($queue2.posts | Where-Object {
  $_.status -eq 'pending' -and -not $_.replyToLocalId
}).Count

Log ''
Log "在庫: $stock 件 → $after 件（+$($after - $stock)）"
Log ''
Log "ログ: $LogFile"
Log '完了'
