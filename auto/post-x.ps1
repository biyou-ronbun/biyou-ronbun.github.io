# ---------------------------------------------------------------
#  X への自動投稿
#
#  Windows のタスクスケジューラから、1時間おきに呼ばれます。
#  x\queue.json を見て、予定時刻を過ぎた投稿だけを出します。
#
#  手で試すとき（投稿せずに中身だけ見る）:
#      node auto\post-x.mjs --dry
#
#  ログ: auto\logs\x-<日付>.log
# ---------------------------------------------------------------

$ErrorActionPreference = 'Continue'

$Root   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$LogDir = Join-Path $Root 'auto\logs'
$Log    = Join-Path $LogDir ("x-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }

# タスクスケジューラから呼ばれると PATH が最小構成なので、読み直す
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

Set-Location $Root

# ★ Node は UTF-8 で出力します。PowerShell は既定で Shift-JIS(CP932) として読みます。
#   これを直さないと、**ファイルに書く前の時点で、日本語がすでに壊れています。**
#   （-Encoding UTF8 を付けても手遅れです。壊れた文字列を UTF-8 で保存するだけ）
#
#   ★ これはただの見た目の問題ではありません。
#     **投稿が関門（verify-x.mjs）に拒否されたとき、その理由が読めなくなります。**
#     実際に「蜃ｺ縺吩ｺ亥ｮ壹・謚慕ｨｿ縺ｯ縺ゅｊ縺ｾ縺帙ｓ」という状態のまま、数日間動いていました。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$stamp = Get-Date -Format 'HH:mm:ss'
$out = & node (Join-Path $Root 'auto\post-x.mjs') 2>&1 | Out-String

Add-Content -Path $Log -Value "[$stamp] ----------------------------------------" -Encoding UTF8
Add-Content -Path $Log -Value $out.TrimEnd() -Encoding UTF8

Write-Output $out.TrimEnd()
