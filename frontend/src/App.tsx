import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { Api, ApiError } from './api.js';
import type { Attempt, Candidate, Charges, Constraints, Evidence, Progress, PurchaseRequest, Review, Session } from './contract.js';
import { canStartNew, locksRequest, money, newerAttempt, newerRequest, parseCents, pending, permitted, purchaseDisplay, unitCost } from './logic.js';
import { PayPalError, preparePayPal } from './paypal.js';
import { play, setSoundOn, soundOn } from './sound.js';

const sample = 'Find exactly 40 microfiber cloths, 40 × 40 cm, under $60 including delivery and tax. One-time purchase only.';
const sampleRequests = [
  { category: 'cloth', label: '40 microfiber cloths', text: sample },
  { category: 'bag', label: '50 waste bags', text: 'Find exactly 50 waste bags, 30 liters each, under $40 including delivery and tax. One-time purchase only.' },
  { category: 'bottle', label: '10 spray bottles', text: 'Find exactly 10 spray bottles, 500 mL each, under $40 including delivery and tax. One-time purchase only.' },
  { category: 'notebook', label: '20 A5 notebooks', text: 'Find exactly 20 A5 notebooks, under $60 including delivery and tax. One-time purchase only.' },
] as const;
const AI_LABEL = 'Waiting for actual AI comparison';
const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value));
const clock = (value: string) => new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value));
const idShort = (id: string) => id.slice(0, 8);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const delay = (i: number) => ({ '--i': i }) as CSSProperties;

export function App() {
  const [api] = useState(() => new Api());
  const [appearance, setAppearance] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('spendconsent-appearance');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch { return 'light'; }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [busy, setBusy] = useState('Connecting to the local workspace');
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [draftMode, setDraftMode] = useState(true);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [pollEnded, setPollEnded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sound, setSound] = useState(soundOn);
  const [progress, setProgress] = useState<Progress | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const operation = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const submission = useRef<{ text: string; id: string } | null>(null);
  const pollCount = useRef({ id: '', count: 0 });
  const { currentReview, currentApproval, stage, collapseComparison } = purchaseDisplay(request, draftMode);
  const focusRequested = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = appearance;
    try { window.localStorage.setItem('spendconsent-appearance', appearance); } catch { /* Appearance still works when storage is unavailable. */ }
  }, [appearance]);
  useEffect(() => {
    if (focusRequested.current) { heading.current?.focus(); focusRequested.current = false; }
  }, [stage, request?.id, request?.version, request?.status, request?.review?.id, draftMode]);
  useEffect(() => { void connect(); return () => { generation.current++; operation.current?.abort(); }; }, []);
  // Notices are announced immediately; the visible toast fades after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => { setEditing(false); }, [request?.id, request?.version]);

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
        setNotice('Welcome back. Your saved request is restored.');
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
    if (target) setRecoveryBlocked(true);
    const next = await api.session(signal);
    if (generation.current !== serial) return;
    setSession(next); target ??= next.current_request_id;
    if (target && next.current_request_id !== target) throw new ApiError('SESSION_CHANGED', 'The browser session changed. Reconnect to recover its saved purchase.');
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
      const next = await api.session(controller.signal);
      if (generation.current !== serial) return;
      setSession(next);
      setNotice(path.endsWith('/approve') ? 'Exact cart approved. No payment has been made.' : path.endsWith('/reviews') ? 'Exact cart ready for your review.' : 'Your request is saved.');
      play(path.endsWith('/approve') ? 'stamp' : path.endsWith('/reviews') ? 'select' : saved.status === 'READY' ? 'found' : 'notice');
    } catch (e) {
      if (controller.signal.aborted || generation.current !== serial) return;
      const failure = asError(e);
      setError(failure); play('error');
      if (failure.attempt) setRequest(old => newerAttempt(old, failure.attempt!));
      try { await recover(failure.requestId ?? request?.id ?? null, controller.signal, serial); }
      catch { if (!controller.signal.aborted && generation.current === serial) setNotice('Saved status could not be reloaded. Use Reload status before retrying.'); }
    } finally { if (generation.current === serial) setBusy(''); }
  }
  async function refresh() {
    if (!request || busy) return;
    const { controller, serial } = begin('Reloading saved status');
    try {
      await recover(request.id, controller.signal, serial);
      if (generation.current === serial) setNotice('Status is up to date.');
    } catch (e) { if (!controller.signal.aborted && generation.current === serial) setError(asError(e)); }
    finally { if (generation.current === serial) setBusy(''); }
  }
  async function paymentAction(path: string, label: string) {
    if (!request || busy || recoveryBlocked) return;
    const { controller, serial } = begin(label);
    try {
      const result = await api.mutateAttempt(path, controller.signal);
      if (generation.current !== serial) return;
      setRequest(old => newerAttempt(old, result.attempt));
      await recover(request.id, controller.signal, serial);
      if (generation.current === serial) setNotice('Payment status updated from the server.');
    } catch (e) {
      if (controller.signal.aborted || generation.current !== serial) return;
      const failure = asError(e); setError(failure); play('error');
      if (failure.attempt) setRequest(old => newerAttempt(old, failure.attempt!));
      try { await recover(request.id, controller.signal, serial); } catch { setRecoveryBlocked(true); }
    } finally { if (generation.current === serial) setBusy(''); }
  }
  function startAttempt() {
    if (!currentApproval || currentApproval.status !== 'APPROVED' || locksRequest(request)
        || !session?.capabilities.ai_ready || !session.capabilities.paypal_ready || !session.capabilities.financial_actions_enabled) return;
    void paymentAction(`/api/approvals/${currentApproval.id}/attempts`, 'Creating the exact approved sandbox order');
  }
  async function attemptAction(action: 'reconcile' | 'stop' | 'capture', expectedId?: string) {
    const attempt = request?.attempt;
    if (!attempt || (expectedId && expectedId !== attempt.id)
        || !permitted(attempt, action === 'reconcile' ? 'check_status' : action, session?.capabilities.financial_actions_enabled ?? false)) return;
    await paymentAction(`/api/attempts/${attempt.id}/${action}`, action === 'capture' ? 'Verifying buyer approval and the exact payment' : action === 'reconcile' ? 'Checking the existing payment status' : 'Requesting a stop');
  }
  const attempt = request?.attempt ?? null;
  const previousAttempt = useRef<Attempt | null>(null);
  useEffect(() => {
    const previous = previousAttempt.current;
    previousAttempt.current = attempt;
    if (!previous || !attempt) return;
    const announcement = paymentTransitionNotice(previous, attempt);
    if (announcement !== null) {
      setNotice(announcement);
      play(attempt.state === 'PAID' ? 'success' : ['UNKNOWN', 'PAYMENT_REVIEW'].includes(attempt.state) ? 'error' : 'tick');
    }
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
    if (!text.trim() || !session || busy || recoveryBlocked || requestLocked) return;
    if (submission.current?.text !== text) submission.current = { text, id: crypto.randomUUID() };
    play('send');
    void mutate('/api/requests', { text, client_submission_id: submission.current.id }, session.capabilities.ai_ready ? AI_LABEL : 'Saving your request');
  }
  function buyAgain(previous: PurchaseRequest) {
    submission.current = null; setText(previous.text); setDraftMode(true); setError(null);
    setNotice('Same request, ready to compare again. Prices and stock are re-checked.');
    focusRequested.current = true; play('select');
  }
  function startNew() {
    submission.current = null; setText(''); setDraftMode(true); setError(null);
    setNotice('Describe your next purchase. Nothing is saved until you compare.');
    focusRequested.current = true;
  }
  const requestLocked = locksRequest(request) && !(draftMode && canStartNew(request));
  const thinking = busy === AI_LABEL;
  // Live progress while the AI works: what it understood, as soon as it knows.
  useEffect(() => {
    if (!thinking) { setProgress(null); return; }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let announced = false;
    async function poll() {
      try {
        const next = await api.progress(controller.signal);
        if (controller.signal.aborted) return;
        setProgress(next);
        if (next.stage === 'UNDERSTOOD' && !announced) { announced = true; play('tick'); }
        if (next.stage === 'DONE') return;
      } catch { if (controller.signal.aborted) return; }
      timer = setTimeout(poll, 1200);
    }
    timer = setTimeout(poll, 800);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [thinking]);
  // Quiet background sync: the screen follows saved state without a manual reload.
  async function sync() {
    if (!request || busy || draftMode || recoveryBlocked) return;
    const serial = generation.current;
    try {
      const next = await api.session();
      if (generation.current !== serial) return;
      setSession(next);
      if (next.current_request_id !== request.id) return;
      const saved = await api.request(request.id);
      if (generation.current === serial) setRequest(old => newerRequest(old, saved));
    } catch { /* Background sync is best effort; Reload status stays available. */ }
  }
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void syncRef.current(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  const waitingForPermission = !!currentApproval && currentApproval.status === 'APPROVED' && !attempt && !session?.capabilities.financial_actions_enabled;
  useEffect(() => {
    if (!waitingForPermission && request?.status !== 'COMPARING') return;
    const timer = setInterval(() => void syncRef.current(), 4000);
    return () => clearInterval(timer);
  }, [waitingForPermission, request?.status]);
  useEffect(() => {
    if (!currentApproval || currentApproval.status !== 'APPROVED') return;
    const wait = Date.parse(currentApproval.expires_at) - Date.now() + 1000;
    if (wait <= 0 || wait > 3600000) return;
    const timer = setTimeout(() => void syncRef.current(), wait);
    return () => clearTimeout(timer);
  }, [currentApproval?.id, currentApproval?.status, currentApproval?.expires_at]);
  const drafting = draftMode || !request;
  const offline = !session && !busy;
  const best = request?.candidates.length ? Math.min(...request.candidates.map(x => x.total_cents)) : null;
  const head = headline({ request, drafting, thinking, offline, stage, attempt, approved: !!currentApproval && ['APPROVED', 'CONSUMED'].includes(currentApproval.status), best });
  const ordered = request ? [...request.candidates].sort((a, b) => a.total_cents - b.total_cents) : [];
  const comparison = request && <>
    {ordered.length > 0 && <section className="offers" aria-labelledby="offers-heading">
      <h2 id="offers-heading" className="sr-only">Eligible offers</h2>
      {ordered.map((candidate, i) => <Offer key={candidate.id} candidate={candidate} lowest={candidate.total_cents === best} deltaCents={best === null ? undefined : candidate.total_cents - best}
        disabled={!!busy || recoveryBlocked || requestLocked || request.status !== 'READY'} order={i}
        onReview={() => void mutate(`/api/requests/${request.id}/reviews`, { expected_version: request.version, candidate_id: candidate.id }, 'Preparing the exact cart for review')} />)}
      <p className="fine-print">Sample merchant catalog. Fictional goods and prices. Per-unit costs are rounded to the nearest cent.</p>
    </section>}
    {request.excluded.length > 0 && <details className="ruled-out" open={request.status === 'NO_MATCH'}>
      <summary><span>{plural(request.excluded.length, 'offer')} ruled out</span><span className="summary-hint">See why</span></summary>
      <ul>{request.excluded.map(item => <li key={item.offer_id}><strong>{item.name}</strong><span>{item.reasons.join(' ')}</span></li>)}</ul>
    </details>}
  </>;
  const editor = request && !requestLocked && <ConstraintForm key={`${request.id}:${request.version}`} constraints={request.constraints} disabled={!!busy || recoveryBlocked}
    onSubmit={constraints => void mutate(`/api/requests/${request.id}/clarify`, { expected_version: request.version, constraints }, session?.capabilities.ai_ready ? AI_LABEL : 'Saving confirmed requirements')} />;
  const asksForDetails = !!request && ['NEEDS_CLARIFICATION', 'MODEL_ERROR'].includes(request.status);
  const steps = journey({ request, drafting, thinking, stage, currentReview, currentApproval, attempt, best });

  return <>
    <a className="skip-link" href="#main">Skip to workspace</a>
    <div className="loadbar" data-active={!!busy} aria-hidden="true" />
    <header className="topbar">
      <a className="brand" href="#main" aria-label="SpendConsent home"><Mark /><span>SpendConsent</span></a>
      <div className="topbar-end">
        <span className="sandbox-chip" title="PayPal sandbox: test money only"><span className="pulse-dot" aria-hidden="true" />Sandbox</span>
        {request && !draftMode && <a className="ghost-link" href="#history">Activity</a>}
        <button type="button" className="icon-button" aria-pressed={sound} aria-label={sound ? 'Mute interface sounds' : 'Turn interface sounds on'}
          onClick={() => { const next = !sound; setSound(next); setSoundOn(next); if (next) play('tick'); }}><Icon name={sound ? 'sound' : 'mute'} /></button>
        <button type="button" className="icon-button" aria-label={`Use ${appearance === 'light' ? 'dark' : 'light'} appearance`} onClick={() => setAppearance(value => value === 'light' ? 'dark' : 'light')}>
          <Icon name={appearance === 'light' ? 'moon' : 'sun'} />
        </button>
      </div>
    </header>

    <div className="layout" data-stage={stage.toLowerCase()}>
      <aside className="rail" aria-label="Purchase progress">
        <nav className="journey" aria-label="Purchase stages">
          <ol>{steps.map((step, i) => <li key={step.name} className={`step is-${step.tone}`} aria-current={step.current ? 'step' : undefined}>
            <span className="step-dot" aria-hidden="true">{step.tone === 'done' ? <Icon name="check" /> : step.tone === 'alert' ? '!' : i + 1}</span>
            <span className="step-text"><span className="step-name">{step.name}{step.current && <span className="sr-only">, current step</span>}</span><span className="step-detail">{step.detail}</span></span>
          </li>)}</ol>
        </nav>
        {request && !draftMode && <div className="rail-brief">
          <p className="rail-label">Your request</p>
          <p className="rail-quote">{request.text}</p>
          <p className="rail-meta">Request {idShort(request.id)} · v{request.version}</p>
          <div className="rail-actions">
            <button type="button" className="btn small" aria-disabled={!!busy} onClick={() => void refresh()}><Icon name="refresh" />Reload status</button>
            {canStartNew(request) && !recoveryBlocked && <button type="button" className="btn small quiet" disabled={!!busy} onClick={startNew}><Icon name="plus" />Start a new request</button>}
          </div>
        </div>}
        <p className="rail-note"><Icon name="lock" />Nothing is paid without your approval. PayPal sandbox only; fictional catalog.</p>
      </aside>

      <main id="main" className="stage" aria-busy={!!busy}>
        <div className="stage-head" key={`${head.title}`}>
          <p className="eyebrow">{head.eyebrow}</p>
          <h1 ref={heading} tabIndex={-1}>{head.title}</h1>
          {head.sub && <p className="lede">{head.sub}</p>}
        </div>

        <div className="live-status sr-only" role="status" aria-live="polite" aria-atomic="true">{busy || notice}</div>
        {error && <div className="alert is-error reveal" role="alert"><Icon name="alert" /><div><strong>That didn’t go through</strong><p>{error.message}</p>{error.code === 'CSRF_FAILED' && <button className="btn small" disabled={!!busy} onClick={() => void connect()}>Reload connection</button>}</div></div>}
        {offline && <div className="empty reveal"><Icon name="plug" /><h2>The local workspace isn’t answering</h2><p>Start the project’s backend, then reconnect. Anything you typed stays on this page.</p><button className="btn primary" onClick={() => void connect()}>Retry connection</button></div>}
        {recoveryBlocked && !busy && <div className="alert is-warning reveal"><Icon name="alert" /><div><strong>Reload the saved purchase before continuing</strong><p>This session has a saved request whose current status could not be read. A new request stays blocked until its status is known.</p><button className="btn small" onClick={() => void connect()}>Retry saved purchase recovery</button></div></div>}
        {session && !session.capabilities.ai_ready && <div className="alert is-info reveal"><Icon name="spark" /><div><strong>AI comparison is not ready</strong><p>You can save a request and confirm requirements. Comparison opens after the local AI passes its checks.</p></div></div>}

        {thinking && <Thinking text={text || request?.text || ''} progress={progress} />}

        {!thinking && !recoveryBlocked && drafting && session && <form onSubmit={submit} className="composer reveal">
          <label className="sr-only" htmlFor="request-text">What supplies do you need?</label>
          <textarea id="request-text" name="text" rows={4} maxLength={2000} required value={text}
            placeholder="e.g. 40 microfiber cloths, 40 × 40 cm, under $60 delivered, one-time"
            disabled={!!busy || requestLocked} onChange={e => setText(e.target.value)} aria-describedby="request-help"
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
          <div className="composer-bar">
            <p id="request-help" className="composer-help">Include <b>how many</b>, <b>what size</b> and your <b>max total</b>.</p>
            <button className="btn primary" disabled={!session || !!busy || requestLocked || !text.trim()}>
              {session?.capabilities.ai_ready ? 'Compare offers' : 'Save request'}<Icon name="arrow" />
            </button>
          </div>
          <div className="examples" aria-label="Try an example">
            <span className="examples-label">Try</span>
            {sampleRequests.map((item, i) => <button key={item.category} type="button" className="example reveal" style={delay(i + 2)} disabled={!!busy || requestLocked}
              aria-label={item.category === 'cloth' ? 'Use the sample cloth request' : `Use a sample ${item.label} request`} onClick={() => { setText(item.text); play('tick'); }}>
              <SupplyIllustration category={item.category} />{item.label}
            </button>)}
          </div>
        </form>}
        {!thinking && drafting && session && <ol className="how reveal" style={delay(6)} aria-label="How it works">
          <li><b>Describe</b><span>Plain words. The AI reads them; nothing is guessed.</span></li>
          <li><b>Compare</b><span>Full delivered cost, wrong sizes ruled out.</span></li>
          <li><b>Approve</b><span>One exact cart, and only you can approve it.</span></li>
          <li><b>Pay</b><span>PayPal sandbox, verified by the server.</span></li>
        </ol>}

        {!thinking && !draftMode && request && <div className="flow">
          {request.constraints && Object.keys(request.constraints).length > 0 && <div className="needs reveal">
            <RequirementChips constraints={request.constraints} />
            {editor && !asksForDetails && <button type="button" className="ghost-link" aria-expanded={editing} onClick={() => setEditing(v => !v)}>{editing ? 'Close' : 'Edit'}</button>}
          </div>}
          {request.clarification && <div className="question reveal"><Icon name="question" /><div><p className="question-label">Confirm the missing details</p><p>{request.clarification.question}</p></div></div>}
          {editor && (asksForDetails || editing) && <div className="reveal">{editor}</div>}
          {request.status === 'COMPARING' && <div className="alert is-info reveal"><Icon name="clock" /><div><strong>Comparison is still in progress</strong><p>Reload the status to see the server’s result. Nothing is assumed in the meantime.</p><button className="btn small" disabled={!!busy} onClick={() => void refresh()}>Reload status</button></div></div>}
          {(ordered.length > 0 || request.excluded.length > 0) && (collapseComparison
            ? <details className="earlier reveal"><summary><span>Earlier comparison</span><span className="summary-hint">{plural(ordered.length, 'eligible offer')}</span></summary>{comparison}</details>
            : comparison)}
          {currentReview && <ReviewCard review={currentReview} approval={currentApproval} locked={requestLocked} disabled={!!busy || recoveryBlocked}
            onApprove={() => void mutate(`/api/reviews/${currentReview.id}/approve`, { expected_version: currentReview.version, expected_digest: currentReview.digest }, 'Recording your exact-cart approval')} />}
          {request.review && !currentReview && <details className="earlier reveal"><summary><span>Previous review</span><span className="summary-hint">request version {request.review.request_version}</span></summary><p className="fine-print">Shown read-only. Compare the current offers to prepare a fresh review.</p><ReviewCard review={request.review} approval={request.approval} locked disabled onApprove={() => {}} /></details>}
          {currentApproval && (!attempt || (attempt.state === 'STOPPED' && currentApproval.status === 'APPROVED')) && <CheckoutStart approval={currentApproval} session={session} busy={!!busy || recoveryBlocked} onStart={startAttempt} onReload={() => void refresh()} />}
          {attempt && (attempt.state === 'STOPPED'
            ? <details className="earlier reveal"><summary><span>Previous stopped payment attempt</span></summary><PaymentStatus attempt={attempt} financialEnabled={false} busy pollEnded={pollEnded} onAction={() => {}} /></details>
            : <>
              <PaymentStatus attempt={attempt} financialEnabled={session?.capabilities.financial_actions_enabled ?? false} busy={!!busy || recoveryBlocked} pollEnded={pollEnded} onAction={attemptAction} />
              {session && permitted(attempt, 'open_paypal', session.capabilities.financial_actions_enabled) && <PayPalCheckout session={session} attempt={attempt} busy={!!busy || recoveryBlocked} onApprove={id => attemptAction('capture', id)} />}
              {attempt.state === 'PAID' && canStartNew(request) && <div className="done-actions reveal" style={delay(3)}>
                <button type="button" className="btn primary" disabled={!!busy} onClick={() => buyAgain(request)}><Icon name="refresh" />Buy again</button>
                {request.review && <button type="button" className="btn" onClick={() => downloadReceipt(request.review!, attempt)}><Icon name="download" />Download receipt</button>}
                <button type="button" className="btn quiet" disabled={!!busy} onClick={startNew}>Start a new request</button>
              </div>}
            </>)}
          <details id="history" className="activity">
            <summary><span>Activity</span><span className="summary-hint">{plural(request.events.length, 'saved event')}</span></summary>
            <ModelEvidence model={request.model} />
            {request.events.length ? <ol>{request.events.map(event => <li key={event.id}><time dateTime={event.created_at}>{clock(event.created_at)}</time><p>{event.message}</p></li>)}</ol> : <p className="fine-print">No saved events yet.</p>}
          </details>
        </div>}
      </main>
    </div>

    <div className="toast" data-show={!!(busy || notice)} aria-hidden="true">
      {busy ? <span className="spinner" /> : <Icon name="check" />}<span>{busy || notice}</span>
    </div>
  </>;
}

type Step = { name: string; detail: string; tone: 'done' | 'current' | 'todo' | 'alert' | 'busy'; current: boolean };
function journey({ request, drafting, thinking, stage, currentReview, currentApproval, attempt, best }: {
  request: PurchaseRequest | null; drafting: boolean; thinking: boolean; stage: string; currentReview: Review | null;
  currentApproval: PurchaseRequest['approval']; attempt: Attempt | null; best: number | null;
}): Step[] {
  const approvedNow = stage === 'Review' && !!currentApproval && ['APPROVED', 'CONSUMED'].includes(currentApproval.status);
  const at = thinking ? 1 : approvedNow ? 3 : ['Request', 'Compare', 'Review', 'Payment'].indexOf(stage);
  const paid = attempt?.state === 'PAID';
  const tone = (i: number, alert = false): Step['tone'] => paid || i < at ? 'done' : i > at ? 'todo' : alert ? 'alert' : thinking ? 'busy' : 'current';
  const c = request && !drafting ? request.constraints : null;
  const ask = c && (c.quantity || c.budget_cents) ? [c.quantity && `${c.quantity} units`, c.budget_cents && `up to ${money(c.budget_cents)}`].filter(Boolean).join(' · ') : 'Say what you need';
  const compare = thinking ? 'AI is comparing…' : drafting || !request ? 'Full delivered cost' : request.status === 'NEEDS_CLARIFICATION' ? 'Needs one more detail'
    : request.status === 'NO_MATCH' ? 'Nothing fits yet' : request.status === 'MODEL_ERROR' ? 'Try again' : request.status === 'COMPARING' ? 'Comparing…'
    : best !== null ? `${plural(request.candidates.length, 'offer')} · from ${money(best)}` : 'Full delivered cost';
  const approve = currentApproval && ['APPROVED', 'CONSUMED'].includes(currentApproval.status) && currentReview ? `Approved · ${money(currentReview.total_cents)}`
    : currentReview ? `Review · ${money(currentReview.total_cents)}` : 'One exact cart';
  const pay = attempt && attempt.state !== 'STOPPED' ? (paid ? `Paid · ${money(attempt.total_cents)}` : attemptText[attempt.state].short) : approvedNow ? 'Ready when you are' : 'PayPal sandbox';
  const alertAt = (i: number) => i === at && (i === 1 ? !!request && !thinking && !drafting && ['NO_MATCH', 'MODEL_ERROR'].includes(request.status)
    : i === 3 ? !!attempt && ['UNKNOWN', 'PAYMENT_REVIEW'].includes(attempt.state) : false);
  return [['Describe', ask], ['Compare', compare], ['Approve', approve], ['Pay', pay]].map(([name, detail], i) => {
    const t = tone(i, alertAt(i));
    return { name, detail, tone: t, current: !paid && i === at };
  });
}

function headline({ request, drafting, thinking, offline, stage, attempt, approved, best }: {
  request: PurchaseRequest | null; drafting: boolean; thinking: boolean; offline: boolean; stage: string; attempt: Attempt | null; approved: boolean; best: number | null;
}) {
  if (offline) return { eyebrow: 'Offline', title: 'Let’s reconnect.', sub: '' };
  if (thinking) return { eyebrow: 'Comparing', title: 'Finding what fits…', sub: 'The AI reads your request. The server checks every offer and does all the math.' };
  if (drafting) return { eyebrow: 'New purchase', title: 'What do you need to buy?', sub: 'Describe it the way you’d text a colleague. We compare the full delivered cost, and nothing happens without your OK.' };
  if (!request) return { eyebrow: '', title: 'Your purchase', sub: '' };
  if (stage === 'Payment' && attempt) {
    if (attempt.state === 'PAID') return { eyebrow: 'Done', title: 'Paid. All verified.', sub: 'The server checked the PayPal result against the exact cart you approved.' };
    if (['UNKNOWN', 'PAYMENT_REVIEW'].includes(attempt.state)) return { eyebrow: 'Payment', title: 'Let’s confirm the payment.', sub: 'We never guess an outcome. Check the status before doing anything else.' };
    return { eyebrow: 'Payment', title: 'Paying with PayPal.', sub: 'One approved cart, one saved attempt. The server verifies the result.' };
  }
  if (stage === 'Review') return approved
    ? { eyebrow: 'Approved', title: 'Approved. Ready to pay.', sub: 'Nothing has been charged yet. Continue to the PayPal sandbox when you’re ready.' }
    : { eyebrow: 'Approve', title: 'Check it, then approve.', sub: 'This is the exact cart. Approving does not charge anything.' };
  const n = request.candidates.length;
  switch (request.status) {
    case 'READY': return { eyebrow: 'Compare', title: n === 1 ? 'One offer fits.' : `${n} offers fit.`, sub: best === null ? '' : `Best delivered total: ${money(best)}. Every price includes delivery and tax.` };
    case 'NO_MATCH': return { eyebrow: 'Compare', title: 'Nothing fits these requirements.', sub: 'We didn’t stretch your budget, size or quantity. See why below, or adjust the request.' };
    case 'NEEDS_CLARIFICATION': return { eyebrow: 'One more detail', title: 'Almost there.', sub: 'Confirm what’s missing and we’ll compare right away.' };
    case 'MODEL_ERROR': return { eyebrow: 'Compare', title: 'Let’s try that again.', sub: 'Your request is saved. Confirm the details below and compare again.' };
    case 'COMPARING': return { eyebrow: 'Compare', title: 'Still comparing…', sub: '' };
    default: return { eyebrow: 'Purchase', title: 'Your purchase', sub: '' };
  }
}

function asError(error: unknown) { return error instanceof ApiError ? error : new ApiError('REQUEST_FAILED', 'The action could not be completed. Reload the saved status.'); }

const captions = [
  'Reading quantity, size and budget from your words.',
  'Only numbers you actually wrote are kept. Nothing is guessed.',
  'Checking every offer in the sample catalog.',
  'Packs must add up to your exact quantity.',
  'Tax and delivery are included in every total.',
  'You’ll approve the exact cart before any payment.',
];
export function Thinking({ text, progress }: { text: string; progress: Progress | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const start = Date.now(); const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250); return () => clearInterval(timer); }, []);
  const ring = Math.min(elapsed / 40, 1);
  return <section className="thinking reveal" aria-label="AI comparison in progress">
    <div className="thinking-top">
      <div className="ring" aria-hidden="true" style={{ '--p': ring } as CSSProperties}><span>{elapsed}s</span></div>
      <div className="thinking-copy">
        {progress?.stage === 'UNDERSTOOD'
          ? <p className="thinking-caption">Confirming the result with the AI…</p>
          : <p className="thinking-caption" key={Math.floor(elapsed / 4)}>{captions[Math.floor(elapsed / 4) % captions.length]}</p>}
        <p className="fine-print">Local AI on this laptop · usually 20–40 s{elapsed > 45 ? ' · taking longer than usual, still working' : ''}</p>
      </div>
    </div>
    {progress?.stage === 'UNDERSTOOD'
      ? <div className="understood"><p className="understood-label"><Icon name="check" />Understood. {progress.status === 'READY' ? `${plural(progress.eligible, 'offer')} fit so far — the AI is confirming.` : progress.status === 'NO_MATCH' ? 'Checking why nothing fits…' : 'A detail is missing — preparing the question…'}</p><RequirementChips constraints={progress.constraints} /></div>
      : text && <blockquote className="echo">{text}</blockquote>}
    <div className="catalog-scan" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <span key={i} style={delay(i)} />)}</div>
    <div className="skeletons" aria-hidden="true"><div className="skeleton" /><div className="skeleton short" /></div>
  </section>;
}

function SupplyIllustration({ category }: { category: NonNullable<Constraints['category']> }) {
  return <svg className="supply-art" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {category === 'cloth' && <><path d="m13 19 32-7 8 33-32 7Z" fill="var(--accent-soft)" /><path d="m13 19 11 6 29 20M24 25l-3 27" /></>}
    {category === 'bag' && <><path d="M19 18h26l4 33c-12 5-23 5-34 0Z" fill="var(--accent-soft)" /><path d="m19 18 4-6h18l4 6M29 23v19" /></>}
    {category === 'bottle' && <><path d="M23 28h18l5 25H18Z" fill="var(--accent-soft)" /><path d="M26 28V17h12v11M23 17V9h23v7H35M38 17l7 9" /></>}
    {category === 'notebook' && <><path d="M17 10h32v44H17Z" fill="var(--accent-soft)" /><path d="M23 10v44M29 22h13M29 28h9" /></>}
  </svg>;
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
  return <form onSubmit={submit} className="details-form"><fieldset disabled={disabled}><legend>Confirm your requirements</legend><div className="fields">
    <Field name="category" label="What"><select id="category" name="category" required value={category} onChange={e => setCategory(e.target.value)}><option value="">Choose a supply</option><option value="cloth">Microfiber cloths</option><option value="bag">Waste bags</option><option value="bottle">Spray bottles</option><option value="notebook">Notebooks</option></select></Field>
    <Field name="quantity" label="How many (exact units)"><input id="quantity" name="quantity" type="number" min="1" max="10000" step="1" required defaultValue={constraints.quantity ?? ''} /></Field>
    <Field name="budget" label="Max total, USD"><input id="budget" name="budget" inputMode="decimal" required placeholder="60.00" defaultValue={constraints.budget_cents === undefined ? '' : (constraints.budget_cents / 100).toFixed(2)} aria-describedby={invalid ? 'budget-error' : 'budget-help'} aria-invalid={!!invalid} /></Field>
    <Field name="currency" label="Currency"><select id="currency" name="currency" required defaultValue={constraints.currency ?? ''}><option value="">Confirm currency</option><option value="USD">USD — US dollars</option></select></Field>
    {category === 'cloth' && <><Field name="width_cm" label="Width (cm)"><input key={`width:${category}`} id="width_cm" name="width_cm" type="number" min="1" max="10000" step="1" required defaultValue={attrs.width_cm ?? ''} /></Field><Field name="height_cm" label="Height (cm)"><input key={`height:${category}`} id="height_cm" name="height_cm" type="number" min="1" max="10000" step="1" required defaultValue={attrs.height_cm ?? ''} /></Field></>}
    {category === 'bag' && <Field name="capacity_l" label="Capacity (liters)"><input id="capacity_l" name="capacity_l" type="number" min="1" max="10000" step="1" required defaultValue={attrs.capacity_l ?? ''} /></Field>}
    {category === 'bottle' && <Field name="volume_ml" label="Volume (mL)"><input id="volume_ml" name="volume_ml" type="number" min="1" max="10000" step="1" required defaultValue={attrs.volume_ml ?? ''} /></Field>}
    {category === 'notebook' && <Field name="paper_size" label="Paper size"><select id="paper_size" name="paper_size" required defaultValue={attrs.paper_size ?? ''}><option value="">Choose a size</option><option>A4</option><option>A5</option><option>A6</option></select></Field>}
  </div><p id="budget-help" className="fine-print">The max total includes delivery and tax. Packs must add up to your exact quantity.</p>{invalid && <p id="budget-error" className="field-error" role="alert">{invalid}</p>}
    <div className="details-actions"><label className="check"><input name="one_time" type="checkbox" required defaultChecked={constraints.one_time === true} /><span>One-time purchase only</span></label><button className="btn primary">Update and compare<Icon name="arrow" /></button></div></fieldset></form>;
}
function RequirementChips({ constraints: c }: { constraints: Constraints }) {
  const a = c.attributes;
  const names = { cloth: 'Microfiber cloths', bag: 'Waste bags', bottle: 'Spray bottles', notebook: 'Notebooks' } as const;
  const spec = c.category === 'cloth' ? (a?.width_cm && a?.height_cm ? `${a.width_cm} × ${a.height_cm} cm` : null) : c.category === 'bag' ? (a?.capacity_l ? `${a.capacity_l} L` : null)
    : c.category === 'bottle' ? (a?.volume_ml ? `${a.volume_ml} mL` : null) : c.category === 'notebook' ? a?.paper_size ?? null : null;
  const chips: [string, string | null][] = [['What', c.category ? names[c.category] : null], ['How many', c.quantity ? `${c.quantity} units` : null], ['Size', spec],
    ['Max total', c.budget_cents === undefined ? null : money(c.budget_cents)], ['Terms', c.one_time === true ? 'One-time' : null]];
  return <ul className="chips" aria-label="Your requirements">{chips.map(([label, value]) => <li key={label} className={value ? undefined : 'is-missing'}><span className="chip-label">{label}</span>{value ?? 'Not confirmed'}</li>)}</ul>;
}
function PriceBreakdown({ charges }: { charges: Charges }) {
  return <dl className="breakdown"><div><dt>Items</dt><dd>{money(charges.subtotal_cents)}</dd></div><div><dt>Delivery</dt><dd>{money(charges.shipping_cents)}</dd></div><div><dt>Fixture tax</dt><dd>{money(charges.tax_cents)}</dd></div><div><dt>Discount</dt><dd>−{money(charges.discount_cents)}</dd></div><div className="total"><dt>Full total</dt><dd>{money(charges.total_cents)} <span>USD</span></dd></div></dl>;
}
function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return <details className="evidence"><summary>Catalog evidence ({evidence.length})</summary>{evidence.length ? <ul>{evidence.map((e, i) => <li key={`${e.offer_id}:${i}`}><p>{e.summary}</p><p className="fine-print">Sample catalog · Offer {idShort(e.offer_id)} · Material version {e.offer_version}</p></li>)}</ul> : <p className="fine-print">No catalog evidence was returned.</p>}</details>;
}
function PackBlocks({ packs, units }: { packs: number; units: number }) {
  const shown = Math.min(packs, 12);
  return <div className="packs" aria-hidden="true">{Array.from({ length: shown }, (_, i) => <span key={i} style={delay(i)}>{units}</span>)}{packs > shown && <em>+{packs - shown}</em>}</div>;
}
export function Offer({ candidate: c, lowest, disabled, onReview, deltaCents, order = 0 }: { candidate: Candidate; lowest: boolean; disabled: boolean; onReview: () => void; deltaCents?: number; order?: number }) {
  return <article className={`offer reveal${lowest ? ' is-best' : ''}`} style={delay(order + 1)}>
    <div className="offer-main">
      <div className="offer-copy">
        <p className="offer-flag">{lowest ? <><Icon name="spark" />Lowest delivered total</> : deltaCents ? `${money(deltaCents)} more` : `SKU ${c.sku}`}</p>
        <h3>{c.name}</h3>
        <p className="offer-spec">{c.specification} · SKU {c.sku}</p>
      </div>
      <div className="offer-price"><strong>{money(c.total_cents)}</strong><span>delivered · USD</span></div>
    </div>
    <div className="offer-math">
      <PackBlocks packs={c.packs} units={c.pack_units} />
      <dl className="qty"><div><dt>Units per pack</dt><dd>{c.pack_units}</dd></div><div><dt>Packs</dt><dd>{c.packs}</dd></div><div><dt>Individual units</dt><dd>{c.individual_units}</dd></div></dl>
    </div>
    <div className="offer-foot">
      <p className="unit-cost"><strong>{unitCost(c.total_cents, c.individual_units)}</strong> per unit delivered <span className="fine-print">(rounded)</span></p>
      <button className={`btn${lowest ? ' primary' : ''}`} disabled={disabled} onClick={onReview}>Review purchase<span className="sr-only">: {c.name}</span><Icon name="arrow" /></button>
    </div>
    <details className="offer-details"><summary>Price breakdown &amp; catalog evidence</summary><PriceBreakdown charges={c} /><ul className="reasons">{c.reasons.map((r, i) => <li key={i}><Icon name="check" />{r}</li>)}</ul><EvidenceList evidence={c.evidence} /></details>
  </article>;
}

function Countdown({ from, to, now }: { from: string; to: string; now: number }) {
  const total = Math.max(1, Date.parse(to) - Date.parse(from));
  const left = Math.max(0, Date.parse(to) - now);
  const s = Math.ceil(left / 1000);
  return <div className={`countdown${left < 60000 ? ' is-low' : ''}`} style={{ '--p': left / total } as CSSProperties}>
    <span className="countdown-ring" aria-hidden="true" /><span>{left ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left` : 'Expired'}</span>
  </div>;
}
export function ReviewCard({ review: r, approval, locked, disabled, onApprove }: { review: Review; approval: PurchaseRequest['approval']; locked: boolean; disabled: boolean; onApprove: () => void }) {
  const [expiryAcknowledged, setExpiryAcknowledged] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setExpiryAcknowledged(false); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [r.id]);
  const localExpired = now >= Date.parse(r.expires_at);
  const mine = approval?.review_id === r.id ? approval : null;
  const approved = mine?.status === 'APPROVED';
  return <section className="receipt reveal" aria-labelledby="review-heading">
    {mine && <div className={`stamp is-${mine.status.toLowerCase()}`} aria-hidden="true">{['APPROVED', 'CONSUMED'].includes(mine.status) ? 'Approved' : mine.status.toLowerCase()}</div>}
    <header className="receipt-head">
      <div><h2 id="review-heading">Review the exact cart</h2><p className="fine-print">{r.merchant.name} · Review {r.version} · Fictional goods and prices</p></div>
      {!mine && !locked && <Countdown from={r.created_at} to={r.expires_at} now={now} />}
    </header>
    <div className="receipt-item">
      <p className="receipt-name">{r.item.name}</p>
      <p className="fine-print">{r.item.specification} · {r.item.sku} / {r.item.variant_id}</p>
      <p className="receipt-qty"><span>{r.item.packs} packs × {r.item.pack_units} units</span><strong>{r.item.individual_units} individual units</strong></p>
    </div>
    <PriceBreakdown charges={r} />
    <dl className="receipt-facts">
      <div><dt>Merchant</dt><dd>{r.merchant.name}</dd></div>
      <div><dt>Delivery</dt><dd>{r.shipping.label}</dd></div>
      <div><dt>Ship to</dt><dd>{r.shipping.destination_label} <span className="fine-print">({r.shipping.destination_ref})</span></dd></div>
      <div><dt>Terms</dt><dd>One-time purchase. {r.terms.description}</dd></div>
    </dl>
    <details className="receipt-more"><summary>Quote details</summary>
      <dl className="receipt-facts"><div><dt>Material quote version</dt><dd>{r.quote_version}</dd></div><div><dt>Quote snapshot</dt><dd><time dateTime={r.created_at}>{dateTime(r.created_at)}</time></dd></div><div><dt>Review expires</dt><dd><time dateTime={r.expires_at}>{dateTime(r.expires_at)}</time></dd></div></dl>
      <EvidenceList evidence={r.evidence} />
    </details>
    {approval && <div className={`approval-note${approved ? ' is-ok' : ''}`}><Icon name={approved ? 'check' : 'clock'} /><div><strong>App approval: {approval.status.toLowerCase()}</strong><p>Recorded {dateTime(approval.approved_at)}. Expires {dateTime(approval.expires_at)}.</p><p className="fine-print">The server checks validity again before any payment operation.</p></div></div>}
    {!locked && !approved && <div className="consent">
      {localExpired && <p className="alert is-warning">This review appears expired on this device. Reload the status and request a fresh review. The server’s time decides.</p>}
      <label className="check"><input type="checkbox" checked={expiryAcknowledged} onChange={e => setExpiryAcknowledged(e.target.checked)} disabled={disabled || !!approval} /><span>I have reviewed this exact cart and its total.</span></label>
      <button className="btn primary wide" disabled={disabled || !expiryAcknowledged || !!approval} onClick={onApprove}>Approve exact cart<Icon name="arrow" /></button>
      <p className="fine-print">Approving binds this merchant, item, quantity, charges, destination and one-time terms. It does not start a payment.</p>
    </div>}
  </section>;
}

function CheckoutStart({ approval, session, busy, onStart, onReload }: { approval: NonNullable<PurchaseRequest['approval']>; session: Session | null; busy: boolean; onStart: () => void; onReload: () => void }) {
  const caps = session?.capabilities;
  const ready = approval.status === 'APPROVED' && !!caps?.ai_ready && !!caps.paypal_ready;
  const permitted = ready && !!caps?.financial_actions_enabled;
  return <section className="panel checkout reveal" aria-labelledby="checkout-heading">
    <div className="panel-head"><Icon name="card" /><div><h2 id="checkout-heading">Sandbox checkout</h2><p className="fine-print">App approval is <strong>{approval.status.toLowerCase()}</strong>. This approval has not started a payment.</p></div></div>
    <ol className="mini-steps"><li>We create one PayPal order for this exact cart</li><li>You approve it in the PayPal window</li><li>The server captures and verifies the result</li></ol>
    {ready && !permitted && caps?.consent_mode !== 'buyer' && <div className="alert is-info"><Icon name="lock" /><div><strong>Waiting for payment permission</strong><p>This server runs in strict mode: a person gives one-time consent outside the browser by running <code>manage.py authorize_sandbox_purchase</code> and typing the total. This page updates by itself when it’s given.</p><button className="btn small" disabled={busy} onClick={onReload}><Icon name="refresh" />Check now</button></div></div>}
    {caps?.consent_mode === 'buyer' && permitted && <p className="consent-note"><Icon name="check" />Your approval above authorizes this one sandbox order, for this exact total, until it expires.</p>}
    <button className="btn primary wide" disabled={busy || !permitted} aria-describedby="checkout-permission" onClick={onStart}>Start sandbox checkout<Icon name="arrow" /></button>
    <p id="checkout-permission" className="fine-print">{caps?.consent_mode === 'buyer' ? 'Creates one order for this exact approved cart.' : 'Requires current permission for this exact approved cart.'} After creation, continue to PayPal to approve the existing sandbox order.</p>
  </section>;
}

const attemptText: Record<Attempt['state'], { title: string; body: string; short: string }> = {
  CREATING: { title: 'Creating the approved sandbox order', body: 'The outcome is still pending. Do not start another purchase.', short: 'Creating order…' },
  AWAITING_BUYER: { title: 'Awaiting PayPal buyer approval', body: 'App approval is recorded. A completed payment has not been verified.', short: 'Approve in PayPal' },
  CAPTURING: { title: 'Payment capture is pending', body: 'A capture may already have been dispatched. Check this existing attempt; do not pay again.', short: 'Capturing…' },
  VERIFYING: { title: 'Verifying payment details', body: 'The server has not yet verified the final payment result.', short: 'Verifying…' },
  UNKNOWN: { title: 'Payment status is unknown', body: 'A timeout does not prove failure. Check the existing payment status before taking any further action.', short: 'Status unknown' },
  PAYMENT_REVIEW: { title: 'Payment needs manual review', body: 'A completed payment has mismatched details. Manual resolution is required. Do not start another purchase.', short: 'Needs review' },
  PAID: { title: 'Payment confirmed', body: 'The server verified the completed payment against the approved cart. This does not confirm shipment or delivery.', short: 'Paid' },
  STOPPED: { title: 'Payment attempt stopped', body: 'This attempt cannot capture. Check the decision history before preparing a fresh review.', short: 'Stopped' },
};
export function paymentTransitionNotice(current: Attempt, incoming: Attempt): string | null {
  if (current.id !== incoming.id || current.state === incoming.state || Date.parse(incoming.updated_at) < Date.parse(current.updated_at)) return null;
  // Urgent states already have an alert; clear an older polite status without duplicating it.
  return ['UNKNOWN', 'PAYMENT_REVIEW'].includes(incoming.state) ? '' : attemptText[incoming.state].title;
}
const trackSteps = ['Order created', 'Approved in PayPal', 'Payment captured', 'Verified by server'];
function trackPosition(a: Attempt) {
  if (a.state === 'UNKNOWN') return a.pending_operation === 'create' ? 0 : a.pending_operation === 'capture' ? 2 : a.pending_operation === 'verification' ? 3 : 1;
  return { CREATING: 0, AWAITING_BUYER: 1, CAPTURING: 2, VERIFYING: 3, PAYMENT_REVIEW: 3, PAID: 4, STOPPED: 1 }[a.state];
}
export function PaymentStatus({ attempt: a, financialEnabled, busy, pollEnded, onAction }: { attempt: Attempt; financialEnabled: boolean; busy: boolean; pollEnded: boolean; onAction: (action: 'reconcile' | 'stop') => void }) {
  const message = attemptText[a.state];
  const uncertain = ['UNKNOWN', 'PAYMENT_REVIEW'].includes(a.state);
  const at = trackPosition(a);
  return <section className={`panel payment reveal${uncertain ? ' is-uncertain' : ''}${a.state === 'PAID' ? ' is-paid' : ''}`} aria-labelledby="payment-heading">
    {a.state === 'PAID' && <svg className="paid-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="m15 27 7 7 15-16" /></svg>}
    <h2 id="payment-heading">{message.title}</h2>
    <p {...(uncertain ? { role: 'alert' } : {})}>{message.body}</p>
    <ol className="track" aria-label="Payment progress">{trackSteps.map((name, i) => <li key={name} className={i < at ? 'is-done' : i === at && a.state !== 'PAID' ? (uncertain ? 'is-alert' : a.state === 'STOPPED' ? 'is-stopped' : 'is-now') : undefined}><span aria-hidden="true" />{name}</li>)}</ol>
    <dl className="receipt-facts"><div><dt>Approved total</dt><dd>{money(a.total_cents)} USD</dd></div><div><dt>Attempt reference</dt><dd>{idShort(a.id)}</dd></div><div><dt>Stored status</dt><dd>{a.state.replaceAll('_', ' ').toLowerCase()}</dd></div><div><dt>Last updated</dt><dd><time dateTime={a.updated_at}>{dateTime(a.updated_at)}</time></dd></div>{a.pending_operation && <div><dt>Pending operation</dt><dd>{a.pending_operation}</dd></div>}{a.capture_id && <div><dt>Capture reference</dt><dd className="mono">{a.capture_id}</dd></div>}</dl>
    {pending(a) && <p className="fine-print">{pollEnded ? 'Automatic checks paused after a bounded wait. Check the existing payment manually.' : 'Checking the saved status every few seconds. No payment action is retried.'}</p>}
    <div className="actions">{permitted(a, 'check_status', financialEnabled) && <button className="btn" disabled={busy} onClick={() => onAction('reconcile')}><Icon name="refresh" />Check existing payment status</button>}{permitted(a, 'stop', financialEnabled) && <button className="btn quiet" disabled={busy} onClick={() => onAction('stop')}>Request stop</button>}</div>
    {permitted(a, 'stop', financialEnabled) && <p className="fine-print">Stopping cannot undo a dispatched payment. An uncertain outcome remains under status checks.</p>}
  </section>;
}

export function PayPalCheckout({ session, attempt, busy, onApprove }: { session: Session; attempt: Attempt; busy: boolean; onApprove: (id: string) => Promise<void> }) {
  const [status, setStatus] = useState('Loading sandbox checkout');
  const flow = useRef<Awaited<ReturnType<typeof preparePayPal>> | null>(null);
  const approve = useRef(onApprove);
  approve.current = onApprove;
  useEffect(() => {
    let active = true;
    let preparedFlow: Awaited<ReturnType<typeof preparePayPal>> | null = null;
    flow.current = null;
    setStatus('Loading sandbox checkout');
    void preparePayPal(session, attempt, {
      onApprove: id => approve.current(id),
      onCancel: () => { if (active) { flow.current = null; setStatus('PayPal approval canceled. No payment outcome is assumed. Check the existing payment status.'); } },
      onError: () => { if (active) { flow.current = null; setStatus('PayPal checkout could not continue. Check the existing payment status before reopening it.'); } },
    }).then(prepared => {
      if (!active) { prepared.dispose(); return; }
      preparedFlow = prepared; flow.current = prepared; setStatus('Ready to open the existing sandbox order');
    }).catch(error => {
      if (active) setStatus(error instanceof PayPalError && error.code === 'PAYPAL_INELIGIBLE' ? 'PayPal is not eligible for this sandbox checkout. The existing order remains saved.' : 'Sandbox checkout could not load. Check the existing payment status before retrying.');
    });
    return () => { active = false; preparedFlow?.dispose(); flow.current = null; };
  }, [session, attempt]);
  function open() {
    const prepared = flow.current;
    if (!prepared || busy) return;
    flow.current = null; setStatus('Complete buyer approval in PayPal. The server must still verify payment.');
    void prepared.start().catch(() => setStatus('Sandbox checkout could not open. Check the existing payment status.'));
  }
  return <section className="panel paypal reveal" aria-label="PayPal buyer approval">
    <p className="paypal-status" role="status">{status === 'Loading sandbox checkout' && <span className="spinner" aria-hidden="true" />}{status}</p>
    <button className="btn paypal-button wide" disabled={busy || !flow.current} onClick={open}>Continue to PayPal sandbox<Icon name="arrow" /></button>
    {!flow.current && status !== 'Loading sandbox checkout' && <button className="btn quiet" disabled={busy} onClick={() => window.location.reload()}>Reload page to retry existing order</button>}
    <p className="fine-print">PayPal buyer approval allows the server to capture only this approved cart. Payment is confirmed by the server’s independent status check.</p>
  </section>;
}
function ModelEvidence({ model }: { model: PurchaseRequest['model'] }) {
  if (!model) return null;
  return <p className="model-line"><Icon name="spark" />{model.used ? <>Actual model <b>{model.name}</b> · {(model.elapsed_ms / 1000).toFixed(1)} s · {model.tool_calls.map(t => `${t.name} ${t.status}`).join(', ')}</> : 'Fixture preview. AI did not run.'}<span className="fine-print"> Catalog facts and server totals are authoritative.</span></p>;
}

const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
// A self-contained HTML receipt for a server-verified sandbox payment.
export function receiptHtml(r: Review, a: Attempt): string {
  const row = (label: string, value: string) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SpendConsent receipt</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1a1714}h1{font-size:22px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px dashed #cfc6b6}td:last-child{text-align:right;font-family:monospace}.total td{font-weight:700;font-size:18px;border:0}p{color:#6a6258;font-size:13px}</style></head><body>
<h1>Payment receipt</h1><p>PayPal sandbox — test money only. Fictional goods; no real shipment.</p><table>
${row('Merchant', r.merchant.name)}${row('Item', `${r.item.name} (${r.item.sku})`)}${row('Quantity', `${r.item.packs} packs × ${r.item.pack_units} = ${r.item.individual_units} units`)}
${row('Items', money(r.subtotal_cents))}${row('Delivery', money(r.shipping_cents))}${row('Fixture tax', money(r.tax_cents))}${row('Discount', `−${money(r.discount_cents)}`)}
<tr class="total"><td>Total paid</td><td>${escapeHtml(money(a.total_cents))} USD</td></tr></table><table>
${row('Status', a.state === 'PAID' ? 'Paid, verified by the server' : a.state.toLowerCase())}${row('Capture reference', a.capture_id ?? '—')}${row('Attempt reference', idShort(a.id))}${row('Updated', dateTime(a.updated_at))}
</table><p>Generated by SpendConsent from the server-verified payment record.</p></body></html>`;
}
function downloadReceipt(r: Review, a: Attempt) {
  const url = URL.createObjectURL(new Blob([receiptHtml(r, a)], { type: 'text/html' }));
  const link = document.createElement('a');
  link.href = url; link.download = `spendconsent-receipt-${a.capture_id ?? idShort(a.id)}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  play('tick');
}

function Mark() {
  return <svg className="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="currentColor" /><path d="M9.5 17.2c2.1 1.2 3.4 2.6 4.2 4.3 2.2-5.6 5.4-9.4 9.3-11.7" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
const paths: Record<string, ReactNode> = {
  arrow: <path d="M5 12h13m-5-5 5 5-5 5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  spark: <path d="M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.4 2.4m6.6 6.6 2.4 2.4m0-11.4-2.4 2.4m-6.6 6.6-2.4 2.4" />,
  alert: <><path d="M12 4 2.8 19.5h18.4Z" /><path d="M12 10v4.5m0 2.6v.1" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />,
  sun: <><circle cx="12" cy="12" r="3.8" /><path d="M12 2.8v2m0 14.4v2M2.8 12h2m14.4 0h2M5.5 5.5l1.4 1.4m10.2 10.2 1.4 1.4m0-13-1.4 1.4M6.9 17.1l-1.4 1.4" /></>,
  question: <><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.4m0 2.6v.1" /></>,
  card: <><rect x="3" y="6" width="18" height="12.5" rx="2.5" /><path d="M3 10.5h18M7 15h3" /></>,
  plug: <path d="M9 3v5m6-5v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0Zm5.5 8.5V21" />,
  download: <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />,
  sound: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" /></>,
  mute: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path d="m16 9.5 5 5m0-5-5 5" /></>,
};
function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
