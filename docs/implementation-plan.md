# Architecture implementation plan

Updated 19 October 2026. Build authorized through the active project-completion goal on 16 October. Scope/build agreement is recorded in PROJECT_CONTEXT.md; measure each gate before claiming it passed. Real sandbox financial calls need separate action-time approval. The [system design](system-design.md) defines behavior and deployment; the [stable API contract](prebuild-audit.md#stable-api-contract-for-backendfrontend-agreement) defines fields/envelopes; the [PRD](PRD.md) defines acceptance targets. The deterministic backend foundation is now authorized to proceed in parallel with the read-only model evaluation, as recorded below; application readiness remains subject to every release gate.

## Sequence and exit criteria

| Stage | Work after authorization | Exit evidence | Dependencies |
| --- | --- | --- | --- |
| 0 — Scope and readiness | Confirm one sample merchant, one SKU per purchase, exact pack quantities, USD, one-time terms and local-only operation. Check supported dependency versions/licenses and SDK sandbox prerequisites without financial calls. | Recorded scope/build decision and a short readiness result; no gated service assumed available. | Architecture review |
| 1 — AI feasibility | Run actual local Qwen inference on compact fictional supply cases. Exercise tool selection, clarification, incorrect schema, and no-match cases. Measure the whole laptop workload. | PRD targets: 18/20 grounded valid outcomes, warm median request-to-review under 60 seconds; retain failures and cold timing. Revise inference/scope if it fails. | Stage 0; no payment needed |
| 2 — Domain/state foundation | Minimal Django/DRF setup; project-local PostgreSQL cluster/private socket and limited application role (existing shared service untouched); models/migrations; sessions/CSRF; seeded fictional offers; money/pack calculation; read-only request endpoints. | Exact example totals, constraints and ownership checks pass. Project cluster/database is isolated, app is nonsuperuser, socket/ports checked; unrelated services/databases untouched. | Stage 0; may run alongside Stage 1 |
| 3 — Comparison and review | Connect the bounded model loop to actual catalog functions. Build the one-screen React comparison and immutable review. | Real model changes behavior for unseen constraints; no invented IDs/prices. Wrong-size, non-divisible-pack and missing-fact cases handled. | Stage 1 + Stage 2 |
| 4 — Approval and fake payment | Add direct approval, stock holds, transactional transitions and operation IDs. Use explicitly labeled local fake PayPal responses. | Wrong-session/expired/changed-cart approvals fail; competing requests do not consume the same approval; double-click, cancellation, timeout and restart remain correct. | Stage 2 for isolated domain tests; Stage 3 for the integrated journey |
| 5 — Approved sandbox integration | Verify current v6 standard-checkout authentication path; implement fixed-host REST create/read/capture and status reconciliation. Obtain explicit approval for each real financial test. | One real sandbox purchase independently verified; failed/unknown states honest; no duplicate intended purchase. Completed mismatches block replacement on the same request until manual resolution. Actual Orders/API/SDK readiness established here, not inferred from OAuth. | Stage 4 + action-time permission |
| 6 — Usability and demo evidence | Compare manual catalog/calculator tasks with assisted tasks; check keyboard/focus/errors; prepare a reproducible local run and under-three-minute story. | Record active effort, elapsed/model time, correctness and failures. Target 30% lower median active effort without extra errors; no claim if unmet. Clear walkthrough and setup instructions. | Stage 5 |

Public repository visibility, hosting, external recruitment and submission are outside this plan's authorization. Private commits/pushes are authorized for completed tasks by the active goal; synchronize a completed architecture checkpoint after independent review. No calendar estimates are asserted before the model/integration gates have been measured.

## Focused verification matrix

| Requirement / risk | Check before moving on |
| --- | --- |
| R1–R3: useful actual AI | Confirmed constraints survive inference, all IDs exist, code computes pack math/full totals, at least one genuine tool call, unseen request changes selection. |
| R4–R6: exact human authority | Modified item at the same price, price drop/increase, terms/address/currency/payee change, expiry, absent approval and another session all reject the old permission. |
| Concurrency | Use PostgreSQL-backed transactional tests with separate connections/requests. Django's ordinary transaction-wrapped TestCase alone must not mask lock behavior. One approval/active attempt wins; lock order consistent. |
| Quote/stock race | Merchant mutation before capture causes review; after capture freeze it cannot rewrite the held quote. Stock holds remain until an uncertain operation resolves. |
| R7–R9: payment correctness | Provider approval does not bypass final validation; duplicate SDK callbacks reuse the attempt; timeouts before/after dispatch and capture mismatch remain honest. An APPROVED read after uncertain capture stays blocked; create recovery requires no prior capture dispatch. Test network failures with fakes before approved sandbox calls. |
| R10–R11: understandable product | Request, review, old/new changes, result and pending recovery are readable with keyboard/screen-reader semantics. No raw model reasoning or unsafe HTML is shown. |
| Secret/cost boundaries | Source/export/log scans and ignored files checked; fixed sandbox/model hosts verified; no card, hosted inference charge, expiring trial or paid database introduced. Never print the private environment file. |

Check clarify/review bodies against PurchaseRequest.version and approval against Review.version/digest; stale review.request_version is rejected. Check a changed offer selection with unchanged request_version: the older review/approval cannot approve or start checkout. Only the current highest review version is eligible; replacement revokes old unconsumed approvals and is blocked while an active/unknown/PAYMENT_REVIEW attempt exists.

Use Django's test runner and TransactionTestCase where real lock/concurrency semantics matter, plus TypeScript/build checks and a small manual browser journey. Tests should target incorrect outcomes, not mirror every helper. No test framework, browser-agent package or CI subscription is adopted by this document.

## First reviewable milestone

Build agreement is recorded. After a passed model gate: one actual AI comparison on fictional merchant data, deterministic totals, a readable immutable review, and one changed-price rejection with a fake payment client. This proves the core boundary before requesting permission for a real sandbox transaction. It does not establish market demand or a prize outcome.

## Scheduling revision — 17 October 2026

The team lead authorized Stage 2 deterministic domain/API/security implementation in parallel with the actual-AI feasibility investigation. This removes the unnecessary model-choice dependency for catalog arithmetic, database ownership, immutable review and direct approval checks. It does not narrow the PRD or mark Stage 1 passed. The actual model adapter, real AI comparison and release still require the unchanged 18/20 grounded-outcome and warm-median-under-60-second gate. Until a verified adapter is integrated, the API reports `ai_ready:false` and `MODEL_UNAVAILABLE`; deterministic service fixtures are tests, not AI responses. Financial capability remains off, and no sandbox financial action is authorized by this scheduling decision.

Dependency metadata verified against primary PyPI release metadata on 17 October 2026: [Django 5.2.18](https://pypi.org/pypi/Django/5.2.18/json), [DRF 3.18.3](https://pypi.org/pypi/djangorestframework/3.18.3/json), and [psycopg 3.3.6](https://pypi.org/pypi/psycopg/3.3.6/json). Exact dependency hashes and the small installed dependency/license inventory belong in `backend/`.

## Checkout-domain scheduling extension — 18 October 2026

The team lead authorized deterministic checkout, stock-hold and recovery implementation/testing alongside the failed actual-AI evaluation. Provider behavior is injected only by test-local fakes. Runtime capabilities stay false, and public create/capture endpoints stay disabled; no PayPal HTTP client, credential loading, OAuth or sandbox financial action is authorized by this extension. Stage 4 domain evidence may be collected before Stage 3, but actual AI integration/release still requires the unchanged 18/20 grounded outcomes and warm median under 60 seconds. Real payment integration and its action-time approval, usefulness and all other PRD gates remain unchanged.

## Actual-AI adapter code scheduling extension — 19 October 2026

The team lead authorized parallel implementation and mocked-HTTP verification of an actual local-model application adapter while the separately frozen 4B experiment runs. This initially authorized unwired code preparation only. The subsequent default-off wiring extension below supersedes that wiring restriction; it does not authorize readiness or actual inference. Do not alter the frozen probe, holdout, model process or experiment configuration or run competing inference. Independent code review and unchanged actual-model gates remain prerequisites for runtime enablement. Mocked adapter tests are not actual-AI quality evidence. Financial action-time permission and all other release gates remain unchanged.

The reviewed `purchases.agent.compare` uses one native `search_catalog` call and schema-bound final confirmation, with actual catalog arithmetic and supported partial constraints. Its 16 mocked-HTTP tests cover all four categories, missing/unsupported requirements, confirmed-field authority, currency/budget binding, exact packs/budgets, invented facts, controlled description injection, privacy, concurrent busy behavior and unlocked PostgreSQL rows. Public socket doubles exercise native HTTP parsing and absolute deadlines across headers, body and request writes; no actual inference or network runs in these checks. Only sanitized model name/use, timings and tool outcome metadata may be persisted by application integration.

## Default-off application wiring and qualification preparation — 19 October 2026

The team lead subsequently authorized default-off endpoint/persistence preparation
in parallel with independent application-protocol qualification. This changes
scheduling, not scope or release targets. The model remains unavailable until
reviewed source and actual qualification pass; an explicit enable setting,
owner-only adapter-source/model-bound marker and fixed-loopback healthy runtime
are all required. Financial capabilities stay off. No marker is granted here.

Prepared wiring separates human-confirmed from inferred constraints, claims work
under short locks, performs inference outside transactions and rejects stale
version/claim results. Migration 0006 was applied to the application database
without resetting data: the version-3 request and its exact requirements were
preserved and backfilled as human-confirmed constraints, with one request,
16 offers and zero payment attempts before and after. Django/Vite were restarted
on loopback with AI disabled. Independent review passed 79 real-PostgreSQL tests
in 26.018 seconds: 56 existing checks, 16 mocked model-adapter checks and seven
mocked application-wiring checks. No actual model quality or browser journey is
established by these fakes. Reviewed source is privately synchronized as `1cd99bc`.

The [qualification runner](ai-application-evaluation.md) passed its offline
self-test and independent review, including forced interruption/resumption with
the attempted failure preserved. After private checkpoint `1cd99bc`, the team lead
prepared the source/config report, verified the single actual runtime and
authorized the first case. It failed in 39.859 seconds: extraction preserved
the global fields and width but omitted the explicitly stated cloth height,
yielding NEEDS_CLARIFICATION instead of READY. The failed 1/40 partial report is
preserved and further calls stopped because a mandatory default case failed;
all fresh cases remain unrun. A general nullable-attribute completeness correction
is being prepared and must pass independent review/private commit before a new
experiment; fixtures and earlier results remain unchanged. Original and fresh suites each require
>=18/20 correct outcomes and warm median <60 seconds, with both original default
40-cloth cases correct; scores cannot be pooled. It uses frozen synthetic catalog
copies and a dummy database, so browser/persistence and full request-to-review
latency still require separate integrated evidence. Preserve failures; do not
change frozen inputs/expected answers or tune on fresh holdout results. The earlier actual three-offer 4B primary remains failed at
16/20 (warm median 37.486 seconds), as do the 1.7B experiments.

## Current stage

The 56-check deterministic authority/checkout/unwired PayPal checkpoint is
independently verified. Prepared actual-model adapter/default-off persistence
wiring brings the independently verified suite to 79 checks with mocked inference
at private checkpoint `1cd99bc`. The frontend passes eight Node test groups and its
production build, with limited actual browser request/refresh/accessibility checks.
Actual AI accuracy remains below the unchanged gate; the separately authorized
application-protocol qualification stopped after its first mandatory default case
failed. The failed partial is preserved and fresh cases remain unrun. Readiness
remains false and normal API requests return
MODEL_UNAVAILABLE. Actual runtime/browser integration, PayPal SDK and authenticated
Orders behavior, explicitly approved sandbox checkout, usefulness and release
evidence remain outstanding. The full PRD is retained. See [backend setup and
limitations](../backend/README.md).
