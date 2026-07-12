# ---------------------------------------------------------------
#  X に貼る「数字の画像」を作る
#
#      powershell -ExecutionPolicy Bypass -File site\xcards.ps1
#
#  定義: x\cards.json
#  出力: x\cards\<スラッグ>.jpg （1200 x 675）
#
#  なぜ作るか:
#    X ではテキストだけのポストより、画像付きのほうが圧倒的に伸びます。
#    そして、このブログの武器は「論文の数字」です。
#    その数字を、そのまま1枚の画像にすれば、他の美容アカウントには作れない弾になります。
#
#  ★ 画像だけが独り歩きします。出典を必ず入れること。
#    出典のない数字を出したら、このブログが批判しているものと同じになります。
# ---------------------------------------------------------------

Add-Type -AssemblyName System.Drawing

$SiteDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root    = Split-Path -Parent $SiteDir
$OutDir  = Join-Path $Root 'x\cards'
$W = 1200
$H = 675

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }

$cfg  = Get-Content (Join-Path $SiteDir 'config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$data = Get-Content (Join-Path $Root 'x\cards.json')   -Raw -Encoding UTF8 | ConvertFrom-Json

# --- 色（style.css と同じ） ---
$bg    = [System.Drawing.Color]::FromArgb(250, 247, 244)
$card  = [System.Drawing.Color]::FromArgb(255, 253, 252)
$ink   = [System.Drawing.Color]::FromArgb(46, 39, 36)
$soft  = [System.Drawing.Color]::FromArgb(107, 97, 91)
$mute  = [System.Drawing.Color]::FromArgb(156, 145, 138)
$gold  = [System.Drawing.Color]::FromArgb(201, 179, 145)
$track = [System.Drawing.Color]::FromArgb(239, 231, 224)
# データの色は、色覚多様性とコントラストの検証を通した値だけを使う
$c1    = [System.Drawing.Color]::FromArgb(156, 79, 71)    # 深いローズ
$c2    = [System.Drawing.Color]::FromArgb(58, 110, 165)   # 青
$off   = [System.Drawing.Color]::FromArgb(185, 172, 163)

$serif = 'Yu Mincho'
$sans  = 'Yu Gothic'
$inst  = New-Object System.Drawing.Text.InstalledFontCollection
$names = $inst.Families | ForEach-Object { $_.Name }
if ($names -notcontains $serif) { $serif = if ($names -contains 'MS Mincho') { 'MS Mincho' } else { 'MS Gothic' } }
if ($names -notcontains $sans)  { $sans  = 'MS Gothic' }

$codec  = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 92L)

function WrapText($g, $text, $font, $maxWidth) {
  $lines = New-Object System.Collections.ArrayList
  $line = ''
  foreach ($ch in $text.ToCharArray()) {
    $try = $line + $ch
    if ($g.MeasureString($try, $font).Width -gt $maxWidth -and $line.Length -gt 0) {
      [void]$lines.Add($line); $line = [string]$ch
    } else { $line = $try }
  }
  if ($line.Length -gt 0) { [void]$lines.Add($line) }
  return $lines
}

$made = 0

foreach ($c in $data.cards) {
  $out = Join-Path $OutDir ($c.slug + '.jpg')

  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear($bg)

  $bInk   = New-Object System.Drawing.SolidBrush($ink)
  $bSoft  = New-Object System.Drawing.SolidBrush($soft)
  $bMute  = New-Object System.Drawing.SolidBrush($mute)
  $bC1    = New-Object System.Drawing.SolidBrush($c1)
  $bC2    = New-Object System.Drawing.SolidBrush($c2)
  $bTrack = New-Object System.Drawing.SolidBrush($track)
  $bCard  = New-Object System.Drawing.SolidBrush($card)
  $pGold  = New-Object System.Drawing.Pen($gold, 2)
  $pRef   = New-Object System.Drawing.Pen($mute, 2)
  $pRef.DashStyle = 'Dash'
  $pC1    = New-Object System.Drawing.Pen($c1, 2)
  $pOff   = New-Object System.Drawing.Pen($off, 2)

  $fTitle = New-Object System.Drawing.Font($serif, 38, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fUnit  = New-Object System.Drawing.Font($sans,  20, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fLabel = New-Object System.Drawing.Font($sans,  22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fValue = New-Object System.Drawing.Font($sans,  24, [System.Drawing.FontStyle]::Bold,    [System.Drawing.GraphicsUnit]::Pixel)
  $fCell  = New-Object System.Drawing.Font($sans,  21, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fSrc   = New-Object System.Drawing.Font($sans,  18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fSite  = New-Object System.Drawing.Font($serif, 20, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

  $M = 60
  $g.FillRectangle($bCard, $M, $M, ($W - $M * 2), ($H - $M * 2))
  $g.DrawRectangle($pGold, $M, $M, ($W - $M * 2), ($H - $M * 2))

  $x = $M + 44
  $maxW = $W - ($M * 2) - 88
  $y = $M + 40

  # --- 見出し ---
  foreach ($ln in (WrapText $g $c.title $fTitle $maxW)) {
    $g.DrawString($ln, $fTitle, $bInk, $x, $y)
    $y += 54
  }

  if ($c.unit) {
    $y += 6
    $g.DrawString($c.unit, $fUnit, $bMute, $x, $y)
    $y += 34
  }

  $g.DrawLine($pGold, $x, $y, ($x + 50), $y)
  $y += 30

  # --- 中身 ---
  if ($c.type -eq 'bar') {

    $labelW = 260
    $valueW = 110
    $barX   = $x + $labelW + 16
    $barW   = $maxW - $labelW - $valueW - 32
    $rowH   = [int](260 / [Math]::Max($c.rows.Count, 1))
    if ($rowH -gt 60) { $rowH = 60 }
    $barH   = 26

    foreach ($r in $c.rows) {
      $cy = $y + [int](($rowH - $barH) / 2)

      $g.DrawString($r.label, $fLabel, $bSoft, $x, ($cy + 1))
      $g.FillRectangle($bTrack, $barX, $cy, $barW, $barH)

      # ★ $w という名前は使わないこと。PowerShell は大文字小文字を区別しないので、
      #   画像の幅 $W を上書きしてしまう（実際にこれで画像が3px幅になった）
      $fillW = [int]($barW * ($r.value / $c.max))
      if ($fillW -lt 3) { $fillW = 3 }

      if ($r.pending) {
        # 値が確定していないもの（「観察期間内に戻らなかった」）は塗りを変える
        $g.DrawRectangle($pC1, $barX, $cy, $fillW, $barH)
        for ($i = 0; $i -lt $fillW; $i += 10) {
          $g.DrawLine($pC1, ($barX + $i), ($cy + $barH), ($barX + $i + $barH), $cy)
        }
      } else {
        $g.FillRectangle($bC1, $barX, $cy, $fillW, $barH)
      }

      $g.DrawString($r.display, $fValue, $bInk, ($barX + $barW + 14), $cy)
      $y += $rowH
    }

    if ($c.ref) {
      $rx = $barX + [int]($barW * ($c.ref.value / $c.max))
      $g.DrawLine($pRef, $rx, ($y - ($rowH * $c.rows.Count) - 6), $rx, ($y - 6))
      $g.DrawString($c.ref.label, $fSrc, $bMute, ($rx + 8), ($y - 2))
      $y += 28
    }

  } elseif ($c.type -eq 'matrix') {

    $colW = [int](($maxW - 240) / 2)
    $g.DrawString($c.cols[0], $fCell, $bSoft, ($x + 240), $y)
    $g.DrawString($c.cols[1], $fCell, $bSoft, ($x + 240 + $colW), $y)
    $y += 40

    foreach ($r in $c.rows) {
      $g.DrawString($r.label, $fLabel, $bSoft, $x, $y)

      # 左列（企業資金あり）は塗りつぶし、右列（なし）は白抜き。
      # 色だけに頼らないよう、文字も必ず入れる
      $g.FillEllipse($bC1, ($x + 240), ($y + 6), 12, 12)
      $g.DrawString($r.cells[0], $fCell, $bInk, ($x + 240 + 22), $y)

      $g.DrawEllipse($pOff, ($x + 240 + $colW), ($y + 6), 12, 12)
      $g.DrawString($r.cells[1], $fCell, $bMute, ($x + 240 + $colW + 22), $y)

      $y += 44
    }
    $y += 10

  } else {

    foreach ($r in $c.rows) {
      $g.DrawString($r.label, $fLabel, $bSoft, $x, $y)
      $sz = $g.MeasureString($r.value, $fValue)
      $g.DrawString($r.value, $fValue, $bC1, ($x + $maxW - $sz.Width), ($y - 1))
      $y += 46
    }
    $y += 10
  }

  # --- 出典（必ず入れる） ---
  $srcY = $H - $M - 92
  foreach ($ln in (WrapText $g $c.source $fSrc $maxW)) {
    $g.DrawString($ln, $fSrc, $bMute, $x, $srcY)
    $srcY += 26
  }

  # --- サイト名 ---
  $g.DrawString($cfg.title, $fSite, $bSoft, $x, ($H - $M - 34))
  $sz = $g.MeasureString('biyou-ronbun.com', $fSrc)
  $g.DrawString('biyou-ronbun.com', $fSrc, $bMute, ($W - $M - 44 - $sz.Width), ($H - $M - 30))

  $bmp.Save($out, $codec, $params)
  $g.Dispose(); $bmp.Dispose()

  Write-Output ("  作成: {0}.jpg  ({1})" -f $c.slug, $c.title)
  $made++
}

Write-Output ''
Write-Output ("数字の画像: {0} 枚" -f $made)
Write-Output ("出力先: {0}" -f $OutDir)
