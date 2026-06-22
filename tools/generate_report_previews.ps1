$ErrorActionPreference = "Stop"

$appRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$rawDir = Join-Path $appRoot "data\raw-files"
$previewDir = Join-Path $appRoot "data\report-previews"

if (!(Test-Path -LiteralPath $rawDir)) {
  throw "Raw files directory not found: $rawDir"
}

New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

function Convert-WordToPdf {
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$TargetPath,
    [Parameter(Mandatory = $true)]$WordApp
  )

  $document = $null
  try {
    $document = $WordApp.Documents.Open($SourcePath, $false, $true)
    $document.ExportAsFixedFormat($TargetPath, 17)
  } finally {
    if ($document -ne $null) {
      $document.Close($false)
    }
  }
}

function Convert-PowerPointToPdf {
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$TargetPath,
    [Parameter(Mandatory = $true)]$PowerPointApp
  )

  $presentation = $null
  try {
    $presentation = $PowerPointApp.Presentations.Open($SourcePath, $true, $false, $false)
    try {
      $presentation.ExportAsFixedFormat($TargetPath, 2)
    } catch {
      $presentation.SaveAs($TargetPath, 32)
    }
  } finally {
    if ($presentation -ne $null) {
      try {
        $presentation.Close()
      } catch {
      }
    }
  }
}

function Close-OfficeApp {
  param($App)

  if ($App -ne $null) {
    try {
      $App.Quit()
    } catch {
    }
  }
}

$officeFiles = Get-ChildItem -LiteralPath $rawDir -File |
  Where-Object { $_.Extension.ToLowerInvariant() -in @(".doc", ".docx", ".ppt", ".pptx", ".pptm") -and !$_.Name.StartsWith("._") }

$converted = 0
$skipped = 0
$failed = @()

foreach ($file in $officeFiles) {
  $target = Join-Path $previewDir ($file.Name + ".pdf")
  if ((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).LastWriteTime -ge $file.LastWriteTime) {
    $skipped++
    continue
  }

  Write-Host "Converting $($file.Name)"
  $word = $null
  $powerPoint = $null
  try {
    switch ($file.Extension.ToLowerInvariant()) {
      ".doc" {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0
        Convert-WordToPdf -SourcePath $file.FullName -TargetPath $target -WordApp $word
      }
      ".docx" {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $word.DisplayAlerts = 0
        Convert-WordToPdf -SourcePath $file.FullName -TargetPath $target -WordApp $word
      }
      default {
        $powerPoint = New-Object -ComObject PowerPoint.Application
        $powerPoint.DisplayAlerts = 1
        Convert-PowerPointToPdf -SourcePath $file.FullName -TargetPath $target -PowerPointApp $powerPoint
      }
    }
    $converted++
  } catch {
    if (Test-Path -LiteralPath $target) {
      Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
    }
    $failed += [PSCustomObject]@{
      Name = $file.Name
      Error = $_.Exception.Message
    }
  } finally {
    Close-OfficeApp $word
    Close-OfficeApp $powerPoint
  }
}

Write-Host "Converted: $converted"
Write-Host "Skipped: $skipped"

if ($failed.Count -gt 0) {
  Write-Host "Failed:"
  $failed | Format-Table -AutoSize | Out-String | Write-Host
  exit 1
}
