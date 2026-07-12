# ---------------------------------------------------------------
#  Kindle の表紙を作る
#
#      powershell -ExecutionPolicy Bypass -File site\cover.ps1
#
#  出力: site\dist-book\cover.jpg （1600 x 2560、KDP の推奨サイズ）
#
#  サイトと同じ配色にする。派手にしない。
#  中身が「論文を辿る本」なので、表紙が煽っていると中身と食い違う。
# ---------------------------------------------------------------

Add-Type -AssemblyName System.Drawing

$W = 1600
$H = 2560
$Out = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'dist-book\cover.jpg'

$dir = Split-Path -Parent $Out
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }

# --- 色（サイトの style.css と同じ） ---
$bg     = [System.Drawing.Color]::FromArgb(250, 247, 244)  # 温かいベージュ
$ink    = [System.Drawing.Color]::FromArgb(46, 39, 36)     # やわらかい墨
$soft   = [System.Drawing.Color]::FromArgb(107, 97, 91)
$mute   = [System.Drawing.Color]::FromArgb(156, 145, 138)
$gold   = [System.Drawing.Color]::FromArgb(201, 179, 145)  # シャンパンゴールド
$rose   = [System.Drawing.Color]::FromArgb(181, 119, 111)  # くすんだローズ

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear($bg)

# --- 書体 ---
$serifName = 'Yu Mincho'
$installed = New-Object System.Drawing.Text.InstalledFontCollection
$names = $installed.Families | ForEach-Object { $_.Name }
if ($names -notcontains $serifName) {
  if ($names -contains 'MS Mincho') { $serifName = 'MS Mincho' } else { $serifName = 'MS Gothic' }
}
Write-Output "使う書体: $serifName"

$fTitle = New-Object System.Drawing.Font($serifName, 118, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fSub   = New-Object System.Drawing.Font($serifName, 42,  [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fLead  = New-Object System.Drawing.Font($serifName, 50,  [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
# 「0件」はこの本の一番の武器。表紙で一番大きくする
$fNum   = New-Object System.Drawing.Font($serifName, 210, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fAuth  = New-Object System.Drawing.Font($serifName, 50,  [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$bInk  = New-Object System.Drawing.SolidBrush($ink)
$bSoft = New-Object System.Drawing.SolidBrush($soft)
$bMute = New-Object System.Drawing.SolidBrush($mute)
$bRose = New-Object System.Drawing.SolidBrush($rose)
$pGold = New-Object System.Drawing.Pen($gold, 2)

$center = New-Object System.Drawing.StringFormat
$center.Alignment = [System.Drawing.StringAlignment]::Center

function DrawCentered($text, $font, $brush, $y) {
  $g.DrawString($text, $font, $brush, ($W / 2), $y, $center)
}

# --- 外枠 ---
# Amazon の白い背景に置かれるので、本の縁が溶けないように
# いちばん外に墨の細線を入れ、その内側に金の罫線を引く
$pEdge = New-Object System.Drawing.Pen($soft, 3)
$g.DrawRectangle($pEdge, 30, 30, ($W - 60), ($H - 60))
$m = 90
$g.DrawRectangle($pGold, $m, $m, ($W - $m * 2), ($H - $m * 2))

# --- タイトル ---
DrawCentered '出典のある美容' $fTitle $bInk 340

# タイトルの下に、細い金の線を1本
$g.DrawLine($pGold, ($W / 2 - 90), 560, ($W / 2 + 90), 560)

# --- サブタイトル（2行に割る） ---
DrawCentered '美容の「常識」を、論文まで' $fSub $bSoft 650
DrawCentered 'さかのぼって確かめた8つの記録' $fSub $bSoft 716

# --- 中央のリード。この本の一番の武器を、表紙で一番大きく出す ---
DrawCentered '「肌のターンオーバーは28日」' $fLead $bInk 1120
DrawCentered 'を実測した論文は' $fLead $bInk 1194

DrawCentered '0件' $fNum $bRose 1320

DrawCentered 'でした。' $fLead $bInk 1620

# --- 下の細い金の線 ---
$g.DrawLine($pGold, ($W / 2 - 90), 1830, ($W / 2 + 90), 1830)

# --- 立ち位置 ---
DrawCentered '効果は約束しません。' $fSub $bMute 1920
DrawCentered '渡すのは、自分で判断できる目です。' $fSub $bMute 1986

# --- 著者名 ---
DrawCentered '美容論' $fAuth $bInk 2300

# --- 保存（JPEG・品質95） ---
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 95L)
$bmp.Save($Out, $codec, $params)

$g.Dispose()
$bmp.Dispose()

$size = [math]::Round((Get-Item $Out).Length / 1KB, 1)
Write-Output ''
Write-Output "表紙を作りました: $Out"
Write-Output "  サイズ: $W x $H （KDP の推奨サイズ）"
Write-Output "  容量  : $size KB"
