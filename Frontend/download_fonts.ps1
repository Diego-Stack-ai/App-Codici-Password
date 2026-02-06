
$manropeUrl = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
$materialUrl = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"

$userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

function Download-Font-Css-And-Files {
    param (
        [string]$Url,
        [string]$OutputFolder,
        [string]$Prefix
    )

    Write-Host "Processing $Prefix from $Url..."
    
    # 1. Scarica il CSS da Google Fonts (simulando un browser moderno per avere woff2)
    $cssContent = Invoke-WebRequest -Uri $Url -UserAgent $userAgent -UseBasicParsing | Select-Object -ExpandProperty Content
    
    # 2. Estrai i link dei file .woff2
    # Regex per trovare url(https://...)
    $regex = 'src:\s*url\((https://[^)]+)\)\s*format\(''woff2''\)'
    $matches = [regex]::Matches($cssContent, $regex)

    $counter = 0
    $downloadedFiles = @()

    foreach ($match in $matches) {
        $fileUrl = $match.Groups[1].Value
        $fileName = "$Prefix-$counter.woff2"
        $filePath = Join-Path $OutputFolder $fileName
        
        Write-Host "  Downloading $fileName..."
        Invoke-WebRequest -Uri $fileUrl -OutFile $filePath
        
        $downloadedFiles += $fileName
        $counter++
    }

    Write-Host "  Downloaded $counter files to $OutputFolder"
}

# Download Manrope
Download-Font-Css-And-Files -Url $manropeUrl -OutputFolder "public/assets/fonts/manrope" -Prefix "manrope"

# Download Material Symbols
Download-Font-Css-And-Files -Url $materialUrl -OutputFolder "public/assets/fonts/material-symbols" -Prefix "material-symbols"
