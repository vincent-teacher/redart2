# 使用 Windows 內建 OCR（zh-Hant-TW）辨識圖片文字
# 參數：清單檔（每行：圖片路徑<TAB>輸出 json 路徑）
param([string]$ListFile)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$type) {
    $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
    $t.Wait(-1) | Out-Null
    $t.Result
}

$lang = New-Object Windows.Globalization.Language 'zh-Hant-TW'
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if ($null -eq $engine) { Write-Host '無法建立繁體中文 OCR 引擎'; exit 1 }

$items = Get-Content -LiteralPath $ListFile -Encoding UTF8 | Where-Object { $_.Trim() -ne '' }
$i = 0
foreach ($row in $items) {
    $i++
    $parts = $row -split "`t"
    $img = $parts[0]; $out = $parts[1]
    try {
        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($img)) ([Windows.Storage.StorageFile])
        $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
        $lines = @()
        foreach ($ln in $res.Lines) {
            # 中文字之間的空白去掉，英數保留
            $t = ($ln.Words | ForEach-Object { $_.Text }) -join ' '
            $t = [regex]::Replace($t, '(?<=[　-鿿＀-￯]) (?=[　-鿿＀-￯0-9])|(?<=[0-9]) (?=[　-鿿＀-￯])', '')
            $lines += $t
        }
        $stream.Dispose()
        $json = @{ lines = $lines } | ConvertTo-Json -Compress
        [System.IO.File]::WriteAllText($out, $json, (New-Object System.Text.UTF8Encoding $false))
        Write-Host ("  OCR {0}/{1} {2} 行" -f $i, $items.Count, $lines.Count)
    } catch {
        Write-Host ("  OCR 失敗：{0} {1}" -f $img, $_.Exception.Message)
    }
}
