#!/bin/bash
# Wrapper para launchd (LUNES 8:00 a.m. · pe.crmagile.dailybrief.plist).
# Ahora corre el SCHEDULER (plano de control): lee las Programaciones de la DB,
# honra "Activa/Pausada" y "Enviar ahora", envía y registra en MessageLog.
# El destino y el horario se editan desde la UI (/programaciones).
# PATH explícito porque launchd no hereda el del shell del usuario.
export PATH="/usr/local/bin:/usr/local/opt/node/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "/Users/luistellesatto/code/crm-agile/app" || exit 1
echo "── $(date '+%Y-%m-%d %H:%M:%S') · scheduler (programaciones) ──"
exec ./node_modules/.bin/tsx scripts/scheduler.ts
