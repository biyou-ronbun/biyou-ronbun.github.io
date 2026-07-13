# 「他メディアの研究」を、Windows のタスクスケジューラに登録する。
#
# ★ 1回だけ実行してください。管理者権限は不要です。
#
#     powershell -ExecutionPolicy Bypass -File e:\claude\auto\register-benchmark-task.ps1
#
# 登録されるもの:
#   毎週 火曜 8:00  →  auto\benchmark.ps1
#
#   他の美容メディア（@cosme / LIPS / MimiTV / 美的 / Lab Muffin …）を研究し、
#   サイトを **1つだけ** 直す。
#
#   ★ 他メディアの型（ランキング / 成分辞典 / 商品DB / 診断→おすすめ /
#     点数・星 / メール会員登録）を持ち帰ったら、**git で元に戻す。**

$ErrorActionPreference = 'Stop'

$Name = '美容論文ブログ 他メディアの研究'
$Script = 'e:\claude\auto\benchmark.ps1'

if (-not (Test-Path $Script)) {
  Write-Output "中止: $Script が見つかりません"
  exit 1
}

$Action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $Script)

$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Tuesday -At 8:00am

$Settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName $Name `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description '他メディアを研究し、サイトを1つだけ直す。他メディアの型（ランキング・成分辞典・商品DB・診断・点数・メール登録）を持ち帰ったら git で戻す。' `
  -Force | Out-Null

Write-Output "登録しました: $Name"
$info = Get-ScheduledTaskInfo -TaskName $Name
Write-Output ("次回の実行: {0}" -f $info.NextRunTime)
