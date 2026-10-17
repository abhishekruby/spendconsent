# Prebuild architecture audit

16 October 2026. Independent document review of PRD v0.3, system design v1.0, architecture, implementation plan, and the user's build/test/audit goal. This is a checklist and proposed API contract, not evidence that the application works. No private configuration or financial API was accessed. The user's new build goal supersedes the documents' earlier planning-only authorization; action-time sandbox financial approval and publication boundaries remain.

## Assessment

The design supports a narrow, professional hackathon prototype without microservices or paid infrastructure. Its important existing strengths are anonymous-session ownership, explicit CSRF, immutable exact-cart review, short PostgreSQL transactions, stock reservations, operation-specific retry keys, and honest unknown-payment states. Implement those boundaries before polishing the demo. A useful comparison and real model tool use remain release requirements, not optional decoration.

The laptop/model feasibility gate is unresolved. All architecture latency numbers are targets. Do not replace an unsuccessful AI evaluation with deterministic hard-coded answers presented as AI, or replace actual PayPal evidence with a fake success screen.

## Required implementation decisions and checks

| Gate | Concrete acceptance evidence | Failure consequence |
| --- | --- | --- |
| Exact authority | The server builds one fixed-schema snapshot from current trusted facts. Session/request version, merchant/payee, item/variant/specification, packs/units, USD breakdown, shipping/destination reference, one-time terms, quote version/expiry are bound. Price drop, same-price SKU substitution, and a changed destination invalidate old approval. | Block create/capture; show fresh review. |
| Constraint authority | Missing quantity, dimensions, budget or material preferences produce clarification; model-extracted requirements are visible and correctable. Confirmed constraints are never silently overwritten by later tool/model text. Unsupported requests remain unsupported. | Clarify or no-match; no invented default purchase. |
| Approval replay | Repeated approval returns the same unexpired approval rather than extending its expiry. One approval maps to one attempt. A stopped/expired approval cannot be renewed implicitly by retrying the same URL. | Fresh review/approval required. |
| Anonymous CSRF | Every unsafe endpoint rejects absent/invalid CSRF and cross-origin requests even when no authenticated Django user exists. Browser calls use same-origin cookies plus a masked token. Ownership comes from the session, never a supplied owner UUID. | Reject before inference or state mutation. |
| Ownership | Another browser session receives 404 for request, review, approval and attempt reads/writes; submitted IDs cannot select somebody else's provider order. Session loss never creates a replacement payment automatically. | No record disclosure or mutation. |
| Persistence and refresh | Bootstrap returns the current request ID; refresh reconstructs current review, approval and attempt from the server. Server restart preserves operation IDs/state/holds. | No client-only payment truth. |
| Race control | PostgreSQL transactions lock request → approval → offer consistently; actual constraints backstop one approval/attempt and one active attempt/request. Concurrent starts/captures dispatch one intended operation. | Financial release blocker. |
| Stock math | Available packs are stock minus reservations. Capture recognizes its own reservation. Reservation changes do not increment material offer version. Paid finalization consumes/releases exactly once. | No oversell or self-invalidating approval. |
| No locks over network | Persist the intended state, operation UUID and exact payload before calling PayPal; commit first. Re-lock and conditionally apply the result. Inference/provider HTTP never runs inside an open row-lock transaction. | Fix before concurrency acceptance. |
| Capture claim/freeze | Read provider order, then re-lock and revalidate local facts immediately before claiming capture. Two callers cannot both claim dispatch. Later merchant edits cannot rewrite the already frozen attempt snapshot. | No stale capture or second dispatch. |
| Unknown recovery | Persist which operation is uncertain: create, capture or verification. A read showing an APPROVED/uncaptured order is not by itself proof that a previously dispatched capture can no longer complete. Do not re-enable capture or release its hold on that observation alone. | Remain pending/unknown until sufficient evidence. |
| Cancellation | Stop before capture makes the local attempt non-capturable. Stop after capture dispatch requests reconciliation; it does not claim to undo payment, release its hold, or trigger refund. | Honest checking-status UI. |
| Verified paid | Require trusted order linkage, configured payee, USD total, completed capture ID/status, and matching mapped purchase details. PENDING capture or browser onApprove is insufficient. A completed mismatch is PAYMENT_REVIEW, not a blocked/no-money state. | Never show unverified success. |
| HTTP behavior | Fixed sandbox/local-inference hosts; reject redirects; finite timeouts and response-size bounds; no automatic POST retries. Safe error allowlist, no raw provider bodies/credentials in exception logs. Unknown outcome never gets an ordinary retry-to-pay button. | Security/correctness release blocker. |
| Human financial boundary | Runtime financial capability defaults off until approved real integration work. Tests use injected fake clients; fake results are clearly labeled and cannot be mistaken for verified PayPal payment. Capture/create are never AI tools. | No real money-like sandbox calls without approval. |
| Meaningful AI | At least one real model-selected allowlisted tool call; unseen request changes selected arguments/options; deterministic code validates IDs, dimensions, pack divisibility and totals. Invalid tools/schema fail safely. | Cannot claim completed PayPal+AI entry. |
| Usability | Keyboard-only request → clarification → comparison → exact review; pending/success/error text announced; sandbox label and units/packs always clear; no raw model reasoning/HTML. | Fix before demo-ready claim. |

The default runtime must not expose a fixture mutation/payment override endpoint. Changed-price demonstrations can use an explicit local operator command or test service; its actual service path must honor reservations/freeze. No unauthenticated demo backdoor.

Recovery distinction: `UNKNOWN` with `pending_operation=create` and a known provider order may become `AWAITING_BUYER` when trusted read-back proves the existing order was created and no capture has ever been dispatched locally. `UNKNOWN` with `pending_operation=capture` remains uncertain when read-back merely shows `APPROVED`; that observation does not establish terminal failure of a potentially in-flight capture. Reconciliation never dispatches capture. A provider capture marked `PENDING` remains pending and retains its reservation.

## Stable API contract for backend/frontend agreement

Root and frontend-design agents accepted these top-level conventions on 16 October. Add fields only with a coordinated backend/frontend change; do not create a parallel envelope.

Use direct JSON objects, snake_case, opaque UUIDs, integer `*_cents`, `currency: "USD"`, integer quantities, and UTC ISO-8601 timestamps. Decimal display strings are presentation only; never submit money from the browser as authoritative. Reject unknown input fields. Response objects below describe fields, not literal data to seed.

`GET /api/session`:

```json
{
  "environment": "sandbox",
  "csrf_token": "masked-browser-token",
  "capabilities": {
    "ai_ready": false,
    "paypal_ready": false,
    "financial_actions_enabled": false
  },
  "current_request_id": null,
  "paypal": null
}
```

`paypal`, when configured, contains only browser-safe `client_id` and `currency`. Do not return session key, owner UUID, REST token, or secret. This endpoint initializes the session/cookie but never calls a financial endpoint. Private readiness details belong in local sanitized diagnostics.

Create request input: `{text, client_submission_id, constraints?}`. A repeated submission UUID with different content is a conflict, not a silent new request or rewrite. The model run may be synchronous initially; 90 seconds is the maximum permitted deadline, not the expected UX. A full model queue/background broker is unnecessary for one concurrent local run.

Constraints agreed 17 October: `{category, quantity, budget_cents, currency, one_time, attributes:{...}}`. The exact `category` enum is `cloth`, `bag`, `bottle`, `notebook`. Category-specific attributes stay nested: `width_cm`/`height_cm` for `cloth`, `capacity_l` for `bag`, `volume_ml` for `bottle`, and `paper_size` for `notebook`. Validate USD and `one_time:true`; preserve the bounded 12–20-SKU catalog. Frontend fields edit nested attributes plainly; the backend validates and freezes the trusted normalized constraints. Unknown required values or unsupported requirements must be clarified or rejected, never invented or silently discarded.

Request response:

```text
id, version, status, text, constraints,
clarification: {question, missing_fields} | null,
candidates: Candidate[], excluded: [{offer_id, name, reasons}],
review: Review | null, approval: Approval | null,
attempt: Attempt | null, events: Event[],
model: {used, name, elapsed_ms, tool_calls} | null
```

Use a bounded `status` enum such as `NEEDS_CLARIFICATION`, `COMPARING`, `READY`, `NO_MATCH`, `MODEL_ERROR`, `CHECKOUT`, `PAID`. Financial truth comes from `attempt.state`, never a contradictory request-only status. Sanitized tool events are IDs/names/result summaries, not model thoughts. `current_request_id` enables refresh recovery without putting ownership identifiers in localStorage.

```text
Candidate: id, offer_id, sku, name, specification, pack_units,
  packs, individual_units, currency, subtotal_cents, shipping_cents,
  tax_cents, discount_cents, total_cents, reasons, evidence
Review: id, version, request_version, quote_version, digest, created_at, expires_at,
  merchant, item, shipping, terms, currency,
  subtotal_cents, shipping_cents, tax_cents, discount_cents, total_cents, evidence
Approval: id, review_id, approved_at, expires_at, status
Attempt: id, state, pending_operation, reason_code, created_at, updated_at,
  provider_order_id, capture_id, total_cents, currency,
  allowed_actions: Action[]
Event: id, type, reason_code, message, created_at
Evidence: {offer_id, offer_version, source: "sample_catalog", summary}
ToolCall: {name, status: "completed" | "error", elapsed_ms}
Action: "open_paypal" | "capture" | "check_status" | "stop"
```

`Candidate.evidence` and `Review.evidence` are arrays of `Evidence`. References identify the trusted offer and its integer material `offer_version`; `summary` is a sanitized plain-text description of the supporting catalog facts. Review evidence is frozen with its snapshot. `Review.quote_version` is the selected material `Offer.version`, distinct from `Review.version` and `Review.request_version`. Display quote version, `created_at` as the quote snapshot time, `expires_at`, and evidence references to satisfy PRD R4. Reservation counters do not change the quote version.

`model.tool_calls` is an array of `ToolCall`, bounded by the six-invocation tool-loop limit. Names come only from `search_catalog`, `get_offer`, `compare_quotes`; `elapsed_ms` is a measured nonnegative integer. Expose only these sanitized outcome/timing fields, never tool arguments, raw responses, prompts or private reasoning. `Attempt.reason_code` and `Event.reason_code` are an allowlisted safe string or `null`.

Review nested objects use these fields:

```text
merchant: {id, name}
item: {offer_id, sku, variant_id, name, specification,
  pack_units, packs, individual_units}
shipping: {option_id, label, destination_ref, destination_label}
terms: {one_time: true, description}
```

`specification` is an escaped plain display string; canonical structured attributes remain server-owned. `merchant.id` identifies our sample merchant, not a browser-supplied payment destination. The configured PayPal payee remains bound in the server snapshot. Constraints must use an agreed typed schema; unsupported requested specifications require clarification/rejection rather than silently disappearing from matching.

Expose only the safe destination label/reference in Review, not an unnecessary full street address. Unit cost can be displayed as a calculated decimal string rather than rounding stored cents. Every comparison/review total is server-computed.

Existing design routes stay unchanged. Mutation input conventions:

| Endpoint | Minimal body |
| --- | --- |
| `/requests/{id}/clarify` | `{expected_version, constraints}`; version is `PurchaseRequest.version` |
| `/requests/{id}/reviews` | `{expected_version, candidate_id}`; version is `PurchaseRequest.version` |
| `/reviews/{id}/approve` | `{expected_version, expected_digest}`; version is the selected `Review.version` |
| `/approvals/{id}/attempts` | `{}`; no caller order, payee or amount; server resolves approval from URL |
| `/attempts/{id}/capture` | `{}`; no caller order, payee or amount; server resolves attempt from URL |
| `/attempts/{id}/stop`, `/reconcile` | Empty object; direct action, no model-generated state |

Return the updated request envelope after clarify/review/approve, and `{attempt}` after financial/status mutations. Approval additionally verifies `Review.request_version` matches the current request. Under the request lock, the selected review must be the current highest review version at approval and attempt start. A replacement review supersedes older reviews and revokes unconsumed approvals; reject replacement while an active, unknown or `PAYMENT_REVIEW` attempt exists or the request is paid. Duplicate in-progress mutations return 202 with the same attempt and pending state. A resolved idempotent repeat may return 200. Expired/changed review returns 410/409 respectively without silently approving its replacement.

Error shape: `{error: {code, message, fields?, retryable}, request_id?, attempt?}`. A request ID here is the domain request, not a credential. Browser errors must handle non-JSON 403/network failures without assuming no payment. JSON CSRF errors are preferable. Use code-specific next actions: `REVIEW_CHANGED` → review; `MODEL_BUSY` → bounded retry; uncertain payment → check existing attempt only. No stack trace or provider raw payload is returned.

### Action authority and SDK handoff

`allowed_actions` contains only the finite `Action` values above. The server returns currently permitted actions; the frontend also gates financial controls on `capabilities.financial_actions_enabled`. That capability defaults false and is not itself action-time human approval. Every endpoint independently checks ownership, permissions, state and server-time expiry.

| Attempt state | Permitted actions |
| --- | --- |
| `AWAITING_BUYER` | `open_paypal`, `capture`, `check_status`, `stop`; remove `open_paypal` and `capture` when financial capability is false. Final buyer-approval/review checks still gate capture. |
| `CREATING`, `CAPTURING`, `VERIFYING`, `UNKNOWN` | `check_status`, `stop` as appropriate; stopping requests reconciliation and never undoes a dispatched operation or releases an uncertain hold. |
| `PAYMENT_REVIEW` | `check_status` only; resolution is manual. No replacement purchase or automatic refund. |
| `PAID`, `STOPPED` | No financial actions; `allowed_actions: []`. |

`open_paypal` opens checkout for the existing `attempt.provider_order_id`; it never creates an attempt or order. Before sending `POST /api/attempts/{id}/capture` with `{}`, the browser adapter checks that the SDK approval callback's order ID matches that existing order. A mismatch stops the adapter. The backend trusts neither that callback nor browser state: it independently reads the stored provider order and validates buyer approval, linkage and the exact current review before dispatching capture.

No financial POST runs automatically on mount, refresh, polling, reconnect or a status response. Status reconciliation never captures or allocates a replacement for an unknown attempt. `fresh_review` is not an action enum value: show a fresh-review control only after `STOPPED` and the request/review-replacement guard establishes it is safe; the backend rechecks that guard when creating the review.

## Staged test strategy

1. **Deterministic domain/API:** exact fixture totals ($47.60/$41.80), wrong size/no-match, non-divisible packs, budgets including tax/delivery, unknown fields, stale request/review, expired/wrong-session/replayed approvals, JSON HTML escaping. Use Django tests and fake model/payment clients. Test CSRF with enforcement enabled; default test clients can hide the omission.
2. **PostgreSQL transactions:** `TransactionTestCase` with independent connections and synchronized threads for double-create, double-capture, same-offer stock competition, pre-capture mutation and cancellation races. Assert provider call count, one active attempt, exact inventory totals, and durable final state. SQLite results do not prove these locks.
3. **Provider failure simulator:** inject timeout before/after possible create/capture dispatch, provider decline/PENDING, mismatch, verification timeout, duplicate callback, crash-like persisted pending operation and refresh. Assert no silent replacement, no false PAID, no lost hold, and idempotent finalization. Read-only reconciliation must call neither create nor capture.
4. **Real AI evaluation:** fixed expected cases before tuning, 20 runs and unseen held-out cases. Record inference/model identity, validated tool arguments, correctness and full latency. Preserve failures. Merchant-description injection fixtures must not alter confirmed constraints or expose a payment tool. A canned parser or mock is not inference evidence.
5. **Frontend/browser:** TypeScript production build; real local browser verifies small laptop layout, keyboard/focus/labels, explicit budget and pack units, loading/busy/timeouts, price-change rejection, refresh and recovery. No payment click in automated browser exploration until approved. Do not treat a successful build as visual/accessibility proof.
6. **Approved sandbox:** only after permission, actual buyer flow and independent read-back. Record sanitized IDs/status/timing, no raw payload/secrets. One successful purchase proves that path only; keep decline/timeout cases fake unless separately approved.
7. **Usefulness and release:** five manual/assisted matched tasks; report active effort and model wait separately, errors and median measured results. Re-run relevant tests after fixes, secret/exclusion checks, clean reproducible setup, README/demo script, documented limitations. Private commit/push per completed milestone; public visibility/deployment/submission need separate authorization.

Do not block the narrow prototype on multi-user accounts, Redis/Celery, Kubernetes, full observability, OAuth merchant onboarding, general web shopping or an enterprise procurement engine. These are not required by the agreed initial scope.

## Primary technical verification

Checked 16 October 2026: [DRF SessionAuthentication](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication) confirms anonymous requests need explicit CSRF enforcement; [Django row locking](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update) explains transaction/TransactionTestCase requirements; [PayPal Orders schema](https://developer.paypal.com/api/orders/v2/schema.json) defines provider order/capture fields; [PayPal idempotency guidance](https://developer.paypal.com/api/rest/reference/idempotency/) requires API-specific support/retention checks. The state machine and response contract above are application design decisions, not promises made by those vendors.
