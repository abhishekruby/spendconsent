# Architecture implementation plan

16 October 2026. Build authorized through the active project-completion goal on 16 October. Scope/build agreement is recorded in PROJECT_CONTEXT.md; measure each gate before claiming it passed. Real sandbox financial calls need separate action-time approval. The [system design](system-design.md) defines the behavior; the [PRD](PRD.md) defines the acceptance targets.

## Sequence and exit criteria

| Stage | Work after authorization | Exit evidence | Dependencies |
| --- | --- | --- | --- |
| 0 — Scope and readiness | Confirm one sample merchant, one SKU per purchase, exact pack quantities, USD, one-time terms and local-only operation. Check supported dependency versions/licenses and SDK sandbox prerequisites without financial calls. | Recorded scope/build decision and a short readiness result; no gated service assumed available. | Architecture review |
| 1 — AI feasibility | Run actual local Qwen inference on compact fictional supply cases. Exercise tool selection, clarification, incorrect schema, and no-match cases. Measure the whole laptop workload. | PRD targets: 18/20 grounded valid outcomes, warm median request-to-review under 60 seconds; retain failures and cold timing. Revise inference/scope if it fails. | Stage 0; no payment needed |
| 2 — Domain/state foundation | Minimal Django/DRF setup; isolated PostgreSQL database/role; models/migrations; sessions/CSRF; seeded fictional offers; money/pack calculation; read-only request endpoints. | Exact example totals, constraints and ownership checks pass. New database is isolated; unrelated databases untouched. | Stage 1 |
| 3 — Comparison and review | Connect the bounded model loop to actual catalog functions. Build the one-screen React comparison and immutable review. | Real model changes behavior for unseen constraints; no invented IDs/prices. Wrong-size, non-divisible-pack and missing-fact cases handled. | Stage 2 |
| 4 — Approval and fake payment | Add direct approval, stock holds, transactional transitions and operation IDs. Use explicitly labeled local fake PayPal responses. | Wrong-session/expired/changed-cart approvals fail; competing requests do not consume the same approval; double-click, cancellation, timeout and restart remain correct. | Stage 3 |
| 5 — Approved sandbox integration | Verify current v6 standard-checkout authentication path; implement fixed-host REST create/read/capture and status reconciliation. Obtain explicit approval for each real financial test. | One real sandbox purchase independently verified; failed/unknown states honest; no duplicate intended purchase. Actual Orders/API/SDK readiness established here, not inferred from OAuth. | Stage 4 + action-time permission |
| 6 — Usability and demo evidence | Compare manual catalog/calculator tasks with assisted tasks; check keyboard/focus/errors; prepare a reproducible local run and under-three-minute story. | Record active effort, elapsed/model time, correctness and failures. Target 30% lower median active effort without extra errors; no claim if unmet. Clear walkthrough and setup instructions. | Stage 5 |

Public repository visibility, hosting, external recruitment and submission are outside this plan's authorization. Private synchronization continues only within the repository setup authorization. No calendar estimates are asserted before the model/integration gates have been measured.

## Focused verification matrix

| Requirement / risk | Check before moving on |
| --- | --- |
| R1–R3: useful actual AI | Confirmed constraints survive inference, all IDs exist, code computes pack math/full totals, at least one genuine tool call, unseen request changes selection. |
| R4–R6: exact human authority | Modified item at the same price, price drop/increase, terms/address/currency/payee change, expiry, absent approval and another session all reject the old permission. |
| Concurrency | Use PostgreSQL-backed transactional tests with separate connections/requests. Django's ordinary transaction-wrapped TestCase alone must not mask lock behavior. One approval/active attempt wins; lock order consistent. |
| Quote/stock race | Merchant mutation before capture causes review; after capture freeze it cannot rewrite the held quote. Stock holds remain until an uncertain operation resolves. |
| R7–R9: payment correctness | Provider approval does not bypass final validation; duplicate SDK callbacks reuse the attempt; timeouts before/after dispatch and capture mismatch remain honest. Test network failures with fakes before approved sandbox calls. |
| R10–R11: understandable product | Request, review, old/new changes, result and pending recovery are readable with keyboard/screen-reader semantics. No raw model reasoning or unsafe HTML is shown. |
| Secret/cost boundaries | Source/export/log scans and ignored files checked; fixed sandbox/model hosts verified; no card, hosted inference charge, expiring trial or paid database introduced. Never print the private environment file. |

Use Django's test runner and TransactionTestCase where real lock/concurrency semantics matter, plus TypeScript/build checks and a small manual browser journey. Tests should target incorrect outcomes, not mirror every helper. No test framework, browser-agent package or CI subscription is adopted by this document.

## First reviewable milestone

After build agreement and a passed model gate: one actual AI comparison on fictional merchant data, deterministic totals, a readable immutable review, and one changed-price rejection with a fake payment client. This proves the core boundary before requesting permission for a real sandbox transaction. It does not establish market demand or a prize outcome.
