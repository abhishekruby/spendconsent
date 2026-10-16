# Sandbox setup and safe verification

Checked 13 October 2026 against [PayPal REST quickstart](https://developer.paypal.com/api/rest/) and [OAuth authentication](https://developer.paypal.com/api/rest/authentication/).

## Observed account state

The user completed login in Chrome. The developer dashboard displayed sandbox mode, a Default Application, and a sandbox business account marked IN. The dedicated Merchant app was created and verified under the name **AI Hackathon 2026 Project Lab**: PayPal rejects app names containing “paypal.” The local workspace retains its full requested name.

## Credential workflow

1. In Developer Dashboard → Apps & Credentials, verify Sandbox.
2. Create the dedicated Merchant app against the sandbox business account. The user has approved this credential creation. Leave broader platform capabilities alone until the product requires them.
3. Confirm the dedicated app appears. Keep client secrets masked except when the user privately copies them.
4. The user enters its sandbox client ID and secret into the hidden prompts of `python3 scripts/sandbox_check.py --prompt` in this workspace. Do not send credentials in chat.

PayPal creates test buyer and business accounts by default. Sandbox-account login passwords differ from API client secrets. Any account upgrade or country-specific obstacle should be handled with the user; no live account change is authorized. [REST quickstart](https://developer.paypal.com/api/rest/).

## Safe API operation

The diagnostic calls only `POST https://api-m.sandbox.paypal.com/v1/oauth2/token` with `grant_type=client_credentials`. This authenticates the app without creating an order, invoice, payment, payout, or subscription. A successful token response proves credentials work for authentication; it does not prove a product flow or access to every PayPal API. [Authentication reference](https://developer.paypal.com/api/rest/authentication/).

The endpoint is fixed, TLS verification stays on, redirects are rejected, requests time out, and response bodies/Authorization headers are never logged. Success output includes only status, a boolean, and token lifetime. Tokens remain in memory and are not saved. A live environment setting is rejected.

## Evidence to record

Record date, sandbox app label, endpoint, HTTP status, and sanitized outcome in progress. Never record a token, client secret, full client ID, raw response, password, or authorization header. Offline self-test success is separate from an authenticated PayPal result.

## Capabilities for later evaluation

| Capability | Potential use | Gate |
| --- | --- | --- |
| [Orders/Checkout](https://developer.paypal.com/api/rest/) | Reviewed purchases | Payment approval required |
| [Invoicing](https://developer.paypal.com/invoicing/about) | Structured bill drafts | Sending and payment approval required |
| [Disputes](https://developer.paypal.com/platforms/disputes/overview) | Evidence organization | User reviews any response submission |
| [Webhooks](https://developer.paypal.com/api/webhooks/overview) | Payment-state updates | Verify signatures before trusting events |
| [AI Toolkit](https://github.com/paypal/AI-Toolkit) | Developer guidance and sandbox tools | Avoid granting unnecessary capabilities |

Additional API entitlement, geographic availability, and test-fixture behavior still need validation after product agreement.

## Verified test result

13 October 2026, 17:02 IST: the diagnostic returned HTTP 200, confirmed a bearer token, and reported a 32400-second lifetime. The token was discarded and no raw response was logged. This confirms sandbox authentication; the final product and other API capabilities remain undecided/untested.
