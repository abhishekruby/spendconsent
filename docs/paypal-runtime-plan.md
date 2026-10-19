# PayPal runtime preparation

Checked 19 October 2026. This is implementation preparation, not authenticated
PayPal evidence or financial authorization. No private configuration was read,
no credentials were created, no PayPal sandbox endpoint was called, and no SDK
was downloaded or executed. The application still disables PayPal and financial
actions. The independent actual-AI qualification remains a separate gate.

## Current official SDK contract

The [v6 setup page](https://developer.paypal.com/sdk/js/set-up/) was updated
13 October 2026. Its explicit authentication guidance recommends `clientId` for
standard one-time checkout and reserves client-token authentication for Fastlane.
The sandbox script is `https://www.sandbox.paypal.com/web-sdk/v6/core`.
Later initialization tables and examples on the same page still require a
`clientToken`; these conflict with that guidance. The selected implementation
follows the explicit standard-checkout guidance. Actual sandbox initialization
is required before claiming it works. Do not add a token endpoint or expose a
REST bearer token to work around an unverified SDK failure.

The [v6 reference](https://developer.paypal.com/sdk/js/reference/), updated
18 August 2026, documents `findEligibleMethods({currencyCode, amount})`,
`isEligible('paypal')`, `createPayPalOneTimePaymentSession`, and
`start({presentationMode: 'auto'}, orderPromise)`. The promise may retrieve an
existing order and resolves to `{orderId}`. `onApprove` supplies `data.orderId`;
approval may call the server. `onCancel` signals cancellation. Initialization,
eligibility and callbacks do not establish completed capture.

The [Orders GET reference](https://developer.paypal.com/api/orders/v2/orders-get)
specifies the stored ID path and an uppercase alphanumeric ID of at most 36
characters. Its example is intentionally incomplete for this application's
verification requirements. The [create schema](https://developer.paypal.com/api/orders/v2/orders-create)
makes `shipping.options` optional; selected shipping in a returned option
describes the buyer's selection. Documentation does not prove that this merchant
will return every required field. No partner, multiparty, Fastlane, agentic API
or additional payment-method entitlement is assumed.

## Prepared slice

[The new helper](../frontend/src/paypal.ts) is not imported by the application.
Importing it has no side effects. Calling it requires validated sandbox session
and attempt data, all three capability flags enabled, an allowed `open_paypal`
action, and an existing provider order. It loads only the fixed sandbox source
and refuses an unknown preloaded PayPal SDK. It passes only the browser-safe
client ID to SDK initialization, checks PayPal eligibility for the stored USD
total, and prepares a one-shot start function for a direct click.

It reopens the existing order; it has no create-order function. A matching
callback forwards only the local attempt ID to the caller's approval handler.
Mismatch, duplicate callbacks, cancellation, errors, disposal and repeat starts
cannot trigger that handler again. Raw SDK errors and payer data are discarded.
The caller must dispose on unmount/session/attempt changes and handle its own
server errors. A dispatched server operation still requires reconciliation.

Run the standalone offline check from `frontend/`:

```bash
node --test tests/paypal.test.mjs
```

This uses installed TypeScript and Node, a fake DOM and an explicitly fake SDK.
It compiles into the existing ignored `.test-build/` folder. It is not an SDK,
browser, OAuth, merchant, shipping-echo or financial integration test. No new
dependency or backend runtime switch was added.

## Next concrete integration

1. Review and wire the sandbox runtime with default capabilities off. Obtain
   the configured sandbox merchant binding without displaying credentials;
   update the fixture binding and require a fresh review and human approval.
   Never upgrade an old placeholder-payee review. Keep all credentials server
   side; session JSON may expose the browser-safe sandbox client ID only.
2. Add server enforcement for a bounded, explicit action-time human permission
   before enabling any real create/capture test. Its allowed request/review,
   merchant, amount, operation count and expiry must be concrete and checked at
   dispatch. A browser button, a model response, a PRD, a team-lead instruction
   or an environment flag alone does not supply the required human permission.
3. With that permission, the existing start endpoint calls `checkout.start` once.
   Bind the SDK helper to its returned attempt. Its approval handler calls only
   `/api/attempts/<local-id>/capture`; never accept browser totals or an arbitrary
   callback order ID as server authority. Preserve CSRF and session ownership.
   Cancellation may request local stop or status refresh, never capture.
4. Let the existing server capture path perform trusted GET, fresh exact-review
   checks, capture dispatch and independent GET reconciliation. SDK callbacks
   never display success. Refresh/restart loads the same persisted attempt;
   uncertain creation without an ID requires resolution rather than another
   order. Include an accessible native status/retry path and a visible SDK
   loading, eligibility or popup failure state.
5. Verify actual returned merchant, order, item, shipping and capture evidence
   against the immutable review. Missing `shipping.options` currently fails
   closed before capture; completed mismatches stay in payment review with the
   hold intact. If PayPal omits that field, record the limitation and review a
   justified evidence-contract change before another approved test. Do not
   silently copy stored shipping into independent provider proof or mark PAID.

Production build and offline checks can validate this prepared code. Completing
these gates still requires a genuine approved buyer journey and sanitized
read-back evidence; no account readiness or payment success is claimed here.
