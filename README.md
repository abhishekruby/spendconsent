# PayPal AI Hackathon 2026 — Project Lab

SpendConsent helps a small-business owner compare routine supplies, review exact
packs and full charges, and approve one immutable cart before PayPal sandbox
checkout. The catalog and shipping/tax are fictional; model inference is local.

**The full project remains incomplete.** Guarded payment runtime/browser wiring
is implemented and default off. Actual AI qualification, the integrated browser
journey, approved sandbox purchasing/read-back and usability gates remain open.
Current checkpoint and next action: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).
Setup: [backend](backend/README.md), [frontend](frontend/README.md).
Integration boundaries: [PayPal runtime](docs/paypal-runtime-plan.md).
Measured history and limitations: [progress](docs/progress.md).

Application migration 0006 is applied: the existing version-3 request and its exact requirements were preserved and backfilled as human-confirmed constraints; 16 offers and zero payment attempts remain. Django/Vite were restarted on loopback with AI disabled.

Architecture consolidation, 17 October: [system design](docs/system-design.md), [implementation gates](docs/implementation-plan.md), [stable API contract](docs/prebuild-audit.md#stable-api-contract-for-backendfrontend-agreement), and [frontend design](docs/frontend-design.md).

Product deliverables, 16 October: [research and target users](docs/research-and-users.md), [PRD](docs/PRD.md), and [selected stack and architecture](docs/architecture.md). The user authorized research, PRD preparation, stack selection and subsequent product implementation, multi-agent review/testing, and private commits/pushes. The proposal helps a small-business buyer compare routine supplies and approve an exact PayPal sandbox purchase. Differentiation and demand remain unproven. Earlier idea changes are retained in [two finalists and organizer fit](docs/two-finalists-and-organizer-fit.md).

System design is ready: [detailed architecture](docs/system-design.md), [visual overview](docs/diagrams/system-overview.svg), and [implementation sequence](docs/implementation-plan.md). These specify the database relationships, application API, bounded AI tools, exact approval, PayPal sequence, and recovery states. Local backend execution uses loopback HTTP and an isolated project PostgreSQL cluster/private peer-authenticated socket; existing shared services stay untouched. Deterministic catalog, session/CSRF, immutable review and direct approval work proceeded alongside model evaluation under the [recorded scheduling revision](docs/implementation-plan.md#scheduling-revision--17-october-2026). Actual AI integration and payment release gates remain outstanding.

Selected stack, revised after the user's backend question: React + TypeScript + Vite, Python 3.12 + Django 5.2 LTS + Django REST Framework, PostgreSQL, PayPal Orders v2 + JavaScript SDK v6, and local Qwen through a project-local llama.cpp CPU server. See [backend comparison](docs/stack-review.md). The backend environment pins Django 5.2.18 and DRF 3.18.3; dependency hashes/licenses are recorded in backend/. Verified Qwen3-1.7B inference remains below the unchanged 18/20 accuracy target: the latest extraction-thinking primary scored 14/20 and the separately measured regression scored 16/20. Earlier failed results remain preserved. The verified non-thinking Qwen3-4B trial from private checkpoint `95779a7` scored 16/20 with warm median 37.486 seconds; the unchanged >=18/20 accuracy gate failed. The separately authorized [application-protocol qualification](docs/ai-application-evaluation.md) from private checkpoint `1cd99bc` stopped after its first actual case failed in 39.859 seconds: the model omitted an explicitly stated cloth height and returned clarification instead of READY. The failed 1/40 partial report is preserved; remaining cases, including all fresh cases, were not run. Runtime enablement and the integrated browser/persistence/latency gates remain pending. See [AI feasibility](docs/ai-feasibility.md).

## Canonical workspace and continuity

Work here: `/home/abhishek/Documents/personal-project/PayPal AI Hackathon 2026 — Project Lab`. The original Codex output folder is preserved as an earlier snapshot. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the complete task-focused handoff and [project setup](docs/project-setup.md) for GitHub and Codex Projects status.

GitHub: [abhishekruby/paypal-ai-hackathon-2026](https://github.com/abhishekruby/paypal-ai-hackathon-2026), private; initial main push independently verified. Codex Project **PayPal AI Hackathon 2026** is registered with this folder, and the setup conversation has been moved into it.

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
docs/system-design.md      Components, data model, APIs, sequence and state diagrams
docs/implementation-plan.md Ordered milestones and verification gates
docs/prebuild-audit.md     Canonical API field contract and release checks
docs/frontend-design.md    Purchasing workspace and interaction design
docs/frontend-checkpoint.md Verified browser checks and remaining UI/integration gaps
docs/diagrams/             Editable SVG and rendered PNG system overview
docs/progress.md           Evidence, checks, and next actions
docs/tooling.md            Installed tools and access limits
docs/sandbox-setup.md      Credential creation and safe API test
backend/                   Verified deterministic authority/checkout domain and setup
frontend/                  Session-bound React/Vite workspace; integration gates remain
scripts/local_postgres.py  Isolated project PostgreSQL startup and self-check
scripts/sandbox_check.py   Sandbox-only OAuth diagnostic
```

Read [AGENTS.md](AGENTS.md) first. Open this folder in your preferred editor or coding workspace. This is a local project folder, not a separately provisioned cloud service or background agent.

## Optional sandbox authentication

Default-off backend/frontend startup needs no PayPal credentials. This optional
OAuth-only diagnostic uses installed Python 3.12 and needs no paid upgrade.

```bash
python3 scripts/sandbox_check.py --self-test
python3 scripts/sandbox_check.py --prompt
```

Run the second command yourself in an interactive terminal. Copy the dedicated **sandbox** app's client ID and secret directly from PayPal into its hidden prompts. Never paste them into this chat, shell commands, or documents. The script requests an OAuth token only, reports a sanitized success/failure summary, and discards the token. It does not make payments or create business objects.

The private `.env` was filled by the user and copied locally with owner-only permissions. To repeat the OAuth-only diagnostic, run `python3 scripts/sandbox_check.py`; the diagnostic reads it without printing values. Supported syntax is simple KEY=value with optional matching quotes, no shell expansion or multiline values. Environment variables override local values. `.env.example` remains blank and safe to share. Never publish `.env`.

## Decision sequence

1. Sandbox credential setup and authenticated OAuth response are verified; retain sandbox-only operation.
2. Review the current [PRD](docs/PRD.md), including the target user, competitor overlap, and single-merchant limitation.
3. Guarded checkout runtime and browser SDK wiring are implemented with the stated fake/test limits; continue actual AI qualification and real browser/sandbox verification while preserving the full PRD scope.
4. Pass the unchanged actual-AI gate: at least 18/20 grounded correct outcomes and warm median under 60 seconds. Preserve failures and separately measure unseen cases.
5. Integrate the smallest approved PayPal + actual-AI flow and test state/recovery with labeled fakes; obtain explicit approval before actual sandbox financial actions. Usability, usefulness and release evidence remain required.

The competition source links and detailed status are in the docs. Private GitHub repository creation/synchronization is authorized for this setup. Public visibility, deployment, and submission remain separate approval steps. An MIT license for original repository material is included.
