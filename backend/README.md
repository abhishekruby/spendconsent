# Local backend foundation

Local Django/DRF/PostgreSQL authority and default-off actual-model/sandbox runtime.
Tests use clearly labeled model/provider doubles and never prove actual AI quality
or real payment. Current evidence and unfinished gates live in
[PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md).

Actual AI requires an explicit server enable flag, an owner-only readiness marker
matching the qualified adapter/model, and healthy loopback inference. No marker
has been granted. The [application qualification protocol](../docs/ai-application-evaluation.md)
uses frozen in-memory offers with a dummy database; it qualifies model behavior,
not persistence/browser latency. Preserved failed reports remain evidence.

The sandbox runtime independently requires owner-only configuration and concrete
human action-time permission. Default startup neither loads private PayPal
credentials nor makes financial calls. See [runtime boundaries and setup](../docs/paypal-runtime-plan.md).

Tested platform: Ubuntu Linux x86-64, Python 3.12, uv, PostgreSQL 16 binaries at
`/usr/lib/postgresql/16/bin`, system libpq, and Node 22.14.0/npm 10 for the frontend.
The PostgreSQL helper intentionally uses that exact binary path. These are
prerequisites, not an arbitrary fresh-OS installer. Run from the repository root. Installation downloads free open-source Python packages;
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
The owner suite now passes 91 real-PostgreSQL checks, including runtime guards;
17 focused model-adapter checks also passed after the prompt-only clarification.
Independent combined verification passed 11 runtime and 26 checkout/race checks
plus offline SDK lifecycle checks. All provider/model responses in these tests
are explicit fakes. These do not establish real inference quality, authenticated
PayPal/SDK compatibility, accessibility, usefulness or release readiness.

`purchases/checkout.py` contains `start`, `capture`, `reconcile` and `stop` domain
functions. The first three require an explicit injected provider with
`create_order(payload, key)`, `capture_order(order_id, payload, key)` and
`get_order(order_id)`. `purchases/paypal.py` provides the sandbox adapter;
`runtime_paypal.py` wires it behind default-off configuration and an exact private
action-time permission checked at dispatch. There is no mock-payment endpoint.
See [runtime setup and remaining real-integration gates](../docs/paypal-runtime-plan.md).
Test-local fakes exercise the domain separately; they do not prove actual payment.

The adapter maps immutable persisted attempts to one USD purchase unit with exact
pack quantities, charges, merchant binding, review digest and a fully reviewed
fixed fictional destination. It permits only the fixed sandbox HTTPS origin,
verifies TLS, disables redirects/proxies, bounds responses/socket operations, keeps
tokens in memory and never retries a POST. Capture responses alone cannot establish
PAID; checkout performs an independent order GET. Read-back must match order,
payee, reference/digest, amount/breakdown, item and shipping facts before the
expected purchase is attached as verified domain evidence. Missing required fields
remain UNKNOWN; completed mismatches reach PAYMENT_REVIEW with their hold intact.
Actual sandbox field echoing, including shipping options, remains unverified.
Old generic destination labels and unconfigured payees cannot reach HTTP. See
[adapter mapping, evidence limits and remaining gates](../docs/paypal-integration.md).

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
Reviewed migration 0006 preserves existing human constraints as confirmed
authority. The team lead applied it to the application database without a reset:
the one version-3 request retained its exact 40-cloth, 40 × 40 cm, USD 6000-cent,
one-time requirements, with identical confirmed constraints backfilled. Counts
remained one request, 16 offers and zero payment attempts. Django/Vite were
restarted on loopback with AI disabled; qualification runs separately.
Prepared wiring claims work under short locks, runs model HTTP without database
transactions, then persists only a matching request-version/claim result. Stale
claims recover after 95 seconds. Inferred values cannot silently become human
confirmation during a partial clarification. Normal disabled behavior is retained.

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
