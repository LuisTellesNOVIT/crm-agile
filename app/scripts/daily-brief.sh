#!/bin/bash
# Wrapper para launchd: corre el brief ejecutivo y lo envía por WhatsApp.
# Programado los LUNES 8:00 a.m. (ver pe.crmagile.dailybrief.plist).
# Destinos: número del usuario + grupo "Gerencia NOVIT".
# PATH explícito porque launchd no hereda el del shell del usuario.
export PATH="/usr/local/bin:/usr/local/opt/node/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export BRIEF_TARGETS="+51980203171,12018757382-1438204825@g.us"
cd "/Users/luistellesatto/code/crm-agile/app" || exit 1
echo "── $(date '+%Y-%m-%d %H:%M:%S') · brief ejecutivo ─────────────"
exec ./node_modules/.bin/tsx scripts/daily-brief.ts --send
