# Project context — start here after AGENTS.md

Updated: 19 October 2026. This is a task-focused handoff, not a verbatim transcript or an instruction to expose private conversations.

## Identity and location

- Workspace name: **PayPal AI Hackathon 2026 — Project Lab**.
- Canonical folder: `/home/abhishek/Documents/personal-project/PayPal AI Hackathon 2026 — Project Lab`.
- GitHub destination: `https://github.com/abhishekruby/paypal-ai-hackathon-2026`. The repository was created privately and the main push independently verified. See docs/project-setup.md.
- Saved Codex project: **PayPal AI Hackathon 2026**, project ID `cc3ec3f0-99d5-4c3e-9348-0ebcf65456cb`. The app project listing confirms the canonical folder; the setup chat was moved into this project on 16 October.
- Product working name: **SpendConsent**. Product implementation is authorized by the active project-completion goal on 16 October 2026.
- This folder was copied from the original Codex output folder on 16 October. The original was preserved as an earlier snapshot. Continue work here rather than maintaining two working copies.

## User's goals and preferences

The user wants a useful, commercially plausible business product with meaningful PayPal and genuine agentic AI. They want new AI skills, a clear demonstration, evidence of an expensive or repetitive real problem, and strong hackathon execution. They repeatedly rejected generic chatbots, invented novelty, and ideas already closely covered by competitors.

Explain the customer, problem, and concrete example in plain language before technical detail. Do not repeatedly rotate ideas or describe every suggestion as the best. Do not promise prizes, investor interest, product-market fit, or a 100% chance of winning. The user has no merchant contacts and accepts public discussions as a prototype starting point; interviews are not a prerequisite. Distinguish public anecdotes, vendor claims, hypotheses, and measured results.

Relevant prior context: see the PRD.

## Current proposed product

An owner or administrator at a small service business asks for routine supplies. AI retrieves catalog facts, clarifies specifications, compares pack sizes and full delivered cost, and proposes a cart. A person reviews the exact merchant, items, quantity, currency, total, shipping choice, and one-time terms. The application enforces that approval through a normal PayPal sandbox journey; material changes require a new review.

Example: exactly 40 microfiber cloths, 40 × 40 cm, maximum $60 including delivery/tax, one-time purchase. Compare suitable packs, reject wrong dimensions, review a complete cart, block changed terms, then verify an explicitly approved sandbox purchase. The first prototype uses one authorized sample merchant and fictional product/quote fixtures. It does not establish universal supplier discovery, product quality, fulfillment, or production payment guarantees.

The main unresolved business question is whether comparison plus review saves enough work compared with a catalog and calculator. Exact-cart approval, budgets, and agent safety already exist elsewhere. Ramp Procurement, Argus, alex-hahn/agentic-commerce, and Agentic Shopping Autopilot are material overlaps. No global novelty or commercial advantage is established.

## Decisions and authorization

**Completed/authorized:** local lab setup; PayPal login assistance; approved sandbox app creation; OAuth-only test; official rules/resources and competitor research; public-evidence screening; target users; PRD; stack selection; this canonical folder and context; private GitHub repository creation and initial synchronization; saved local project registration and moving the setup chat into it.

**Current stack, revised 16 October after the user's Django/PostgreSQL question:** React + TypeScript + Vite; Python 3.12 + Django 5.2 LTS + Django REST Framework; PostgreSQL; PayPal Orders v2 + JavaScript SDK v6; one local Qwen3-1.7B Q4_K_M tool loop through the project-local llama.cpp CPU server on loopback port 11435. The readiness runtime supersedes the original Ollama daemon plan to avoid unnecessary GPU-library downloads; model feasibility remains unpassed. The project-local `.venv` now pins Django 5.2.18, DRF 3.18.3 and psycopg 3.3.6 with dependency hashes/licenses recorded in backend/. FastAPI/SQLite was the previous minimal-demo plan, now superseded. Do not run two application backends or retain two databases for the same feature.

**Bounded model trial, 19 October:** optional non-thinking Qwen3-4B profile and frozen evidence were independently reviewed and privately committed as `95779a7` before download/inference. The team lead subsequently authorized its pinned local download, now in progress. Artifact verification, laptop fit and actual measurements are pending; this is not a selected successful replacement or a passed AI gate. Keep only one model loaded. The prior 1.7B profile/results remain available. See [AI feasibility](docs/ai-feasibility.md).

**Build authorization, 16 October:** the user explicitly set an active goal to complete the existing SpendConsent project, authorized multiple agents and team-lead execution, iterative build/review/fix/testing/audit, and commits/private GitHub pushes for completed tasks. This is agreement to implement the current PRD; it is not blanket permission for money movement or public release. Preserve the existing small single-merchant/one-SKU scope until evidence warrants a recorded change.

**Not authorized:** actual sandbox financial actions without action-time approval; paid accounts/billing/cards; public publication, deployment, hackathon submission, or outreach. Creating a private GitHub repository does not authorize making it public. The active goal extends permission to implementation and private synchronization, while these other boundaries remain.

**Architecture requested and prepared, 16 October:** docs/system-design.md defines components, single-offer purchase scope, data relationships, APIs, agent tools, exact approval, stock/quote holds, payment states and recovery. docs/implementation-plan.md defines milestones and exit checks. docs/diagrams/system-overview.svg/.png provides the visual. The original architecture request authorized design/planning; the later active project-completion goal now authorizes implementation of that scope. Current SDK documentation has inconsistent authentication examples; standard-checkout client-ID initialization is the planning default pending verification, replacing the earlier assumed mandatory client-token endpoint.

## What actually works today

- The deterministic authority and checkout domain are implemented: 16 fictional SKUs across cloth/bag/bottle/notebook, exact pack/cents arithmetic, anonymous CSRF/session ownership, immutable current reviews, direct approval, reservation/dispatch persistence and safe recovery rules. Private checkpoint `a73c511` passed independent review and 46 real-PostgreSQL tests, including the completed-order-without-capture guard. Provider behavior is injected test-local fakes; it is not actual PayPal execution. See [backend setup and limits](backend/README.md).
- The partial frontend milestone is privately committed as `bfbb3c2`; the refresh-focus correction and browser checkpoint are `bfeb684`. Eight Node test groups and the TypeScript/Vite production build pass. Actual browser checks cover saved/confirmed requirements, MODEL_UNAVAILABLE read-back and refresh persistence, 320/360px overflow fixes, keyboard navigation, dark rendering, heading focus after clarification and retained reload-button focus after click/Enter. Comparison/review/payment rendering uses labeled unit fixtures; the actual AI → review → approval → payment browser journey remains unverified. See [frontend checkpoint](docs/frontend-checkpoint.md).
- The sandbox-only REST adapter is implemented and independently reviewed while remaining unwired. The full backend suite passes 56 real-PostgreSQL tests (24 foundation, 22 checkout-domain and 10 adapter checks); independent verification took 17.333 seconds, with clean Django, migration-drift and whitespace checks. Adapter tests mock urllib and forbid HTTPS connections. Fixed-origin transport, exact persisted purchase mapping, restart binding, independent GET after capture, conservative missing-evidence/mismatch handling and sanitized responses are covered. Actual sandbox field echoing and provider behavior remain unverified. No runtime loader, configuration access or capability switch was added. See [adapter checkpoint and limits](docs/paypal-integration.md).
- Actual AI is unavailable through the application: normal create/clarify saves the request and returns HTTP 503 MODEL_UNAVAILABLE; no successful AI response is faked. All three capabilities (ai_ready, paypal_ready, financial_actions_enabled) are false. SDK checkout and actual sandbox order/capture/read-back remain outstanding. No financial action has occurred; the adapter checkpoint used no actual OAuth or PayPal HTTP calls.
- Runtime/model provenance and actual 1.7B local inference are verified. Earlier failed primary scores remain preserved: baseline 0/20, protocol correction 6/20 and prompt revision 12/20. Latest extraction-thinking primary is 14/20, warm median 26.707 seconds; the separate previously measured regression is 16/20, warm median 33.487 seconds. Neither reaches 18/20; passing warm latency does not compensate for accuracy. Fresh unseen evaluation and integrated application performance remain pending. The authorized 4B download is not yet verified. See [AI feasibility](docs/ai-feasibility.md).
- The team lead applied application-database migrations 0004/0005 successfully without resetting data: one saved request remains version 3 with exactly 40 cloths, maximum $60.00 USD, 40 × 40 cm and one-time terms; there are 16 offers and zero payment attempts. Django and Vite were running on loopback ports 8000/5173 when checked on 19 October. Recheck availability after a restart; application data and the dedicated test database are separate.
- Dedicated PayPal sandbox app: **AI Hackathon 2026 Project Lab**. PayPal rejected a label containing “PayPal,” so the dashboard name differs from the workspace name.
- The user saved sandbox credentials privately. `.env` is owner-readable/writable only and ignored by Git. Never display or stage it.
- OAuth check passed on 13 October 2026: HTTP 200, bearer token lifetime 32400 seconds; token discarded. This proves authentication only.
- `scripts/sandbox_check.py --self-test` is a dependency-free offline diagnostic. It does not prove Orders access, SDK setup, payment execution, or AI performance.
- Node 22.14.0, Python 3.12.3, Git, uv, and GitHub CLI are available. The project-local PostgreSQL 16 cluster is initialized with TCP disabled, an owner-only private peer-authenticated Unix socket and a limited spendconsent_app role (no superuser/CREATEDB/CREATEROLE). The existing shared service and unrelated databases/configuration remain untouched.
- Laptop: i5-1035G1, 7.4 GiB RAM, MX250 with 2 GiB VRAM. Ollama was not on PATH. The local CPU model is measured on synthetic probes but remains below its accuracy gate; a passing full-application memory/latency benchmark is not established.

## Organizer requirements and resources

As checked on 16 October, the competition has no mandatory industry topic. Meaningful PayPal sandbox + AI is required. Implementation, design, potential impact, innovation, and presentation are equally weighted. The rules require a runnable prototype, public licensed source, and a public English/translated demo under three minutes. Deadline recorded: 12 November 2026, noon Pacific. Recheck official rules before submission.

Official entry point: https://paypalaihackathon.devpost.com/rules. Sponsor resources are optional for general entry. Do not add sponsor tools just for logos, depend on expiring trials, or assume product-search access grants checkout/payment authority. PayPal agentic services have separate onboarding; ordinary sandbox OAuth does not establish those entitlements.

## Research history and decisions not to repeat

Earlier proposals included scope/invoice automation, accessible checkout, dispute evidence, repair procurement, grant allocation, recalls/recovery, PayPal operations, printing-shop sales assistance, workshop-offcut products, merchant interruption handling, and a developer checkout tester. They were not agreed products.

Printing assistance and workshop leftovers were rejected because of close existing products. CheckoutProof was withdrawn as the leading prize-focused recommendation after its differentiation and impact evidence proved insufficient. SpendConsent is the current planning proposal, with acknowledged direct competition. Detailed historical documents are preserved; their old rankings do not override the latest PRD and decision log.

## Reading order and next work

1. `AGENTS.md` — master rules and explicit approval boundaries.
2. This file, then `README.md` — current context and navigation.
3. `docs/PRD.md` — proposed scope and acceptance targets.
4. `docs/architecture.md` — current stack and execution boundaries.
   Then `docs/system-design.md` and `docs/implementation-plan.md` — detailed architecture and build gates.
5. `docs/research-and-users.md` and `docs/stack-review.md` — evidence and tradeoffs.
6. `docs/project-setup.md` and the latest section of `docs/progress.md` — verified setup and remaining work.

Build agreement is recorded; deterministic backend and frontend work proceeded alongside read-only AI evaluation under the scheduling revision in docs/implementation-plan.md. Continue the authorized bounded 4B trial and reviewed runtime/SDK integration work without relaxing the failed AI gate; preserve the fake-provider/mocked-HTTP evidence and complete the remaining actual browser and provider checks. Only after explicit action-time approval should a real sandbox financial journey run. Full PRD acceptance, usefulness measurements and release evidence remain unachieved. Report measured results, preserve failed cases, and update this context when decisions change.
