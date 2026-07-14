# 「海外の学術誌の新着」を、Windows のタスクスケジューラに登録する。
#
# ★ 1回だけ実行してください。管理者権限は不要です。
#
#     powershell -ExecutionPolicy Bypass -File e:\claude\auto\register-journal-task.ps1
#
# 登録されるもの:
#   毎週 金曜 7:00  →  auto\journal.ps1
#
#   海外10誌（J Am Acad Dermatol / Br J Dermatol / JAMA Dermatol /
#   J Invest Dermatol / Int J Cosmet Sci / J Cosmet Dermatol ほか）の
#   新着を PubMed から拾い、ネタ帳（topics.json）に足すかどうかを決める。
#
#   ★ 記事は書かない。書いたら git で戻す。
#     「新着を翻訳して要約して記事にする」は、他人の情報を右から左に流すこと。
#     Google のスパムポリシーは「AIで価値を加えないページの大量生成」を禁じている。
#
#   ★ RCT・メタ解析・撤回が1本も無ければ、Claude を呼ばずに終わる。
#     「今週は何も無かった」が、最も多い正解。
#
#   ★ 金曜 7:00 は、記事の輪（金 9:00）の2時間前。
#     同じ日に、ネタ帳の更新が活きる。

$ErrorActionPreference = 'Stop'

$Name = '美容論文ブログ 海外の学術誌の新着'
$Script = 'e:\claude\auto\journal.ps1'

if (-not (Test-Path $Script)) {
  Write-Output "中止: $Script が見つかりません"
  exit 1
}

$Action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $Script)

$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 7:00am

$Settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
  -TaskName $Name `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description '海外10誌の新着を PubMed から拾い、ネタ帳に足すかどうかを決める。記事は書かない（書いたら git で戻す）。RCT・メタ解析・撤回が無ければ Claude を呼ばずに終わる。' `
  -Force | Out-Null

Write-Output "登録しました: $Name"
$info = Get-ScheduledTaskInfo -TaskName $Name
Write-Output ("次回の実行: {0}" -f $info.NextRunTime)
