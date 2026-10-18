# Local backend foundation

This implements the deterministic SpendConsent authority foundation. Actual AI
comparison is unavailable: normal create/clarify calls save the request and return
HTTP 503 `MODEL_UNAVAILABLE` with its `request_id`. GET reconstructs the saved
canonical request envelope. There is no canned successful AI response. Every
financial capability is false; no PayPal client, financial call or private `.env`
loading exists in this milestone. The application server is not started by setup.

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
They do not establish real inference, provider dispatch, capture/recovery, stock
competition under payment, browser accessibility, usefulness or release readiness.

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
