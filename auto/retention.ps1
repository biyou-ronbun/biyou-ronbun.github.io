# ---------------------------------------------------------------
#  配信の購読者を増やす（毎週）
#
#  Windows のタスクスケジューラから、毎週木曜の 8時に呼ばれます。
#  手で試したいときは:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\retention.ps1
#
#  ---------------------------------------------------------------
#  ★★ この輪の名前は「リピーターを増やす」ですが、
#     **コンテンツは1つも作りません。**
#
#  ★ 調査の結論（商品を勧めない媒体を4つ、実際に開いて調べた）
#
#    **再訪の理由が、コンテンツの中にあった例はゼロ。**
#    観測できたのは ①配信（push） ②読者自身の次の疑問 の2つだけ。
#
#    > **「読者が喜ぶページを1枚足す」は、再訪の打ち手ではありません。**
#
#  ★ そして、うちは再訪を測れません
#
#    解析は Cookie を使いません（同意バナーを出さないため）。
#    **Cookie が無ければ、同じ人が戻ってきたことは原理的に分かりません。**
#    **測れない数字を改善目標にすると、機械は必ず数字を捏造します。**
#
#    だから目標は「再訪率」ではなく「配信の購読者数」。**これは測れます。**
#
#  ★★ この輪が、いちばん暴走しやすい
#
#    「リピーターを増やすコンテンツを毎週作れ」と命じられた機械は、必ずこうします。
#
#      ・2個目の診断・クイズを作る
#      ・ゲーミフィケーション（ポイント・バッジ・レベル・連続記録）
#      ・通知をねだる
#      ・煽る（「毎日更新中!」「見逃さないで」）
#      ・購読者の数を捏造する（「1,200人が読者」）
#
#    **全部、却下済みです。**
#    auto/retention-gates.mjs が、作業の前と後に検査します。
#    越えたら、git で元に戻します。
#
#  ★ 「今週は何もしませんでした」が、正しい仕事です。
#    何かをしなければと思った瞬間、2個目の診断を作り始めます。
#  ---------------------------------------------------------------
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "retention_$Stamp.log"

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
Log '配信の購読者を調べます（毎週）'
Log '=========================================='

foreach ($cmd in @('node', 'claude', 'git')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Log "中止: $cmd が見つかりません"
    exit 1
  }
}

# ---- 作業の前に、越えていないか見る ------------------------------

Log '作業の前に、確認します'
$before = & node (Join-Path $Root 'auto\retention-gates.mjs') 2>&1 | Out-String
$beforeOk = ($LASTEXITCODE -eq 0)
foreach ($line in ($before -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

if (-not $beforeOk) {
  Log ''
  Log '★ 作業の前から、線を越えています。誰かが越えました。'
  Log '  今回は何もせずに終わります。'
  exit 1
}

# ---- ファンを測る --------------------------------------------------
#
# ★★ 再訪率は測れない。Cookie を使っていないので、同じ人が戻ったか原理的に分からない。
#   **測れない数字を目標にすると、機械は必ず数字を捏造する。**
#
# ★ 測れるのは「フォロワー数」と「購読者数」。**これを目標にする。**

Log ''
Log 'フォロワーを測ります（★ 再訪率は、Cookie を使っていないので測れません）'
$xm = & node (Join-Path $Root 'auto\x-metrics.mjs') 2>&1 | Out-String
foreach ($line in ($xm -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

Log ''
Log '購読者を測ります'
$push = & node (Join-Path $Root 'auto\push-metrics.mjs') 2>&1 | Out-String
foreach ($line in ($push -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

Log ''
Log 'PV・収益を測ります'
$cm = & node (Join-Path $Root 'auto\collect-metrics.mjs') 2>&1 | Out-String
foreach ($line in ($cm -split "`r?`n" | Where-Object { $_ -match 'PV|訪問|検索|売上|サブスク|取得失敗' })) { Log "  $line" }

# ---- 調べさせる ---------------------------------------------------

Log ''
Log '調べさせます（★ 人はなぜファンになるのか。実例で）'
Log ''

$prompt = Get-Content (Join-Path $Root 'auto\retention-prompt.md') -Raw -Encoding UTF8

$tools = 'Read Write Edit Glob Grep Bash TodoWrite'

$out = & claude -p $prompt --allowed-tools $tools --permission-mode acceptEdits 2>&1 | Out-String

Log '---------- 報告 ----------'
foreach ($line in ($out -split "`r?`n")) { Log $line }
Log '--------------------------'

# ---- ★ 作業の後に、線を越えていないか見る --------------------------

Log ''
Log '★ 作業の後に、確認します'
$after = & node (Join-Path $Root 'auto\retention-gates.mjs') 2>&1 | Out-String
$afterOk = ($LASTEXITCODE -eq 0)
foreach ($line in ($after -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

if (-not $afterOk) {
  Log ''
  Log '=========================================='
  Log '★★ エージェントが、線を越えました。元に戻します。'
  Log '=========================================='
  Log ''
  Log '  「リピーターを増やせ」と命じられた機械は、必ずここに手を伸ばします。'
  Log '  2個目の診断を作る。ポイントを配る。通知をねだる。煽る。'
  Log ''
  Log '  **調査の結論: 再訪の理由が、コンテンツの中にあった例はゼロ。**'
  Log '  **作れるのは配信（push）だけ。ページを1枚足しても、誰も戻ってきません。**'
  Log ''

  # 新しく作られたテンプレートを消す
  $known = @('layout.html','home.html','card.html','article.html','about.html','privacy.html',
             'contact.html','membership.html','tokushoho.html','cta.html','check.html',
             'news.html','404.html','verified-en.html')
  Get-ChildItem (Join-Path $Root 'site\templates') -Filter *.html | ForEach-Object {
    if ($known -notcontains $_.Name) {
      Remove-Item $_.FullName -Force
      Log "  消しました（勝手に作られたページ）: $($_.Name)"
    }
  }

  foreach ($f in @('site/templates', 'site/build.mjs')) {
    $co = & git checkout -- $f 2>&1
    if ($LASTEXITCODE -ne 0) {
      Log "  ★ 戻せませんでした: $f"
      Log '    **戻せないなら、進んではいけません。**'
      exit 1
    }
    Log "  元に戻しました: $f"
  }

  Log ''
  $recheck = & node (Join-Path $Root 'auto\retention-gates.mjs') 2>&1 | Out-String
  foreach ($line in ($recheck -split "`r?`n" | Where-Object { $_.Trim() })) { Log "  $line" }

  Log ''
  Log '★ この週の作業は、失敗として記録します。'
  exit 1
}

# ---- サイトの検査 --------------------------------------------------

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
