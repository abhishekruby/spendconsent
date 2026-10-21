#!/usr/bin/env bash
# One command to run SpendConsent locally: database, local AI model, API and web app.
#   scripts/run_demo.sh         start whatever is not already running, then print the URL
#   scripts/run_demo.sh stop    stop what this script started (the database keeps running)
#   scripts/run_demo.sh status  show what is up
# Set SPENDCONSENT_PAYPAL_CONSENT=operator for strict mode (typed consent per purchase).
# One-time setup (Python env, model download, sandbox .env) is in README.md.
set -euo pipefail
cd "$(dirname "$0")/.."
LOGS=.runtime/logs PIDS=.runtime/pids
mkdir -p "$LOGS" "$PIDS"

up() { curl -s -o /dev/null --max-time 2 -H "Host: 127.0.0.1:5173" "$1"; }
wait_for() { # name url seconds
  for _ in $(seq "$3"); do up "$2" && { echo "  ✓ $1"; return 0; }; sleep 1; done
  echo "  ✗ $1 did not start; see $LOGS/" >&2; return 1
}
launch() { # name logfile command...
  local name=$1 log=$2; shift 2
  setsid nohup "$@" >>"$log" 2>&1 </dev/null &
  echo $! >"$PIDS/$name.pid"
}
status() {
  python3 scripts/local_postgres.py --start >/dev/null 2>&1 && echo "  ✓ database" || echo "  · database not running"
  for svc in "model http://127.0.0.1:11435/health" "api http://127.0.0.1:8000/api/session" "web http://127.0.0.1:5173/"; do
    set -- $svc; up "$2" && echo "  ✓ $1" || echo "  · $1 not running"
  done
}

case "${1:-start}" in
stop)
  for f in "$PIDS"/*.pid; do
    [ -e "$f" ] || continue
    pid=$(cat "$f"); kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    echo "  stopped $(basename "$f" .pid)"; rm -f "$f"
  done
  exit 0 ;;
status) status; exit 0 ;;
start) ;;
*) echo "usage: $0 [start|stop|status]" >&2; exit 2 ;;
esac

missing=()
[ -x .venv/bin/python ] || missing+=(".venv (backend setup in backend/README.md)")
[ -f .ai-cache/qwen3-4b-q4_k_m.gguf ] || missing+=("AI model (download steps in docs/ai-feasibility.md)")
[ -x .runtime/llama-b11696/llama-server ] || missing+=("llama.cpp server (docs/ai-feasibility.md)")
[ -d frontend/node_modules ] || missing+=("frontend packages (cd frontend && npm ci)")
if [ ${#missing[@]} -gt 0 ]; then printf 'Missing setup:\n'; printf '  - %s\n' "${missing[@]}"; exit 1; fi

echo "Starting SpendConsent…"
# Idempotent: starts the isolated project cluster or verifies the running one.
python3 scripts/local_postgres.py --start >"$LOGS/database.log" 2>&1 && echo "  ✓ database" \
  || { echo "  ✗ database; first run needs: python3 scripts/local_postgres.py --init --start (see $LOGS/database.log)" >&2; exit 1; }

if ! up http://127.0.0.1:11435/health; then
  launch model "$LOGS/model.log" .runtime/llama-b11696/llama-server --model .ai-cache/qwen3-4b-q4_k_m.gguf \
    --alias qwen3-4b-q4_k_m --host 127.0.0.1 --port 11435 --threads 4 --threads-batch 4 --ctx-size 4096 \
    --parallel 2 --cache-ram 0 --batch-size 128 --ubatch-size 128 --device none --gpu-layers 0 --jinja \
    --chat-template-file .ai-cache/qwen3.jinja --reasoning off --offline --log-disable --no-webui
fi
wait_for model http://127.0.0.1:11435/health 120

if ! up http://127.0.0.1:8000/api/session; then
  export SPENDCONSENT_AI_ENABLED=1 SPENDCONSENT_PAYPAL_CONSENT="${SPENDCONSENT_PAYPAL_CONSENT:-buyer}"
  [ -f .env ] && export SPENDCONSENT_PAYPAL_ENABLED=1 || echo "  · no .env: PayPal sandbox checkout stays off (see README step 4)"
  launch api "$LOGS/api.log" .venv/bin/python backend/manage.py runserver 127.0.0.1:8000 --noreload
fi
wait_for api http://127.0.0.1:8000/api/session 60

if ! up http://127.0.0.1:5173/; then
  launch web "$LOGS/vite.log" npm --prefix frontend run dev
fi
wait_for web http://127.0.0.1:5173/ 60

ready=$(curl -s --max-time 3 -H "Host: 127.0.0.1:5173" http://127.0.0.1:8000/api/session | python3 -c "import json,sys; c=json.load(sys.stdin)['capabilities']; print('AI ' + ('ready' if c['ai_ready'] else 'NOT ready (grant readiness: README step 3)') + ' · PayPal ' + ('ready, ' + c.get('consent_mode','operator') + ' consent' if c['paypal_ready'] else 'off'))")
echo "  $ready"
echo "Open http://127.0.0.1:5173"
