# PayPal AI Hackathon 2026 — Project Lab

A dedicated local workspace for research, sandbox verification, and product planning. Setup is complete; sandbox OAuth authentication passed with HTTP 200 on 13 October 2026. **Current planning direction: SpendConsent; product implementation awaits agreement.** No frontend or backend application has been implemented.

Latest deliverables, 16 October: [research and target users](docs/research-and-users.md), [PRD](docs/PRD.md), and [selected stack and architecture](docs/architecture.md). The user authorized research, PRD preparation, and stack selection. The proposal helps a small-business buyer compare routine supplies and approve an exact PayPal sandbox purchase. Differentiation and demand remain unproven. Earlier idea changes are retained in [two finalists and organizer fit](docs/two-finalists-and-organizer-fit.md).

Selected planning stack, revised after the user's backend question: React + TypeScript + Vite, Python 3.12 + Django 5.2 LTS + Django REST Framework, PostgreSQL, PayPal Orders v2 + JavaScript SDK v6, and local Ollama/Qwen3-1.7B. See [backend comparison](docs/stack-review.md). The model must pass the documented laptop feasibility gate before this inference choice is committed to implementation. No packages or models were installed.

## Canonical workspace and continuity

Work here: `/home/abhishek/Documents/personal-project/PayPal AI Hackathon 2026 — Project Lab`. The original Codex output folder is preserved as an earlier snapshot. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the complete task-focused handoff and [project setup](docs/project-setup.md) for GitHub and Codex Projects status.

GitHub: [abhishekruby/paypal-ai-hackathon-2026](https://github.com/abhishekruby/paypal-ai-hackathon-2026), private during preparation; verify creation/push in the setup log.

## Workspace map

```text
AGENTS.md                  Master project instructions
README.md                  Entry point and safe setup
PROJECT_CONTEXT.md         Current decisions, context, authorization, and handoff
LICENSE                    MIT license for original repository material
.env.example               Blank runtime configuration template
.gitignore                 Secrets and generated files excluded
docs/hackathon-rules.md    Official requirements and source links
docs/ideas.md              Five product candidates and tradeoffs
docs/market-research-and-ranking.md  Market evidence and personalized ranking
docs/research-and-users.md Current evidence, users, competitors, and limitations
docs/PRD.md                Proposed product scope and acceptance criteria
docs/architecture.md       Selected planning stack, boundaries, and feasibility gates
docs/progress.md           Evidence, checks, and next actions
docs/tooling.md            Installed tools and access limits
docs/sandbox-setup.md      Credential creation and safe API test
backend/                   Reserved for an agreed product
frontend/                  Reserved for an agreed product
scripts/sandbox_check.py   Sandbox-only OAuth diagnostic
```

Read [AGENTS.md](AGENTS.md) first. Open this folder in your preferred editor or coding workspace. This is a local project folder, not a separately provisioned cloud service or background agent.

## First check

Python 3.12 is already installed. No packages or paid account upgrades are required by the diagnostic.

```bash
python3 scripts/sandbox_check.py --self-test
python3 scripts/sandbox_check.py --prompt
```

Run the second command yourself in an interactive terminal. Copy the dedicated **sandbox** app's client ID and secret directly from PayPal into its hidden prompts. Never paste them into this chat, shell commands, or documents. The script requests an OAuth token only, reports a sanitized success/failure summary, and discards the token. It does not make payments or create business objects.

The private `.env` was filled by the user and copied locally with owner-only permissions. To repeat the OAuth-only diagnostic, run `python3 scripts/sandbox_check.py`; the diagnostic reads it without printing values. Supported syntax is simple KEY=value with optional matching quotes, no shell expansion or multiline values. Environment variables override local values. `.env.example` remains blank and safe to share. Never publish `.env`.

## Decision sequence

1. Sandbox credential setup and authenticated OAuth response are verified; retain sandbox-only operation.
2. Review the current [PRD](docs/PRD.md), including the target user, competitor overlap, and single-merchant limitation.
3. Record agreement to implement this scope before building product features.
4. Check the selected local model's actual speed/reliability and dependency compatibility. Published licensing and zero hosted-inference cost do not establish laptop feasibility.
5. Build the smallest approved PayPal + AI flow; request explicit approval before actual sandbox financial actions, then improve reliability, accessibility, and presentation.

The competition source links and detailed status are in the docs. Private GitHub repository creation/synchronization is authorized for this setup. Public visibility, deployment, and submission remain separate approval steps. An MIT license for original repository material is included.
