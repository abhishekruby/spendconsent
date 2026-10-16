# Local tooling and access

Inspected 13 October 2026 on the user's laptop.

| Tool | Observed version | Purpose |
| --- | --- | --- |
| Git | 2.43.0 | Later local version control |
| Python | 3.12.3 | Dependency-free sandbox diagnostic |
| Node.js | 22.14.0 | Available if the agreed stack needs it |
| npm | 10.9.2 | Available; no packages installed |
| uv | 0.11.28 | Available; no runtime installation needed |
| curl | 8.5.0 | Available; avoid verbose credential-bearing requests |
| VS Code | 1.141.0 | Local editor |
| Google Chrome | 155.0.8059.39 | Connected user browser |
| BrowserAct CLI | 1.4.2 | Installed; not needed for the current workflow |

Native desktop automation is disabled in this session; local file access and connected Chrome browser control are available. Installed CLI presence does not imply all service accounts, permissions, or plugins are configured. No tools, paid services, security changes, or broad access grants were added. Local Git initialized on main; no commit, remote repository, or cloud project was created.

On 16 October the user requested stack selection. The planning stack was initially FastAPI/SQLite, then revised after the user's backend question to React/TypeScript/Vite, Django 5.2 LTS/DRF, PostgreSQL, PayPal SDK v6/Orders v2, and local Ollama/Qwen3-1.7B. See docs/architecture.md. These application dependencies and model are not installed; no model benchmark has run.

Read-only hardware check, 16 October: Intel i5-1035G1, 8 logical CPUs, 7.4 GiB RAM total with about 2.9 GiB available at inspection, NVIDIA MX250 with 2048 MiB VRAM, and about 55 GiB free disk. Ollama was not found on PATH. Small-model feasibility remains an explicit gate; GPU acceleration and adequate runtime memory are not assumed.

Read-only canonical-folder setup check, 16 October: GitHub CLI authenticated as abhishekruby; PostgreSQL 16.15 readiness accepted on the local socket. Django was not installed in system Python. No existing database contents, database credentials, or server configuration were inspected/changed.


## Authorized AI readiness experiment — 16 October 2026

Project-local `.runtime/` and `.ai-cache/` are Git-ignored. Official llama.cpp b11696 CPU runtime and official Ollama registry Qwen3-1.7B Q4_K_M model are the current readiness path. This supersedes the untested Ollama installation plan without changing model family or zero-cost execution. No system service, sudo installer or hosted inference is used. See ai-feasibility.md for downloads, licenses, actual execution/results and repeatable commands.
