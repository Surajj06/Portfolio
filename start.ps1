# Starts both the .NET backend and the Angular frontend, each in its own window.
$root = $PSScriptRoot

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$root\backend\PortfolioApi'; dotnet run"
)

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$root\frontend'; npm start"
)

Write-Host "Backend starting  -> http://localhost:5000/api"
Write-Host "Frontend starting -> http://localhost:4201"
