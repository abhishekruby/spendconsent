# PayPal runtime preparation

Checked 20 October 2026. The sandbox runtime and browser SDK wiring are implemented
and default off. Owner verification passed 91 PostgreSQL tests, nine frontend
groups, the offline SDK check and production build. Independent checks cover
11 runtime and 26 checkout/race tests plus SDK lifecycle checks. All provider/model
responses in those tests are explicit fakes. Sandbox OAuth separately returned
HTTP 200 today; no actual order, capture or financial action has occurred.
AI qualification, actual SDK initialization and a concrete approved purchase remain
separate release gates. `PAYPAL_MERCHANT_ID` is missing from private configuration;
the existing seller's ID must be supplied privately before real checkout.

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

## Implemented runtime and browser path

`runtime_paypal.py` lazily loads owner-only sandbox configuration only when enabled.
Read-only reconciliation remains available for an existing attempt. No HTTP endpoint
can grant financial permission. A private action-time permission must bind the
owner, current request/review/digest/approval, configured seller, USD total,
explicit create/capture operations and expiry. The runtime rechecks it after OAuth
immediately before financial dispatch. The persisted attempt/idempotency keys bound
by approval prevent using permission to start another intended purchase.

The App now imports the inert SDK helper. Direct human actions start only the
server-approved cart, then open that attempt's existing order. SDK approval sends
only `{}` to the local attempt capture endpoint. Callback order IDs and browser
amounts never become server authority. Cancellation, errors, disposal and duplicate
callbacks cannot establish success. Only server read-back may do so.

Session/attempt changes dispose the SDK flow. A load failure offers a full page
reload, which resets the SDK cache and restores the saved attempt; it never creates
a replacement order. Existing status/stop controls remain accessible. Mutations
that fail recover with reads rather than automatic payment retries.

Offline checks from `frontend/`:

```bash
npm test
node --test tests/paypal.test.mjs
npm run build
```

## Remaining actual integration gates

1. Supply the existing sandbox seller Merchant ID privately in `.env`. The
   [official account lookup](https://developer.paypal.com/platforms/checkout/save-payment-methods/onboarding/platform/)
   uses sandbox.paypal.com → Account Settings → Business information → PayPal
   Merchant ID (checked 20 October). Do not create new credentials or change
   account settings. Newly configured reviews must use this binding; old placeholder
   payees are never upgraded into valid approval.
2. Pass the independent actual-AI suites and integrated browser flow. Prepare the
   exact review and human app approval, then obtain concrete action-time consent
   before writing any private create/capture permission or enabling dispatch.
3. Verify the actual SDK, separate sandbox buyer approval, Orders responses and
   independent read-back. Missing `shipping.options` currently fails closed before
   capture. If PayPal omits it, record the limitation and review a justified
   evidence-contract change before another approved test; stored shipping facts
   cannot masquerade as independently returned provider proof.
4. Demonstrate recovery without duplicates and preserve sanitized evidence. No
   test result above establishes authenticated SDK/Orders compatibility or payment
   success. Public deployment/submission remains unauthorized.
