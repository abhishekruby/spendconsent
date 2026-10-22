# Docker helpers

Optional: on a slow connection, pre-download the hash-pinned Python wheels here so
`docker compose build` installs them offline (hashes are still checked):

```bash
python3 -m pip download --require-hashes --only-binary=:all: -r backend/requirements.txt -d docker/wheels
```

The llama.cpp b11696 archive can be placed here too (`docker/llama-b11696-bin-ubuntu-x64.tar.gz`); its SHA-256 is checked either way.
