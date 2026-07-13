# ---------------------------------------------------------------
#  X の型を、研究して更新する（毎週）
#
#  Windows のタスクスケジューラから、毎週日曜の 7時に呼ばれます。
#  手で試したいときは:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\x-research.ps1
#
#  やること:
#    X で伸びているアカウント・ポストを研究し、benchmark/x-playbook.md を更新する。
#    そのファイルは auto/x-prompt.md（X投稿の自動生成）が毎回読みます。
#
#  ---------------------------------------------------------------
#  ★ この仕事には、構造的な危険があります
#
#    「伸びている投稿」を毎週取り込み続けると、必ず煽りに寄ります。
#    バズる投稿は、断定と煽りと不安でできているからです。
#    毎週それを学習すれば、**このアカウントは数か月で、
#    うちが批判している側と同じものになります。**
#
#    だから歯止めを2つ置いています。
#
#    1. auto/x-research-prompt.md に「煽らずに伸びている型だけを持ち帰れ。
#       それ以外は明示的に捨てて、捨てたことを記録しろ」と書いてある
#
#    2. **auto/verify-x.mjs が、投稿の直前に全件を検査する。**
#       研究がどんな型を持ち帰っても、煽り・言い過ぎ・薬機法に触れる投稿は、
#       機械が拒否します。**関門のほうが上位です。**
#
#    ★ この2つのどちらかを外したくなったら、それは危険信号です。
#  ---------------------------------------------------------------
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "x-research_$Stamp.log"

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
Log 'X の型を研究します（毎週）'
Log '=========================================='

foreach ($cmd in @('node', 'claude')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

$Playbook = Join-Path $Root 'benchmark\x-playbook.md'

if (Test-Path $Playbook) {
  $before = (Get-Item $Playbook).Length
  Log "現在の x-playbook.md: $before バイト"
} else {
  $before = 0
  Log 'x-playbook.md がまだありません。新しく作ります'
}

# ---- ★★ まず、うち自身の実測値を取る ------------------------------
#
#   ★ 「他人の伸びている投稿を研究する」は、**構造的にできません。**
#
#     X の投稿は、この環境から**1ページも読めません**（ログインの壁 / 検索APIは月200ドル）。
#     benchmark/x-playbook.md の冒頭に、実際にそう記録されています。
#
#   **読めないのに「伸びる型を研究しろ」と毎週命じられた機械は、記憶から捏造します。**
#   そして、このファイルの冒頭が警告しているとおりになります。
#
#   ★ だから、研究の対象を**うち自身の実測値**に変えました。
#     「他人の煽りを真似る」ではなく「**うちの何が読まれたか**」を見ます。
#
#   ★ そして、数字がすべて 0 なら、**Claude を呼ばずに終わります。**
#     材料が無いのに分析させれば、機械は推測でデータを作り、
#     「伸びる型」として煽りを学習します。
#     （需要の輪〈auto/demand.ps1〉と、まったく同じ構造です）

Log ''
Log 'まず、うち自身の X の実測値を取ります（公式API）'
$mout = & node (Join-Path $Root 'auto\x-metrics.mjs') 2>&1 | Out-String
$mcode = $LASTEXITCODE
foreach ($line in ($mout -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

if ($mcode -eq 1) {
  Log ''
  Log '★ 数字を取得できませんでした。**「0だった」ではありません。**'
  Log '  材料が無い状態で研究させると、機械は推測でデータを作ります。'
  Log '  今回は、何もせずに終わります。'
  exit 0
}

if ($mcode -eq 0) {
  Log ''
  Log '★ 実測値がすべて 0 です。**Claude を呼ばずに終わります。**'
  Log ''
  Log '  これは失敗ではありません。**正しい動作です。**'
  Log '  材料が無いのに「伸びる型を研究しろ」と命じれば、機械は必ず捏造します。'
  Log '  そして煽りを「伸びる型」として学習します。'
  Log ''
  Log '  ボトルネックは投稿の中身ではありません。**誰も見ていないことです。**'
  Log '  投稿を増やしても、0 は 0 のままです。'
  exit 0
}

$prompt = Get-Content (Join-Path $Root 'auto\x-research-prompt.md') -Raw -Encoding UTF8

Log ''
Log '実測値があります。研究させます（20〜40分かかります）'
Log ''

$tools = 'Read Write Edit Glob Grep Bash WebFetch WebSearch TodoWrite'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log '---------- 報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '--------------------------'

if (Test-Path $Playbook) {
  $after = (Get-Item $Playbook).Length
  Log ''
  Log "x-playbook.md: $before → $after バイト"
  if ($after -eq $before) {
    Log '（変わっていません。「今週は新しい発見が無かった」なら、それが正常です）'
  }
}

# ---- 歯止め: 研究が煽りを持ち帰っていないか、機械で確かめる ----------
#
# playbook そのものは投稿ではないので verify-x.mjs にはかけられません。
# ただし、禁止語が playbook に「推奨する型」として書き込まれていないかは見ておきます。
# （引用や「避けるべき型」として書かれている分には問題ありません）

if (Test-Path $Playbook) {
  Log ''
  Log '念のため: playbook に禁止語が入っていないか見ます'
  $text = Get-Content $Playbook -Raw -Encoding UTF8
  $ng = @('騙されてました', '9割が知らない', '知らないと損', '絶対に効く', 'ヤバい')
  $hit = @()
  foreach ($w in $ng) { if ($text -match [regex]::Escape($w)) { $hit += $w } }
  if ($hit.Count -gt 0) {
    Log "  注意: 次の語が playbook に入っています: $($hit -join ' / ')"
    Log '  「避けるべき型」として書いてあるなら問題ありません。'
    Log '  「効く型」として書いてあるなら、それは playbook のほうが間違っています。上の報告を読んでください。'
  } else {
    Log '  問題ありません'
  }
}

Log ''
Log "ログ: $LogFile"
Log '完了'
