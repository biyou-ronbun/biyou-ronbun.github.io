# ---------------------------------------------------------------
#  はてなブログに、紹介記事を自動で公開する
#
#  Windows のタスクスケジューラから、2日に1回・朝8時30分に呼ばれます。
#  手で試したいときは:
#
#      powershell -ExecutionPolicy Bypass -File e:\claude\auto\hatena.ps1
#
#  やること:
#    1. サイトの検査（verify.mjs）を通す
#    2. 紹介記事を作り直す（site/syndicate.mjs）
#    3. まだ出していないものを1本、はてなに**公開**する
#
#  ---------------------------------------------------------------
#  ★ 歯止め
#
#  1. **2日に1本まで。**
#     10本を一気に投げると、それ自体が「量産」に見えます。
#     Google の「AI で価値を加えないページの大量生成」は、
#     うちが最も避けるべきものです。
#
#  2. **サイトの検査が通らない日は、出しません。**
#     verify.mjs が止めた記事は、サイトに出せません。
#     サイトに出せないものを、よそに出すわけにはいきません。
#
#  3. **全文は載せません。**
#     site/syndicate.mjs が作るのは紹介記事だけ（元記事の16〜30%）。
#     同じ本文が2か所にあると、Google はどちらか一方しか出しません。
#     うちのドメインは新しく、はてなは巨大です。**負けます。**
#
#  4. **紹介記事にも関門があります。**
#     薬機法・煽り・言い過ぎ・読者を主語にしていないか。
#     はてなに出した文は、こちらから直せません。だから出す前に止めます。
#  ---------------------------------------------------------------
#
#  ログは auto\logs\ に残ります。
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root    = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir  = Join-Path $Root 'auto\logs'
$Stamp   = Get-Date -Format 'yyyy-MM-dd_HHmm'
$LogFile = Join-Path $LogDir "hatena_$Stamp.log"

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
Log 'はてなブログに紹介記事を公開します'
Log '=========================================='

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Log '中止: node が見つかりません'
  exit 1
}

# ---- 1. サイトの検査を通す --------------------------------------
#
# ここで落ちたら、記事に何か問題があります。
# サイトに出せないものを、はてなに出すわけにはいきません。

Log 'サイトの検査（verify.mjs）を通します'
$verify = & node (Join-Path $Root 'site\verify.mjs') 2>&1 | Out-String
$verifyOk = ($LASTEXITCODE -eq 0)

foreach ($line in ($verify -split "`r?`n" | Where-Object { $_ -match '✗|検証を通過|公開を中止' })) {
  Log "  $line"
}

if (-not $verifyOk) {
  Log ''
  Log '★ サイトの検査に落ちました。はてなには出しません。'
  Log '  サイトに出せないものを、よそに出すわけにはいきません。'
  exit 1
}

# ---- 2. 紹介記事を作り直す --------------------------------------

Log ''
Log '紹介記事を作り直します'
$synd = & node (Join-Path $Root 'site\syndicate.mjs') 2>&1 | Out-String
$syndOk = ($LASTEXITCODE -eq 0)

foreach ($line in ($synd -split "`r?`n" | Where-Object { $_ -match '✗|本を output' })) {
  Log "  $line"
}

if (-not $syndOk) {
  Log ''
  Log '★ 紹介記事の関門に落ちました。はてなには出しません。'
  Log '  はてなに出した文は、こちらから直せません。だから出す前に止めます。'
  exit 1
}

# ---- 3. 1本だけ公開する ------------------------------------------

Log ''
Log 'はてなに公開します（1本だけ）'

$out = & node (Join-Path $Root 'auto\post-hatena.mjs') --publish 2>&1 | Out-String

foreach ($line in ($out -split "`r?`n")) {
  if ($line.Trim()) { Log "  $line" }
}

if ($LASTEXITCODE -ne 0) {
  Log ''
  Log '★ 投稿に失敗しました。上の報告を読んでください。'
  exit 1
}

Log ''
Log "ログ: $LogFile"
Log '完了'
