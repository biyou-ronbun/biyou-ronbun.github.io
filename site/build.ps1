# サイトをビルドする。
#
#   powershell -ExecutionPolicy Bypass -File site\build.ps1
#
# 中身は site\build.mjs（Node）です。ここは呼び出すだけのラッパーです。
# ビルドの本体を2つ持つと必ず食い違うので、本体は build.mjs 1つだけにしています。
#
# GitHub に push したときも、GitHub のサーバー上で同じ build.mjs が動きます。

$ErrorActionPreference = 'Stop'
$SiteDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node が見つかりません。PowerShell を開き直すか、https://nodejs.org からインストールしてください。'
  exit 1
}

node (Join-Path $SiteDir 'build.mjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output ''
Write-Output 'プレビュー: site\dist\index.html をブラウザで開いてください。'
