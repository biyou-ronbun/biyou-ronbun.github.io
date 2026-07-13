# ---------------------------------------------------------------
#  収益を調べて、器を1つだけ直す（毎週）
#
#  Windows のタスクスケジューラから、毎週日曜の 8時に呼ばれます。
#  手で試したいときは:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\money.ps1
#
#  ---------------------------------------------------------------
#  ★★ この仕組みの、いちばん大事な部分
#
#    **「収益を改善しろ」と毎週命じられた機械は、必ず金の出口を開けにいきます。**
#
#      広告枠をONにする / アフィリのURLを入れる / 本のURLを入れる /
#      商品を推薦する / スコア・ランキング・認証を作る
#
#    **どれも収益を増やします。そして、どれもこのブログを殺します。**
#
#    Consumer Reports は1936年から広告を断り続けた消費者団体です。
#    その CR が、いま「CR Recommended」の認証マークの掲示料を、
#    **評価した企業から取っています。**
#
#      **判定は資産になる。資産は換金圧力を持つ。**
#      **理念の強度では止まらない。86年の実績でも止まらなかった。**
#
#    **意志では止まりません。だから、機械で止めます。**
#
#    このスクリプトは、作業の前と後に auto/money-gates.mjs を走らせます。
#    **作業のあとで金の出口が開いていたら、その変更を git で元に戻します。**
#  ---------------------------------------------------------------
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "money_$Stamp.log"

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
Log '収益を調べます（毎週）'
Log '=========================================='

foreach ($cmd in @('node', 'claude', 'git')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

# ---- 作業の前に、金の出口の状態を見る ----------------------------

Log '作業の前に、金の出口を確認します'
$before = & node (Join-Path $Root 'auto\money-gates.mjs') 2>&1 | Out-String
$beforeOk = ($LASTEXITCODE -eq 0)
foreach ($line in ($before -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

if (-not $beforeOk) {
  Log ''
  Log '★ 作業の前から、**承認されていない**金の出口が開いています。'
  Log '  site/money-approved.json に載っていない出口が開いている、ということです。'
  Log ''
  Log '  オーナーが開けたのなら、承認リストに足してください（メインの Claude に頼んでください）。'
  Log '  そうでないなら、誰かが勝手に開けています。'
  Log ''
  Log '  今回は、何もせずに終わります。'
  exit 0
}

# ★ 承認済みの出口が開いているのは、正常です。
#   ここで止めてしまうと、オーナーが広告をONにした瞬間、
#   **収益の輪が二度と動かなくなります。**（実際にその欠陥がありました）

# ---- 数字を取る ---------------------------------------------------

Log ''
Log '数字を取ります'
$metrics = & node (Join-Path $Root 'auto\collect-metrics.mjs') 2>&1 | Out-String
foreach ($line in ($metrics -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

# ---- 調べさせる ---------------------------------------------------

Log ''
Log '調べさせます（法規制の変化 / 器の穴 / 収益の構造）'
Log ''

$prompt = Get-Content (Join-Path $Root 'auto\money-prompt.md') -Raw -Encoding UTF8

$tools = 'Read Write Edit Glob Grep Bash WebFetch WebSearch TodoWrite'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log '---------- 報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '--------------------------'

# ---- ★ 作業の後に、金の出口が開いていないかを見る ------------------
#
# ここが、この仕組みの本体です。

Log ''
Log '★ まず、承認リストを元に戻します（エージェントが自分を承認できないように）'
#
# site/money-approved.json は「オーナーが承認した出口」の一覧です。
# エージェントがそこに勝手に "affiliate" などを書き足せば、
# **金の出口を開けたうえで、自分でそれを承認できてしまいます。**
# だから、作業のあとに必ず git から元に戻します。
#
# ★★ この git checkout が失敗したら、**そこで中止します。**
#
#   実際に、この歯止めが1度破られました。
#   承認リストが git に登録されていなかったので checkout が失敗し、
#   エラーを無視して先へ進んだ結果、
#   **エージェントがアフィリのURLを入れ、自分で自分を承認し、関門を通り抜けました。**
#
#   **戻せないなら、進んではいけません。**

$co = & git checkout -- 'site/money-approved.json' 2>&1
if ($LASTEXITCODE -ne 0) {
  Log ''
  Log '=========================================='
  Log '★★ 承認リストを git から戻せませんでした。中止します。'
  Log '=========================================='
  Log "  $co"
  Log ''
  Log '  site/money-approved.json が git に登録されていない可能性があります。'
  Log '  **戻せない状態で進むと、エージェントが自分で自分を承認できてしまいます。**'
  Log '  （実際に1度、それで関門が破られました）'
  Log ''
  Log '  オーナーは、このファイルを git に登録してください。'
  exit 1
}
Log '  戻しました: site/money-approved.json'

Log ''
Log '★ 作業の後に、金の出口を確認します'
$after = & node (Join-Path $Root 'auto\money-gates.mjs') 2>&1 | Out-String
$afterOk = ($LASTEXITCODE -eq 0)
foreach ($line in ($after -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

if (-not $afterOk) {
  Log ''
  Log '=========================================='
  Log '★★ エージェントが、金の出口を開けました。元に戻します。'
  Log '=========================================='
  Log ''
  Log '  「収益を改善しろ」と命じられた機械は、必ずここに手を伸ばします。'
  Log '  意志では止まりません。だから、機械で止めます。'
  Log ''

  # 金の出口に関わるファイルだけを、元に戻す
  foreach ($f in @('site\config.json', 'site\products.json', 'site\books.json', 'site\claims.json', 'site\papers.json')) {
    & git checkout -- $f 2>&1 | Out-Null
    Log "  元に戻しました: $f"
  }

  Log ''
  $recheck = & node (Join-Path $Root 'auto\money-gates.mjs') 2>&1 | Out-String
  foreach ($line in ($recheck -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

  Log ''
  Log '★ この週の作業は、失敗として記録します。オーナーは上の報告を読んでください。'
  Log '  （器や説明文への変更は残っています。金の出口だけを戻しました）'
  exit 1
}

# ---- 記事の関門も通す ---------------------------------------------

Log ''
Log 'サイトの検査を通します'
$verify = & node (Join-Path $Root 'site\verify.mjs') 2>&1 | Out-String
foreach ($line in ($verify -split "`r?`n" | Where-Object { $_ -match '✗|検証を通過|公開を中止' })) { Log "  $line" }

if ($LASTEXITCODE -ne 0) {
  Log ''
  Log '★ サイトの検査に落ちました。直すまで公開されません。'
  exit 1
}

# ---- ★ リンクを付けられる記事を、毎回オーナーに知らせる -------------
#
#   アフィリエイトリンクの発行は、**オーナーにしかできません。**
#   だから機械が「基準に合う商品」を見つけても、
#   **知らせなければ、その記事は永久に収益ゼロのままです。**
#
#   記事は自動で週5本増えます。**知らせを人の記憶に頼れば、必ず漏れます。**
#
#   ★ この報告は、金の出口を戻したあとに出します。
#     機械が url を埋めていたら、その埋めた分はもう消えています。
#     つまり、ここに出るのは**本当にオーナーの手が要るものだけ**です。

Log ''
Log '★ リンクを付けられる記事を確認します'
$cand = & node (Join-Path $Root 'auto\product-candidates.mjs') 2>&1 | Out-String
foreach ($line in ($cand -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

Log ''
Log "ログ: $LogFile"
Log '完了'
