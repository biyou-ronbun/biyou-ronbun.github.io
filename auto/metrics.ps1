# ---------------------------------------------------------------
#  PV と収益を、公式APIから取ってくる
#
#  Windows のタスクスケジューラから、月曜の朝8時に呼ばれます。
#  手で試すとき（ファイルを書かずに中身だけ見る）:
#      node auto\collect-metrics.mjs --dry
#
#  鍵が auto\.env に無ければ、何もせずに終わります（エラーにはしません）。
#
#  ログ: auto\logs\metrics-<日付>.log
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir = Join-Path $Root 'auto\logs'
$Log    = Join-Path $LogDir ("metrics-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }

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


$stamp = Get-Date -Format 'HH:mm:ss'
$out = & node (Join-Path $Root 'auto\collect-metrics.mjs') 2>&1 | Out-String

Add-Content -Path $Log -Value "[$stamp] ----------------------------------------" -Encoding UTF8
Add-Content -Path $Log -Value $out -Encoding UTF8

Write-Output $out

# ops/ は .gitignore 済み（＝ push されない）。数値は公開しません。
# ここで git を触る必要はありません。
