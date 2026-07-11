@echo off
cd /d "F:\Strike Alert"
start "Strike Alert Server" /min "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next" start
