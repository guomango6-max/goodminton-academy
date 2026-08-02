@echo off
cd /d D:\Goodminton-website-maintenance\goodminton-academy
"C:\Users\guoma\AppData\Local\hermes\node\node.exe" "D:\Goodminton-website-maintenance\goodminton-academy\node_modules\next\dist\bin\next" dev --webpack --hostname 127.0.0.1 --port 3000 > ".next\local-dev.out.log" 2> ".next\local-dev.err.log"
