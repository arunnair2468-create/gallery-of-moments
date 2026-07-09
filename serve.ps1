# Tiny static file server for The Gallery of Moments
# Run:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Add -Lan (needs admin) to share the gallery with phones on the same Wi-Fi.
param([int]$Port = 8321, [switch]$Lan)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mime = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8"
  ".js"="application/javascript; charset=utf-8"; ".json"="application/json"
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".png"="image/png"
  ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".woff2"="font/woff2"
}

$listener = New-Object System.Net.HttpListener
if ($Lan) {
    try {
        $listener.Prefixes.Add("http://+:$Port/")
        # open the Windows firewall for this port (idempotent)
        if (-not (Get-NetFirewallRule -DisplayName "Gallery of Moments" -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName "Gallery of Moments" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
        }
        $listener.Start()
    } catch {
        Write-Host ""
        Write-Host "  Wi-Fi sharing needs administrator rights." -ForegroundColor Red
        Write-Host "  Please use 'Share on Wi-Fi.bat' (it asks for permission), or run this window as administrator." -ForegroundColor Red
        Write-Host ""
        Read-Host "  Press Enter to close"
        exit 1
    }
} else {
    $listener.Prefixes.Add("http://localhost:$Port/")
    $listener.Start()
}

Write-Host ""
Write-Host "  The Gallery of Moments is open at  http://localhost:$Port/" -ForegroundColor Yellow
if ($Lan) {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
        ForEach-Object {
            Write-Host ("  On your phone (same Wi-Fi), open   http://{0}:{1}/" -f $_.IPAddress, $Port) -ForegroundColor Cyan
        }
}
Write-Host "  Press Ctrl+C to close the gallery." -ForegroundColor DarkGray
Write-Host ""

while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    $file = Join-Path $root ($path -replace "/", "\").TrimStart("\")
    $resp = $ctx.Response
    if ((Test-Path $file -PathType Leaf) -and ((Resolve-Path $file).Path.StartsWith($root))) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $resp.ContentType = if ($mime[$ext]) { $mime[$ext] } else { "application/octet-stream" }
        $bytes = [IO.File]::ReadAllBytes($file)
        $resp.ContentLength64 = $bytes.Length
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $resp.StatusCode = 404
        $b = [Text.Encoding]::UTF8.GetBytes("404 - not in this gallery")
        $resp.OutputStream.Write($b, 0, $b.Length)
    }
    $resp.Close()
}
