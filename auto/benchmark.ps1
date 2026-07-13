# ---------------------------------------------------------------
#  他メディアを研究して、サイトを1つだけ直す（毎週・火曜 8:00）
#
#  手で試したいときは:
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\benchmark.ps1
#
#  ---------------------------------------------------------------
#  ★★ この仕組みの、いちばん大事な部分
#
#    **「他メディアを研究してサイトを更新しろ」と毎週命じられた機械は、**
#    **必ず他メディアの型を取り込みます。**
#
#    他の美容メディアで最も伸びている機能は、これです。
#
#      ランキング / 成分辞典 / 商品データベース /
#      肌診断→おすすめ成分→商品 / 点数・星 / メール会員登録
#
#    **6つとも、うちがすでに却下したものです。**
#    **そして、6つとも、入れれば伸びます。**
#
#    Consumer Reports は1936年から広告を断り続けた消費者団体です。
#    その CR が、いま認証マークの掲示料を、評価した企業から取っています。
#
#      **判定は資産になる。資産は換金圧力を持つ。**
#      **理念の強度では止まらない。86年の実績でも止まらなかった。**
#
#    **意志では止まりません。だから、機械で止めます。**
#
#    このスクリプトは、作業のあとに auto/benchmark-gates.mjs を走らせます。
#    **他メディアの型が入っていたら、その変更を git で元に戻します。**
#  ---------------------------------------------------------------
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "benchmark_$Stamp.log"

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
#   （実際に 9本中 8本が、この状態で数日間動いていました）
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Log '=========================================='
Log '他メディアを研究します（毎週）'
Log '=========================================='

foreach ($cmd in @('node', 'claude', 'git')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

# ---- 作業の前に、いまの状態を確かめる ------------------------------

Log ''
Log '作業の前に、他メディアの型が入っていないか確認します'
$before = & node (Join-Path $Root 'auto\benchmark-gates.mjs') 2>&1 | Out-String
$beforeOk = ($LASTEXITCODE -eq 0)
foreach ($line in ($before -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

if (-not $beforeOk) {
  Log ''
  Log '★ 作業の前から、他メディアの型が入っています。'
  Log '  誰かが（前回の実行かもしれません）持ち帰っています。'
  Log '  今回は、何もせずに終わります。オーナーは上を読んでください。'
  exit 1
}

# ---- 研究させる ----------------------------------------------------

Log ''
Log '研究させます（20〜40分かかります）'
Log ''

$prompt = Get-Content (Join-Path $Root 'auto\benchmark-prompt.md') -Raw -Encoding UTF8

$tools = 'Read Write Edit Glob Grep Bash WebFetch WebSearch TodoWrite'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log '---------- 報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '--------------------------'

# ---- ★ 作業の後に、他メディアの型が入っていないか -------------------
#
# ここが、この仕組みの本体です。

Log ''
Log '★ 作業の後に、他メディアの型が入っていないか確認します'
$after = & node (Join-Path $Root 'auto\benchmark-gates.mjs') 2>&1 | Out-String
$afterOk = ($LASTEXITCODE -eq 0)
foreach ($line in ($after -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

if (-not $afterOk) {
  Log ''
  Log '=========================================='
  Log '★★ 他メディアの型を、持ち帰りました。元に戻します。'
  Log '=========================================='
  Log ''
  Log '  「他メディアを研究して更新しろ」と命じられた機械は、必ずここに手を伸ばします。'
  Log '  ランキングも、成分辞典も、入れれば伸びます。そして、このブログを殺します。'
  Log '  意志では止まりません。だから、機械で止めます。'
  Log ''

  # サイトの本体だけを、元に戻す
  foreach ($f in @('site\templates', 'site\build.mjs', 'site\config.json',
                   'site\articles.json', 'site\claims.json', 'site\news.json')) {
    & git checkout -- $f 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Log ''
      Log "★★ 戻せませんでした: $f"
      Log '  **戻せない状態で進んではいけません。** オーナーは手で確認してください。'
      exit 1
    }
    Log "  元に戻しました: $f"
  }

  # 新しく作られたテンプレート（git に登録されていないもの）も消す
  $untracked = git ls-files --others --exclude-standard -- 'site/templates' 2>&1
  foreach ($f in $untracked) {
    if ($f -and (Test-Path $f)) {
      Remove-Item $f -Force
      Log "  消しました（新しく作られたページの型）: $f"
    }
  }

  Log ''
  $recheck = & node (Join-Path $Root 'auto\benchmark-gates.mjs') 2>&1 | Out-String
  foreach ($line in ($recheck -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

  Log ''
  Log '★ この週の研究は、失敗として記録します。'
  Log '  （benchmark/ の記録は残しています。サイトへの変更だけを戻しました）'
  exit 1
}

# ---- 記事の関門も通す ----------------------------------------------

Log ''
Log 'サイトの検査を通します'
$verify = & node (Join-Path $Root 'site\verify.mjs') 2>&1 | Out-String
foreach ($line in ($verify -split "`r?`n" | Where-Object { $_ -match '✗|検証を通過|公開を中止' })) { Log "  $line" }

if ($LASTEXITCODE -ne 0) {
  Log ''
  Log '★ サイトの検査に落ちました。直すまで公開されません。'
  exit 1
}

Log ''
Log "ログ: $LogFile"
Log '完了'
