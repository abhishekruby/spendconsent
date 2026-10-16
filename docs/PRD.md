# Product requirements — SpendConsent

Version 0.3 · 16 October 2026 · Working name

The [detailed system design](system-design.md) and [implementation plan](implementation-plan.md) now specify the architecture. This is design authorization, not product-build agreement.

Planning stack revised to Django 5.2 LTS + Django REST Framework + PostgreSQL after the user's backend question. See architecture.md and stack-review.md; product scope remains the same.

Status: research-backed planning proposal. Research, user definition, PRD preparation, and tech-stack selection are authorized. This document does not record agreement to implement the final product, adopt paid services, publish, or execute sandbox payments.

## 1. Product and problem

**Product:** a purchasing assistant that compares routine business supplies, prepares an exact cart for human review, and checks that the approved purchase stays unchanged through PayPal sandbox checkout.

**Primary user:** the owner or administrator buying low-risk consumables for a small service business. A cleaning business buying cloths is the first illustrative scenario. The owner may also be the payer; separate employee/manager accounts are outside version one.

**Problem hypothesis:** checking specifications, pack sizes, and full delivered cost creates repetitive comparison work. AI can assist, but the buyer may repeat that work because recommendations can be unsuitable or checkout terms can change. We need to reduce the work while preserving a clear final decision.

The [research and users](research-and-users.md) document links the public evidence and direct competitors. It does not establish demand for this app, frequent PayPal use by this segment, days of manual work, or unique technology.

**Outcome hypothesis:** less active time preparing and reviewing a correct purchase than using the same catalog manually. No measured improvement is claimed yet.

## 2. A concrete example

The buyer asks: “Find exactly 40 microfiber cloths, 40 × 40 cm, for at most $60 including delivery and tax. One-time purchase only.” The assistant asks about any missing essential requirement, retrieves available offers, and presents suitable options.

All values below are fictional merchant fixtures, not live prices, tax advice, or supplier endorsements. Every offer belongs to the same sample merchant; the product does not claim market-wide best prices.

| Offer | Declared size / pack | Packs for 40 cloths | Subtotal | Delivery | Fixture tax | Total | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 40 × 40 cm / 10 | 4 | $36.00 | $8.00 | $3.60 | $47.60 | Matches; $1.19 per cloth delivered |
| B | 40 × 40 cm / 20 | 2 | $38.00 | $0.00 | $3.80 | $41.80 | Matches; lowest total among eligible retrieved offers |
| C | 30 × 30 cm / 10 | 4 | $32.00 | $5.00 | $3.20 | $40.20 | Reject: wrong size despite lower total |

The server calculates quantities and money. AI explains the options using returned facts; it does not invent stock, quality, tax rates, or arithmetic. If the buyer agrees, a review card shows the merchant, exact item and pack count, individual-unit count, specification, shipping option, currency, complete charges, one-time terms, and quote expiry.

The person explicitly approves that version, then starts PayPal sandbox checkout. If B changes to $45.10, it needs fresh approval even though the original $60 budget would allow it. Changing item or terms at the same price also needs fresh approval. A failed or uncertain payment is displayed accurately, with a way to check status.

## 3. Scope

**Must have:** one local buyer session; one authorized sample merchant; roughly 12–20 clearly labeled sample SKUs; one offer/SKU per purchase with an exact pack count; USD only; exact product identifiers and pack units; fixed synthetic delivery/tax quotes; actual model inference; bounded catalog tools; comparison and review; expiring exact-cart approval; approved real sandbox checkout; server-verified payment result; concise decision history; clear failure states.

**Later, only if the core succeeds:** a second independently connected merchant, repeat-order preferences, genuine shipping estimates, or a richer decision table. Each needs evidence of value and a verified zero-cost integration path.

**Excluded:** unrestricted web shopping, merchant impersonation or external-site testing, autonomous spending, recurring payments, live payments, refunds/payouts, escrow, card storage, multi-merchant settlement, full procurement ERP, mobile app, voice input, multi-agent orchestration, arbitrary browser/code-execution tools, and paid hosting. Actual goods and fulfillment are outside this sandbox prototype.

## 4. User journey and requirements

| ID | Requirement | Acceptance condition |
| --- | --- | --- |
| R1 | Capture the request and its constraints. | Item/category, specification, required individual-unit quantity, currency, maximum full total, and one-time-only preference are visible. Required ambiguity prompts a question; the app does not silently guess. |
| R2 | Retrieve real tool results from the sample catalog. | At least one actual model-driven tool call occurs. Candidate IDs exist in the catalog. Unknown fields remain unknown; no generated price becomes authoritative. |
| R3 | Produce a grounded comparison. | Show up to three options, pack count, individual-unit count, full total, delivered unit cost, and reasons for exclusion. Enforce exact quantity in version one; non-divisible packs require changing the request or reporting no match. |
| R4 | Prepare the exact purchase for human review. | A server-generated review card displays all financially or materially relevant fields, quote version/time/expiry, and evidence references. Nothing is pre-approved. |
| R5 | Record approval outside the AI's authority. | A direct user action approves one server-side snapshot in that browser session, once, with a five-minute validity target. AI tools cannot create, approve, renew, or consume approvals. |
| R6 | Reject changed or stale purchases. | Before creating a PayPal order and before capture, validate the bound snapshot, merchant facts, stock, quote, amount, currency, selected shipping, one-time terms, expiry, and session. Any change returns to review; remaining budget does not grant permission. |
| R7 | Complete an explicitly approved sandbox purchase. | Use the configured sandbox merchant and a separate sandbox buyer through PayPal's normal approval flow. Server-side create/capture only; no model-supplied payment destination or financial payload. No live endpoint permitted. |
| R8 | Confirm the actual outcome. | Compare trusted PayPal order/capture details with the stored order and approved purchase. Show success only for verified completed capture with matching amount, currency, payee, and order linkage. Browser callbacks alone are insufficient. This confirms payment, not delivery or product quality. |
| R9 | Handle retries, cancellation, and uncertain outcomes. | Repeated clicks cannot create a second intended purchase. Keep operation-specific idempotency keys and payment-attempt state. After a timeout, check the existing attempt; do not create another order or call it failed without evidence. Cancellation never triggers an automatic capture. |
| R10 | Explain what happened. | Show requested, compared, reviewed, changed/blocked, and verified states with concise reasons and timestamps. Technical diagnostics are separate and sanitized. Never display secrets, raw provider responses, or private model reasoning. |
| R11 | Remain usable and accessible. | Keyboard access, labeled inputs, visible focus, readable contrast, textual status messages, and clear retry paths. Approval and payment controls remain disabled when invalid or pending. Sandbox status is always apparent. |

The lab additionally requires explicit user approval at action time for any actual sandbox financial operation. A feature description or general decision to build is not that approval. No financial operation is authorized by this PRD.

## 5. AI responsibility and authority

Use one agent loop. The model interprets the request, chooses among allowlisted catalog/quote tools, asks useful clarification questions, and explains retrieved choices. Backend validation checks the arguments, constraints, totals, and results. The loop has a step/time limit and stops safely if the model produces malformed output or repeatedly fails.

Proposed AI tools are `search_catalog`, `get_offer`, and `compare_quotes`. They retrieve or calculate proposals only. Approval, PayPal create, and PayPal capture are human-driven application endpoints, never model tools. A model's “approved” message has no authority.

Merchant descriptions are untrusted data. Only structured merchant records establish product IDs, declared specifications, and quotes; descriptions cannot alter the user's budget or authorize a purchase. Test controlled malicious description text on our own fixtures. A passed fixture test does not establish comprehensive prompt-injection resistance.

Use synthetic catalog and request data. No passwords, API secrets, tokens, customer addresses, or private financial information enter model context. Local inference is the selected planning route; it still needs a hardware and reliability check.

## 6. Approval and payment states

```text
request → needs clarification OR comparing → review required
review required → explicitly approved → checkout → payment pending → verified paid
                                      ↘ canceled / declined / status unknown
changed quote, cart, terms, or expired approval → review required
```

An approval reserves one specific application payment attempt when checkout begins. It cannot be reused for a new order. Retrying that same attempt is different from granting a new purchase. Before irreversible steps, still check the quote and approval validity. If terms change or approval expires during checkout, do not capture; obtain a new review and start a new eligible attempt after resolving the previous one.

Persist state across refresh/restart. A network timeout must not erase the order ID, release a consumed approval for reuse, or hide the possibility of a completed capture. Local inventory/quote mutation and purchase reservation need transactional checks; do not hold database transactions open during external HTTP calls.

Architecture clarification: check approval expiry and material changes before dispatching capture, then freeze/honor the exact held quote. An operation already dispatched may still complete after expiry or cancellation; reconcile it rather than treating it as undone. Keep stock/attempt holds while an outcome is uncertain. Mixed-SKU baskets and third-party merchant quote guarantees are deferred.

## 7. Data and integration boundaries

Keep requests, merchant offers, immutable quote/review snapshots, approval records, payment attempts, and sanitized decision events in PostgreSQL through Django models/migrations. Store financial values as integer USD cents; use decimal formatting at the API boundary. Pack quantities are distinct from individual-unit quantities.

Tie approval to a canonical server-side snapshot covering session, request version, merchant/payee, item and variant IDs, declared specification, pack count, individual-unit count, currency, line prices, tax, delivery, discounts, total, shipping-option/destination reference, purchase terms, quote version, and expiry. Do not let the browser or model define the authoritative snapshot or total. A digest is an integrity comparison, not a substitute for authorization.

The sample merchant is authoritative within our demonstration only. A general buyer-side app cannot force an external merchant to honor a quoted price or keep inventory unchanged. Multi-merchant operation and production guarantees require further commercial and technical work.

## 8. Success measures and release gates

All numbers below are proposed acceptance targets, not achieved results. Record raw case outcomes rather than reporting a small synthetic suite as production accuracy.

| Measure | Method and target |
| --- | --- |
| Grounded task completion | Ten fixed functional cases, each run twice. At least 18/20 produce the correct supported cart, appropriate clarification, or justified no-match without fabricated facts. Expected answers are written before tuning; reserve additional unseen cases before submission. |
| Financial permission correctness | All deterministic cases for changed amount, same-price item change, currency/payee mismatch, expired/wrong-session approval, missing approval, and replay are rejected before the applicable financial action. Every violation is a release blocker. |
| Recovery | Cancellation, API decline, refresh, double click, timeout after request transmission, and backend restart produce no duplicate intended purchase and no unverified success. Begin with local fakes; real sandbox checks need approval. |
| User effort | Compare five equivalent manual and assisted tasks, alternating order. Target at least 30% lower median active comparison/review time with no increase in specification or total errors. Report wall-clock/model wait separately. Developer-only results are preliminary. |
| Local AI feasibility | On this laptop, target at least 18/20 valid, schema-checked task outcomes and a warm median request-to-review time under 60 seconds for the bounded catalog. Record startup time and slow cases. If unsuitable, stop and revise the model decision rather than using hidden paid inference or a fake AI. |
| Payment integration | After explicit permission: one actual user-approved sandbox journey and read-back matching the review. At present, only OAuth authentication has passed. |
| Zero-cost repeatability | Fresh local setup and ordinary run require no paid key, card, expiring sponsor trial, or hosted service. Disclose model download size and internet requirements. |

A failed usefulness comparison is a reason to revise or stop the product, even if the safety tests pass. Do not claim a purchase that normally takes minutes has been shortened from days.

## 9. Hackathon evidence and demo

The [official rules](https://paypalaihackathon.devpost.com/rules) give equal weight to five criteria. Prepare evidence rather than self-awarding scores:

| Criterion | Evidence to demonstrate |
| --- | --- |
| Implementation | Actual inference and tool choices, deterministic constraints, real approved PayPal sandbox flow, trustworthy recovery. |
| Design | Understandable comparison, exact review, clear changed-price explanation, and completed payment result. |
| Potential impact | Specific user and public problem evidence, plus measured task comparisons with limitations. |
| Innovation | Honest comparison with existing procurement/agent-control tools; show any actual advantage. This remains the weakest unproven part. |
| Presentation | One coherent story: request, comparison, review, changed-term block, fresh approval, verified sandbox outcome. |

Plan a public English demo under three minutes, a runnable public source repository with an appropriate open-source license, and reproducible setup instructions. Publishing/submission require authorization. Target deadline: 12 November 2026, noon Pacific, subject to rechecking the official schedule before submission.

Suggested video allocation: 20 seconds user/problem; 45 seconds real AI comparison; 30 seconds exact approval and changed-term rejection; 50 seconds approved sandbox checkout and verification; 20 seconds measured results and limitations. Total 2 minutes 45 seconds. If edited or time-compressed, label cuts and keep full reproducible evidence available; do not misrepresent prerecorded inference as live.

## 10. Delivery order and unresolved decisions

1. Review this scope, including its competitor overlap and single-merchant limitation. Record product/build agreement before implementation.
2. Prove local model feasibility with read-only sample tasks. No financial calls or feature expansion.
3. Implement comparison, review, and approval invariants; verify with fake payment responses.
4. With explicit action-time permission, integrate and verify one real sandbox purchase and recovery path.
5. Measure usefulness, improve accessibility and presentation, then prepare submission materials for review.

Open questions are evidence gates, not requests for the user to know merchants: will the local model work reliably; does this reduce review effort; does the single-merchant task matter enough; can real supplier access later support the proposed business; what demonstrable advantage remains over competitors? No market-fit or prize claim is justified until stronger evidence exists.
