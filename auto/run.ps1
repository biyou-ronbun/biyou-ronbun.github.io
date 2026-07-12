# ---------------------------------------------------------------
#  記事を1本、自動で作って公開する
#
#  Windows のタスクスケジューラから、月・水・金の朝9時に呼ばれます。
#  手で試したいときは、これを直接実行してください:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\run.ps1
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "$Stamp.log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
  Write-Output $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# タスクスケジューラから呼ばれると PATH が最小構成なので、読み直す
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

Set-Location $Root

Log '=========================================='
Log '記事の自動生成をはじめます'
Log '=========================================='

foreach ($cmd in @('node', 'git', 'claude')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

# 最新の状態から始める（GitHub 側で変更されているかもしれない）
# 手元に未コミットの変更が残っていると pull できないので、先に退避する
Log 'リポジトリを最新にします'
$dirty = git status --porcelain
if ($dirty) {
  Log '  未コミットの変更があるので、いったん退避します'
  git stash push -u -m "auto-run $Stamp" 2>&1 | ForEach-Object { Log "  git: $_" }
  $stashed = $true
}
git pull --rebase origin main 2>&1 | ForEach-Object { Log "  git: $_" }
if ($stashed) {
  Log '  退避した変更を戻します'
  git stash pop 2>&1 | ForEach-Object { Log "  git: $_" }
}

# ネタが残っているか
$topics = Get-Content (Join-Path $Root 'topics.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$queued = @($topics.topics | Where-Object { $_.status -eq 'queued' }).Count
Log "待機中のネタ: $queued 件"
if ($queued -eq 0) {
  Log '中止: ネタがありません（topics.json に queued がゼロ）'
  exit 1
}

# ---- 本番 --------------------------------------------------------

$prompt = Get-Content (Join-Path $Root 'auto\prompt.md') -Raw -Encoding UTF8

Log 'Claude に記事を作らせます（10〜20分かかります）'
Log ''

$tools = 'Read Write Edit Glob Grep Bash WebFetch WebSearch TodoWrite Task'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log ''
Log '---------- Claude の報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '-----------------------------------'

# ---- 結果の確認 --------------------------------------------------

# 画像を作る。Claude は JSON を書くだけで、画像そのものはここで作る。
#   - OGP画像   … X に記事URLを貼ったときのリンクカードの画像
#   - 数字の画像 … X の単発ポストに添える、論文の数字を1枚にしたもの
# Claude が push した後だと画像が入らないので、ここで作って追加コミットする。

Log ''
Log 'OGP画像を作ります（新しい記事のぶん）'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'site\ogp.ps1') 2>&1 |
  ForEach-Object { Log "  $_" }

Log '数字の画像を作ります（新しいカードのぶん）'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'site\xcards.ps1') 2>&1 |
  ForEach-Object { Log "  $_" }

# X の予定表が壊れていないか確認する。壊れたまま放置すると、以降の投稿が全部止まる。
Log 'X の予定表を検証します'
$check = & node -e "const q=require('./x/queue.json'); const p=q.posts.filter(x=>x.status==='pending'); console.log('OK: 未投稿 '+p.length+' 件');" 2>&1 | Out-String
Log "  $($check.Trim())"
if ($LASTEXITCODE -ne 0) {
  Log '  !! x/queue.json が壊れています。以降の X 投稿が止まります。直してください'
}

$newImages = git status --porcelain -- site/assets/ogp x/cards
if ($newImages) {
  Log '画像を追加でコミットします'
  git add site/assets/ogp x/cards 2>&1 | Out-Null
  git commit -q -m "OGP画像と数字の画像を追加" 2>&1 | ForEach-Object { Log "  git: $_" }
  git push origin main 2>&1 | ForEach-Object { Log "  git: $_" }
}

Log ''
Log '公開されたか確認します'

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
