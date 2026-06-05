#!/bin/bash
# Wrapper opcional: corre el scheduler cada N min (ver pe.crmagile.scheduler.plist).
# Procesa "Enviar ahora" (runNow) y las programaciones vencidas. NO está cargado
# por default; cargalo con: launchctl load ~/Library/LaunchAgents/pe.crmagile.scheduler.plist
export PATH="/usr/local/bin:/usr/local/opt/node/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "/Users/luistellesatto/code/crm-agile/app" || exit 1
exec ./node_modules/.bin/tsx scripts/scheduler.ts
