$ports = @(3001, 5173)

foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

  foreach ($connection in $connections) {
    $processId = $connection.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

    if ($process -and ($process.ProcessName -eq "node" -or $process.ProcessName -eq "npm")) {
      Write-Host "Stopping $($process.ProcessName) process $processId on port $port"
      Stop-Process -Id $processId -Force
    }
  }
}

Write-Host "GuessVille ports are free."
