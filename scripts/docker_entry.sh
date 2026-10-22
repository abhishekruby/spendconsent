#!/bin/sh
# Container start: fetch and verify the model once, then run the same stack as run_demo.sh.
set -eu
cd /app
mkdir -p .runtime/logs
if [ ! -f .ai-cache/qwen3-4b-q4_k_m.gguf ]; then
  echo "Downloading Qwen3-4B Q4_K_M (2.5 GB, once)…"
  curl -fL --continue-at - -o .ai-cache/model.part https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/bc640142c66e1fdd12af0bd68f40445458f3869b/Qwen3-4B-Q4_K_M.gguf
  echo "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5  .ai-cache/model.part" | sha256sum --check -
  mv .ai-cache/model.part .ai-cache/qwen3-4b-q4_k_m.gguf
fi
if [ ! -f .ai-cache/qwen3.jinja ]; then
  curl -fsSL -o .ai-cache/tokenizer.json https://huggingface.co/Qwen/Qwen3-1.7B/resolve/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e/tokenizer_config.json
  python3 - <<'PY'
import hashlib, json
from pathlib import Path
template = json.loads(Path('.ai-cache/tokenizer.json').read_text())['chat_template'].encode()
assert hashlib.sha256(template).hexdigest() == 'a55ee1b1660128b7098723e0abcd92caa0788061051c62d51cbe87d9cf1974d8'
Path('.ai-cache/qwen3.jinja').write_bytes(template)
PY
fi
[ -d .runtime/postgres-data/base ] || python3 scripts/local_postgres.py --init
python3 scripts/local_postgres.py --start >/dev/null
.venv/bin/python backend/manage.py migrate --noinput >/dev/null
.venv/bin/python backend/manage.py grant_ai_readiness "${SPENDCONSENT_QUALIFICATION:-docs/evidence/ai-application-qualification-a01b9f9.json}" \
  || echo "AI stays off: the qualification report does not match this code."
[ -f .env ] && [ ! -d .env ] && export SPENDCONSENT_PAYPAL_ENABLED=1
export SPENDCONSENT_AI_ENABLED=1 SPENDCONSENT_PAYPAL_CONSENT="${SPENDCONSENT_PAYPAL_CONSENT:-buyer}"
.runtime/llama-b11696/llama-server --model .ai-cache/qwen3-4b-q4_k_m.gguf --alias qwen3-4b-q4_k_m --host 127.0.0.1 --port 11435 \
  --threads 4 --threads-batch 4 --ctx-size 4096 --parallel 2 --cache-ram 0 --batch-size 128 --ubatch-size 128 --device none \
  --gpu-layers 0 --jinja --chat-template-file .ai-cache/qwen3.jinja --reasoning off --offline --log-disable --no-webui \
  >.runtime/logs/model.log 2>&1 &
until curl -sf http://127.0.0.1:11435/health >/dev/null; do sleep 2; done
.venv/bin/python backend/manage.py runserver 127.0.0.1:8000 --noreload >.runtime/logs/api.log 2>&1 &
echo "SpendConsent is starting: open http://127.0.0.1:5173"
cd frontend && exec node_modules/.bin/vite --host 0.0.0.0 --port 5173 --strictPort
