# SpendConsent — compact handoff

Updated 20 October 2026. Read once after AGENTS.md; load detailed references only when needed.

## Scope and authorization

A small-business owner requests routine supplies; actual local AI interprets requirements and calls the fictional catalog. Server code calculates exact packs/full USD totals. The buyer reviews and approves an immutable cart before an explicitly permitted PayPal sandbox journey.

One sample merchant, one SKU per purchase, 16 cloth/bag/bottle/notebook SKUs, exact quantities, fixed synthetic delivery/tax, one-time USD only. Preserve the full [PRD](docs/PRD.md). No unrestricted shopping, recurring/live payments or new product direction. No prize/market-fit guarantees; public problem evidence is acceptable and merchant contacts are not required.

Build, independent review and private synchronization are authorized. Zero-cost, secrets, non-destructive work, action-time financial approval and no-publication boundaries remain in [AGENTS.md](AGENTS.md). The build goal is **paused**; optimization does not resume it.

## Verified checkpoint

- Private repo: https://github.com/abhishekruby/paypal-ai-hackathon-2026. Last verified main: `d171448`.
- Django/DRF/PostgreSQL authority, catalog math, immutable reviews, approval/dispatch/recovery safeguards are built. Latest owner suite: 80 PostgreSQL tests. Independent review covered the prior 79 plus 17 focused adapter checks after the last extraction change. Provider/model doubles are explicitly test-only.
- React/TypeScript/Vite UI: eight test groups/build; limited actual browser persistence, mobile and focus checks. Full AI-to-payment browser journey remains unverified.
- Real AI adapter/gated persistence wiring: `1cd99bc`; required nullable attributes: `a9fdb54`. Model: pinned local Qwen3-4B Q4_K_M / llama.cpp, CPU, loopback 11435. Never treat a test double as inference.
- PayPal REST adapter: `3074f73`; inert SDK helper: `c1318c7`. Actual Orders/SDK authentication/read-back and financial journey are unverified. OAuth-only check passed 13 October; no financial action has occurred.
- App migration 0006 preserved one version-3 request, 16 offers and zero attempts; existing requirements were backfilled as confirmed constraints. No readiness marker was granted. Application readiness/financial flags remain off.

## Interrupted work — preserve it

`docs/evidence/ai-application-qualification-a9fdb54.json`: partial; 12 finished outcomes, 10 passes, one interrupted attempt, fresh suite unrun. Both completed default repetitions passed. No model/test/server process was present at the last inspection. Check live handles before any restart; an unknown-timing attempt cannot qualify latency. Preserve earlier failed reports and all measured rows.

Unreviewed PayPal runtime work remains in `.env.example`, `backend/config/settings.py`, `backend/purchases/{checkout,paypal,services,views,runtime_paypal,test_runtime_paypal}.py`. Do not overwrite, stage broadly or claim it verified. Never display private `.env` contents. Review diff/state before continuing; do not resume the paused build without user instruction.

## Six remaining delivery milestones

1. Pass original and fresh AI suites independently: >=18/20 each, warm median <60s, both original defaults correct.
2. Verify actual browser request → comparison → exact review → approval.
3. Finish/review PayPal runtime and SDK wiring, default off.
4. With concrete action-time approval, verify sandbox purchase/read-back and recovery.
5. Run [five usability pairs](docs/usability-evaluation.md); measure active effort, correctness and model/wall wait. 30% reduction is an unachieved target.
6. Finish reproducible setup, demo under three minutes, full PRD audit and private synchronization. Public release/submission needs approval.

## On-demand references

[API contract](docs/prebuild-audit.md), [backend setup](backend/README.md), [AI protocol](docs/ai-application-evaluation.md), [model provenance](docs/ai-feasibility.md), [PayPal plan](docs/paypal-runtime-plan.md), [architecture](docs/system-design.md). Historical decisions: [archived context](PROJECT_CONTEXT_HISTORY.md), [progress log](docs/progress.md). Read only the relevant sections.
