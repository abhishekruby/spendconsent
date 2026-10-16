# Backend review: Django/PostgreSQL versus FastAPI/SQLite

16 October 2026. Planning decision, not an installation or implemented application.

## Recommendation

Use **Django 5.2 LTS + Django REST Framework + PostgreSQL** for the proposed product. Keep React/TypeScript/Vite and the separate local AI inference runtime. This supersedes the earlier FastAPI/SQLite planning choice; the product scope and safety boundaries remain the same.

The earlier choice optimized for a one-user local demonstration with minimal setup. The user's Django/PostgreSQL experience and interest in a product that could grow justify giving more weight to familiar development, migrations, sessions, and persistent approval/payment records. A read-only check also found PostgreSQL 16.15 already accepting local connections, which reduces the setup advantage SQLite previously had. Service readiness is not permission to reuse existing databases or proof that a project database exists.

## Comparison for this project

| Consideration | FastAPI + SQLite | Django + PostgreSQL |
| --- | --- | --- |
| Small local proof | Few moving parts; no database service. A reasonable original choice. | More application conventions and a database service, which is already present here. |
| User's experience | Python is familiar; this specific framework was not established as the user's main stack. | Matches the user's stated Django/PostgreSQL ERP experience; likely less framework learning during the deadline. This is a judgment, not a measured speed claim. |
| Sessions, authentication, CSRF | Can be implemented correctly, but selection/integration is application work. | Built-in facilities can be used directly. Multi-user features are still deferred until required. |
| Models and migrations | FastAPI does not choose an ORM or migration system. SQLite still supports constraints and transactions. | Django provides models/migrations; PostgreSQL supports concurrent transactional workloads and row locks. |
| Approval/payment coordination | Correct for the bounded single-user design with careful state transitions and SQLite transactions. | Explicit transactions and row locks suit later concurrent requests. They do not replace idempotency, exact-cart validation, or payment recovery. |
| AI integration | Convenient API framework with async support. | Can call the same model APIs and expose REST endpoints. A second FastAPI service is unnecessary for this short tool loop. |
| Cost | Free local tools; no hosting assumed. | Free local tools; no paid managed database assumed. Hosting is a separate future decision. |
| Main risk | Hand-assembling more product facilities as scope grows. | Adding unnecessary apps, permissions, services, and production infrastructure before the core works. Keep the scope narrow. |

Neither framework makes a project more innovative or guarantees a better judging score. The user-visible workflow, reliable implementation, measured usefulness, and demonstration matter more than the backend brand.

## Minimal Django plan

- Use one Django application server and DRF serializers/views for the React API and validated model-tool inputs. Keep the bounded agent loop as ordinary Python functions.
- Use Django sessions and CSRF protections. Avoid JWT, a custom account system, Redis, Celery, or microservices until an actual requirement exists.
- Use Django models, migrations, unique constraints, and short `transaction.atomic()` blocks. For consuming an approval, lock the relevant row with `select_for_update()` and perform a conditional state transition.
- Never hold a database transaction or row lock open while waiting for model inference, PayPal, or human checkout. Reserve state, commit, make the external request, then record/reconcile the result.
- Keep integer money amounts and explicit currency. Protect the same cart/version and operation-specific retry keys described in the PRD.
- Create a dedicated local database and least-privileged application role only when implementation requires them. Do not change an existing service, client database, password, listening address, or authentication policy.
- Django's admin can later help inspect sample catalog and sanitized state. It must not provide an unchecked way to approve or capture payments. An admin dashboard is not required for the first demo.
- Select the latest supported 5.2 LTS patch and compatible DRF/psycopg versions when installing; lock exact versions after verification. Do not install a newer major merely because it is latest.

The local model remains the larger feasibility uncertainty on an approximately 8 GB laptop. PostgreSQL and a development server add memory use; benchmark the whole working setup, not just a model in isolation.

## Primary references checked

- [Django releases/support](https://www.djangoproject.com/download/) — 5.2 is an LTS line supported through April 2028.
- [Django authentication](https://docs.djangoproject.com/en/5.2/topics/auth/) and [database transactions](https://docs.djangoproject.com/en/5.2/topics/db/transactions/).
- [Django row-lock API](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update) and [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html).
- [DRF 3.16 support announcement](https://www.django-rest-framework.org/community/3.16-announcement/) — documents Django 5.2 support; choose a currently compatible release at implementation.
- [PostgreSQL license](https://www.postgresql.org/about/licence/) — permissive local use.
- [FastAPI concurrency documentation](https://fastapi.tiangolo.com/async/) — async capability does not imply Django cannot call an AI API.
