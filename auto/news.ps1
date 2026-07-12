# ---------------------------------------------------------------
#  美容ニュースを、論文で確かめる
#
#  Windows のタスクスケジューラから、毎日 8時〜22時に 2時間おきに呼ばれます（1日8回）。
#  手で試したいときは:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\news.ps1
#
#  やること:
#    プレスリリース・消費者庁・国民生活センターなどを見て、
#    「◯◯が△△する」という主張を拾い、その出典を PubMed で辿る。
#    結果を site/news.json に書き、X の投稿も予約する。
#
#  ★ ほとんどの回は「今回は無し」で終わります。それが正常です。
#    美容業界に、2時間ごとに「確かめる価値のある新しい主張」は生まれません。
#    無いのに探し続けると、無理やり何かをニュースに仕立てることになります。
#
#  ★ 1日3件が上限。達していたら Claude を呼ばずに終わります。
#    中身の薄いニュースを積み上げるのは、Google に量産ページと判定される直接の原因です。
#    このサイトを殺すのは、書かないことではなく、薄いものを書くことです。
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "news_$Stamp.log"

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
Log 'ニュースの検証をはじめます'
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
  git stash push -u -m "news $Stamp" 2>&1 | ForEach-Object { Log "  git: $_" }
  $stashed = $true
}
git pull --rebase origin main 2>&1 | ForEach-Object { Log "  git: $_" }
if ($stashed) {
  git stash pop 2>&1 | ForEach-Object { Log "  git: $_" }
}

$news = Get-Content (Join-Path $Root 'site\news.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$before = @($news.items).Count
$today = Get-Date -Format 'yyyy-MM-dd'
$todayCount = @($news.items | Where-Object { $_.date -eq $today }).Count

Log "検証済みのニュース: $before 件（うち今日: $todayCount 件）"

# ---- 歯止め ------------------------------------------------------
#
# 1時間おきに「ニュースを探せ」と言われ続けたエージェントは、
# 探すものが無くても何かを見つけようとします。
# 中身の薄いニュースが積み上がるのは、Google に量産ページと
# 判定される直接の原因です。
#
# 1日3件を上限にし、達していたら Claude を呼ばずに終わります。

$DailyLimit = 3

if ($todayCount -ge $DailyLimit) {
  Log ''
  Log "今日はすでに $todayCount 件を検証しています（上限 $DailyLimit 件）。"
  Log '無理にニュースを増やしません。今回は何もせずに終了します。'
  Log ''
  Log '完了'
  exit 0
}

$remaining = $DailyLimit - $todayCount
Log "今日、あと $remaining 件まで追加できます"

$prompt = Get-Content (Join-Path $Root 'auto\news-prompt.md') -Raw -Encoding UTF8

Log 'ニュースを探して、出典を辿らせます（15〜30分かかります）'
Log ''

$tools = 'Read Write Edit Glob Grep Bash WebFetch WebSearch TodoWrite Task'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log ''
Log '---------- 報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '--------------------------'

$after = (Get-Content (Join-Path $Root 'site\news.json') -Raw -Encoding UTF8 | ConvertFrom-Json).items.Count
Log ''
Log "検証済みのニュース: $before 件 → $after 件（+$($after - $before)）"

git fetch origin 2>&1 | Out-Null
$local  = (git rev-parse HEAD).Trim()
$remote = (git rev-parse origin/main).Trim()

if ($local -eq $remote) {
  Log 'GitHub に push されています'
} else {
  Log '注意: push されていません（検証に落ちた可能性があります。上の報告を読んでください）'
}

Log ''
Log "ログ: $LogFile"
Log '完了'
