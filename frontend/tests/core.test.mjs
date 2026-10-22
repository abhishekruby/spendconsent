import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Api, ApiError, safeApiError } from '../.test-build/api.js';
import { isAttempt, isConstraints, isLinkCreated, isLinkView, isMarket, isProgress, isPurchaseList, isPurchaseRequest, isSession, linkToken } from '../.test-build/contract.js';
import { canStartNew, locksRequest, money, newerAttempt, newerRequest, parseCents, pending, permitted, friendlyQuestion, purchaseDisplay, readRequest, savings, unitCost } from '../.test-build/logic.js';
import { Offer, PaymentStatus, PayPalCheckout, RefundPanel, ReviewCard, paymentTransitionNotice, receiptHtml } from '../.test-build/App.js';

// Explicit local test fixtures only. The running application has no seeded results.
const id = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const timestamp = '2026-10-18T00:00:00Z';
const charges = { currency: 'USD', subtotal_cents: 3800, shipping_cents: 0, tax_cents: 380, discount_cents: 0, total_cents: 4180 };
const candidate = { ...charges, id, offer_id: id2, sku: 'TEST-CLOTH-20', name: '<img src=x onerror=bad()>', specification: '40 × 40 cm microfiber', pack_units: 20, packs: 2, individual_units: 40, reasons: ['Exact quantity and size'], evidence: [{ offer_id: id2, offer_version: 3, source: 'sample_catalog', summary: 'Test catalog: 20 units per pack.' }] };
const review = { ...charges, id: id2, version: 2, request_version: 4, quote_version: 3, digest: 'a'.repeat(64), created_at: timestamp, expires_at: '2026-10-18T00:05:00Z', merchant: { id: 'test-merchant', name: 'Explicit test merchant' }, item: { ...candidate, variant_id: '40-cm' }, shipping: { option_id: 'standard', label: 'Standard delivery', destination_ref: 'fixture-office', destination_label: 'Synthetic office' }, terms: { one_time: true, description: 'No subscription.' }, evidence: candidate.evidence };
const attempt = { id, state: 'UNKNOWN', pending_operation: 'capture', reason_code: null, created_at: timestamp, updated_at: timestamp, provider_order_id: 'TEST-ORDER', capture_id: null, currency: 'USD', total_cents: 4180, allowed_actions: ['check_status', 'stop'], refund: null };
const request = { id, version: 4, text: 'Explicit test request', status: 'READY', constraints: { category: 'cloth', quantity: 40, budget_cents: 6000, currency: 'USD', one_time: true, attributes: { width_cm: 40, height_cm: 40 } }, clarification: null, candidates: [candidate], excluded: [], review, approval: null, attempt: null, events: [], model: null };
const session = { environment: 'sandbox', csrf_token: 'a'.repeat(64), capabilities: { ai_ready: false, paypal_ready: false, financial_actions_enabled: false }, current_request_id: null, paypal: null };

test('integer USD input, exact totals and rounded delivered unit cost', () => {
  assert.equal(parseCents('41.80'), 4180);
  assert.equal(parseCents('0.01'), 1);
  assert.equal(parseCents('10000.00'), 1000000);
  for (const input of ['0', '-1', '1.001', '1e3', '1,000', ' 4.20', '10000.01', 'Infinity', '01.20', '']) assert.equal(parseCents(input), null, input);
  assert.equal(money(4180), '$41.80');
  assert.equal(unitCost(4180, 40), '$1.05');
  assert.equal(unitCost(4760, 40), '$1.19');
  assert.throws(() => money(4.2));
  assert.throws(() => unitCost(4180, 0));
});

test('API boundary rejects unsupported currency, malformed quotes, units and authority', () => {
  assert.ok(isSession(session));
  assert.equal(isSession({ ...session, environment: 'live' }), false);
  assert.equal(isSession({ ...session, csrf_token: '' }), false);
  assert.ok(isPurchaseRequest(request));
  assert.ok(isConstraints({}));
  assert.equal(isConstraints({ ...request.constraints, owner_uuid: id }), false);
  assert.equal(isConstraints({ ...request.constraints, attributes: { width_cm: '40', height_cm: 40 } }), false);
  assert.equal(isConstraints({ category: 'bag', attributes: { width_cm: 40 } }), false);
  assert.equal(isPurchaseRequest({ ...request, candidates: [{ ...candidate, total_cents: 4181 }] }), false);
  assert.equal(isPurchaseRequest({ ...request, candidates: [{ ...candidate, individual_units: 39 }] }), false);
  assert.equal(isPurchaseRequest({ ...request, candidates: [{ ...candidate, total_cents: '4180' }] }), false);
  assert.equal(isPurchaseRequest({ ...request, model: { used: true, name: 'test-model', elapsed_ms: 1, tool_calls: [{ name: 'capture', status: 'completed', elapsed_ms: 1 }] } }), false);
  assert.equal(isAttempt({ ...attempt, allowed_actions: ['fresh_review'] }), false);
  assert.equal(isAttempt({ ...attempt, state: 'PAID', provider_order_id: null, capture_id: null }), false);
});

test('unknown, mismatched and terminal payment states never enable a fresh financial action', () => {
  assert.ok(pending(attempt));
  assert.equal(permitted({ ...attempt, allowed_actions: ['open_paypal', 'capture'] }, 'open_paypal', true), false);
  assert.equal(permitted({ ...attempt, state: 'AWAITING_BUYER', allowed_actions: ['capture'] }, 'capture', false), false);
  assert.equal(permitted({ ...attempt, state: 'PAYMENT_REVIEW', allowed_actions: ['stop', 'capture'] }, 'stop', true), false);
  assert.equal(permitted({ ...attempt, state: 'PAID', allowed_actions: ['capture'] }, 'capture', true), false);
  assert.ok(locksRequest({ ...request, attempt }));
  assert.equal(locksRequest({ ...request, attempt: { ...attempt, state: 'STOPPED' } }), false);
  for (const state of ['STOPPED', 'PAID']) assert.ok(canStartNew({ ...request, attempt: { ...attempt, state } }), state);
  for (const state of ['UNKNOWN', 'PAYMENT_REVIEW', 'AWAITING_BUYER', 'CAPTURING']) assert.equal(canStartNew({ ...request, attempt: { ...attempt, state } }), false, state);
  assert.ok(canStartNew(null));
  assert.equal(newerRequest(request, { ...request, version: 3 }).version, 4);
  assert.equal(newerRequest(request, { ...request, review: { ...review, version: 1 } }).review.version, 2);
  const paid = { ...attempt, state: 'PAID', updated_at: '2026-10-18T00:01:00Z' };
  const current = { ...request, attempt: paid };
  assert.equal(newerAttempt(current, attempt).attempt.state, 'PAID');
  assert.equal(newerRequest(current, { ...request, attempt }).attempt.state, 'PAID');
});

test('payment polling announces changed states once and leaves urgent states to their alerts', () => {
  for (const [state, title] of [['PAID', 'Payment confirmed'], ['STOPPED', 'Payment attempt stopped'], ['AWAITING_BUYER', 'Awaiting PayPal buyer approval'], ['VERIFYING', 'Verifying payment details']]) {
    const incoming = { ...attempt, state, updated_at: '2026-10-18T00:01:00Z' };
    assert.equal(paymentTransitionNotice(attempt, incoming), title);
    assert.equal(paymentTransitionNotice(incoming, { ...incoming, updated_at: '2026-10-18T00:02:00Z' }), null, 'unchanged polls remain quiet');
  }
  const capturing = { ...attempt, state: 'CAPTURING' };
  for (const state of ['UNKNOWN', 'PAYMENT_REVIEW']) {
    const incoming = { ...attempt, state };
    assert.equal(paymentTransitionNotice(capturing, incoming), '', 'clear stale polite text without duplicating the alert');
    const html = renderToStaticMarkup(createElement(PaymentStatus, { attempt: incoming, financialEnabled: false, busy: false, pollEnded: false, onAction() {} }));
    assert.equal((html.match(/role="alert"/g) ?? []).length, 1);
  }
  assert.equal(paymentTransitionNotice(attempt, { ...attempt, id: id2, state: 'PAID' }), null);
  assert.equal(paymentTransitionNotice({ ...attempt, updated_at: '2026-10-18T00:01:00Z' }, { ...attempt, state: 'PAID' }), null, 'stale responses do not announce a discarded state');
});

test('current request version drives visible offers while historical carts stay read-only', () => {
  const oldApproval = { id, review_id: review.id, status: 'REVOKED', approved_at: timestamp, expires_at: review.expires_at };
  const refreshed = { ...request, version: request.version + 1, approval: oldApproval };
  const consumed = { ...request, approval: { ...oldApproval, status: 'CONSUMED' }, attempt: { ...attempt, state: 'STOPPED' } };
  for (const saved of [refreshed, { ...refreshed, attempt: { ...attempt, state: 'STOPPED' } }, consumed]) {
    const display = purchaseDisplay(saved);
    assert.equal(display.stage, 'Compare');
    assert.equal(display.currentReview, null);
    assert.equal(display.currentApproval, null);
    assert.equal(display.collapseComparison, false, 'new READY offers remain visible');
    assert.equal(locksRequest(saved), false);
    const html = renderToStaticMarkup(createElement(Offer, {
      candidate, lowest: true, disabled: locksRequest(saved) || saved.status !== 'READY', onReview() {},
    }));
    assert.ok(html.includes('Review purchase'));
    assert.equal(/<button[^>]*disabled/.test(html), false, 'new offers can prepare a fresh review');
  }
  const historical = renderToStaticMarkup(createElement(ReviewCard, {
    review, approval: oldApproval, locked: true, disabled: true, onApprove() { throw Error('Historical review cannot approve'); },
  }));
  assert.equal(historical.includes('Approve exact cart'), false);
  assert.equal(purchaseDisplay(request).stage, 'Review');
  assert.equal(purchaseDisplay(request).currentReview, review);
  assert.equal(purchaseDisplay(request).collapseComparison, true);
  assert.equal(purchaseDisplay({ ...consumed, approval: null }).stage, 'Review', 'a fresh same-version review is current');
  assert.equal(purchaseDisplay({ ...consumed, review: { ...review, id } }).stage, 'Review', 'old consumed approval cannot hide a different fresh review');
  assert.equal(purchaseDisplay({ ...consumed, attempt: { ...attempt, state: 'PAID' } }).stage, 'Payment');
  assert.equal(purchaseDisplay({ ...consumed, attempt: { ...attempt, state: 'PAID' } }).currentReview, review);
  for (const state of ['CREATING', 'CAPTURING', 'VERIFYING', 'UNKNOWN', 'PAYMENT_REVIEW', 'AWAITING_BUYER', 'PAID']) {
    const saved = { ...refreshed, attempt: { ...attempt, state } };
    assert.equal(purchaseDisplay(saved).stage, 'Payment', state);
    assert.equal(purchaseDisplay(saved).collapseComparison, true);
    assert.equal(locksRequest(saved), true);
    assert.equal(purchaseDisplay(saved, true).stage, 'Request');
  }
});

test('same-origin session/CSRF and safe persisted MODEL_UNAVAILABLE recovery contract', async () => {
  const calls = [];
  const api = new Api(async (path, options) => {
    calls.push({ path, options });
    if (path === '/api/session') return Response.json(session);
    if (path === '/api/requests') return Response.json({ error: { code: 'MODEL_UNAVAILABLE', message: 'DO_NOT_DISPLAY_PRIVATE_PROVIDER_BODY', retryable: false }, request_id: id }, { status: 503 });
    return Response.json(request);
  });
  await assert.rejects(api.mutateRequest('/api/requests', {}), error => error instanceof ApiError && error.code === 'SESSION_REQUIRED');
  assert.equal(calls.length, 0);
  await api.session();
  await assert.rejects(api.mutateRequest('/api/requests', { text: 'test', client_submission_id: id }), error => error.code === 'MODEL_UNAVAILABLE' && error.requestId === id && !error.message.includes('PRIVATE'));
  const saved = await api.request(id);
  assert.equal(saved.id, id);
  assert.equal(calls[1].options.credentials, 'same-origin');
  assert.equal(calls[1].options.headers['X-CSRFToken'], session.csrf_token);
  assert.equal(calls[2].options.method, 'GET');
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
  await assert.rejects(api.call('https://example.com/api/session', isSession), error => error.code === 'INVALID_PATH');
  assert.equal(safeApiError({ error: { code: 'UNTRUSTED', message: 'PRIVATE' }, request_id: '<script>' }, 500).requestId, null);
  assert.equal(safeApiError({ error: { code: 'UNTRUSTED', message: 'PRIVATE' } }, 500).message.includes('PRIVATE'), false);
});

test('transport is called without the Api instance as its receiver, as browser fetch requires', async () => {
  let calls = 0;
  const api = new Api(function () {
    assert.equal(this, undefined, 'native browser fetch rejects the Api instance receiver');
    calls++;
    return Promise.resolve(Response.json(session));
  });
  assert.equal((await api.session()).environment, 'sandbox');
  assert.equal(calls, 1);
});

test('payment requests send only local authority and preserve uncertain attempts without POST retry', async () => {
  const calls = [];
  const api = new Api(async (path, options) => {
    calls.push({ path, options });
    if (path === '/api/session') return Response.json(session);
    if (options.method === 'POST') throw new TypeError('Test-only lost capture response');
    return Response.json({ attempt });
  });
  await api.session();
  await assert.rejects(api.mutateAttempt(`/api/attempts/${id}/capture`), error => error.code === 'CONNECTION_LOST');
  assert.equal((await api.attempt(id)).attempt.state, 'UNKNOWN');
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
  assert.equal(calls[1].options.body, '{}');
  assert.equal(calls[1].options.headers['X-CSRFToken'], session.csrf_token);
  const html = renderToStaticMarkup(createElement(PayPalCheckout, {
    session, attempt: { ...attempt, state: 'AWAITING_BUYER' }, busy: false, async onApprove() { throw Error('Rendering never captures'); },
  }));
  assert.ok(html.includes('Loading sandbox checkout'));
  assert.ok(/disabled=""[^>]*>Continue to PayPal sandbox/.test(html));
  assert.ok(html.includes('independent status check'));
});

test('non-JSON, malformed successful responses and interrupted calls fail safely without automatic POST retries', async () => {
  for (const response of [new Response('<html>private traceback</html>', { status: 403 }), Response.json({ ...session, environment: 'live' })]) {
    const api = new Api(async () => response);
    await assert.rejects(api.session(), error => error instanceof ApiError && !error.message.includes('private traceback'));
  }
  let calls = 0;
  const api = new Api(async () => { calls++; throw new TypeError('private network detail'); });
  await assert.rejects(api.session(), error => error.code === 'CONNECTION_LOST' && !error.message.includes('private network detail'));
  assert.equal(calls, 1);
});

test('labeled test UI renders exact packs, quote evidence and uncertainty, escaping model/catalog text', () => {
  const offer = renderToStaticMarkup(createElement(Offer, { candidate, lowest: true, disabled: false, onReview() {} }));
  assert.ok(offer.includes('Units per pack') && offer.includes('Individual units') && offer.includes('$41.80') && offer.includes('$1.05'));
  assert.ok(offer.includes('&lt;img'));
  assert.equal(offer.includes('<img'), false);
  const reviewHtml = renderToStaticMarkup(createElement(ReviewCard, { review, approval: null, locked: false, disabled: false, onApprove() {} }));
  for (const value of ['Explicit test merchant', 'Material quote version', 'Quote snapshot', 'Review expires', 'Synthetic office', 'One-time purchase', 'No subscription.', 'Material version 3']) assert.ok(reviewHtml.includes(value), value);
  assert.ok(reviewHtml.includes('Fictional goods and prices'));
  assert.ok(/disabled=""[^>]*>Approve exact cart/.test(reviewHtml));
  const unknown = renderToStaticMarkup(createElement(PaymentStatus, { attempt, financialEnabled: true, busy: false, pollEnded: false, onAction() {} }));
  assert.ok(unknown.includes('Payment status is unknown'));
  assert.ok(unknown.includes('Check existing payment status'));
  assert.equal(unknown.includes('Start sandbox checkout'), false);
  assert.equal(unknown.includes('Payment confirmed'), false);
  const mismatch = renderToStaticMarkup(createElement(PaymentStatus, { attempt: { ...attempt, state: 'PAYMENT_REVIEW', allowed_actions: ['check_status'] }, financialEnabled: true, busy: false, pollEnded: false, onAction() {} }));
  assert.ok(mismatch.includes('completed payment has mismatched details'));
  assert.equal(mismatch.includes('Request stop'), false);
});

test('live progress and consent mode are validated at the API boundary', () => {
  assert.ok(isProgress({ stage: 'READING' }) && isProgress({ stage: 'DONE' }));
  assert.ok(isProgress({ stage: 'UNDERSTOOD', constraints: request.constraints, eligible: 2, status: 'READY' }));
  for (const bad of [{ stage: 'READING', extra: 1 }, { stage: 'UNDERSTOOD', constraints: request.constraints, eligible: -1, status: 'READY' },
    { stage: 'UNDERSTOOD', constraints: { ...request.constraints, owner_uuid: id }, eligible: 1, status: 'READY' },
    { stage: 'UNDERSTOOD', constraints: request.constraints, eligible: 1, status: 'PAID' }, { stage: 'PAID' }]) assert.equal(isProgress(bad), false);
  assert.ok(isSession({ ...session, capabilities: { ...session.capabilities, consent_mode: 'buyer' } }));
  assert.equal(isSession({ ...session, capabilities: { ...session.capabilities, consent_mode: 'anyone' } }), false);
});

test('downloadable receipt shows the verified payment and escapes catalog text', () => {
  const html = receiptHtml(review, { ...attempt, state: 'PAID', capture_id: 'TESTCAPTURE1' });
  for (const value of ['$41.80 USD', 'TESTCAPTURE1', 'Paid, verified by the server', 'PayPal sandbox', '2 packs × 20 = 40 units']) assert.ok(html.includes(value), value);
  assert.ok(html.includes('&lt;img') && !html.includes('<img'));
});

test('purchase history accepts only a bounded list of valid requests', () => {
  assert.ok(isPurchaseList({ purchases: [request] }) && isPurchaseList({ purchases: [] }));
  assert.equal(isPurchaseList({ purchases: [{ ...request, status: 'LIVE' }] }), false);
  assert.equal(isPurchaseList({ purchases: Array(21).fill(request) }), false);
  assert.equal(isPurchaseList({ purchases: [request], extra: true }), false);
});

test('owner approval links are validated and only reach their own routes', async () => {
  const token = 'Ab_-'.repeat(11);
  assert.ok(linkToken(token) && !linkToken('short') && !linkToken('../api/session') && !linkToken(null));
  assert.ok(isLinkCreated({ token, expires_at: timestamp }));
  assert.equal(isLinkCreated({ token: 'x', expires_at: timestamp }), false);
  const view = { request, review_id: id2, capabilities: { ai_ready: true, paypal_ready: true, financial_actions_enabled: false, consent_mode: 'buyer' }, paypal: { client_id: 'abc', currency: 'USD' }, expires_at: timestamp };
  assert.ok(isLinkView(view));
  assert.equal(isLinkView({ ...view, paypal: { client_id: 'abc', currency: 'EUR' } }), false);
  assert.equal(isLinkView({ ...view, extra: 1 }), false);
  const paths = [];
  const api = new Api(async path => { paths.push(path); return Response.json(view); });
  assert.ok(isLinkView(await api.link(token)));
  await assert.rejects(api.link('../../session'), error => error.code === 'INVALID_PATH');
  assert.deepEqual(paths, [`/api/links/${token}`]);
});

test('market check accepts only bounded https listings', () => {
  const listing = { title: 'Cloths 24 Pack', domain: 'shop.example', url: 'https://shop.example/a', image: null, price_cents: 1599, units: 24, unit_cents: 67 };
  assert.ok(isMarket({ available: false }));
  assert.ok(isMarket({ available: true, source: 'Channel3', query: 'q', listings: [listing] }));
  assert.ok(!isMarket({ available: true, source: 'Channel3', query: 'q', listings: [{ ...listing, url: 'javascript:alert(1)' }] }));
  assert.ok(!isMarket({ available: true, source: 'Channel3', query: 'q', listings: [{ ...listing, image: 'http://x.example/i.png' }] }));
  assert.ok(!isMarket({ available: true, source: 'Channel3', query: 'q', listings: Array(6).fill(listing) }));
});

test('savings compares the chosen offer with the next one that fits', () => {
  const p = { candidates: [{ offer_id: 'a', total_cents: 4180 }, { offer_id: 'b', total_cents: 4760 }], excluded: [{ reasons: ['Wrong size.'] }] };
  assert.deepEqual(savings(p, 'a'), { vsNext: 580, fitting: 2, ruledOut: 1 });
  assert.equal(savings(p, 'b').vsNext, -580);
  assert.equal(savings({ candidates: [{ offer_id: 'a', total_cents: 1 }], excluded: [] }, 'a').vsNext, null);
});

test('refunds: only on a paid attempt, validated, and shown with an explicit confirm', () => {
  const paid = { ...attempt, state: 'PAID', capture_id: 'TEST-CAPTURE', pending_operation: null, allowed_actions: ['refund'] };
  const refund = { state: 'REFUNDED', total_cents: 4180, provider_refund_id: 'R1', updated_at: timestamp };
  assert.ok(isAttempt(paid));
  assert.ok(isAttempt({ ...paid, refund }));
  assert.equal(isAttempt({ ...attempt, refund }), false, 'an unpaid attempt has no refund');
  assert.equal(isAttempt({ ...paid, refund: { ...refund, state: 'DONE' } }), false);
  const offer = renderToStaticMarkup(createElement(RefundPanel, { attempt: paid, busy: false, onRefund() {} }));
  assert.match(offer, /Undo purchase/);
  assert.doesNotMatch(offer, /Yes, refund/, 'refunding needs a second, explicit click');
  assert.match(renderToStaticMarkup(createElement(RefundPanel, { attempt: { ...paid, allowed_actions: [], refund }, busy: false, onRefund() {} })), /Refunded in full/);
  assert.equal(renderToStaticMarkup(createElement(RefundPanel, { attempt: { ...paid, allowed_actions: [] }, busy: false, onRefund() {} })), '');
});

test('readRequest highlights the buyer words that grounded each value, without overlap', () => {
  const tags = (text, c) => readRequest(text, c).filter(r => r.field).map(r => `${r.field}:${r.text}`);
  const cloth = { category: 'cloth', quantity: 40, budget_cents: 6000, one_time: true, attributes: { width_cm: 40, height_cm: 40 } };
  assert.deepEqual(tags('Find exactly 40 microfiber cloths, 40 × 40 cm, under $60 including delivery and tax. One-time purchase only.', cloth),
    ['quantity:40', 'item:microfiber cloths', 'size:40 × 40 cm', 'budget:under $60', 'cost:including delivery and tax', 'terms:One-time']);
  const bags = { category: 'bag', quantity: 50, budget_cents: 4000, one_time: true, attributes: { capacity_l: 30 } };
  assert.deepEqual(tags('I need 50 garbage bags, 30 liters, max 40 dollars, once', bags),
    ['quantity:50', 'item:garbage bags', 'size:30 liters', 'budget:max 40 dollars', 'terms:once']);
  const text = 'need cloths';
  assert.equal(readRequest(text, { category: 'cloth' }).map(r => r.text).join(''), text, 'segments rebuild the exact text');
  assert.deepEqual(tags('20 notebooks', { quantity: 7 }), [], 'a value not in the words is never highlighted');
});

test('missing details are asked like a person, other messages untouched', () => {
  assert.equal(friendlyQuestion('Please confirm: quantity, budget_cents.', ['quantity', 'budget_cents']),
    'Please tell me how many you need and your max total (including delivery and tax).');
  assert.equal(friendlyQuestion('Confirm USD and one-time terms explicitly. Please confirm: currency.', ['currency']),
    'Confirm USD and one-time terms explicitly. Please tell me that prices are in US dollars.');
  assert.equal(friendlyQuestion('No sample offer meets the exact specification.', []), 'No sample offer meets the exact specification.');
});

test('short requests: number words and single item words are recognised', () => {
  const tags = readRequest('one spray', { category: 'bottle', quantity: 1, one_time: true }).filter(r => r.field).map(r => `${r.field}:${r.text}`);
  assert.deepEqual(tags, ['quantity:one', 'item:spray']);
  assert.deepEqual(readRequest('a dozen notebooks', { category: 'notebook', quantity: 12 }).filter(r => r.field).map(r => r.field), ['quantity', 'item']);
  assert.equal(friendlyQuestion('Please confirm: budget_cents, attributes.volume_ml.', ['budget_cents', 'attributes.volume_ml']),
    'Please tell me your max total (including delivery and tax) and the bottle size in ml.');
});

test('budgets written without a dollar sign are still shown as the max total', () => {
  const budget = (text, cents) => readRequest(text, { budget_cents: cents }).filter(r => r.field === 'budget').map(r => r.text);
  assert.deepEqual(budget('one spray 10 budget', 1000), ['10 budget']);
  assert.deepEqual(budget('cloths, budget of 60', 6000), ['budget of 60']);
  assert.deepEqual(budget('keep it under 40 with delivery', 4000), ['under 40']);
  assert.deepEqual(budget('max usd 25', 2500), ['max usd 25']);
});

test('voice input: exact words, optional on-device recognition, absent when unsupported', async () => {
  const { onDevice, recognitionClass, transcript } = await import('../.test-build/voice.js');
  assert.equal(recognitionClass({}), null, 'no button without browser speech support');
  class Fake {}
  assert.equal(recognitionClass({ webkitSpeechRecognition: Fake }), Fake);
  assert.equal(transcript([[{ transcript: 'fifty garbage bags ' }], [{ transcript: ' thirty liters  under $40' }]]), 'fifty garbage bags thirty liters under $40');
  assert.equal(await onDevice(Object.assign(class {}, { available: async () => 'available' }), 'en-IN'), true);
  assert.equal(await onDevice(Object.assign(class {}, { available: async () => 'downloadable' }), 'en-IN'), false);
  assert.equal(await onDevice(class {}, 'en-IN'), false);
});
