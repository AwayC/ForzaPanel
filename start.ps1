Write-Host "Starting Forza Telemetry..." -ForegroundColor Cyan

# Kill any existing backend process on port 5300
$old = netstat -ano | Select-String ":5300" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1
if ($old) {
    Stop-Process -Id $old -Force -ErrorAction SilentlyContinue
    Write-Host "Killed existing process on port 5300 (PID $old)" -ForegroundColor Yellow
}

# Start Go backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; go run ./src/server/main.go" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Electron frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run start"

Write-Host "Both services started." -ForegroundColor Green
