# ---------------------------------------------------------------
#  記事ごとの OGP 画像を作る
#
#      powershell -ExecutionPolicy Bypass -File site\ogp.ps1
#
#  出力: site\assets\ogp\<スラッグ>.jpg （1200 x 630）
#
#  X やはてなブックマークに記事URLを貼ったとき、リンクカードに出る画像です。
#  これが無いと、テキストだけの弱いカードになります。
#
#  記事が増えるたびに、無い分だけ作り足します（既存は作り直しません）。
#  auto\run.ps1 から自動で呼ばれます。
#
#  ※ サイトと同じ配色・明朝。煽らない。中身と表紙が食い違わないようにする。
# ---------------------------------------------------------------

Add-Type -AssemblyName System.Drawing

$SiteDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutDir  = Join-Path $SiteDir 'assets\ogp'
$W = 1200
$H = 630

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }

$cfg  = Get-Content (Join-Path $SiteDir 'config.json')   -Raw -Encoding UTF8 | ConvertFrom-Json
$meta = Get-Content (Join-Path $SiteDir 'articles.json') -Raw -Encoding UTF8 | ConvertFrom-Json

# --- 色（style.css と同じ） ---
$bg   = [System.Drawing.Color]::FromArgb(250, 247, 244)
$ink  = [System.Drawing.Color]::FromArgb(46, 39, 36)
$soft = [System.Drawing.Color]::FromArgb(107, 97, 91)
$mute = [System.Drawing.Color]::FromArgb(156, 145, 138)
$gold = [System.Drawing.Color]::FromArgb(201, 179, 145)

$serif = 'Yu Mincho'
$installed = New-Object System.Drawing.Text.InstalledFontCollection
$names = $installed.Families | ForEach-Object { $_.Name }
if ($names -notcontains $serif) {
  if ($names -contains 'MS Mincho') { $serif = 'MS Mincho' } else { $serif = 'MS Gothic' }
}

$codec  = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 90L)

# 日本語は単語で折り返せないので、幅を測りながら1文字ずつ積む
function WrapText($graphics, $text, $font, $maxWidth) {
  $lines = New-Object System.Collections.ArrayList
  $line = ''
  foreach ($ch in $text.ToCharArray()) {
    $try = $line + $ch
    $w = $graphics.MeasureString($try, $font).Width
    if ($w -gt $maxWidth -and $line.Length -gt 0) {
      [void]$lines.Add($line)
      $line = [string]$ch
    } else {
      $line = $try
    }
  }
  if ($line.Length -gt 0) { [void]$lines.Add($line) }
  return $lines
}

$made = 0
$skipped = 0

# トップページ用（サイト名とキャッチコピー）
$homeOut = Join-Path $OutDir '_home.jpg'
if (-not (Test-Path $homeOut)) {
  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear($bg)

  $bInk  = New-Object System.Drawing.SolidBrush($ink)
  $bMute = New-Object System.Drawing.SolidBrush($mute)
  $pGold = New-Object System.Drawing.Pen($gold, 2)

  $g.DrawRectangle($pGold, 28, 28, ($W - 56), ($H - 56))

  $fBig  = New-Object System.Drawing.Font($serif, 72, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fLead = New-Object System.Drawing.Font($serif, 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

  $center = New-Object System.Drawing.StringFormat
  $center.Alignment = [System.Drawing.StringAlignment]::Center

  $g.DrawString($cfg.title, $fBig, $bInk, ($W / 2), 230, $center)
  $g.DrawLine($pGold, ($W / 2 - 50), 350, ($W / 2 + 50), 350)
  $g.DrawString($cfg.tagline, $fLead, $bMute, ($W / 2), 400, $center)

  $bmp.Save($homeOut, $codec, $params)
  $g.Dispose(); $bmp.Dispose()
  Write-Output '  作成: _home.jpg  (トップページ用)'
  $made++
} else { $skipped++ }

foreach ($a in $meta) {
  $out = Join-Path $OutDir ($a.slug + '.jpg')
  if (Test-Path $out) { $skipped++; continue }

  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear($bg)

  $bInk  = New-Object System.Drawing.SolidBrush($ink)
  $bSoft = New-Object System.Drawing.SolidBrush($soft)
  $bMute = New-Object System.Drawing.SolidBrush($mute)
  $pGold = New-Object System.Drawing.Pen($gold, 2)

  # 外枠
  $g.DrawRectangle($pGold, 28, 28, ($W - 56), ($H - 56))

  # タイトルは長さに応じて縮める
  $size = 46
  if ($a.title.Length -gt 28) { $size = 40 }
  if ($a.title.Length -gt 38) { $size = 34 }
  $fTitle = New-Object System.Drawing.Font($serif, $size, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fSub   = New-Object System.Drawing.Font($serif, 26, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fSite  = New-Object System.Drawing.Font($serif, 24, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

  $margin = 90
  $maxW   = $W - ($margin * 2)

  $lines = WrapText $g $a.title $fTitle $maxW
  $lh = [int]($size * 1.65)

  # タイトルの塊を上下中央に置く（サブタイトルとサイト名の分を差し引く）
  $blockH = ($lines.Count * $lh)
  $y = [int](($H - $blockH) / 2) - 60

  foreach ($ln in $lines) {
    $g.DrawString($ln, $fTitle, $bInk, $margin, $y)
    $y += $lh
  }

  # サブタイトル
  if ($a.subtitle) {
    $y += 14
    $subLines = WrapText $g $a.subtitle $fSub $maxW
    foreach ($ln in $subLines) {
      $g.DrawString($ln, $fSub, $bMute, $margin, $y)
      $y += 40
    }
  }

  # 下の金の線とサイト名
  $g.DrawLine($pGold, $margin, ($H - 118), ($margin + 60), ($H - 118))
  $g.DrawString($cfg.title, $fSite, $bSoft, $margin, ($H - 100))

  $bmp.Save($out, $codec, $params)
  $g.Dispose()
  $bmp.Dispose()

  Write-Output ("  作成: {0}.jpg  ({1})" -f $a.slug, $a.title)
  $made++
}

Write-Output ''
Write-Output ("OGP画像: {0} 枚を新規作成、{1} 枚は既にありました" -f $made, $skipped)
