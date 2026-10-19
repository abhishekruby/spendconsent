# Sandbox REST adapter — isolated implementation checkpoint

19 October 2026. `backend/purchases/paypal.py` implements an **unwired** sandbox
client. Its tests mock the actual urllib opener; no actual OAuth, Orders, capture,
private configuration or financial operation was used for this checkpoint. Normal
API capabilities remain false and payment endpoints remain disabled. This is not
proof of PayPal account/API/SDK readiness or a completed sandbox purchase.

Verification: all 10 adapter tests and the full 56-test PostgreSQL suite pass; the
final full run took 16.193 seconds. Django checks, migration-drift check and
whitespace checks pass. Independent review is pending. The tests inspect actual
urllib request bodies/headers through a mocked opener and separately forbid real
HTTPS connections. No application database, running server or runtime flags were
changed by this isolated adapter verification.

The client permits only HTTPS `api-m.sandbox.paypal.com` and fixed OAuth,
create-order, read-order and capture-order paths. It checks identifiers before URL
construction, verifies TLS, disables proxies and redirects, bounds responses to
256 KiB and socket operations to 15 seconds, rejects malformed/duplicate-key JSON,
and never retries a POST. A 401 clears its memory token without replaying the
operation. Credentials, Basic authorization and cached bearer tokens stay only in
memory; exceptions contain allowlisted codes, never raw errors, headers or bodies.
The socket timeout is an inactivity timeout rather than a hard wall-clock
cancellation guarantee; a dispatched operation remains uncertain on transport
failure. No new dependency, client loader, runtime fake or enable switch exists.

## What is mapped and checked

The wire body contains one `CAPTURE` purchase unit, the attempt UUID reference,
review digest as `custom_id`, the explicitly configured sandbox merchant ID, USD
amount/breakdown, one SKU with pack quantity and per-pack amount, and the fixed
fictional shipping details. Capture sends an empty JSON body and a different
persisted operation key. A successful capture response alone cannot establish
PAID; checkout independently reads the stored order afterward.

The read normalizer requires matching order ID/intent, exactly one purchase unit,
reference/digest/payee, total and breakdown, item name/SKU/specification description,
pack quantity/unit amount, recipient/address and selected shipping option. Missing
echoable fields fail closed, even where a minimal official example omits them.
Only after those checks does it attach the immutable expected purchase to the
normalized observation. Matching completed capture ID/status/amount/final-capture
evidence is still required by the checkout verifier. Multiple captures, changed
facts or missing completed evidence cannot produce PAID.

`PaymentAttempt.create_payload`, snapshot, operation keys and provider order ID
provide the persistent mapping. A new client instance reads this data from
PostgreSQL rather than relying on an in-memory order map. Local offer identity,
individual units, request/review relationship, one-time application terms and
destination-reference meaning remain bound by that immutable mapping/digest;
copying them into a normalized object is **not independent provider evidence** of
product quality, fulfillment, tax correctness or supplier promises.

HTTP errors including `ORDER_ALREADY_CAPTURED`, timeout, 5xx, parse failure and
verification failure are uncertain, never definitive-decline exceptions. Safe
read facts can preserve PENDING or a matching decline. A completed mismatch reaches
PAYMENT_REVIEW with its stock hold intact; incomplete evidence reaches UNKNOWN.
Safe diagnostics include allowlisted issues, order/capture identifiers, status,
currency and cents only. Payer identity, email, address and raw provider responses
are discarded. Expanded durable mismatch-detail events remain integration work;
the current domain already preserves PAYMENT_MISMATCH, capture ID and snapshot.

## Fixed destination v1

The existing `sample-business` reference has this immutable v1 source mapping:

> Fictional sample only — SpendConsent Demo Business, 100 Fictional Supply Lane,
> San Jose, CA 95131, US

Future review snapshots display this full label and bind it in their digest. The
wire mapper requires both the exact label and reference, then uses the same
recipient/postal fields with `SET_PROVIDED_ADDRESS` and the single fixed synthetic
shipping option. It accepts no arbitrary address override. This is fictional
demonstration data, not an address or fulfillment guarantee. Any later destination
change needs a new reference and fresh review; do not rewrite this v1 mapping.
Existing immutable reviews are unchanged. Old generic labels and unconfigured
payee bindings are refused before any HTTP call; real merchant configuration must
precede a fresh review. No old review is silently promoted into a configured one.

## Primary API references and remaining gates

Official sources checked 19 October: [Orders create](https://developer.paypal.com/api/orders/v2/orders-create),
[Orders read](https://developer.paypal.com/api/orders/v2/orders-get),
[Orders capture](https://developer.paypal.com/api/orders/v2/orders-capture), and the
[Orders schema](https://developer.paypal.com/api/orders/v2/schema.json). These
describe the amount, item, payee, shipping and capture fields used here. The
adapter deliberately requires more read-back evidence than minimal examples.
Whether this sandbox merchant actually echoes every required field, including
shipping options, has not been verified; an omission blocks payment verification
rather than inventing proof.

[SDK v6 setup](https://developer.paypal.com/sdk/js/set-up/) remains a separate
integration gate: standard-checkout client-ID initialization is the selected
default, while inconsistent later token examples still need sandbox verification.
The actual-AI gate, reviewed SDK/runtime wiring, configured merchant binding,
action-time approval for each real financial test, one genuine buyer journey and
trusted read-back, recovery evidence, browser accessibility and usefulness targets
all remain required. No gate is relaxed by this isolated adapter checkpoint.

Run from the repository root with the existing isolated project PostgreSQL:

```bash
.venv/bin/python backend/manage.py test purchases.test_paypal --keepdb --noinput
.venv/bin/python backend/manage.py test purchases --keepdb --noinput
```
