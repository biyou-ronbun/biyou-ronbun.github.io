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

# ネタ（topics.json の queued）が、この件数以下になったら補充する。
# 週3本ペースなので、3 なら「尽きる1週間前」に気づけます。
$ReplenishAt = 3

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

# ★ Node は UTF-8 で出力します。PowerShell は既定で Shift-JIS(CP932) として読みます。
#   これを直さないと、**ファイルに書く前の時点で、日本語がすでに壊れています。**
#   （Add-Content に -Encoding UTF8 を付けても手遅れです。壊れた文字列を保存するだけ）
#
#   ★ ただの見た目の問題ではありません。
#     **関門が「金の出口が開いた」と報告しても、その理由が読めなくなります。**
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8


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

# ---- ネタの補充 --------------------------------------------------
#
# ネタ（topics.json の queued）が尽きると、次回から記事が1本も作れなくなります。
# 尽きてから気づくと、そのぶんの自動生成が丸ごと失われるので、
# 残りが少なくなった時点で、先に補充しておきます。
#
# 補充のときも PubMed に当てて「論文が存在するテーマか」を確かめます。
# 論文の無いテーマを行列に入れると、その番で記事が書けず、結局そこで止まるからです。

Log ''
$topics = Get-Content (Join-Path $Root 'topics.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$left = @($topics.topics | Where-Object { $_.status -eq 'queued' }).Count
Log "残りのネタ: $left 件"

if ($left -le $ReplenishAt) {
  Log "ネタが $ReplenishAt 件以下になりました。補充します（5〜10分かかります）"
  Log ''

  $rp = Get-Content (Join-Path $Root 'auto\replenish-prompt.md') -Raw -Encoding UTF8
  $rout = & claude -p $rp --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

  Log '---------- 補充の報告 ----------'
  foreach ($line in ($rout -split "`r?`n")) { Log $line }
  Log '--------------------------------'

  # 補充が失敗して topics.json が壊れていないか、機械で確かめる。
  # 壊れたまま放置すると、以降の自動生成が全部止まります。
  $check = & node -e "const t=require('./topics.json'); const q=t.topics.filter(x=>x.status==='queued'); const s=t.topics.map(x=>x.slug); if(new Set(s).size!==s.length) throw new Error('slug 重複'); console.log(q.length);" 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Log "!! topics.json が壊れています。次回の自動生成が止まります。直してください: $($check.Trim())"
  } else {
    Log "補充後のネタ: $($check.Trim()) 件"
  }
} else {
  Log '補充はまだ不要です'
}

# ---- 次の巻 ------------------------------------------------------
#
# Kindle は、このブログで唯一「サイトのPVを分母にしない」収益源です。
# Amazon の検索が流通を担ってくれるので、読者がゼロでも売れます（ops/monetization.md §15）。
# だから、記事が溜まったら自動で次の巻を組みます。
#
# ★ KDP には個人向けの出版APIがありません。
#   ここで自動化できるのは「原稿ができる」までです。
#   アップロードは、オーナーが手でやります（1冊30分）。

Log ''
Log '次の巻を出せるか確認します'
$vout = & node (Join-Path $Root 'auto\next-volume.mjs') 2>&1 | Out-String
$vready = ($LASTEXITCODE -eq 10)
foreach ($line in ($vout -split "`r?`n")) { if ($line.Trim()) { Log "  $line" } }

if ($vready) {
  Log ''
  Log '記事が1冊ぶん溜まりました。次の巻を組みます（5〜10分かかります）'
  Log ''

  $bp = Get-Content (Join-Path $Root 'auto\book-prompt.md') -Raw -Encoding UTF8
  $bout = & claude -p $bp --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

  Log '---------- 本の報告 ----------'
  foreach ($line in ($bout -split "`r?`n")) { Log $line }
  Log '------------------------------'
  Log ''
  Log '★ オーナーへ: 原稿ができています。KDP にアップロードしてください（手作業。1冊30分）'
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

# ---- ★ 新しい記事に、リンクを付けられるか -------------------------
#
#   記事は平日毎日1本増えます。
#   **書いた記事に「選び方の基準」が導けるなら、そこには収益の機会があります。**
#   **リンクの発行はオーナーにしかできないので、知らせなければ機会は消えます。**
#
#   ★ ただし「基準が導けない」なら、置かないのが正解です。
#     10本のうち5本が、それでした。**無理に作らせないこと。**

Log ''
Log '★ リンクを付けられる記事を確認します'
$cand = & node (Join-Path $Root 'auto\product-candidates.mjs') 2>&1 | Out-String
foreach ($line in ($cand -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

Log ''
Log "ログ: $LogFile"
Log '完了'
