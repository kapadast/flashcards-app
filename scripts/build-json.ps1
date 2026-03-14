# ASCII-only: translations as RU gloss in Latin + word (avoid encoding issues)
$raw = Join-Path $PSScriptRoot "words-raw.txt"
$outDir = Join-Path $PSScriptRoot "..\src\data"
$outFile = Join-Path $outDir "words.json"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('[')
$id = 1
$first = $true
Get-Content $raw -Encoding UTF8 | ForEach-Object {
  $w = $_.Trim()
  if (-not $w -or $w.StartsWith('#')) { return }
  $esc = $w -replace '\\','\\' -replace '"','\"'
  if (-not $first) { [void]$sb.Append(',') }
  $first = $false
  $ex = "Example: This sentence uses the word ``$esc``."
  $tr = "chastoe slovo (top-1000)"
  [void]$sb.Append("{`"id`":$id,`"word`":`"$esc`",`"translation`":`"$tr`",`"example`":`"$($ex -replace '"','\"')`"}")
  $id++
}
[void]$sb.Append(']')
[System.IO.File]::WriteAllText($outFile, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Host "OK" $outFile "count" ($id - 1)
