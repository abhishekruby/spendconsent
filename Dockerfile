# One container, the same stack as scripts/run_demo.sh: project PostgreSQL 16,
# llama.cpp b11696 + Qwen3-4B (downloaded and hash-checked on first start),
# Django API and the Vite web app. Sandbox only; no secrets are baked in.
FROM node:22-bookworm-slim AS node

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates gnupg libgomp1 libcurl4 \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-16 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && useradd --create-home --uid 1000 app && mkdir /app && chown app /app
USER app
WORKDIR /app
COPY --chown=app backend/requirements.txt backend/requirements.txt
# Optional offline wheels (docker/wheels, same hashes) for slow connections.
COPY --chown=app docker/ /tmp/docker/
RUN python -m venv .venv && if ls /tmp/docker/wheels/*.whl >/dev/null 2>&1; \
      then .venv/bin/pip install --no-cache-dir --no-index --find-links /tmp/docker/wheels --require-hashes -r backend/requirements.txt; \
      else .venv/bin/pip install --no-cache-dir --timeout 120 --retries 10 --require-hashes -r backend/requirements.txt; fi
COPY --chown=app frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix frontend ci --no-audit --no-fund
RUN mkdir -p .runtime && if [ -f /tmp/docker/llama-b11696-bin-ubuntu-x64.tar.gz ]; then cp /tmp/docker/llama-b11696-bin-ubuntu-x64.tar.gz .runtime/llama.tar.gz; \
      else curl -fsSL --retry 5 -o .runtime/llama.tar.gz https://github.com/ggml-org/llama.cpp/releases/download/b11696/llama-b11696-bin-ubuntu-x64.tar.gz; fi \
 && echo "6a04629ca5265eb4c5c7d6edec8d6fa429e7e7da2de1cd5d5e357a492fc8f802  .runtime/llama.tar.gz" | sha256sum --check - \
 && tar -xzf .runtime/llama.tar.gz -C .runtime && rm .runtime/llama.tar.gz \
 && echo "6c7e275a5fe0b9f2b3d90dd53d8fd441d653af415350cfc05ca41e45eb18abfb  .runtime/llama-b11696/llama-server" | sha256sum --check -
COPY --chown=app . .
RUN mkdir -p .ai-cache .runtime/logs frontend/dist
EXPOSE 5173
CMD ["scripts/docker_entry.sh"]
