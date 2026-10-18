# Local backend foundation

This implements the deterministic SpendConsent authority and checkout-domain foundation. Actual AI
comparison is unavailable: normal create/clarify calls save the request and return
HTTP 503 `MODEL_UNAVAILABLE` with its `request_id`. GET reconstructs the saved
canonical request envelope. There is no canned successful AI response. Every
financial capability is false; no PayPal client, actual financial HTTP call or private `.env`
loading exists in this milestone. The checkout domain is exercised only by injected test-local provider fakes. The application server is not started by setup.

Run these commands from the repository root with the installed Python 3.12, uv and
PostgreSQL 16 binaries. Installation downloads free open-source Python packages;
it needs internet once and no key, account, card, trial or hosted service.

```bash
uv venv .venv --python /usr/bin/python3
uv pip sync --python .venv/bin/python --require-hashes backend/requirements.txt
python3 scripts/local_postgres.py --self-test
python3 scripts/local_postgres.py --init --start
.venv/bin/python backend/manage.py migrate --noinput
.venv/bin/python backend/manage.py check
.venv/bin/python backend/manage.py test purchases --keepdb --noinput
.venv/bin/python backend/manage.py runserver 127.0.0.1:8000 --noreload
```

Reuse an existing project `.venv`; do not recreate it on ordinary startup. For
subsequent runs, use `local_postgres.py --start` then `runserver`. PostgreSQL starts
manually with TCP disabled, low memory settings and no global daemon. The helper
never resets/deletes a cluster or stops another process. It refuses an unknown
existing cluster, insecure socket directory, occupied socket, unexpected database
owner or privileged application role. Preserve project runtime data; reset/deletion
requires a separate explicit decision. The helper prints only its sanitized
project database/socket/role/PID identity.

The ignored `.runtime/postgres-data` and short `/tmp/spendconsent-<uid>-<path hash>`
socket directory are owner-only. Explicit peer maps use the local OS user for the
separate `spendconsent_bootstrap` setup owner and `spendconsent_app` application
role. The latter is nonsuperuser with neither CREATEDB nor CREATEROLE. Only the
project `spendconsent` and precreated `test_spendconsent` databases accept this role.
No existing shared service, role, database or server configuration is modified.

Use `--keepdb --noinput` for tests: the application role cannot create databases.
Django may emit its standard warning that this restricted role cannot connect to
the `postgres` maintenance database; the isolated application/test database paths
remain the only allowed connections. The transactional tests independently assert
the test database and narrow role identity. The test runner flushes **only** this
dedicated project test database; tests never reset the application database.

Settings create one random Django signing key in an ignored owner-only runtime
file and reuse it across restarts. No key is printed or read from private PayPal
configuration. Local HTTP cookies use HttpOnly session cookies and Strict
SameSite. Host checks allow loopback hosts; CSRF explicitly checks every anonymous
unsafe endpoint and limits cross-origin allowances to the two declared loopback
Vite origins. DEBUG is false; error responses are sanitized JSON. No admin, login,
public catalog editor, fixture mutation or mock-payment endpoint is exposed.

The migration seeds 16 clearly fictional offers in four categories. Trusted
catalog functions compute exact pack quantities and integer cents, including
fixed synthetic half-up tax and delivery. PostgreSQL constraints and triggers
back immutable reviews/approvals, material quote versions, stock ranges and retry
uniqueness. The authority services lock request → approval → offer and perform no
network I/O. Reviews last ten minutes; approval expires at the earlier of quote
expiry or five minutes after approval. Repeated approval cannot renew it.

The foundation tests cover catalog totals, constraints, session/CSRF/ownership,
retry conflicts, immutable/current review, approval expiry/revocation, changed
facts, edit blocking for unresolved/paid attempts and three real row-lock races.
They call deterministic comparison directly only in clearly named test setup.
The complete suite now contains 46 real-PostgreSQL checks: the original 24 plus
22 checkout-domain checks, with no provider HTTP. These do not establish real
inference, actual PayPal dispatch/capture/read-back, provider-specific idempotency,
browser accessibility, usefulness or release readiness.

`purchases/checkout.py` contains `start`, `capture`, `reconcile` and `stop` domain
functions. The first three require an explicit injected provider with
`create_order(payload, key)`, `capture_order(order_id, payload, key)` and
`get_order(order_id)`. The only implementation is a fake inside the test file.
There is no runtime provider loader, mock-payment endpoint or capability switch.
Create/capture/reconciliation API routes retain their visible disabled responses.
The future real adapter must independently verify provider facts and preserve the
approved snapshot-to-payload mapping; the normalized test contract is not a claim
that these internal objects are supported PayPal REST payloads.

Checkout transactions reserve available packs and persist unique operation keys,
exact payload and state before dispatch. Independent PostgreSQL connections prove
request/approval/offer rows are unlocked during every simulated provider call.
Capture reads provider approval first, then revalidates the current immutable
review and five-minute approval under locks immediately before claiming dispatch.
Its own reservation counts toward availability. The sent quote stays immutable
even if future catalog facts change after that claim.

Repeated or crash-persisted operations never automatically resend. An unknown
create without an order ID requires manual resolution, rather than an invented
lookup. An APPROVED order cannot resolve an uncertain capture; PENDING retains its
hold. Completed mismatches enter PAYMENT_REVIEW and block replacement. Stopping
uncertain work cannot undo it or release stock. Verified matching completion
consumes/releases stock exactly once. Cancellation, stock competition, timeout,
crash, mismatch and duplicate-dispatch cases use test-local fakes only.

Migrations 0004/0005 add payload/dispatch persistence, paid-request uniqueness and
an immutable-attempt database trigger. Apply the reviewed migrations before
starting updated backend code. They add schema only and do not reset application
requests/catalog data. Tests apply them only to the dedicated test database.

Direct dependency versions were checked against primary release metadata on
17 October 2026. All installed transitive versions are hash-locked in
`requirements.txt`; no compiled/bundled psycopg extra is installed, so the pure
Python driver uses the existing system libpq.

| Package | Locked version | Installed metadata/license file | Primary release metadata |
| --- | --- | --- | --- |
| Django | 5.2.18 | BSD-3-Clause | [PyPI](https://pypi.org/pypi/Django/5.2.18/json) |
| djangorestframework | 3.18.3 | BSD-3-Clause | [PyPI](https://pypi.org/pypi/djangorestframework/3.18.3/json) |
| psycopg | 3.3.6 | LGPL-3.0-only | [PyPI](https://pypi.org/pypi/psycopg/3.3.6/json) |
| asgiref | 3.12.1 | BSD-3-Clause | [PyPI](https://pypi.org/pypi/asgiref/3.12.1/json) |
| sqlparse | 0.6.0 | BSD-3-Clause (installed LICENSE; metadata identifies BSD) | [PyPI](https://pypi.org/pypi/sqlparse/0.6.0/json) |
| typing-extensions | 4.16.0 | PSF-2.0 | [PyPI](https://pypi.org/pypi/typing-extensions/4.16.0/json) |

To deliberately refresh the lock after compatibility/license checks:

```bash
uv pip compile backend/requirements.in --generate-hashes --output-file backend/requirements.txt
```
