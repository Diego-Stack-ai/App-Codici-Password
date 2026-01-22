# verify_project.ps1
# Script per verificare la qualità del codice e l'ottimizzazione del progetto

Write-Host ">>> Inizio verifica del progetto..." -ForegroundColor Cyan

# 1. Verifica Backend (Functions)
Write-Host "`n[1/3] Verifica Backend (Cloud Functions)..." -ForegroundColor Yellow
if (Test-Path "functions\package.json") {
    Push-Location "functions"
    try {
        if (Get-Content "package.json" | Select-String "lint") {
            Write-Host "    Esecuzione di 'npm run lint'..." -ForegroundColor Gray
            npm run lint
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    [OK] Backend linting superato." -ForegroundColor Green
            } else {
                Write-Host "    [ERRORE] Backend linting fallito." -ForegroundColor Red
            }
        } else {
            Write-Host "    [WARN] Nessuno script 'lint' trovato in functions/package.json." -ForegroundColor Magenta
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "    [INFO] Nessuna cartella 'functions' trovata." -ForegroundColor Gray
}

# 2. Verifica Frontend (Ottimizzazione Assets)
Write-Host "`n[2/3] Verifica Ottimizzazione Frontend (Assets)..." -ForegroundColor Yellow
$largeFiles = Get-ChildItem "Frontend\public" -Recurse | Where-Object { $_.Length -gt 500KB }
if ($largeFiles) {
    Write-Host "    [WARN] Trovati file di grandi dimensioni (>500KB). Considera di ottimizzarli (es. WebP per immagini):" -ForegroundColor Magenta
    foreach ($file in $largeFiles) {
        $sizeMB = "{0:N2} MB" -f ($file.Length / 1MB)
        Write-Host "    - $($file.FullName) ($sizeMB)"
    }
} else {
    Write-Host "    [OK] Nessun file eccessivamente grande trovato in Frontend." -ForegroundColor Green
}

# 3. Controllo TODO e Commenti
Write-Host "`n[3/3] Scansione TODO..." -ForegroundColor Yellow
$todos = Get-ChildItem -Recurse -Include *.js, *.html, *.ts -Exclude node_modules, .git | Select-String "TODO"
if ($todos) {
    Write-Host "    [INFO] Trovati $($todos.Count) TODO nel codice:" -ForegroundColor Cyan
    $todos | Select-Object -First 5 | ForEach-Object { Write-Host "    - $($_.Filename):$($_.LineNumber) $($_.Line.Trim())" }
    if ($todos.Count -gt 5) { Write-Host "    ... e altri $($todos.Count - 5)." }
} else {
    Write-Host "    [OK] Nessun TODO trovato." -ForegroundColor Green
}

Write-Host "`n>>> Verifica completata." -ForegroundColor Cyan
