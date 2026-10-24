# 給 ChatGPT／Codex 用：等 Claude 在 art-inbox\requests\ 或 art-inbox\replies\ 寫新東西。
# 有新檔案就把內容印出來並結束；處理完再執行一次繼續等。
#
# 用法（在 repo 根目錄）：
#   powershell -ExecutionPolicy Bypass -File art-inbox\wait-for-claude.ps1
#   powershell -ExecutionPolicy Bypass -File art-inbox\wait-for-claude.ps1 -TimeoutMinutes 30
#
# 已經看過的檔案記在 art-inbox\.seen-by-chatgpt（不進版控），所以重跑不會重複回報。
# 第一次執行會先回報目前所有的 requests／replies，讓你知道有哪些待辦。

param([int]$TimeoutMinutes = 60, [int]$IntervalSeconds = 20)

$inbox = Split-Path -Parent $MyInvocation.MyCommand.Path
$seenFile = Join-Path $inbox '.seen-by-chatgpt'
$seen = @{}
if (Test-Path $seenFile) {
  Get-Content $seenFile -Encoding UTF8 | ForEach-Object { if ($_) { $seen[$_] = $true } }
}

function Get-NewFiles {
  foreach ($dir in 'requests', 'replies') {
    $path = Join-Path $inbox $dir
    if (-not (Test-Path $path)) { continue }
    Get-ChildItem $path -File -Filter '*.md' | Sort-Object Name | ForEach-Object {
      # 用「資料夾/檔名|修改時間」當作識別，Claude 改寫同一個檔也會再回報
      $key = "$dir/$($_.Name)|$($_.LastWriteTimeUtc.Ticks)"
      if (-not $seen.ContainsKey($key)) { [pscustomobject]@{ Key = $key; File = $_; Dir = $dir } }
    }
  }
}

$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
Write-Output "等待 Claude 的新訊息（最多 $TimeoutMinutes 分鐘）…"
while ($true) {
  $new = @(Get-NewFiles)
  if ($new.Count -gt 0) {
    # 等 10 秒，確定 Claude 寫完了
    Start-Sleep -Seconds 10
    $new = @(Get-NewFiles)
    foreach ($item in $new) {
      Write-Output ''
      Write-Output "===== $($item.Dir)\$($item.File.Name) ====="
      Get-Content $item.File.FullName -Encoding UTF8 | Write-Output
      Add-Content -Path $seenFile -Value $item.Key -Encoding UTF8
    }
    Write-Output ''
    Write-Output "共 $($new.Count) 則新訊息。處理完後再執行一次這個腳本繼續等。"
    exit 0
  }
  if ((Get-Date) -gt $deadline) {
    Write-Output "沒有新訊息（已等 $TimeoutMinutes 分鐘）。要繼續等就再執行一次。"
    exit 0
  }
  Start-Sleep -Seconds $IntervalSeconds
}
