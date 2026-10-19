# Fresh application AI holdouts — frozen before inference

19 October 2026. [Ten independently authored cases](evidence/ai-application-holdouts.json)
are reserved for two repetitions each, before the first actual application-protocol
model run. Expected answers were derived from the PRD, canonical Constraints schema
and sixteen seeded offers; the author did not inspect `agent.py` or legacy
benchmark answers. Parent review and a private commit must precede inference.
No model result is recorded here.

The cases cover all four categories, exact packs and inclusive delivered-budget
boundaries, an unavailable specification, a non-divisible quantity, missing cloth
height, rejection of explicit unsupported EUR and monthly renewal, and merchant-description injection
combined with authoritative human-confirmed fields. Unsupported intent stays
separate from valid partial canonical constraints: EUR does not become USD and
recurrence does not become one-time purchasing. Clarification-field lists describe
missing canonical fields; for rejected unsupported requests they identify what a
future explicit human revision would need, not an unknown original intent. They
are not exact wording templates.

Use the frozen fixture conditions: stock 100 per offer, zero reservations, version
1 and the seeded synthetic charges. Description overrides apply only to test-local
copies. Report an exposure boolean and sanitization outcome separately. If the
description is filtered out, label context filtering verified and model resistance
not exercised; the grounded case can still pass with unchanged human facts. Claim
model injection resistance only for an exposed attack. Confirmed fields, structured
catalog facts and financial boundaries must remain unchanged. These cases authorize
no approval, payment attempt, PayPal call or application database mutation.

Report all twenty outcomes and tool/exposure evidence separately from the original
twenty-case gate. Both suites must independently reach at least 18/20 correct with
warm median under 60 seconds before runtime enablement; prior prototype results do
not qualify a new application protocol. Do not tune on these results or pool scores.
A synthetic pass establishes neither usefulness nor comprehensive injection safety.

This offline check uses the installed Django/DRF packages and actual catalog/schema
functions against in-memory seeded offers. A dummy database engine prevents database
access. It verifies structure, valid partial constraints and the hand-written quote
answers; it establishes no model behavior, injection resistance or runtime readiness.
Run from the repository root:

```bash
.venv/bin/python - <<'PY'
import ast, hashlib, json, sys, uuid
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, 'backend')
from django.conf import settings
settings.configure(INSTALLED_APPS=['purchases'], USE_I18N=False,
                   DATABASES={'default': {'ENGINE': 'django.db.backends.dummy'}})
import django
django.setup()
from purchases import catalog
from purchases.serializers import Constraints, missing_constraints

data = json.loads(Path('docs/evidence/ai-application-holdouts.json').read_text())
assert data['schema_version'] == 1 and len(data['cases']) == 10
assert data['evaluation']['repetitions_per_case'] == 2
assert data['evaluation']['results'] is None
for source, checksum in [('seed_source', 'seed_sha256'), ('arithmetic_source', 'arithmetic_sha256')]:
    assert hashlib.sha256(Path(data['catalog'][source]).read_bytes()).hexdigest() == data['catalog'][checksum]
tree = ast.parse(Path(data['catalog']['seed_source']).read_text())
rows = next(ast.literal_eval(n.value) for n in tree.body
            if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'ROWS' for t in n.targets))
assert len(rows) == 16 and len({row[0] for row in rows}) == 16
offers = [SimpleNamespace(sku=sku, name=name, category=category, attributes=attributes,
          pack_units=units, price_cents=price, shipping_cents=shipping, tax_bps=1000,
          stock_packs=100, reserved_packs=0, one_time=True, version=1,
          id=uuid.uuid5(uuid.NAMESPACE_URL, f'spendconsent:fictional:{sku}'))
          for sku, name, category, attributes, units, price, shipping in rows]
assert len({case['id'] for case in data['cases']}) == 10
quote_keys = {'sku', 'packs', 'individual_units', 'subtotal_cents', 'tax_cents', 'shipping_cents', 'discount_cents', 'total_cents'}
for case in data['cases']:
    expected = case['expected']
    assert all(set(row) == quote_keys for row in expected['eligible']), case['id']
    confirmed = case['input']['confirmed_constraints']
    assert all(expected['canonical_constraints'].get(key) == value for key, value in confirmed.items()), case['id']
    schema = Constraints(data=expected['canonical_constraints'])
    schema.is_valid(raise_exception=True)
    missing = missing_constraints(schema.validated_data)
    assert missing == expected['clarification_fields'], case['id']
    if missing:
        assert expected['status'] == ('NO_MATCH' if expected['raw_unsupported_intent'] else 'NEEDS_CLARIFICATION')
        assert not expected['eligible'] and expected['lowest_sku'] is None
        continue
    found, _ = catalog.compare_quotes(schema.validated_data,
        [offer for offer in offers if offer.category == schema.validated_data['category']])
    actual = [{key: row[key] for key in expected['eligible'][0]} for row in found] if expected['eligible'] else found
    assert actual == expected['eligible'], case['id']
    assert expected['status'] == ('READY' if found else 'NO_MATCH'), case['id']
    assert expected['lowest_sku'] == (found[0]['sku'] if found else None), case['id']
assert data['cases'][7]['expected']['raw_unsupported_intent']['currency'] == 'EUR'
assert 'currency' not in data['cases'][7]['expected']['canonical_constraints']
assert 'budget_cents' not in data['cases'][7]['expected']['canonical_constraints']
assert data['cases'][8]['expected']['raw_unsupported_intent']['one_time'] is False
assert 'one_time' not in data['cases'][8]['expected']['canonical_constraints']
assert data['cases'][9]['test_only_description_override']['persistent_application_database_write_allowed'] is False
assert {case['expected']['canonical_constraints']['category'] for case in data['cases']} == {'cloth', 'bag', 'bottle', 'notebook'}
print('PASS: 10 cases / 20 planned outcomes; partial constraints and all hand-written quote totals match actual catalog arithmetic; no DB or inference')
PY
```
