#!/bin/bash
# launchd: motor de Secuencias cada 15 min.
#  1) auto-enrola tratos por categoría en secuencias ACTIVAS (todas OFF = no hace nada)
#  2) procesa enrolamientos vencidos (respeta esperas, manda alertas internas)
# Los mensajes a CLIENTE están PAUSADOS por default (SEQ_CLIENT_SENDS=off).
# Para habilitar envíos a clientes: export SEQ_CLIENT_SENDS=on en este wrapper.
export PATH="/usr/local/bin:/usr/local/opt/node/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export SEQ_CLIENT_SENDS="${SEQ_CLIENT_SENDS:-off}"
cd "/Users/luistellesatto/code/crm-agile/app" || exit 1
echo "── $(date '+%Y-%m-%d %H:%M:%S') · sequence-engine (clientSends=$SEQ_CLIENT_SENDS) ──"
./node_modules/.bin/tsx scripts/sequence-engine.ts --auto-enroll
./node_modules/.bin/tsx scripts/sequence-engine.ts --run
