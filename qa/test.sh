#!/usr/bin/env bash
# Startet den Black-Box-Tester. Läuft im Ordner mit diesen Testwerkzeugen, nicht im Code.
# Erwartet: Testserver auf Port 4173 und ANTHROPIC_API_KEY.
# Der Tester bekommt keine eingebauten Werkzeuge (kein Lesen, kein Shell), nur den Browser.
set -euo pipefail
mkdir -p bericht
TOOLS=$(sed -n 's/^tools: //p' .claude/agents/voci-tester.md | tr -d ' ')
node_modules/.bin/claude -p "$(cat auftrag.md use-cases.md)" \
  --agent voci-tester \
  --model "${TESTER_MODEL:-claude-sonnet-5-5}" \
  --tools "" \
  --allowedTools "$TOOLS" \
  --permission-mode dontAsk \
  --mcp-config mcp.json --strict-mcp-config \
  --setting-sources project \
  --json-schema "$(cat bericht-schema.json)" \
  --output-format json \
  --max-budget-usd "${TESTER_BUDGET_USD:-3}" \
  --no-session-persistence > bericht/resultat.json
