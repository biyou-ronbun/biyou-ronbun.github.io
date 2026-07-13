# ---------------------------------------------------------------
#  需要を調べて、サイトを直す（毎週）
#
#  Windows のタスクスケジューラから、毎週土曜の 7時に呼ばれます。
#  手で試したいときは:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\demand.ps1
#
#  やること:
#    1. 数字を取る（Search Console / Cloudflare / Stripe）
#    2. **検索データが無ければ、Claude を呼ばずに終わる**
#    3. データがあれば、読んで、サイトを1つだけ直す
#
#  ---------------------------------------------------------------
#  ★★ この仕組みの、いちばん大事な部分
#
#    **データが無いときに「需要を分析しろ」と言われた機械は、
#      必ず推測でデータを作ります。**
#
#    そして推測に基づいて記事を量産し始めます。
#    **それは Google が最も嫌う「AI で価値を加えないページの大量生成」そのもの。**
#    AdSense と検索流入を、同時に失います。
#
#    だから、**検索データが無い週は、Claude を呼びません。**
#    呼べば、必ず何か書こうとするからです。
#
#    Search Console のデータは、登録から数週間かかります。
#    それまでこのタスクは、毎週「まだデータがない」と記録して終わります。
#    **それが正しい動作です。**
#
#  ★ 直すのは、1週間に1つだけ。
#    たくさん直すと、何が効いたのか分からなくなります。
#    そして「たくさん直した」こと自体が目的になります。
#  ---------------------------------------------------------------
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "demand_$Stamp.log"

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
Log '需要を調べます（毎週）'
Log '=========================================='

foreach ($cmd in @('node', 'claude')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

# ---- 1. 数字を取る -----------------------------------------------

Log '数字を取ります（Search Console / Cloudflare / Stripe）'
$metrics = & node (Join-Path $Root 'auto\collect-metrics.mjs') 2>&1 | Out-String
foreach ($line in ($metrics -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

# ---- 2. 検索データが無ければ、Claude を呼ばない -------------------
#
# ★ ここが、この仕組みでいちばん大事な部分です。
#
#   データが無いのに Claude を呼ぶと、必ず推測で「需要」を作ります。
#   そして推測に基づいて記事を量産し始めます。
#
#   **呼ばなければ、捏造は起きません。**

$dataFile = Join-Path $Root 'ops\auto-metrics.json'

if (-not (Test-Path $dataFile)) {
  Log ''
  Log '★ まだ数字の記録がありません。今回は何もせずに終わります。'
  exit 0
}

$history = Get-Content $dataFile -Raw -Encoding UTF8 | ConvertFrom-Json
$latest = $history[-1]
$impressions = 0
if ($latest.gsc -and ($null -ne $latest.gsc.impressions)) { $impressions = [int]$latest.gsc.impressions }

Log ''
Log "検索の表示回数: $impressions"

if ($impressions -eq 0) {
  Log ''
  Log '★ Search Console のデータが、まだありません。'
  Log '  登録から数週間かかります。**これは「人気が無い」ではなく「データが存在しない」です。**'
  Log ''
  Log '  ここで Claude を呼ぶと、**必ず推測で「需要」を作ります。**'
  Log '  そして推測に基づいて記事を量産し始めます。'
  Log '  それは Google が最も嫌う「AI で価値を加えないページの大量生成」です。'
  Log ''
  Log '  だから、呼びません。今週は何もせずに終わります。**それが正しい動作です。**'
  Log ''

  # 記録だけは残す（「データが無かった」ことも、記録に値する事実です）
  $demand = Join-Path $Root 'ops\demand.md'
  if (-not (Test-Path $demand)) {
    Set-Content -Path $demand -Encoding UTF8 -Value @'
# 需要の記録

`auto/demand.ps1` が毎週追記します。

**★ データが無い週は「データが無かった」と書いて終わります。それが正しい動作です。**
推測で「需要」を書かないこと。書いた瞬間、このブログは Google に量産ページと判定される側に回ります。
'@
  }
  $pv = if ($latest.cloudflare.pv) { $latest.cloudflare.pv } else { '取得失敗' }
  $visits = if ($latest.cloudflare.visits) { $latest.cloudflare.visits } else { '取得失敗' }
  Add-Content -Path $demand -Encoding UTF8 -Value @"

## $(Get-Date -Format 'yyyy-MM-dd')

- PV: $pv / 訪問: $visits
- **検索の表示回数: 0（まだデータがありません。登録から数週間かかります）**
- 分析は行いませんでした。**データが無いのに分析すると、推測を需要として書いてしまうためです。**
"@

  Log '完了'
  exit 0
}

# ---- 3. データがある。読ませて、1つだけ直させる -------------------

Log ''
Log '検索データがあります。読ませて、サイトを1つだけ直させます'
Log ''

$prompt = Get-Content (Join-Path $Root 'auto\demand-prompt.md') -Raw -Encoding UTF8

$tools = 'Read Write Edit Glob Grep Bash TodoWrite'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log '---------- 報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '--------------------------'

# ---- 4. 関門を通す -----------------------------------------------

Log ''
Log '検査します'
$verify = & node (Join-Path $Root 'site\verify.mjs') 2>&1 | Out-String
foreach ($line in ($verify -split "`r?`n" | Where-Object { $_ -match '✗|検証を通過|公開を中止' })) { Log "  $line" }

if ($LASTEXITCODE -ne 0) {
  Log ''
  Log '★ 検査に落ちました。直すまで公開されません。'
  exit 1
}

Log ''
Log "ログ: $LogFile"
Log '完了'
