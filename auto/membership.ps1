# ---------------------------------------------------------------
#  メンバーシップを調べて、文面を1つだけ直す（毎週）
#
#  Windows のタスクスケジューラから、毎週水曜の 8時に呼ばれます。
#  手で試したいときは:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\membership.ps1
#
#  ---------------------------------------------------------------
#  ★★ この仕組みの、いちばん大事な部分
#
#    **「メンバーを増やせ」と毎週命じられた機械は、必ずこうします。**
#
#      ・限定コンテンツを作る（「メンバーだけが読めます」）
#      ・渡せないものを約束する（「メールでお届けします」）
#      ・支援者の数を捏造する（「500人が支援しています」）
#      ・煽る（「今だけ」「残りわずか」）
#
#    **どれもメンバーを増やします。そして、どれもこのブログを殺します。**
#
#  ★ すでに一度、壊れました
#
#    旧プランは「記事にならなかった論文のメモが**届きます**」と書いていました。
#    **届ける手段が、ありませんでした。**
#    **続かない約束を収益の入口に置いた時点で、このブログの唯一の武器が壊れます。**
#
#  ★★ 特に「限定」が危ない
#
#    メンバーページには「鍵のかかった情報はありません」と書いてあります。
#    **機械は、この一文を「もったいない」と思います。**
#    そう思った瞬間、消したくなります。
#
#    **消させません。** auto/membership-gates.mjs が見張っています。
#    作業の前と後に走り、壊れていたら git で元に戻します。
#
#  ★ メンバーシップは「情報を売る」ものではありません。
#    **売っているのは、「断り続けること」です。**
#    「見返り」を増やそうとした瞬間、それは別のものになります。
#  ---------------------------------------------------------------
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "membership_$Stamp.log"

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
Log 'メンバーシップを調べます（毎週）'
Log '=========================================='

foreach ($cmd in @('node', 'claude', 'git')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

# ---- 作業の前に、文面が健全か見る --------------------------------

Log '作業の前に、文面を確認します'
$before = & node (Join-Path $Root 'auto\membership-gates.mjs') 2>&1 | Out-String
$beforeOk = ($LASTEXITCODE -eq 0)
foreach ($line in ($before -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

if (-not $beforeOk) {
  Log ''
  Log '★ 作業の前から、文面が壊れています。誰かが壊しました。'
  Log '  今回は何もせずに終わります。オーナーは上を読んでください。'
  exit 1
}

# ---- 数字を取る ---------------------------------------------------

Log ''
Log '数字を取ります'
$metrics = & node (Join-Path $Root 'auto\collect-metrics.mjs') 2>&1 | Out-String
foreach ($line in ($metrics -split "`r?`n" | Where-Object { $_ -match 'サブスク|Stripe' })) { Log "  $line" }

# ---- 調べさせる ---------------------------------------------------

Log ''
Log '調べさせます（なぜ払うのかの説明 / 文面の嘘 / メンバーの数）'
Log ''

$prompt = Get-Content (Join-Path $Root 'auto\membership-prompt.md') -Raw -Encoding UTF8

$tools = 'Read Write Edit Glob Grep Bash WebFetch WebSearch TodoWrite'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log '---------- 報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '--------------------------'

# ---- ★ 作業の後に、文面が壊れていないか見る ------------------------
#
# ここが、この仕組みの本体です。

Log ''
Log '★ 作業の後に、文面を確認します'
$after = & node (Join-Path $Root 'auto\membership-gates.mjs') 2>&1 | Out-String
$afterOk = ($LASTEXITCODE -eq 0)
foreach ($line in ($after -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

if (-not $afterOk) {
  Log ''
  Log '=========================================='
  Log '★★ エージェントが、メンバーシップの文面を壊しました。元に戻します。'
  Log '=========================================='
  Log ''
  Log '  「メンバーを増やせ」と命じられた機械は、必ずここに手を伸ばします。'
  Log '  限定コンテンツを作る。渡せないものを約束する。数字を捏造する。煽る。'
  Log '  **どれもメンバーを増やします。そして、どれもこのブログを殺します。**'
  Log ''

  foreach ($f in @('site/templates/membership.html', 'site/templates/tokushoho.html', 'site/config.json', 'site/build.mjs')) {
    $co = & git checkout -- $f 2>&1
    if ($LASTEXITCODE -ne 0) {
      Log "  ★ 戻せませんでした: $f"
      Log "    $co"
      Log '    **戻せないなら、進んではいけません。**'
      exit 1
    }
    Log "  元に戻しました: $f"
  }

  Log ''
  $recheck = & node (Join-Path $Root 'auto\membership-gates.mjs') 2>&1 | Out-String
  foreach ($line in ($recheck -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

  Log ''
  Log '★ この週の作業は、失敗として記録します。'
  exit 1
}

# ---- 金の出口と、記事の関門も通す ----------------------------------

Log ''
Log '金の出口を確認します'
$money = & node (Join-Path $Root 'auto\money-gates.mjs') 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
  Log '★ 承認されていない金の出口が開いています。'
  foreach ($line in ($money -split "`r?`n" | Where-Object { $_ -match '★開' })) { Log "  $line" }
  & git checkout -- 'site/config.json' 2>&1 | Out-Null
  Log '  元に戻しました: site/config.json'
  exit 1
}

Log ''
Log 'サイトの検査を通します'
$verify = & node (Join-Path $Root 'site\verify.mjs') 2>&1 | Out-String
foreach ($line in ($verify -split "`r?`n" | Where-Object { $_ -match '✗|検証を通過|公開を中止' })) { Log "  $line" }

if ($LASTEXITCODE -ne 0) {
  Log ''
  Log '★ サイトの検査に落ちました。'
  exit 1
}

Log ''
Log "ログ: $LogFile"
Log '完了'
