# SpendConsent purchasing workspace

Updated 17 October 2026. Interface design and coordinated API contract for the build authorized on 16 October; frontend implementation remains behind the local-model readiness gate. This document does not authorize financial actions.

**Design read:** a calm purchasing workspace for small-business buyers, with predictable controls, a restrained teal accent, and native React/CSS. This is a task application, not a marketing site. The reviewed frontend taste skill explicitly excludes multi-step product UI; its relevant contrast, feedback, typography and consistency guidance informs this design, while landing-page image, hero, motion and package prescriptions do not apply.

Design variance 3, motion intensity 2, visual density 5. No new component library, icon set, remote font, image dependency or chart is necessary. Use system sans-serif, tabular numerals, real text labels and native controls. No fabricated savings, activity counters, testimonials or claims of verified AI/payment success.

## Workspace and visual system

Desktop: a compact 64px header with the SpendConsent wordmark, persistent **PayPal sandbox** indicator and one link to decision history. A maximum 1200px centered workspace uses a 300px request/context column and a flexible main decision area. The request summary stays visible through comparison and checkout. A narrow sequence reads **Request / Compare / Review / Payment**, with current step indicated by text and `aria-current`, not color alone. It reflects server state rather than a simulated progress percentage.

The first screen is the actual request form, not a landing page. Its title is **What supplies do you need?** The empty state offers the clearly labeled sample request: “Find exactly 40 microfiber cloths, 40 × 40 cm, under $60 including delivery and tax. One-time purchase only.” Selecting it populates the input; it never submits, approves or pays automatically. A visible **Sample merchant catalog. Fictional goods and prices.** note appears before results and on review.

Use semantic tokens: light background `#f4f7f7`, surface `#fcfdfd`, text `#18282b`, secondary text `#4b6063`, border `#c4d0d2`, accent `#126b62`, accent text `#fcfdfd`. Dark system preference swaps background `#101c1e`, surface `#17272a`, text `#edf5f4`, secondary text `#b2c5c6`, border `#516467`, accent `#7ad4c8`, accent text `#102c28`. Validate actual contrast before shipping. Semantic warnings/errors may use restrained amber/red with explicit text; they are not competing action accents. Corners: 8px inputs/buttons, 12px grouped review surfaces. Spacing scale: 4/8/12/16/24/32px. Body 16px/1.5, control labels 14px, page heading 28px, section heading 20px. No decorative gradient, glow, glass, confetti or animated typing.

Below 900px: request context becomes a normal full-width block above results, followed by optional disclosure of the original request. Below 600px: 16px gutters, single-column fields and option sections, full-width primary controls, no horizontal page scroll. Comparison changes from a semantic table to stacked offer sections with repeated visible labels. Review never hides price or material terms behind a horizontal scroll. No fixed mobile footer obscures focused fields or the on-screen keyboard.

## Interaction and state design

| State | Useful content and permitted actions |
| --- | --- |
| Request | Labeled multiline request, editable extracted constraints after inference, `Compare offers` action. Input stays intact on failure. Ctrl/Cmd+Enter may submit the request, never approve or pay. |
| Interpreting/comparing | Immediate visible busy state, named actual server stage if available, elapsed time, and clear statement that this may take up to the configured model timeout. No invented tool steps, percentage or thinking transcript. Disable duplicate submits. |
| Clarification | Plain question near the request and labeled fields for missing constraints; `Update request`. No guessed mandatory specifications. |
| Comparison | At most three results with declared specification, units per pack, pack count, individual units, delivery/tax/total, delivered unit cost and explicit match/rejection reasons. Label the lowest total only among retrieved eligible offers. Each eligible result has `Review purchase`; rejected results explain the issue and cannot advance. |
| No match | State which requirement excluded available offers. `Edit request` retains all prior input. Never silently relax exact quantity, dimensions or budget. |
| Review | Full merchant and item identity, SKU/variant, specification, pack and unit count, all charge lines, currency, shipping/destination fixture, one-time terms, quote version/time/expiry. Primary action `Approve exact cart`. Nothing prechecked or preapproved. |
| Approved | Show approved total and absolute expiry with countdown as secondary information. Separate `Start sandbox checkout` action. App approval does not imply PayPal buyer approval or captured payment. |
| Changed/expired | Describe exact old/new material values if server provides safe differences, invalidate local approval view, and offer fresh review. A smaller price still requires review. |
| Checkout | Load PayPal UI only when configured and explicitly requested. Distinguish app purchase initiation, PayPal buyer approval and server capture. Keep exact approved amount visible. |
| Pending/unknown | Say `Checking payment status` or `Payment status is unknown`. Only status/recovery/stop controls, never a new Pay button. Explain a timeout does not prove failure. |
| Stopped/declined | Display server reason; show fresh-review action only when server says the previous attempt is definitively safe to replace. |
| Verified paid | Show server-verified payment status, total, short purchase reference, timestamp and review summary. Say payment is confirmed; do not imply goods have shipped. |
| Payment review | A completed payment with mismatched details needs review. Do not describe it as a blocked/no-payment success or offer automatic refund/retry. |

Decision history is an ordinary timestamped event list: request, comparison, review, approval, changed terms, checkout and verification. It is not branded tamper-proof. Model-generated text is escaped as plain text. Actual inference results identify the model and actual status; deterministic fixture previews must be labeled **Fixture preview. AI did not run.** A model failure must never silently fall back to a fake AI success.

Initial-load failure offers `Retry connection`. Busy model response offers a manual retry without duplicate request creation. Field errors use `aria-describedby`; outcome changes use a polite live region, urgent payment uncertainty uses a concise alert. Keep a stable focus target on a new main heading; preserve the request focus during ordinary background status updates. Native Tab/Shift+Tab, Enter/Space and visible 3px focus outlines work everywhere. Minimum 44px action targets, no color-only status, no surprise autofocus on page load, reduced-motion mode disables optional transitions. Avoid success announcements on every poll.

## Shared JSON contract

Coordinated with architecture_audit. [Prebuild audit](prebuild-audit.md#stable-api-contract-for-backendfrontend-agreement) is the canonical field contract; routes remain those in system-design.md. Direct JSON objects, snake_case, opaque UUIDs, UTC ISO-8601 timestamps and integer `*_cents` are used throughout. Browser display strings never become authoritative prices. All POSTs use same-origin cookies and `X-CSRFToken`. No response returns session keys, REST secrets/tokens, raw provider bodies or model reasoning.

`GET /api/session` returns:

```json
{
  "environment": "sandbox",
  "csrf_token": "masked-runtime-value",
  "capabilities": {
    "ai_ready": false,
    "paypal_ready": false,
    "financial_actions_enabled": false
  },
  "current_request_id": null,
  "paypal": null
}
```

Configured `paypal` contains `client_id` and `currency: "USD"`; the actual ID is runtime-only and excluded from chat/logs/screenshots. Financial actions default disabled. Bootstrap uses `current_request_id` for refresh recovery without any stored owner identifier.

`POST /api/requests` accepts `{text, client_submission_id, constraints?}`. Retries reuse that submission UUID; a deliberately new purchase gets a new one. A different request under the same UUID is a conflict. Clarify accepts `{expected_version, constraints}`. GET and successful create/clarify/review/approve return this request envelope:

```text
id, version, status, text, constraints,
clarification: {question, missing_fields} | null,
candidates: Candidate[], excluded: [{offer_id, name, reasons}],
review: Review | null, approval: Approval | null,
attempt: Attempt | null, events: Event[],
model: {used, name, elapsed_ms, tool_calls} | null
```

Request status: `NEEDS_CLARIFICATION`, `COMPARING`, `READY`, `NO_MATCH`, `MODEL_ERROR`, `CHECKOUT`, `PAID`. Payment truth always comes from `attempt.state`. Actual inference means `model.used: true`; local fixture-only previews use `used: false` and a visible fixture label. Tool evidence is allowlisted names/result summaries, not raw prompts or hidden thought. Timing values must be measured.

```text
Candidate: id, offer_id, sku, name, specification, pack_units,
  packs, individual_units, currency, subtotal_cents, shipping_cents,
  tax_cents, discount_cents, total_cents, reasons, evidence
Review: id, version, request_version, digest, created_at, expires_at,
  merchant, item, shipping, terms, currency,
  subtotal_cents, shipping_cents, tax_cents, discount_cents, total_cents
Approval: id, review_id, approved_at, expires_at, status
Attempt: id, state, pending_operation, reason_code, created_at, updated_at,
  provider_order_id, capture_id, total_cents, currency, allowed_actions
Event: id, type, reason_code, message, created_at
```

Agreed nested Review shape:

```text
merchant: {id, name}
item: {offer_id, sku, variant_id, name, specification, pack_units, packs, individual_units}
shipping: {option_id, label, destination_ref, destination_label}
terms: {one_time: true, description}
```

Specification is a plain display string; structured attributes and configured payee binding remain authoritative server-side data. Merchant ID is the sample merchant's stable ID, not a browser-provided payment destination. Shipping is a synthetic configured reference. One-time terms must be validated before eligibility.

The agreed constraints shape is `{category, quantity, budget_cents, currency, one_time, attributes:{...}}`. The backend validates nested attributes by category: `width_cm` and `height_cm` for cloth, `capacity_l` for bags, `volume_ml` for bottles, and `paper_size` for notebooks. Currency is USD and one-time terms must be true. The catalog remains bounded to 12–20 sample SKUs. The frontend presents these nested attributes as plainly labeled editable fields; the backend freezes the trusted normalized constraints. Unknown required values or unsupported requirements need clarification or rejection, never invented defaults or silently discarded fields.

The server returns the full normalized review from trusted merchant facts; the browser does not reconstruct it from candidate/model prose. Review exposes only the synthetic shipping label/reference needed for the decision. Unit price is calculated for display with declared rounding, rather than storing rounded per-unit money.

| Mutation | Body / successful response |
| --- | --- |
| `/requests/{id}/reviews` | `{expected_version, candidate_id}` → updated request envelope |
| `/reviews/{id}/approve` | `{expected_version, expected_digest}` → updated request envelope |
| `/approvals/{id}/attempts` | `{}` → `{attempt}` |
| `/attempts/{id}/capture`, `/stop`, `/reconcile` | `{}` → `{attempt}` |

Attempt states: `CREATING`, `AWAITING_BUYER`, `CAPTURING`, `VERIFYING`, `UNKNOWN`, `PAID`, `STOPPED`, `PAYMENT_REVIEW`. Pending/unknown responses expose `allowed_actions: ["check_status", "stop"]` as appropriate; every endpoint independently enforces permission. SDK adapters obtain only the existing returned order ID; capture accepts no browser order/payee/amount. A duplicate in-progress mutation returns 202 with the same attempt, never a newly allocated purchase.

Error envelope: `{error: {code, message, fields?, retryable}, request_id?, attempt?}`. Review expiry/change returns 410/409. Handle malformed/non-JSON errors and CSRF/network failures safely. An HTTP error during a payment operation retains the attempt and prompts checking its status; it never proves no payment occurred. `MODEL_BUSY` may offer bounded request retry. An uncertain financial action offers status reconciliation only. No financial POST is automatically retried on mount, refresh, polling or reconnect.

## Frontend implementation and verification boundary

After the readiness gate: one Vite React app, one same-origin API module, a typed contract module, one workspace state owner and small request/comparison/review/status components only where it reduces complexity. Native CSS Grid, no router/state/query library needed for this one workspace. Abort stale request fetches, ignore outdated request versions, clear polling timers on unmount, and use bounded polling only for active operations. Do not send raw requests/results to console or analytics. No service worker or offline payment queue.

Verify TypeScript/build, narrow contract/error handling, keyboard completion, focus, mobile 360px and desktop 1280px, light/dark and reduced motion. Browser-test request → actual inference → comparison → review/approval with payment disabled first. Test changed/expired review, model unavailable/busy, no-match, refresh recovery and unknown outcome using labeled local test responses. Real PayPal actions wait for explicit action-time approval. Record actual measured frontend responsiveness separately from model wait; do not claim zero latency.
