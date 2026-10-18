param(
    [string]$DataRoot = 'D:\Documents\OLPAI\output\shareable\De_1_Lay_diem_chac\dataset_cv'
)

# Read participant train/validation only. Generate descriptive quality measurements
# and contact sheets; no model predictions, test labels or training are involved.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
if (-not ('CvReportImageStats' -as [type])) {
    Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
public static class CvReportImageStats {
    public static double[] Read(string path) {
        using (var bitmap = new Bitmap(path)) {
            double sum = 0;
            long dark = 0, bright = 0;
            for (int y = 0; y < bitmap.Height; y++) {
                for (int x = 0; x < bitmap.Width; x++) {
                    var pixel = bitmap.GetPixel(x, y);
                    double value = 0.2126 * pixel.R + 0.7152 * pixel.G + 0.0722 * pixel.B;
                    sum += value;
                    if (value < 40) dark++;
                    if (value > 220) bright++;
                }
            }
            double count = (double)bitmap.Width * bitmap.Height;
            return new double[] {bitmap.Width, bitmap.Height, sum / count, dark / count, bright / count};
        }
    }
}
'@
}

$trainingRows = @(Import-Csv -LiteralPath (Join-Path $DataRoot 'train.csv'))
$validationRows = @(Import-Csv -LiteralPath (Join-Path $DataRoot 'validation.csv'))
$records = foreach ($split in @('train', 'validation')) {
    $rows = if ($split -eq 'train') { $trainingRows } else { $validationRows }
    foreach ($row in $rows) {
        if ([int]$row.label -in @(16, 34)) {
            $stats = [CvReportImageStats]::Read((Join-Path $DataRoot $row.image))
            [pscustomobject]@{
                split = $split
                sample_id = $row.sample_id
                label = [int]$row.label
                width = $stats[0]
                height = $stats[1]
                mean_luma = $stats[2]
                fraction_luma_lt40 = $stats[3]
                fraction_luma_gt220 = $stats[4]
            }
        }
    }
}
$records | Export-Csv -LiteralPath (Join-Path $PSScriptRoot 'class16_34_image_quality.csv') -NoTypeInformation -Encoding UTF8
$summary = @($records | Group-Object split, label | ForEach-Object {
    [pscustomobject]@{
        group = $_.Name
        count = $_.Count
        mean_luma_min = ($_.Group.mean_luma | Measure-Object -Minimum).Minimum
        mean_luma_max = ($_.Group.mean_luma | Measure-Object -Maximum).Maximum
        images_mean_luma_lt60 = @($_.Group | Where-Object { $_.mean_luma -lt 60 }).Count
        images_mean_luma_gt150 = @($_.Group | Where-Object { $_.mean_luma -gt 150 }).Count
    }
})
[pscustomobject]@{
    source = (Resolve-Path -LiteralPath $DataRoot).Path
    luma = '0.2126R + 0.7152G + 0.0722B on encoded RGB, range 0-255; whole-image descriptive proxy, not physical exposure'
    thresholds = 'Mean luma <60 and >150 are descriptive only, not tuned inference thresholds'
    groups = $summary
    predictions = 'Unavailable per sample; quality groups cannot be identified with notebook errors'
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'image_quality_summary.json') -Encoding UTF8

foreach ($classId in @(16, 34)) {
    $trainClass = @($trainingRows | Where-Object { [int]$_.label -eq $classId })
    $validClass = @($validationRows | Where-Object { [int]$_.label -eq $classId })
    $pickedTrain = @(for ($index = 0; $index -lt 16; $index++) {
        $trainClass[[int][Math]::Floor($index * $trainClass.Count / 16)]
    })
    $samples = @($pickedTrain) + @($validClass)
    $canvas = New-Object System.Drawing.Bitmap(1120, 1460)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $font = New-Object System.Drawing.Font('Arial', 9)
    $titleFont = New-Object System.Drawing.Font('Arial', 13)
    try {
        $graphics.Clear([System.Drawing.Color]::White)
        $title = "CLASS $classId | first 16 = TRAIN | next 60 = ALL VALIDATION | ground truth; predictions unavailable"
        $graphics.DrawString($title, $titleFont, [System.Drawing.Brushes]::Black, 10, 8)
        for ($index = 0; $index -lt $samples.Count; $index++) {
            $row = $samples[$index]
            $left = ($index % 8) * 140
            $top = 45 + [Math]::Floor($index / 8) * 140
            $sourceImage = [System.Drawing.Image]::FromFile((Join-Path $DataRoot $row.image))
            try {
                $ratio = [Math]::Min(120.0 / $sourceImage.Width, 100.0 / $sourceImage.Height)
                $graphics.DrawImage($sourceImage, [int]($left + 10), [int]$top,
                    [int]($sourceImage.Width * $ratio), [int]($sourceImage.Height * $ratio))
                $splitName = if ($index -lt 16) { 'train' } else { 'valid' }
                $label = "$splitName $($sourceImage.Width)x$($sourceImage.Height)`n$($row.sample_id)"
                $graphics.DrawString($label, $font, [System.Drawing.Brushes]::Black,
                    [int]($left + 4), [int]($top + 102))
            } finally {
                $sourceImage.Dispose()
            }
        }
        $canvas.Save((Join-Path $PSScriptRoot "class_${classId}_train_validation.png"),
            [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $font.Dispose()
        $titleFont.Dispose()
        $graphics.Dispose()
        $canvas.Dispose()
    }
}
$summary | ConvertTo-Json
