# Resilient drape-batch driver.
#
#   wait for any running batch -> run cleanup passes -> if the Workers AI free
#   allocation is exhausted, sleep 2 h and retry -> loop until every draft has
#   all 4 poses (or nothing is eligible in any pass).
#
# Passes:
#   --partials : drafts with only 1-3 of 4 poses
#   --refix    : products whose renders predate the extra-hands prompt fix
#   (main)     : drafts with 0 renders (first pass + any quota victims)

$log = "D:\thetanti\.drape-batch.out.log"
$deadline = (Get-Date).AddHours(72)   # spans 2-3 daily Workers AI quota resets

# 1. Wait for any already-running batch to exit.
while (Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*drape-batch.mjs*' }) {
    Start-Sleep -Seconds 60
}

while ((Get-Date) -lt $deadline) {
    node D:\thetanti\.drape-batch.mjs --partials >> $log 2>&1
    node D:\thetanti\.drape-batch.mjs --refix    >> $log 2>&1
    node D:\thetanti\.drape-batch.mjs            >> $log 2>&1

    # Done when nothing is eligible anywhere.
    $pending = node D:\thetanti\.drape-status.mjs 2>&1
    if ($pending -match 'ALL DRAFTS COMPLETE') { break }

    # Quota victims wait for the daily reset; other failures retry sooner.
    Add-Content $log ("[driver] sleeping 2h before next pass ({0})" -f (Get-Date))
    Start-Sleep -Seconds 7200
}
Add-Content $log "[driver] finished at $(Get-Date)"
