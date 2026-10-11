#!/usr/bin/env pwsh
# start_backend.ps1 — Launch VayuDrishti backend (run from project root)
# Usage: .\start_backend.ps1

Set-Location "$PSScriptRoot\backend"

Write-Host "🚀 Starting VayuDrishti backend..." -ForegroundColor Cyan
Write-Host "   URL: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "   Docs: http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "   Press Ctrl+C to stop.`n" -ForegroundColor Yellow

python -m uvicorn main:app --reload --port 8000
