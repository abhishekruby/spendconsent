import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Api, ApiError } from './api.js';
import type { Attempt, Candidate, Charges, Constraints, Evidence, PurchaseRequest, Review, Session } from './contract.js';
import { locksRequest, money, newerAttempt, newerRequest, parseCents, pending, permitted, unitCost } from './logic.js';

const sample = 'Find exactly 40 microfiber cloths, 40 × 40 cm, under $60 including delivery and tax. One-time purchase only.';
const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value));
const idShort = (id: string) => id.slice(0, 8);
const titles: Record<PurchaseRequest['status'], string> = {
  NEEDS_CLARIFICATION: 'A few details to confirm', COMPARING: 'Comparison in progress', READY: 'Compare suitable offers',
  NO_MATCH: 'No matching offer', MODEL_ERROR: 'Request saved. AI is not ready.', CHECKOUT: 'Your purchase status', PAID: 'Your purchase status',
};

export function App() {
  const [api] = useState(() => new Api());
  const [session, setSession] = useState<Session | null>(null);
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [busy, setBusy] = useState('Connecting to the local workspace');
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [draftMode, setDraftMode] = useState(true);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [pollEnded, setPollEnded] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const operation = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const submission = useRef<{ text: string; id: string } | null>(null);
  const pollCount = useRef({ id: '', count: 0 });
  const stage = draftMode ? 'Request' : request?.attempt ? 'Payment' : request?.review ? 'Review' : request && ['READY', 'NO_MATCH'].includes(request.status) ? 'Compare' : 'Request';
  const focusRequested = useRef(false);

  useEffect(() => {
    if (focusRequested.current) { heading.current?.focus(); focusRequested.current = false; }
  }, [stage, request?.id, request?.version, request?.status, request?.review?.id, draftMode]);
  useEffect(() => { void connect(); return () => { generation.current++; operation.current?.abort(); }; }, []);

  function begin(label: string) {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    generation.current++;
    setBusy(label); setError(null); setNotice('');
    return { controller, serial: generation.current };
  }
  async function connect() {
    const { controller, serial } = begin('Connecting to the local workspace');
    try {
      const next = await api.session(controller.signal);
      if (generation.current !== serial) return;
      setSession(next);
      if (next.current_request_id) {
        setRecoveryBlocked(true);
        const saved = await api.request(next.current_request_id, controller.signal);
        if (generation.current !== serial) return;
        setRequest(old => newerRequest(old, saved)); setText(saved.text); setDraftMode(false);
        setRecoveryBlocked(false);
        setNotice('Saved request restored from this browser session.');
      } else if (request) {
        setRecoveryBlocked(true);
        setError(new ApiError('SESSION_CHANGED', 'This browser session no longer identifies the saved purchase. Its previous payment outcome must be resolved before a replacement purchase.'));
      }
    } catch (e) { if (!controller.signal.aborted && generation.current === serial) setError(asError(e)); }
    finally { if (generation.current === serial) setBusy(''); }
  }
  async function recover(id: string | null, signal: AbortSignal, serial: number) {
    // Read-back only: a failed mutation never triggers a second POST.
    let target = id;
    if (!target) {
      const next = await api.session(signal);
      if (generation.current !== serial) return;
      setSession(next); target = next.current_request_id;
    }
    if (target) {
      setRecoveryBlocked(true);
      const saved = await api.request(target, signal);
      if (generation.current !== serial) return;
      setRequest(old => newerRequest(old, saved)); setDraftMode(false);
      setRecoveryBlocked(false);
    }
  }
  async function mutate(path: string, body: unknown, label: string) {
    if (busy) return;
    focusRequested.current = true;
    const { controller, serial } = begin(label);
    try {
      const saved = await api.mutateRequest(path, body, controller.signal);
      if (generation.current !== serial) return;
      setRequest(old => newerRequest(old, saved)); setDraftMode(false);
      setNotice(path.endsWith('/approve') ? 'Exact cart approval recorded. No payment has been made.' : 'Saved request updated.');
    } catch (e) {
      if (controller.signal.aborted || generation.current !== serial) return;
      const failure = asError(e);
      setError(failure);
      if (failure.attempt) setRequest(old => newerAttempt(old, failure.attempt!));
      try { await recover(failure.requestId ?? request?.id ?? null, controller.signal, serial); }
      catch { if (!controller.signal.aborted && generation.current === serial) setNotice('Saved status could not be reloaded. Use Reload saved status before retrying.'); }
    } finally { if (generation.current === serial) setBusy(''); }
  }
  async function refresh() {
    if (!request || busy) return;
    const { controller, serial } = begin('Reloading saved status');
    try {
      await recover(request.id, controller.signal, serial);
      if (generation.current === serial) setNotice('Saved status reloaded.');
    } catch (e) { if (!controller.signal.aborted && generation.current === serial) setError(asError(e)); }
    finally { if (generation.current === serial) setBusy(''); }
  }
  async function attemptAction(action: 'reconcile' | 'stop') {
    const attempt = request?.attempt;
    if (!attempt || busy || !permitted(attempt, action === 'reconcile' ? 'check_status' : 'stop', false)) return;
    const { controller, serial } = begin(action === 'reconcile' ? 'Checking the existing payment status' : 'Requesting a stop');
    try {
      const result = await api.mutateAttempt(`/api/attempts/${attempt.id}/${action}`, controller.signal);
      if (generation.current !== serial) return;
      setRequest(old => newerAttempt(old, result.attempt));
      await recover(request!.id, controller.signal, serial);
      if (generation.current === serial) setNotice(action === 'stop' ? 'Stop request processed. See the stored payment state below.' : 'Existing payment status checked.');
    } catch (e) {
      if (controller.signal.aborted || generation.current !== serial) return;
      const failure = asError(e); setError(failure);
      if (failure.attempt) setRequest(old => newerAttempt(old, failure.attempt!));
      try { await recover(request!.id, controller.signal, serial); } catch { /* Keep the last known attempt; never infer failure. */ }
    } finally { if (generation.current === serial) setBusy(''); }
  }
  const attempt = request?.attempt ?? null;
  const previousAttempt = useRef<Attempt | null>(null);
  useEffect(() => {
    const previous = previousAttempt.current;
    previousAttempt.current = attempt;
    if (!previous || !attempt) return;
    const announcement = paymentTransitionNotice(previous, attempt);
    if (announcement !== null) setNotice(announcement);
  }, [attempt]);
  const pollable = pending(attempt);
  useEffect(() => {
    if (!attempt || !pollable || busy) return;
    if (pollCount.current.id !== attempt.id) pollCount.current = { id: attempt.id, count: 0 };
    if (pollCount.current.count >= 20) { setPollEnded(true); return; }
    setPollEnded(false);
    const controller = new AbortController();
    const serial = generation.current;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (pollCount.current.count >= 20) { setPollEnded(true); return; }
      pollCount.current.count++;
      try {
        const result = await api.attempt(attempt!.id, controller.signal);
        if (controller.signal.aborted || generation.current !== serial) return;
        if (pending(result.attempt)) {
          setRequest(old => newerAttempt(old, result.attempt));
          timer = setTimeout(poll, 3000);
        } else {
          const saved = await api.request(request!.id, controller.signal);
          if (controller.signal.aborted || generation.current !== serial) return;
          setRequest(old => newerAttempt(newerRequest(old, saved), result.attempt));
        }
      } catch {
        if (!controller.signal.aborted && generation.current === serial) { setPollEnded(true); setNotice('Automatic status checks paused. Check the existing payment manually.'); }
      }
    }
    timer = setTimeout(poll, 3000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [attempt?.id, attempt?.state, pollable, busy]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || !session || busy || recoveryBlocked || locksRequest(request)) return;
    if (submission.current?.text !== text) submission.current = { text, id: crypto.randomUUID() };
    void mutate('/api/requests', { text, client_submission_id: submission.current.id }, session.capabilities.ai_ready ? 'Waiting for actual AI comparison' : 'Saving your request');
  }
  const requestLocked = locksRequest(request);
  const title = draftMode || !request ? 'What supplies do you need?' : titles[request.status];

  return <>
    <a className="skip-link" href="#main">Skip to workspace</a>
    <header className="app-header"><div className="header-inner">
      <a className="wordmark" href="#main">SpendConsent</a>
      <span className="sandbox-label">PayPal sandbox</span>
      <a className="history-link" href="#history">Decision history</a>
    </div></header>
    <div className="shell">
      <nav className="steps" aria-label="Purchase stages"><ol>{['Request', 'Compare', 'Review', 'Payment'].map((name, i) => <li key={name} aria-current={stage === name ? 'step' : undefined}><span aria-hidden="true">{i + 1}</span>{name}{stage === name && <span className="sr-only">, current step</span>}</li>)}</ol></nav>
      <div className="workspace">
        <aside className="context" aria-label="Request context">
          <p className="eyebrow">Purchasing workspace</p>
          <h1>Supplies, with your say.</h1>
          <p>Compare the full cost. Review the exact cart. You decide what happens next.</p>
          <div className="context-note"><strong>Sample merchant catalog</strong><p>Fictional goods, prices, delivery and tax. One item per cart. USD, one-time purchases.</p></div>
          {request && <section className="request-context"><h2>Current request</h2><p className="request-text">{request.text}</p><p className="muted">Request {idShort(request.id)} · Version {request.version}</p><ConstraintSummary constraints={request.constraints} />
            <button className="secondary" aria-disabled={!!busy} onClick={() => void refresh()}>Reload saved status</button>
            {!requestLocked && !recoveryBlocked && <button className="text-button" disabled={!!busy} onClick={() => { submission.current = null; setText(''); setDraftMode(true); setError(null); setNotice('Describe a new request. It is saved only when you submit.'); }}>Start a new request</button>}
          </section>}
          <p className="boundary-note">App approval and PayPal buyer approval are separate. Payment is confirmed only after the server verifies it.</p>
        </aside>
        <main id="main" className="decision" aria-busy={!!busy}>
          <div className="section-heading"><p className="eyebrow">{stage}</p><h2 ref={heading} tabIndex={-1}>{title}</h2></div>
          <div className="live-status" role="status" aria-live="polite" aria-atomic="true">{busy || notice}</div>
          {busy && <Busy label={busy} />}
          {error && <div className="message error" role="alert"><strong>Action needs attention</strong><p>{error.message}</p>{error.code === 'CSRF_FAILED' && <button className="secondary" disabled={!!busy} onClick={() => void connect()}>Reload connection</button>}</div>}
          {!session && !busy && <div className="message"><h3>Local workspace unavailable</h3><p>Start the project’s local backend, then reconnect. Your draft stays in this page.</p><button onClick={() => void connect()}>Retry connection</button></div>}
          {recoveryBlocked && !busy && <div className="message warning"><h3>Reload the saved purchase before continuing</h3><p>This session has a saved request whose current status could not be read. A replacement request is blocked until its status is known.</p><button className="secondary" onClick={() => void connect()}>Retry saved purchase recovery</button></div>}
          {session && !session.capabilities.ai_ready && <div className="message warning"><strong>AI comparison is not ready</strong><p>You can save a request and confirm its requirements. Offers appear only after actual AI integration passes its checks.</p></div>}
          {!recoveryBlocked && (draftMode || !request) && <form onSubmit={submit} className="request-form">
            <label htmlFor="request-text">Describe the supplies and requirements</label>
            <textarea id="request-text" name="text" rows={7} maxLength={2000} required value={text} disabled={!!busy || requestLocked} onChange={e => setText(e.target.value)} aria-describedby="request-help" onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
            <p id="request-help" className="hint">Include exact individual units, specification and maximum total including delivery and tax. Synthetic business requests only.</p>
            <button type="button" className="text-button sample" disabled={!!busy || requestLocked} onClick={() => setText(sample)}>Use the sample cloth request</button>
            <div className="form-actions"><button disabled={!session || !!busy || requestLocked || !text.trim()}>{session?.capabilities.ai_ready ? 'Compare offers' : 'Save request'}</button><span className="hint">No approval or payment</span></div>
          </form>}
          {!draftMode && request && <>
            {request.status === 'MODEL_ERROR' && <p className="empty-copy">Your saved request is available after refresh. No offers were generated, and nothing has been approved or paid.</p>}
            {request.clarification && <div className="message"><h3>Confirm the missing details</h3><p>{request.clarification.question}</p></div>}
            {!requestLocked && <details className="requirements" open={['NEEDS_CLARIFICATION', 'MODEL_ERROR'].includes(request.status)}><summary>Confirm or edit requirements</summary><ConstraintForm key={`${request.id}:${request.version}`} constraints={request.constraints} disabled={!!busy || recoveryBlocked} onSubmit={constraints => void mutate(`/api/requests/${request.id}/clarify`, { expected_version: request.version, constraints }, session?.capabilities.ai_ready ? 'Waiting for actual AI comparison' : 'Saving confirmed requirements')} /></details>}
            {request.status === 'COMPARING' && <div className="message"><strong>Comparison is still in progress</strong><p>Reload the saved status to check the actual server result. No tool steps or outcome are assumed.</p></div>}
            <ModelEvidence model={request.model} />
            {request.status === 'NO_MATCH' && <div className="message"><h3>No available offer meets these requirements</h3><p>Review the exclusions below or edit the request. Quantity, specification and budget have not been relaxed.</p></div>}
            {request.candidates.length > 0 && <section aria-labelledby="offers-heading"><div className="subheading"><h3 id="offers-heading">Eligible offers</h3><span className="muted">Full delivered cost</span></div><p className="hint">Sample merchant catalog. Fictional goods and prices. Unit costs rounded to the nearest cent.</p><div className="offers">{request.candidates.map(candidate => <Offer key={candidate.id} candidate={candidate} lowest={candidate.total_cents === Math.min(...request.candidates.map(x => x.total_cents))} disabled={!!busy || recoveryBlocked || requestLocked || request.status !== 'READY'} onReview={() => void mutate(`/api/requests/${request.id}/reviews`, { expected_version: request.version, candidate_id: candidate.id }, 'Preparing the exact cart for review')} />)}</div></section>}
            {request.excluded.length > 0 && <details className="excluded"><summary>Excluded offers ({request.excluded.length})</summary><ul>{request.excluded.map(item => <li key={item.offer_id}><strong>{item.name}</strong><ul>{item.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></li>)}</ul></details>}
            {request.review && <ReviewCard review={request.review} approval={request.approval} locked={requestLocked} disabled={!!busy || recoveryBlocked || request.review.request_version !== request.version} onApprove={() => void mutate(`/api/reviews/${request.review!.id}/approve`, { expected_version: request.review!.version, expected_digest: request.review!.digest }, 'Recording your exact-cart approval')} />}
            {request.approval && !request.attempt && <section className="payment-prep" aria-labelledby="checkout-heading"><h3 id="checkout-heading">Sandbox checkout</h3><p>App approval is <strong>{request.approval.status.toLowerCase()}</strong>. Payment has not started.</p><p className="muted">PayPal checkout integration is not available in this build. Financial controls remain disabled.</p><button disabled aria-describedby="checkout-disabled">Start sandbox checkout</button><p id="checkout-disabled" className="hint">Requires a verified SDK integration, an unexpired approval and explicit authorization for sandbox financial actions.</p></section>}
            {attempt && <PaymentStatus attempt={attempt} financialEnabled={session?.capabilities.financial_actions_enabled ?? false} busy={!!busy} pollEnded={pollEnded} onAction={attemptAction} />}
          </>}
          <section id="history" className="history" aria-labelledby="history-heading"><h3 id="history-heading">Decision history</h3><p className="hint">Saved application events for this request.</p>{request?.events.length ? <ol>{request.events.map(event => <li key={event.id}><time dateTime={event.created_at}>{dateTime(event.created_at)}</time><p>{event.message}</p></li>)}</ol> : <p className="muted">No saved decision events yet.</p>}</section>
        </main>
      </div>
      <footer>Local prototype · One fictional merchant · PayPal sandbox only</footer>
    </div>
  </>;
}

function asError(error: unknown) { return error instanceof ApiError ? error : new ApiError('REQUEST_FAILED', 'The action could not be completed. Reload the saved status.'); }
function Busy({ label }: { label: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { setElapsed(0); const start = Date.now(); const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000); return () => clearInterval(timer); }, [label]);
  return <p className="busy-text" aria-hidden="true">{label} · {elapsed}s{label.includes('AI comparison') ? ' · Model deadline: up to 90 seconds' : ''}</p>;
}
function Field({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return <div className="field"><label htmlFor={name}>{label}</label>{children}</div>;
}
function ConstraintForm({ constraints, disabled, onSubmit }: { constraints: Constraints; disabled: boolean; onSubmit: (value: Constraints) => void }) {
  const [category, setCategory] = useState(constraints.category ?? '');
  const [invalid, setInvalid] = useState('');
  const attrs = category === constraints.category ? constraints.attributes ?? {} : {};
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const budget = parseCents(String(values.get('budget')));
    if (budget === null) { setInvalid('Enter a maximum total from $0.01 to $10,000.00, with no more than two decimal places.'); event.currentTarget.querySelector<HTMLInputElement>('#budget')?.focus(); return; }
    const attributes: NonNullable<Constraints['attributes']> = {};
    for (const key of ['width_cm', 'height_cm', 'capacity_l', 'volume_ml'] as const) if (values.has(key)) attributes[key] = Number(values.get(key));
    if (values.has('paper_size')) attributes.paper_size = values.get('paper_size') as 'A4' | 'A5' | 'A6';
    setInvalid('');
    onSubmit({ category: category as Constraints['category'], quantity: Number(values.get('quantity')), budget_cents: budget, currency: 'USD', one_time: true, attributes });
  }
  return <form onSubmit={submit} className="constraint-form"><fieldset disabled={disabled}><legend>Only enter requirements you confirm.</legend><div className="fields-grid">
    <Field name="category" label="Supply category"><select id="category" name="category" required value={category} onChange={e => setCategory(e.target.value)}><option value="">Select a category</option><option value="cloth">Cloths</option><option value="bag">Bags</option><option value="bottle">Bottles</option><option value="notebook">Notebooks</option></select></Field>
    <Field name="quantity" label="Exact individual units"><input id="quantity" name="quantity" type="number" min="1" max="10000" step="1" required defaultValue={constraints.quantity ?? ''} /></Field>
    <Field name="budget" label="Maximum full total (USD)"><input id="budget" name="budget" inputMode="decimal" required defaultValue={constraints.budget_cents === undefined ? '' : (constraints.budget_cents / 100).toFixed(2)} aria-describedby={invalid ? 'budget-error' : 'budget-help'} aria-invalid={!!invalid} /></Field>
    <Field name="currency" label="Currency"><select id="currency" name="currency" required defaultValue={constraints.currency ?? ''}><option value="">Confirm currency</option><option value="USD">USD — US dollars</option></select></Field>
    {category === 'cloth' && <><Field name="width_cm" label="Cloth width (cm)"><input key={`width:${category}`} id="width_cm" name="width_cm" type="number" min="1" max="10000" step="1" required defaultValue={attrs.width_cm ?? ''} /></Field><Field name="height_cm" label="Cloth height (cm)"><input key={`height:${category}`} id="height_cm" name="height_cm" type="number" min="1" max="10000" step="1" required defaultValue={attrs.height_cm ?? ''} /></Field></>}
    {category === 'bag' && <Field name="capacity_l" label="Bag capacity (liters)"><input id="capacity_l" name="capacity_l" type="number" min="1" max="10000" step="1" required defaultValue={attrs.capacity_l ?? ''} /></Field>}
    {category === 'bottle' && <Field name="volume_ml" label="Bottle volume (mL)"><input id="volume_ml" name="volume_ml" type="number" min="1" max="10000" step="1" required defaultValue={attrs.volume_ml ?? ''} /></Field>}
    {category === 'notebook' && <Field name="paper_size" label="Notebook paper size"><select id="paper_size" name="paper_size" required defaultValue={attrs.paper_size ?? ''}><option value="">Select paper size</option><option>A4</option><option>A5</option><option>A6</option></select></Field>}
  </div><p id="budget-help" className="hint">The total includes delivery, tax and any discount. Exact pack divisibility is required.</p>{invalid && <p id="budget-error" className="field-error" role="alert">{invalid}</p>}<label className="checkbox"><input name="one_time" type="checkbox" required defaultChecked={constraints.one_time === true} />I confirm a one-time purchase only.</label><button className="secondary">Update confirmed requirements</button></fieldset></form>;
}
function ConstraintSummary({ constraints: c }: { constraints: Constraints }) {
  if (!Object.keys(c).length) return <p className="hint">No requirements have been confirmed yet.</p>;
  const attrs = c.attributes;
  return <dl className="constraint-summary"><dt>Category</dt><dd>{c.category ?? 'Not confirmed'}</dd><dt>Individual units</dt><dd>{c.quantity ?? 'Not confirmed'}</dd><dt>Maximum full total</dt><dd>{c.budget_cents === undefined ? 'Not confirmed' : `${money(c.budget_cents)} USD`}</dd><dt>Specification</dt><dd>{c.category === 'cloth' ? `${attrs?.width_cm ?? '?'} × ${attrs?.height_cm ?? '?'} cm` : c.category === 'bag' ? `${attrs?.capacity_l ?? '?'} liters` : c.category === 'bottle' ? `${attrs?.volume_ml ?? '?'} mL` : c.category === 'notebook' ? attrs?.paper_size ?? 'Not confirmed' : 'Not confirmed'}</dd><dt>Purchase terms</dt><dd>{c.one_time === true ? 'One-time only' : 'Not confirmed'}</dd></dl>;
}
function PriceBreakdown({ charges }: { charges: Charges }) {
  return <dl className="price-breakdown"><dt>Items</dt><dd>{money(charges.subtotal_cents)}</dd><dt>Delivery</dt><dd>{money(charges.shipping_cents)}</dd><dt>Fixture tax</dt><dd>{money(charges.tax_cents)}</dd><dt>Discount</dt><dd>−{money(charges.discount_cents)}</dd><dt className="total">Full total</dt><dd className="total">{money(charges.total_cents)} <span>USD</span></dd></dl>;
}
function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return <details className="evidence"><summary>Catalog evidence ({evidence.length})</summary>{evidence.length ? <ul>{evidence.map((e, i) => <li key={`${e.offer_id}:${i}`}><p>{e.summary}</p><p className="hint">Sample catalog · Offer {idShort(e.offer_id)} · Material version {e.offer_version}</p></li>)}</ul> : <p className="hint">No catalog evidence was returned.</p>}</details>;
}
export function Offer({ candidate: c, lowest, disabled, onReview }: { candidate: Candidate; lowest: boolean; disabled: boolean; onReview: () => void }) {
  return <article className="offer"><div className="offer-heading"><h4>{c.name}</h4>{lowest && <span className="offer-label">Lowest retrieved eligible total</span>}</div><p>{c.specification}</p><p className="hint">SKU {c.sku}</p><dl className="quantity-grid"><div><dt>Units per pack</dt><dd>{c.pack_units}</dd></div><div><dt>Packs</dt><dd>{c.packs}</dd></div><div><dt>Individual units</dt><dd>{c.individual_units}</dd></div></dl><PriceBreakdown charges={c} /><p className="unit-cost">{unitCost(c.total_cents, c.individual_units)} per individual unit delivered <span className="hint">(rounded)</span></p><ul className="match-reasons">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul><EvidenceList evidence={c.evidence} /><button className="secondary" disabled={disabled} onClick={onReview}>Review purchase<span className="sr-only">: {c.name}</span></button></article>;
}
export function ReviewCard({ review: r, approval, locked, disabled, onApprove }: { review: Review; approval: PurchaseRequest['approval']; locked: boolean; disabled: boolean; onApprove: () => void }) {
  const [expiryAcknowledged, setExpiryAcknowledged] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setExpiryAcknowledged(false); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [r.id]);
  const localExpired = now >= Date.parse(r.expires_at);
  const approved = approval?.review_id === r.id && approval.status === 'APPROVED';
  return <section className="review" aria-labelledby="review-heading"><div className="subheading"><h3 id="review-heading">Review the exact cart</h3><span className="review-version">Review {r.version}</span></div><p className="hint">Sample merchant catalog. Fictional goods and prices.</p><dl className="review-facts"><dt>Merchant</dt><dd>{r.merchant.name}</dd><dt>Item</dt><dd><strong>{r.item.name}</strong><br />{r.item.specification}</dd><dt>SKU / variant</dt><dd>{r.item.sku} / {r.item.variant_id}</dd><dt>Quantity</dt><dd>{r.item.packs} packs × {r.item.pack_units} units = <strong>{r.item.individual_units} individual units</strong></dd><dt>Delivery option</dt><dd>{r.shipping.label}</dd><dt>Destination fixture</dt><dd>{r.shipping.destination_label} <span className="hint">({r.shipping.destination_ref})</span></dd><dt>Purchase terms</dt><dd>One-time purchase. {r.terms.description}</dd></dl><PriceBreakdown charges={r} /><dl className="quote-facts"><dt>Material quote version</dt><dd>{r.quote_version}</dd><dt>Quote snapshot</dt><dd><time dateTime={r.created_at}>{dateTime(r.created_at)}</time></dd><dt>Review expires</dt><dd><time dateTime={r.expires_at}>{dateTime(r.expires_at)}</time></dd></dl><EvidenceList evidence={r.evidence} />
    {approval && <div className="message"><strong>App approval: {approval.status.toLowerCase()}</strong><p>Recorded {dateTime(approval.approved_at)}. Expires {dateTime(approval.expires_at)}.</p><p className="hint">The server checks validity again before any payment operation.</p></div>}
    {!locked && !approved && <><p className="hint">Approving binds this exact merchant, item, quantity, charges, destination and one-time terms. It does not start a payment.</p>{localExpired && <p className="message warning">This review appears expired on this device. Reload saved status and request a fresh review. The server’s time determines validity.</p>}<label className="checkbox"><input type="checkbox" checked={expiryAcknowledged} onChange={e => setExpiryAcknowledged(e.target.checked)} disabled={disabled || !!approval} />I have reviewed this exact cart and its total.</label><button disabled={disabled || !expiryAcknowledged || !!approval} onClick={onApprove}>Approve exact cart</button></>}
  </section>;
}
const attemptText: Record<Attempt['state'], { title: string; body: string }> = {
  CREATING: { title: 'Creating the approved sandbox order', body: 'The outcome is still pending. Do not start another purchase.' },
  AWAITING_BUYER: { title: 'Awaiting PayPal buyer approval', body: 'App approval is recorded. A completed payment has not been verified.' },
  CAPTURING: { title: 'Payment capture is pending', body: 'A capture may already have been dispatched. Check this existing attempt; do not pay again.' },
  VERIFYING: { title: 'Verifying payment details', body: 'The server has not yet verified the final payment result.' },
  UNKNOWN: { title: 'Payment status is unknown', body: 'A timeout does not prove failure. Check the existing payment status before taking any further action.' },
  PAYMENT_REVIEW: { title: 'Payment needs manual review', body: 'A completed payment has mismatched details. Manual resolution is required. Do not start another purchase.' },
  PAID: { title: 'Payment confirmed', body: 'The server verified the completed payment against the approved cart. This does not confirm shipment or delivery.' },
  STOPPED: { title: 'Payment attempt stopped', body: 'This attempt cannot capture. Check the decision history before preparing a fresh review.' },
};
export function paymentTransitionNotice(current: Attempt, incoming: Attempt): string | null {
  if (current.id !== incoming.id || current.state === incoming.state || Date.parse(incoming.updated_at) < Date.parse(current.updated_at)) return null;
  // Urgent states already have an alert; clear an older polite status without duplicating it.
  return ['UNKNOWN', 'PAYMENT_REVIEW'].includes(incoming.state) ? '' : attemptText[incoming.state].title;
}
export function PaymentStatus({ attempt: a, financialEnabled, busy, pollEnded, onAction }: { attempt: Attempt; financialEnabled: boolean; busy: boolean; pollEnded: boolean; onAction: (action: 'reconcile' | 'stop') => void }) {
  const message = attemptText[a.state];
  return <section className={`payment-status ${['UNKNOWN', 'PAYMENT_REVIEW'].includes(a.state) ? 'uncertain' : ''}`} aria-labelledby="payment-heading"><h3 id="payment-heading">{message.title}</h3><p {...(['UNKNOWN', 'PAYMENT_REVIEW'].includes(a.state) ? { role: 'alert' } : {})}>{message.body}</p><dl className="review-facts"><dt>Approved total</dt><dd>{money(a.total_cents)} USD</dd><dt>Attempt reference</dt><dd>{idShort(a.id)}</dd><dt>Stored status</dt><dd>{a.state.replaceAll('_', ' ').toLowerCase()}</dd><dt>Last updated</dt><dd><time dateTime={a.updated_at}>{dateTime(a.updated_at)}</time></dd>{a.pending_operation && <><dt>Pending operation</dt><dd>{a.pending_operation}</dd></>}{a.capture_id && <><dt>Capture reference</dt><dd>{a.capture_id}</dd></>}</dl>
    {pending(a) && <p className="hint">{pollEnded ? 'Automatic checks paused after a bounded wait. Check the existing payment manually.' : 'Checking the saved local status periodically. No payment action is retried.'}</p>}
    <div className="form-actions">{permitted(a, 'check_status', financialEnabled) && <button className="secondary" disabled={busy} onClick={() => onAction('reconcile')}>Check existing payment status</button>}{permitted(a, 'stop', financialEnabled) && <button className="text-button" disabled={busy} onClick={() => onAction('stop')}>Request stop</button>}</div>
    {permitted(a, 'stop', financialEnabled) && <p className="hint">Stopping cannot undo a dispatched payment. An uncertain outcome remains under status checks.</p>}
    {(permitted(a, 'open_paypal', financialEnabled) || permitted(a, 'capture', financialEnabled)) && <p className="message warning">PayPal checkout integration is unavailable in this build. No checkout or capture control is active.</p>}
  </section>;
}
function ModelEvidence({ model }: { model: PurchaseRequest['model'] }) {
  if (!model) return null;
  return <details className="model-evidence"><summary>{model.used ? `Actual model: ${model.name} · ${(model.elapsed_ms / 1000).toFixed(1)}s` : 'Fixture preview. AI did not run.'}</summary>{model.used && <ul>{model.tool_calls.map((tool, i) => <li key={i}>{tool.name}: {tool.status} · {(tool.elapsed_ms / 1000).toFixed(1)}s</li>)}</ul>}<p className="hint">Catalog facts and server-calculated totals remain authoritative.</p></details>;
}
