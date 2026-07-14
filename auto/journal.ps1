# ---------------------------------------------------------------
#  海外の学術誌の新着を見て、ネタ帳を更新する（毎週・金曜 7:00）
#
#  手で試したいときは:
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\journal.ps1
#
#  ---------------------------------------------------------------
#  ★★ この輪が、絶対にやらないこと
#
#    ✗ 新着を、翻訳して、要約して、記事にする
#
#      それは「他人の情報を、右から左に流す」こと。
#      Google のスパムポリシーは「AIで価値を加えないページの大量生成」を
#      明示的に禁じている（自動か人力かを問わない）。
#      **このサイトを殺すのは、書かないことではなく、薄いものを書くこと。**
#
#    ✗ 化粧品メーカーのプレスリリースを、記事にする
#
#      翻訳して記事にすれば、**うちは無料の宣伝媒体**になる。
#
#  ★ この輪がやること
#
#      「この論文が出た」を知らせ、ネタ帳（topics.json）に足すかどうかを決めるだけ。
#
#      記事は、いつもの流れで作る:
#        researcher → research/<slug>.md（論文カード）→ writer → 記事
#
#      **カード無しで書かせると、このブログの唯一の武器が壊れる**（CLAUDE.md）。
#
#  ---------------------------------------------------------------
#  ★★ そして、いちばん大事な部分
#
#    **新着が無い週に、Claude を呼ばない。**
#
#    「新着を分析しろ」と毎週命じられた機械は、
#    **新着が無い週に、推測でデータを作る。**
#    （需要の輪〈auto/demand.ps1〉と、まったく同じ構造）
#
#    **RCT / メタ解析 / 撤回 が1本も無ければ、呼ばずに終わる。**
#
#    ★ 「今週は何も無かった」が、最も多い正解。
#      美容の一次研究が、毎週たくさん出ることはない。
#  ---------------------------------------------------------------
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "journal_$Stamp.log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }

function Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
  Write-Output $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

Set-Location $Root

# Node は UTF-8 で出力する。PowerShell は既定で Shift-JIS(CP932) として読む。
# これを直さないと、ファイルに書く前の時点で日本語が壊れる。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Log '=========================================='
Log '海外の学術誌の新着を見ます（毎週）'
Log '=========================================='

foreach ($cmd in @('node', 'claude', 'git')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

# ---- 新着を取る ---------------------------------------------------

Log ''
Log '新着を取ります（PubMed / 海外10誌）'

$out = & node (Join-Path $Root 'auto\journal-watch.mjs') --days 8 2>&1 | Out-String
$code = $LASTEXITCODE

foreach ($line in ($out -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

# ---- ★★ 呼ばずに終わる分岐 ------------------------------------------

if ($code -eq 1) {
  Log ''
  Log '★ 取得できませんでした。**「0件」ではありません。**'
  Log '  材料が無い状態で分析させると、機械は推測でデータを作ります。'
  Log '  今回は、何もせずに終わります。'
  exit 0
}

if ($code -eq 0) {
  Log ''
  Log '★ RCT・メタ解析・撤回は、1本もありませんでした。'
  Log '  **Claude を呼ばずに終わります。これが正しい動作です。**'
  Log ''
  Log '  「今週は何も無かった」が、最も多い正解です。'
  Log '  美容の一次研究が、毎週たくさん出ることはありません。'
  Log '  **無いのに探し続けると、無理やり何かを記事に仕立てることになります。**'
  exit 0
}

# ---- 見るべき新着があった ------------------------------------------

Log ''
Log '★ 見るべき新着があります。読ませます（10〜20分かかります）'
Log ''

$prompt = Get-Content (Join-Path $Root 'auto\journal-prompt.md') -Raw -Encoding UTF8

$tools = 'Read Write Edit Glob Grep Bash WebFetch TodoWrite'

$cout = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log '---------- 報告 ----------'
foreach ($line in ($cout -split "`r?`n")) { Log $line }
Log '--------------------------'

# ---- ★★ 記事を書いていないか、確かめる --------------------------------
#
#   この輪は、記事を書いてはいけない。ネタ帳（topics.json）に足すところまで。
#
#   「新着を翻訳して要約して記事にする」は、他人の情報を右から左に流すこと。
#   Google のスパムポリシーは「AIで価値を加えないページの大量生成」を禁じている。

Log ''
Log '★ 記事を書いていないか、確かめます'

$touched = git status --porcelain -- articles/ 2>&1 | Where-Object { $_.Trim() }

if ($touched) {
  Log ''
  Log '=========================================='
  Log '★★ この輪が、記事を書きました。元に戻します。'
  Log '=========================================='
  Log ''
  Log '  **この輪は、記事を書いてはいけません。**'
  Log '  「新着を翻訳して要約して記事にする」は、他人の情報を右から左に流すことです。'
  Log '  Google のスパムポリシーは「AIで価値を加えないページの大量生成」を禁じています。'
  Log ''
  Log '  記事は researcher → 論文カード → writer で作ります。'
  Log '  **カード無しで書かせると、このブログの唯一の武器が壊れます。**'
  Log ''

  foreach ($line in $touched) { Log "  $line" }

  & git checkout -- articles/ 2>&1 | Out-Null
  Log ''
  Log '  元に戻しました: articles/'
  Log '  ★ この週の作業は、失敗として記録します。'
  exit 1
}
Log '  記事は書かれていません'

# ---- 関門を通す ----------------------------------------------------

Log ''
Log 'サイトの検査を通します'
$verify = & node (Join-Path $Root 'site\verify.mjs') 2>&1 | Out-String
$vcode = $LASTEXITCODE
foreach ($line in ($verify -split "`r?`n" | Where-Object { $_ -match '✗|検証を通過|公開を中止' })) { Log "  $line" }

if ($vcode -ne 0) {
  Log ''
  Log '★ サイトの検査に落ちました。直すまで公開されません。'
  exit 1
}

Log ''
Log "ログ: $LogFile"
Log '完了'
