// Offline only: no SDK download, API calls, runtime flags or credentials.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync(fileURLToPath(new URL('../node_modules/.bin/tsc', import.meta.url)), [
  '--ignoreConfig', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--strict',
  '--skipLibCheck', '--lib', 'ES2022,DOM', '--outDir', '.test-build/paypal', 'src/paypal.ts',
], { cwd: root, stdio: 'inherit' });
const { preparePayPal } = await import('../.test-build/paypal/paypal.js');

test('sandbox SDK preparation keeps one persisted order and gates approval callbacks', async () => {
  const old = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  let appended = 0, eligible = true, eligibilityError = false, callbacks, startError = false, createError = false;
  const starts = [], approved = [], canceled = [], errors = [];
  const handlers = { onApprove: async id => approved.push(id), onCancel: id => canceled.push(id), onError: code => errors.push(code) };
  const sdk = {
    async findEligibleMethods(options) {
      assert.deepEqual(options, { currencyCode: 'USD', amount: '41.80' });
      if (eligibilityError) throw new Error('something went wrong when fetching eligible methods');
      return { isEligible(method) { assert.equal(method, 'paypal'); return eligible; } };
    },
    createPayPalOneTimePaymentSession(options) {
      if (createError) throw new Error('raw provider error must not escape');
      callbacks = options;
      return { async start(options, order) {
        if (startError) throw new Error('raw start error must not escape');
        starts.push([options, await order]);
      } };
    },
  };
  globalThis.window = {};
  globalThis.document = {
    querySelector: () => null,
    createElement(tag) { assert.equal(tag, 'script'); return {}; },
    head: { append(script) {
      appended++;
      assert.equal(script.src, 'https://www.sandbox.paypal.com/web-sdk/v6/core');
      globalThis.window.paypal = { async createInstance(options) {
        assert.deepEqual(options, { clientId: 'OFFLINE_TEST_ONLY', components: ['paypal-payments'], pageType: 'checkout' });
        return sdk;
      } };
      queueMicrotask(() => script.onload());
    } },
  };
  globalThis.fetch = () => { throw new Error('Network is forbidden in this check'); };
  const session = { environment: 'sandbox', csrf_token: 'a'.repeat(64), capabilities: { ai_ready: true, paypal_ready: true, financial_actions_enabled: true }, current_request_id: null, paypal: { client_id: 'OFFLINE_TEST_ONLY', currency: 'USD' } };
  const attempt = { id: '11111111-1111-4111-8111-111111111111', state: 'AWAITING_BUYER', pending_operation: null, reason_code: null, created_at: '2026-10-19T00:00:00Z', updated_at: '2026-10-19T00:00:00Z', provider_order_id: 'OFFLINETESTORDER', capture_id: null, total_cents: 4180, currency: 'USD', allowed_actions: ['open_paypal'] };
  const blocked = error => error.code === 'CHECKOUT_UNAVAILABLE';
  try {
    for (const flag of ['ai_ready', 'paypal_ready', 'financial_actions_enabled']) {
      await assert.rejects(preparePayPal({ ...session, capabilities: { ...session.capabilities, [flag]: false } }, attempt, handlers), blocked);
    }
    await assert.rejects(preparePayPal({ ...session, environment: 'live' }, attempt, handlers), blocked);
    await assert.rejects(preparePayPal(session, { ...attempt, provider_order_id: null }, handlers), blocked);
    await assert.rejects(preparePayPal(session, { ...attempt, state: 'UNKNOWN' }, handlers), blocked);
    assert.equal(appended, 0);

    const mismatched = await preparePayPal(session, attempt, handlers);
    await callbacks.onApprove({ orderId: attempt.provider_order_id }); // No click yet.
    assert.equal(approved.length, 0);
    await mismatched.start();
    assert.deepEqual(starts[0], [{ presentationMode: 'auto' }, { orderId: attempt.provider_order_id }]);
    await callbacks.onApprove({ orderId: 'DIFFERENTORDER' });
    assert.deepEqual(errors, ['CALLBACK_MISMATCH']);
    await callbacks.onApprove({ orderId: attempt.provider_order_id });
    assert.equal(approved.length, 0);

    const canceledFlow = await preparePayPal(session, attempt, handlers);
    await canceledFlow.start();
    callbacks.onCancel({ payerId: 'discarded', orderId: 'discarded' });
    await callbacks.onApprove({ orderId: attempt.provider_order_id });
    assert.deepEqual(canceled, [attempt.id]);
    assert.equal(approved.length, 0);

    const approvedFlow = await preparePayPal(session, attempt, handlers);
    await approvedFlow.start();
    await assert.rejects(approvedFlow.start(), blocked);
    await callbacks.onApprove({ orderId: attempt.provider_order_id, payerId: 'never-forwarded' });
    await callbacks.onApprove({ orderId: attempt.provider_order_id });
    assert.deepEqual(approved, [attempt.id]);

    const stale = await preparePayPal(session, attempt, handlers);
    await stale.start();
    stale.dispose();
    await callbacks.onApprove({ orderId: attempt.provider_order_id });
    assert.equal(approved.length, 1);
    eligible = false;
    await assert.rejects(preparePayPal(session, attempt, handlers), e => e.code === 'PAYPAL_INELIGIBLE');
    eligible = true;
    // A failed eligibility lookup is advisory: the persisted order can still open.
    eligibilityError = true;
    const advisory = await preparePayPal(session, attempt, handlers);
    await advisory.start();
    assert.deepEqual(starts.at(-1)[1], { orderId: attempt.provider_order_id });
    advisory.dispose();
    eligibilityError = false;
    createError = true;
    await assert.rejects(preparePayPal(session, attempt, handlers), e => e.message === 'SDK_UNAVAILABLE');
    createError = false;
    startError = true;
    await (await preparePayPal(session, attempt, handlers)).start();
    assert.deepEqual(errors, ['CALLBACK_MISMATCH', 'SDK_UNAVAILABLE']);
    assert.equal(appended, 1);
  } finally {
    for (const key of Object.keys(old)) {
      if (old[key] === undefined) delete globalThis[key]; else globalThis[key] = old[key];
    }
  }
});
