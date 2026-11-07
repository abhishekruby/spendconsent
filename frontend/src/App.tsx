import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { Api, ApiError } from './api.js';
import type { Attempt, Candidate, Charges, Constraints, Evidence, LinkView, Market, Progress, PurchaseRequest, RefundState, Review, Session, Suggestions } from './contract.js';
import { canStartNew, locksRequest, money, newerAttempt, newerRequest, parseCents, pending, permitted, friendlyQuestion, purchaseDisplay, readRequest, savings, unitCost } from './logic.js';
import { PayPalError, preparePayPal } from './paypal.js';
import { play, setSoundOn, soundOn, unlockAudio } from './sound.js';
import { onDevice, recognitionClass, transcript } from './voice.js';
import type { Recognition } from './voice.js';

const sample = 'Find exactly 40 microfiber cloths, 40 × 40 cm, under $60 including delivery and tax. One-time purchase only.';
const sampleRequests = [
  { category: 'cloth', label: '40 microfiber cloths', text: sample },
  { category: 'bag', label: '50 waste bags', text: 'Find exactly 50 waste bags, 30 liters each, under $40 including delivery and tax. One-time purchase only.' },
  { category: 'bottle', label: '10 spray bottles', text: 'Find exactly 10 spray bottles, 500 mL each, under $40 including delivery and tax. One-time purchase only.' },
  { category: 'notebook', label: '20 A5 notebooks', text: 'Find exactly 20 A5 notebooks, under $60 including delivery and tax. One-time purchase only.' },
] as const;
const AI_LABEL = 'The AI is reading your request';
const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value));
const clock = (value: string) => new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value));
const idShort = (id: string) => id.slice(0, 8);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const delay = (i: number) => ({ '--i': i }) as CSSProperties;

const THEME_KEY = 'spendconsent-theme';
function savedTheme(): 'light' | 'dark' {
  try { return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export function App() {
  const [api] = useState(() => new Api());
  // Light by default; dark only after this visitor picks it with the toggle.
  const [appearance, setAppearance] = useState<'light' | 'dark'>(savedTheme);
  const [session, setSession] = useState<Session | null>(null);
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [busy, setBusy] = useState('Connecting to SpendConsent');
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [draftMode, setDraftMode] = useState(true);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [pollEnded, setPollEnded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sound, setSound] = useState(soundOn);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [askedOwner, setAskedOwner] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const operation = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const submission = useRef<{ text: string; id: string } | null>(null);
  const pollCount = useRef({ id: '', count: 0 });
  const { currentReview, currentApproval, stage, collapseComparison } = purchaseDisplay(request, draftMode);
  const focusRequested = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = appearance;
  }, [appearance]);
  useEffect(() => {
    if (focusRequested.current) { heading.current?.focus(); focusRequested.current = false; }
  }, [stage, request?.id, request?.version, request?.status, request?.review?.id, draftMode]);
  useEffect(() => { void connect(); return () => { generation.current++; operation.current?.abort(); }; }, []);
  useEffect(unlockAudio, []);
  // Notices are announced immediately; the visible toast fades after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => { setEditing(false); setAskedOwner(false); }, [request?.id, request?.version]);

  function begin(label: string) {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    generation.current++;
    setBusy(label); setError(null); setNotice('');
    return { controller, serial: generation.current };
  }
  async function connect() {
    const { controller, serial } = begin('Connecting to SpendConsent');
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
    await paymentAction(`/api/attempts/${attempt.id}/${action}`, action === 'capture' ? 'Verifying buyer approval and the exact payment' : action === 'reconcile' ? 'Checking the payment status' : 'Cancelling this payment');
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
        if (!controller.signal.aborted && generation.current === serial) { setPollEnded(true); setNotice('Automatic checks paused. Use “Check payment status”.'); }
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
  // Going back: Describe reopens the request text (a new comparison; the old one
  // stays in Purchases); finished Compare/Approve steps scroll to their section.
  function editRequest(previous: PurchaseRequest) {
    submission.current = null; setText(previous.text); setDraftMode(true); setError(null);
    setNotice('Change your words, then compare again.');
    focusRequested.current = true; play('tick');
  }
  function reveal(selector: string) {
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' }); play('tick');
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
  const waitingForOwner = askedOwner && attempt?.state !== 'PAID';
  useEffect(() => {
    if (!waitingForPermission && !waitingForOwner && request?.status !== 'COMPARING') return;
    const timer = setInterval(() => void syncRef.current(), 4000);
    return () => clearInterval(timer);
  }, [waitingForPermission, waitingForOwner, request?.status]);
  const ownerApproved = useRef(false);
  useEffect(() => {
    const approvedNow = askedOwner && currentApproval?.status === 'APPROVED';
    if (approvedNow && !ownerApproved.current) { setNotice('The owner approved this exact cart.'); play('stamp'); }
    ownerApproved.current = !!approvedNow;
  }, [askedOwner, currentApproval?.status]);
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
      <p className="fine-print">Test shop catalog: fictional goods and prices. Per-unit costs are rounded to the nearest cent.</p>
    </section>}
    {request.status === 'READY' && session?.capabilities.ai_ready && <MarketCheck key={`${request.id}:${request.version}`} api={api} requestId={request.id} best={ordered[0]} />}
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
        <span className="sandbox-chip" title="PayPal sandbox: test money only, no real charges"><span className="test-dot" aria-hidden="true" />Sandbox<span className="wide-only"> · test money</span></span>
        {session && <button type="button" className="btn small quiet history-button" aria-label="Your purchases" onClick={() => setHistoryOpen(true)}><Icon name="list" /><span className="wide-only">Purchases</span></button>}
        <button type="button" className="icon-button" aria-pressed={sound} aria-label={sound ? 'Mute interface sounds' : 'Turn interface sounds on'}
          onClick={() => { const next = !sound; setSound(next); setSoundOn(next); if (next) play('tick'); }}><Icon name={sound ? 'sound' : 'mute'} /></button>
        <button type="button" className="icon-button" aria-label={`Use ${appearance === 'light' ? 'dark' : 'light'} appearance`} onClick={() => { const next = appearance === 'light' ? 'dark' : 'light'; setAppearance(next); try { window.localStorage.setItem(THEME_KEY, next); } catch { /* Lasts this page only. */ } }}>
          <Icon name={appearance === 'light' ? 'moon' : 'sun'} />
        </button>
      </div>
    </header>

    <div className="layout" data-stage={stage.toLowerCase()}>
      <aside className="rail" aria-label="Purchase progress">
        <nav className="journey" aria-label="Purchase stages">
          <ol>{steps.map((step, i) => {
            // Describe can always be reopened (also while the AI is asking a question);
            // later steps only once finished.
            const go = busy || !request || draftMode ? undefined
              : i === 0 ? (canStartNew(request) && !recoveryBlocked ? () => editRequest(request) : undefined)
              : step.tone !== 'done' ? undefined
              : i === 1 ? () => reveal(document.querySelector('.earlier .offers') ? '.earlier' : '.offers')
              : i === 2 ? () => reveal('.receipt') : undefined;
            const body = <>
              <span className="step-dot" aria-hidden="true">{step.tone === 'done' ? <Icon name="check" /> : step.tone === 'alert' ? '!' : i + 1}</span>
              <span className="step-text"><span className="step-name">{step.name}{step.current && <span className="sr-only">, current step</span>}</span>
                <span className="step-detail">{step.detail}</span>{go && <span className="step-go">{i === 0 ? 'Rewrite request' : 'View again'}</span>}</span>
            </>;
            return <li key={step.name} className={`step is-${step.tone}`} aria-current={step.current ? 'step' : undefined}>
              {go ? <button type="button" className="step-button" onClick={go}>{body}</button> : body}
            </li>;
          })}</ol>
        </nav>
        {request && !draftMode && <div className="rail-brief">
          <p className="rail-label">Your request</p>
          <p className="rail-quote">{request.text}</p>
          <p className="rail-meta">Request {idShort(request.id)} · v{request.version}</p>
          <div className="rail-actions">
            <button type="button" className="btn small" aria-disabled={!!busy} onClick={() => void refresh()}><Icon name="refresh" />Reload status</button>
            {canStartNew(request) && !recoveryBlocked && <button type="button" className="btn small quiet" disabled={!!busy} onClick={() => editRequest(request)}><Icon name="arrow" />Rewrite this request</button>}
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
        {offline && <div className="empty reveal"><Icon name="plug" /><h2>SpendConsent’s server isn’t answering</h2><p>Check your connection (running it yourself? start the backend), then retry. Anything you typed stays on this page.</p><button className="btn primary" onClick={() => void connect()}>Retry connection</button></div>}
        {recoveryBlocked && !busy && <div className="alert is-warning reveal"><Icon name="alert" /><div><strong>Reload the saved purchase before continuing</strong><p>This session has a saved request whose current status could not be read. A new request stays blocked until its status is known.</p><button className="btn small" onClick={() => void connect()}>Retry saved purchase recovery</button></div></div>}
        {session && !session.capabilities.ai_ready && <div className="alert is-info reveal"><Icon name="spark" /><div><strong>AI comparison is not ready</strong><p>You can save a request and confirm requirements. Comparison opens after the AI passes its checks.</p></div></div>}

        {thinking && <Thinking text={text || request?.text || ''} progress={progress} />}

        {!thinking && !recoveryBlocked && drafting && session && <form onSubmit={submit} className="composer reveal">
          <label className="sr-only" htmlFor="request-text">What supplies do you need?</label>
          <textarea id="request-text" name="text" rows={4} maxLength={2000} required value={text}
            placeholder="e.g. 40 microfiber cloths, 40 × 40 cm, under $60 delivered, one-time"
            disabled={!!busy || requestLocked} onChange={e => setText(e.target.value)} aria-describedby="request-help"
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
          {draftMode && request && <button type="button" className="ghost-link composer-back" onClick={() => { setDraftMode(false); setNotice(''); }}>← Back to current request</button>}
          <div className="composer-bar">
            <p id="request-help" className="composer-help">Include <b>how many</b>, <b>what size</b> and your <b>max total</b>.</p>
            <VoiceButton disabled={!!busy || requestLocked} onText={setText} tidy={raw => api.dictation(raw)} />
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
          <li><b>Approve</b><span>One exact cart, approved by a person: you or the owner, from any phone.</span></li>
          <li><b>Pay</b><span>PayPal, verified by the server. Cancel and refund within 7 days.</span></li>
        </ol>}
        {!thinking && drafting && session && <p className="why reveal" style={delay(7)}>Why a person approves: 60% of shoppers would stop using an AI shopping agent after one mistake, and approval before checkout is the safeguard they ask for most. <span className="fine-print">ACI Worldwide/YouGov and RTB House surveys, 2026.</span></p>}

        {!thinking && !draftMode && request && <div className="flow">
          {!collapseComparison && <AiReading request={request} />}
          {request.constraints && Object.keys(request.constraints).length > 0 && <div className="needs reveal">
            <RequirementChips constraints={request.constraints} />
            {editor && !asksForDetails && <button type="button" className="ghost-link" aria-expanded={editing} onClick={() => setEditing(v => !v)}>{editing ? 'Close' : 'Edit'}</button>}
          </div>}
          {request.clarification && <div className="question reveal"><Icon name="question" /><div><p className="question-label">Confirm the missing details</p><p>{friendlyQuestion(request.clarification.question, request.clarification.missing_fields)}</p></div></div>}
          {request.clarification && !busy && <SuggestionChips key={`${request.id}:${request.version}`} api={api} request={request}
            onPick={(change, label) => void mutate(`/api/requests/${request.id}/clarify`, { expected_version: request.version, constraints: withChange(request.constraints, change) }, `Comparing with ${label}`)} />}
          {editor && (asksForDetails || editing) && <div className="reveal">{editor}</div>}
          {request.status === 'COMPARING' && <div className="alert is-info reveal"><Icon name="clock" /><div><strong>Comparison is still in progress</strong><p>Reload the status to see the server’s result. Nothing is assumed in the meantime.</p><button className="btn small" disabled={!!busy} onClick={() => void refresh()}>Reload status</button></div></div>}
          {(ordered.length > 0 || request.excluded.length > 0) && (collapseComparison
            ? <details className="earlier reveal"><summary><span>Earlier comparison</span><span className="summary-hint">{plural(ordered.length, 'eligible offer')}</span></summary>{comparison}</details>
            : comparison)}
          {currentReview && <Insight request={request} review={currentReview} />}
          {currentReview && <ReviewCard review={currentReview} approval={currentApproval} locked={requestLocked} disabled={!!busy || recoveryBlocked}
            onApprove={() => void mutate(`/api/reviews/${currentReview.id}/approve`, { expected_version: currentReview.version, expected_digest: currentReview.digest }, 'Recording your exact-cart approval')} />}
          {currentReview && !currentApproval && !requestLocked && <AskOwner api={api} review={currentReview} busy={!!busy || recoveryBlocked} onSent={() => setAskedOwner(true)} />}
          {request.review && !currentReview && <details className="earlier reveal"><summary><span>Previous review</span><span className="summary-hint">request version {request.review.request_version}</span></summary><p className="fine-print">Shown read-only. Compare the current offers to prepare a fresh review.</p><ReviewCard review={request.review} approval={request.approval} locked disabled onApprove={() => {}} /></details>}
          {currentApproval && (!attempt || (attempt.state === 'STOPPED' && currentApproval.status === 'APPROVED')) && <CheckoutStart approval={currentApproval} session={session} busy={!!busy || recoveryBlocked} onStart={startAttempt} onReload={() => void refresh()} />}
          {attempt && (attempt.state === 'STOPPED'
            ? <details className="earlier reveal"><summary><span>Previous stopped payment attempt</span></summary><PaymentStatus attempt={attempt} financialEnabled={false} busy pollEnded={pollEnded} onAction={() => {}} /></details>
            : <>
              <PaymentStatus attempt={attempt} financialEnabled={session?.capabilities.financial_actions_enabled ?? false} busy={!!busy || recoveryBlocked} pollEnded={pollEnded} onAction={attemptAction} />
              {session && permitted(attempt, 'open_paypal', session.capabilities.financial_actions_enabled) && <PayPalCheckout session={session} attempt={attempt} busy={!!busy || recoveryBlocked} onApprove={id => attemptAction('capture', id)} />}
              <RefundPanel attempt={attempt} busy={!!busy || recoveryBlocked} onRefund={() => void paymentAction(`/api/attempts/${attempt.id}/refund`, 'Sending the refund to PayPal')} />
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

    {historyOpen && <PurchasesPanel api={api} canBuyAgain={canStartNew(request) && !busy && !recoveryBlocked}
      onClose={() => setHistoryOpen(false)} onBuyAgain={previous => { setHistoryOpen(false); buyAgain(previous); }} />}
    <div className="toast" data-show={!!(busy || notice)} aria-hidden="true">
      {busy ? <span className="spinner" /> : <Icon name="check" />}<span>{busy || notice}</span>
    </div>
  </>;
}

type Step = { name: string; detail: string; tone: 'done' | 'current' | 'todo' | 'alert' | 'busy'; current: boolean };
export function journey({ request, drafting, thinking, stage, currentReview, currentApproval, attempt, best }: {
  request: PurchaseRequest | null; drafting: boolean; thinking: boolean; stage: string; currentReview: Review | null;
  currentApproval: PurchaseRequest['approval']; attempt: Attempt | null; best: number | null;
}): Step[] {
  // A new draft, or a comparison in flight, starts a fresh journey: the previous
  // purchase's approval and payment never show against the new request.
  if (drafting || thinking) { currentReview = null; currentApproval = null; attempt = null; }
  const approvedNow = stage === 'Review' && !!currentApproval && ['APPROVED', 'CONSUMED'].includes(currentApproval.status);
  const at = thinking ? 1 : drafting ? 0 : approvedNow ? 3 : ['Request', 'Compare', 'Review', 'Payment'].indexOf(stage);
  const paid = attempt?.state === 'PAID';
  const tone = (i: number, alert = false): Step['tone'] => paid || i < at ? 'done' : i > at ? 'todo' : alert ? 'alert' : thinking ? 'busy' : 'current';
  const c = request && !drafting ? request.constraints : null;
  const ask = c && (c.quantity || c.budget_cents) ? [c.quantity && plural(c.quantity, 'unit'), c.budget_cents && `up to ${money(c.budget_cents)}`].filter(Boolean).join(' · ') : 'Say what you need';
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
    if (attempt.refund?.state === 'REFUNDED') return { eyebrow: 'Cancelled', title: 'Order cancelled. Refunded.', sub: 'The full amount went back to the buyer’s PayPal, checked against the original payment.' };
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
        <p className="fine-print">Self-hosted open AI model, no cloud AI · usually 15–40 s{elapsed > 45 ? ' · taking longer than usual, still working' : ''}</p>
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
    <Field name="budget" label="Max total, USD"><input id="budget" name="budget" inputMode="decimal" required placeholder="e.g. 40.00" defaultValue={constraints.budget_cents === undefined ? '' : (constraints.budget_cents / 100).toFixed(2)} aria-describedby={invalid ? 'budget-error' : 'budget-help'} aria-invalid={!!invalid} /></Field>
    <Field name="currency" label="Currency"><select id="currency" name="currency" required defaultValue={constraints.currency ?? ''}><option value="">Confirm currency</option><option value="USD">USD — US dollars</option></select></Field>
    {category === 'cloth' && <><Field name="width_cm" label="Width (cm)"><input key={`width:${category}`} id="width_cm" name="width_cm" type="number" min="1" max="10000" step="1" required defaultValue={attrs.width_cm ?? ''} /></Field><Field name="height_cm" label="Height (cm)"><input key={`height:${category}`} id="height_cm" name="height_cm" type="number" min="1" max="10000" step="1" required defaultValue={attrs.height_cm ?? ''} /></Field></>}
    {category === 'bag' && <Field name="capacity_l" label="Capacity (liters)"><input id="capacity_l" name="capacity_l" type="number" min="1" max="10000" step="1" required defaultValue={attrs.capacity_l ?? ''} /></Field>}
    {category === 'bottle' && <Field name="volume_ml" label="Volume (mL)"><input id="volume_ml" name="volume_ml" type="number" min="1" max="10000" step="1" required defaultValue={attrs.volume_ml ?? ''} /></Field>}
    {category === 'notebook' && <Field name="paper_size" label="Paper size"><select id="paper_size" name="paper_size" required defaultValue={attrs.paper_size ?? ''}><option value="">Choose a size</option><option>A4</option><option>A5</option><option>A6</option></select></Field>}
  </div><p id="budget-help" className="fine-print">The max total includes delivery and tax. Packs must add up to your exact quantity.</p>{invalid && <p id="budget-error" className="field-error" role="alert">{invalid}</p>}
    <div className="details-actions"><label className="check"><input name="one_time" type="checkbox" required defaultChecked={constraints.one_time === true} /><span>One-time purchase only</span></label><button className="btn primary">Update and compare<Icon name="arrow" /></button></div></fieldset></form>;
}
const readingLabel = { item: 'item', quantity: 'how many', size: 'size', budget: 'max total', terms: 'one-time', cost: 'delivered cost' } as const;
const missingLabel = (field: string) => ({ category: 'the item', quantity: 'how many', budget_cents: 'a max total', currency: 'the currency', one_time: 'one-time terms' } as Record<string, string>)[field]
  ?? (field.startsWith('attributes.') ? 'the size' : field);
// Makes the AI's part visible: the buyer's own words, tagged with what each became,
// then the split of work (AI understands, code checks, a person decides).
export function AiReading({ request }: { request: PurchaseRequest }) {
  const m = request.model;
  if (!m?.used) return null;
  const parts = readRequest(request.text, request.constraints);
  const c = request.constraints;
  const understood = [c.category, c.quantity, c.budget_cents, c.attributes && Object.keys(c.attributes).length ? 1 : undefined, c.one_time].filter(v => v !== undefined).length;
  const assumedOneTime = c.one_time === true && !parts.some(p => p.field === 'terms');
  const missing = [...new Set(request.clarification?.missing_fields.map(missingLabel) ?? [])];
  const checked = request.candidates.length + request.excluded.length;
  return <section className="ai-reading reveal" aria-labelledby="ai-reading-heading">
    <header><h2 id="ai-reading-heading"><Icon name="spark" />What the AI understood</h2>
      <p className="fine-print">{m.name.startsWith('qwen3-4b') ? 'Qwen3-4B' : m.name}, a self-hosted open AI model · read in {(m.elapsed_ms / 1000).toFixed(1)} s · {m.tool_calls.map(t => t.name).join(', ')} called once</p></header>
    <blockquote className="reading">{parts.map((p, i) => p.field
      ? <mark key={i} data-field={p.field}><span className="reading-word">{p.text}</span><span className="reading-tag">{readingLabel[p.field]}</span></mark> : <span key={i}>{p.text}</span>)}</blockquote>
    {assumedOneTime && <p className="fine-print">One-time purchase by default: SpendConsent never sets up subscriptions or repeat orders.</p>}
    {missing.length > 0 && <p className="reading-missing"><Icon name="question" />Not in your words: {missing.join(', ')}. The AI asks instead of guessing.</p>}
    <ol className="division" aria-label="Who did what">
      <li><b>The AI read your words</b><span>{plural(understood, 'detail')} turned into an exact order form. It did no maths and picked nothing.</span></li>
      <li><b>Code checked every offer</b><span>{checked ? `${plural(checked, 'offer')}: ${request.candidates.length} fit exactly, ${request.excluded.length} ruled out.` : 'Waiting for the missing details.'} Sizes, packs, tax and delivery are calculated, not guessed.</span></li>
      <li><b>A person decides</b><span>Nothing is bought until you approve the exact cart.</span></li>
    </ol>
  </section>;
}
// One click answers what is missing, using options read from the catalog.
function withChange(current: Constraints, change: Constraints): Constraints {
  const switched = change.category !== undefined && change.category !== current.category;
  return { ...current, ...change, attributes: switched ? change.attributes : { ...current.attributes, ...change.attributes } };
}
function SuggestionChips({ api, request, onPick }: { api: Api; request: PurchaseRequest; onPick: (change: Constraints, label: string) => void }) {
  const [s, setS] = useState<Suggestions | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api.suggestions(request.id, controller.signal).then(setS).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!s || (!s.sizes.length && !s.category_hint && !s.quantities.length && !s.budgets.length)) return null;
  const names = { cloth: 'microfiber cloths', bag: 'waste bags', bottle: 'spray bottles', notebook: 'notebooks' } as const;
  const item = request.constraints.category ? names[request.constraints.category] : 'it';
  const pick = (change: Constraints, label: string) => { play('select'); onPick(change, label); };
  return <section className="suggest reveal" aria-label="Quick answers">
    {s.category_hint && <div className="suggest-row"><p>Did you mean <b>{s.category_hint.label}</b>? That size is a cloth size.</p>
      <button type="button" className="chip-button" onClick={() => pick({ category: s.category_hint!.category, attributes: s.category_hint!.attributes }, s.category_hint!.label)}>Yes, {s.category_hint.label}</button></div>}
    {s.sizes.length > 0 && <div className="suggest-row"><p>Which size of {item}? These are the sizes in stock.</p>
      <div className="chip-row">{s.sizes.map(o => <button key={o.label} type="button" className="chip-button" onClick={() => pick({ attributes: o.attributes }, o.label)}>{o.label}</button>)}</div></div>}
    {s.quantities.length > 0 && <div className="suggest-row"><p>{request.constraints.quantity ? <>Packs can’t make exactly {plural(request.constraints.quantity, 'unit')}. Pick an amount they can:</> : 'How many? Packs can make these amounts exactly.'}</p>
      <div className="chip-row">{s.quantities.map(q => <button key={q} type="button" className="chip-button" onClick={() => pick({ quantity: q }, `${q} units`)}>{q}</button>)}</div></div>}
    {s.budgets.length > 0 && <div className="suggest-row"><p>Max total, including delivery and tax?{s.cheapest_cents !== null && <> The cheapest exact fit is <b>{money(s.cheapest_cents)}</b>.</>}</p>
      <div className="chip-row">{s.budgets.map(b => <button key={b} type="button" className="chip-button" onClick={() => pick({ budget_cents: b }, `a max of ${money(b)}`)}>Up to {money(b)}</button>)}</div></div>}
  </section>;
}
// Speak the request. While listening, words show in a preview line only, so the box
// is never overwritten; on stop the local AI applies the speaker's own corrections
// ("fifty, no, forty") and the result is added to the box for the buyer to check.
function VoiceButton({ disabled, onText, tidy }: { disabled: boolean; onText: (update: (current: string) => string) => void; tidy: (raw: string) => Promise<{ text: string; tidied: boolean }> }) {
  const [Recognizer] = useState(() => recognitionClass());
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [note, setNote] = useState('');
  const [last, setLast] = useState<{ raw: string; text: string } | null>(null);
  const active = useRef<Recognition | null>(null);
  const words = useRef('');
  useEffect(() => () => active.current?.abort(), []);
  if (!Recognizer) return null;
  async function finish() {
    const raw = words.current;
    active.current = null; setListening(false); setHeard(''); play('tick');
    if (!raw) { setNote(n => n.startsWith('Listening') ? 'Didn’t hear anything. Try again.' : n); return; }
    setNote('Tidying up what you said…');
    const result = await tidy(raw).catch(() => ({ text: raw, tidied: false }));
    onText(current => [current.trim(), result.text].filter(Boolean).join(' '));
    setLast(result.tidied ? { raw, text: result.text } : null);
    setNote(result.tidied ? 'Your spoken corrections were applied. Check the words, then compare.' : 'Added what you said. Check the words, then compare.');
  }
  async function toggle() {
    if (active.current) { active.current.stop(); return; }
    const lang = navigator.language || 'en-US';
    const recognition = new Recognizer!();
    const local = await onDevice(Recognizer!, lang);
    recognition.lang = lang; recognition.continuous = true; recognition.interimResults = true;
    if (local) recognition.processLocally = true;
    words.current = ''; setLast(null);
    recognition.onresult = event => { words.current = transcript(event.results); setHeard(words.current); };
    recognition.onerror = event => setNote(event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? 'Microphone blocked. Allow it in the browser to speak your request.' : event.error === 'no-speech' ? 'Didn’t hear anything. Try again.' : 'Voice input stopped. You can type instead.');
    recognition.onend = () => void finish();
    active.current = recognition;
    setNote(local ? 'Listening on this device. Tap the mic again when you’re done.' : 'Listening (browser speech service). Tap the mic again when you’re done.');
    setListening(true); play('tick');
    try { recognition.start(); } catch { active.current = null; setListening(false); setNote('Voice input could not start. You can type instead.'); }
  }
  return <>
    <button type="button" className={`icon-button voice${listening ? ' is-listening' : ''}`} disabled={disabled || note === 'Tidying up what you said…'} aria-pressed={listening}
      aria-label={listening ? 'Stop and add what I said' : 'Speak your request'} title={listening ? 'Stop' : 'Speak your request'} onClick={() => void toggle()}><Icon name="mic" /></button>
    <div className="voice-note" role="status">
      {listening && heard && <p className="voice-heard">“{heard}”</p>}
      {note && <p>{note}</p>}
      {last && !listening && <p className="fine-print">You said: “{last.raw}” <button type="button" className="ghost-link"
        onClick={() => { onText(current => current.replace(last.text, last.raw)); setLast(null); setNote('Restored exactly what you said.'); }}>Use exactly what I said</button></p>}
    </div>
  </>;
}
function RequirementChips({ constraints: c }: { constraints: Constraints }) {
  const a = c.attributes;
  const names = { cloth: 'Microfiber cloths', bag: 'Waste bags', bottle: 'Spray bottles', notebook: 'Notebooks' } as const;
  const spec = c.category === 'cloth' ? (a?.width_cm && a?.height_cm ? `${a.width_cm} × ${a.height_cm} cm` : null) : c.category === 'bag' ? (a?.capacity_l ? `${a.capacity_l} L` : null)
    : c.category === 'bottle' ? (a?.volume_ml ? `${a.volume_ml} mL` : null) : c.category === 'notebook' ? a?.paper_size ?? null : null;
  const chips: [string, string | null][] = [['What', c.category ? names[c.category] : null], ['How many', c.quantity ? plural(c.quantity, 'unit') : null], ['Size', spec],
    ['Max total', c.budget_cents === undefined ? null : money(c.budget_cents)], ['Terms', c.one_time === true ? 'One-time' : null]];
  return <ul className="chips" aria-label="Your requirements">{chips.map(([label, value]) => <li key={label} className={value ? undefined : 'is-missing'}><span className="chip-label">{label}</span>{value ?? 'Not confirmed'}</li>)}</ul>;
}
function PriceBreakdown({ charges }: { charges: Charges }) {
  return <dl className="breakdown"><div><dt>Items</dt><dd>{money(charges.subtotal_cents)}</dd></div><div><dt>Delivery</dt><dd>{money(charges.shipping_cents)}</dd></div><div><dt>Tax (test rate)</dt><dd>{money(charges.tax_cents)}</dd></div><div><dt>Discount</dt><dd>−{money(charges.discount_cents)}</dd></div><div className="total"><dt>Full total</dt><dd>{money(charges.total_cents)} <span>USD</span></dd></div></dl>;
}
// Real retail prices from Channel3 so the owner can judge the supplier offer; never part of the cart.
function MarketCheck({ api, requestId, best }: { api: Api; requestId: string; best?: Candidate }) {
  const [market, setMarket] = useState<Market | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api.market(requestId, controller.signal).then(setMarket).catch(() => { if (!controller.signal.aborted) setMarket({ available: false }); });
    return () => controller.abort();
  }, []);
  if (!market) return <div className="market" aria-busy="true"><div className="skeleton short" /></div>;
  if (!market.available || market.listings.length === 0) return null;
  const own = best ? Math.round(best.total_cents / best.individual_units) : null;
  const priced = market.listings.filter(l => l.unit_cents !== null).map(l => l.unit_cents!);
  const low = priced.length ? Math.min(...priced) : null;
  const verdict = own === null || low === null ? null : own <= low ? 'Your best offer beats every retail listing per unit, before their delivery and tax.'
    : `Retail listings start at ${money(low)} per unit before delivery and tax; your best offer is ${money(own)} delivered.`;
  return <details className="market reveal" open>
    <summary><span>Real-world prices</span><span className="summary-hint">via Channel3</span></summary>
    {verdict && <p className="market-verdict">{verdict}</p>}
    <ul>{market.listings.map(l => <li key={l.url}>
      {l.image ? <img src={l.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="market-noimg" aria-hidden="true" />}
      <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title}</a>
      <span className="fine-print">{l.domain}{l.units ? ` · ${l.units} per pack` : ''}</span>
      <span className="market-price mono">{money(l.price_cents)}{l.unit_cents !== null && <small> · {money(l.unit_cents)} each</small>}</span>
    </li>)}</ul>
    <p className="fine-print">Live US retail listings for “{market.query}”. Listings of a different size are left out; per-item prices only where the listing states the same size and pack count. Prices exclude their delivery and tax. For reference only: the cart and payment use the supplier offer above.</p>
  </details>;
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
const plainReason: Record<string, string> = {
  'Declared specification does not match.': 'wrong size or spec',
  'Pack size cannot provide the exact individual-unit quantity.': 'packs can’t make the exact quantity',
  'Full delivered total exceeds the budget.': 'over budget once delivery and tax are added',
  'Insufficient available packs.': 'not enough stock',
  'One-time terms are not available.': 'subscription only',
};
// Why this cart: the measurable value of the comparison, shown before anyone approves.
export function Insight({ request, review }: { request: PurchaseRequest; review: Review }) {
  const s = savings(request, review.item.offer_id);
  const reasons = [...new Set(request.excluded.flatMap(x => x.reasons))].map(r => plainReason[r] ?? r.replace(/\.$/, '').toLowerCase());
  if (s.fitting === 0) return null;
  const lead = s.vsNext === null ? `The only offer of ${request.candidates.length + request.excluded.length} that fits exactly.`
    : s.vsNext >= 0 ? `Cheapest of ${plural(s.fitting, 'offer')} that fit exactly: ${money(s.vsNext)} less than the next.`
    : `${money(-s.vsNext)} more than the cheapest offer that fits.`;
  return <div className="insight reveal"><Icon name="check" /><div><strong>{lead}</strong>
    {s.ruledOut > 0 && <p>{plural(s.ruledOut, 'offer')} ruled out before you saw them: {reasons.join('; ')}.</p>}</div></div>;
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
    <details className="receipt-more"><summary>Price details</summary>
      <dl className="receipt-facts"><div><dt>Price version</dt><dd>{r.quote_version}</dd></div><div><dt>Prices checked</dt><dd><time dateTime={r.created_at}>{dateTime(r.created_at)}</time></dd></div><div><dt>Review expires</dt><dd><time dateTime={r.expires_at}>{dateTime(r.expires_at)}</time></dd></div></dl>
      <EvidenceList evidence={r.evidence} />
    </details>
    {approval && <div className={`approval-note${approved ? ' is-ok' : ''}`}><Icon name={approved ? 'check' : 'clock'} /><div><strong>Your approval: {approvalWord[approval.status]}</strong><p>Recorded {dateTime(approval.approved_at)}. Expires {dateTime(approval.expires_at)}.</p>
      <p className="fine-print">Cart mandate <span className="mono" title={r.digest}>{fingerprint(r.digest)}</span>: a fingerprint of this exact merchant, item, quantity, charges and total. Any change voids it.</p><p className="fine-print">The server checks validity again before any payment operation.</p></div></div>}
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
    <div className="panel-head"><Icon name="card" /><div><h2 id="checkout-heading">Sandbox checkout</h2><p className="fine-print">Your approval is <strong>{approvalWord[approval.status]}</strong>. Nothing has been charged yet.</p></div></div>
    <ol className="mini-steps"><li>We create one PayPal order for this exact cart</li><li>You approve it in the PayPal window</li><li>We take the payment and check it with PayPal</li></ol>
    {ready && !permitted && caps?.consent_mode !== 'buyer' && <div className="alert is-info"><Icon name="lock" /><div><strong>Waiting for payment permission</strong><p>This server runs in strict mode: a person gives one-time consent outside the browser by running <code>manage.py authorize_sandbox_purchase</code> and typing the total. This page updates by itself when it’s given.</p><button className="btn small" disabled={busy} onClick={onReload}><Icon name="refresh" />Check now</button></div></div>}
    {caps?.consent_mode === 'buyer' && permitted && <p className="consent-note"><Icon name="check" />Your approval above authorizes this one sandbox order, for this exact total, until it expires.</p>}
    <button className="btn primary wide" disabled={busy || !permitted} aria-describedby="checkout-permission" onClick={onStart}>Start sandbox checkout<Icon name="arrow" /></button>
    <p id="checkout-permission" className="fine-print">{caps?.consent_mode === 'buyer' ? 'Creates one order for this exact approved cart.' : 'Requires current permission for this exact approved cart.'} After creation, continue to PayPal to approve the existing sandbox order.</p>
  </section>;
}

const approvalWord: Record<NonNullable<PurchaseRequest['approval']>['status'], string> = {
  APPROVED: 'approved', EXPIRED: 'expired (approve again to pay)', REVOKED: 'no longer valid (the price or offer changed)', CONSUMED: 'used for this payment',
};
const attemptText: Record<Attempt['state'], { title: string; body: string; short: string }> = {
  CREATING: { title: 'Creating your PayPal order', body: 'One order for this exact cart. Please don’t start another purchase meanwhile.', short: 'Creating order…' },
  AWAITING_BUYER: { title: 'Waiting for you in PayPal', body: 'You approved the cart. Finish in the PayPal window; nothing is paid until you do.', short: 'Waiting for PayPal' },
  CAPTURING: { title: 'Taking the payment', body: 'PayPal may already be taking the payment. Don’t pay again; check the payment status.', short: 'Taking payment…' },
  VERIFYING: { title: 'Checking the payment with PayPal', body: 'We confirm the amount, shop and order with PayPal before saying it’s paid.', short: 'Checking…' },
  UNKNOWN: { title: 'We’re confirming the payment', body: 'A slow reply doesn’t mean it failed. Check the payment status before doing anything else.', short: 'Confirming…' },
  PAYMENT_REVIEW: { title: 'This payment needs a manual check', body: 'PayPal’s record doesn’t match the approved cart. Nothing more will be charged; please contact support.', short: 'Needs a check' },
  PAID: { title: 'Payment confirmed', body: 'PayPal confirmed the payment for exactly the cart you approved.', short: 'Paid' },
  STOPPED: { title: 'Payment cancelled', body: 'No money was taken for this payment. Review the cart again to buy it.', short: 'Not completed' },
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
    <dl className="receipt-facts"><div><dt>Approved total</dt><dd>{money(a.total_cents)} USD</dd></div><div><dt>Payment reference</dt><dd>{idShort(a.id)}</dd></div><div><dt>Status</dt><dd>{message.short}</dd></div><div><dt>Last updated</dt><dd><time dateTime={a.updated_at}>{dateTime(a.updated_at)}</time></dd></div>{a.pending_operation && <div><dt>Pending operation</dt><dd>{a.pending_operation}</dd></div>}{a.capture_id && <div><dt>Capture reference</dt><dd className="mono">{a.capture_id}</dd></div>}</dl>
    {pending(a) && <p className="fine-print">{pollEnded ? 'Automatic checks paused. Use “Check payment status”.' : 'Checking with PayPal every few seconds. Nothing is charged twice.'}</p>}
    <div className="actions">{permitted(a, 'check_status', financialEnabled) && <button className="btn" disabled={busy} onClick={() => onAction('reconcile')}><Icon name="refresh" />Check payment status</button>}{permitted(a, 'stop', financialEnabled) && a.reason_code !== 'STOP_REQUESTED' && <button className="btn quiet" disabled={busy} onClick={() => onAction('stop')}>Cancel this payment</button>}</div>
    {a.reason_code === 'STOP_REQUESTED'
      ? <p className="consent-note"><Icon name="check" />Cancellation requested. We’re confirming with PayPal that no money was taken, then this payment is cancelled. Use “Check payment status”.</p>
      : permitted(a, 'stop', financialEnabled) && <p className="fine-print">If PayPal has already taken the payment, cancelling here can’t reverse it; you can then request a refund.</p>}
  </section>;
}

const refundText: Record<RefundState, string> = {
  REFUNDING: 'Sending the refund to PayPal…',
  NOT_SENT: 'Refund permission was unavailable. Nothing was sent to PayPal.',
  PENDING: 'PayPal is processing the refund. Check again shortly.',
  UNKNOWN: 'The refund outcome is uncertain. Check again; it can never refund more than was paid.',
  REFUNDED: 'Cancelled. The full amount was refunded to the buyer’s PayPal.',
  DECLINED: 'PayPal did not complete the refund.',
};
// Cancel order & refund: one full PayPal refund of a verified paid purchase, after an explicit confirm.
export function RefundPanel({ attempt: a, busy, onRefund }: { attempt: Attempt; busy: boolean; onRefund: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const r = a.refund;
  const can = a.allowed_actions.includes('refund');
  if (a.state !== 'PAID' || (!r && !can)) return null;
  return <section className={`panel refund reveal${r?.state === 'REFUNDED' ? ' is-refunded' : ''}`} aria-labelledby="refund-heading">
    <h2 id="refund-heading">{r?.state === 'REFUNDED' ? 'Order cancelled and refunded' : 'Need to cancel this order?'}</h2>
    {r ? <p role="status">{refundText[r.state]}{r.provider_refund_id && <span className="fine-print mono"> · {r.provider_refund_id}</span>}</p>
      : <p className="fine-print">Cancelling refunds the full {money(a.total_cents)} to the buyer’s PayPal and returns the items to stock. Available for 7 days after payment.</p>}
    {can && (confirming || r
      ? <div className="actions">
          <button className="btn primary" disabled={busy} onClick={() => { setConfirming(false); onRefund(); }}><Icon name="refresh" />{r ? (r.state === 'PENDING' ? 'Check refund status' : 'Try the refund again') : `Yes, cancel and refund ${money(a.total_cents)}`}</button>
          {!r && <button className="btn quiet" disabled={busy} onClick={() => setConfirming(false)}>Keep the order</button>}
        </div>
      : <div className="actions"><button className="btn" disabled={busy} onClick={() => setConfirming(true)}>Cancel order &amp; refund</button></div>)}
  </section>;
}

export function PayPalCheckout({ session, attempt, busy, onApprove }: { session: Session; attempt: Attempt; busy: boolean; onApprove: (id: string) => Promise<void> }) {
  const [status, setStatus] = useState('Loading sandbox checkout');
  const flow = useRef<Awaited<ReturnType<typeof preparePayPal>> | null>(null);
  const approve = useRef(onApprove);
  approve.current = onApprove;
  const latest = useRef({ session, attempt });
  latest.current = { session, attempt };
  // Re-prepare only when the payment itself changes. Background status refreshes
  // create new objects every few seconds; reacting to those disposed the open
  // PayPal session, so the buyer's approval was ignored and nothing was captured.
  const flowKey = [session.paypal?.client_id, session.capabilities.financial_actions_enabled, attempt.id, attempt.state, attempt.provider_order_id].join('|');
  useEffect(() => {
    const { session, attempt } = latest.current;
    let active = true;
    let preparedFlow: Awaited<ReturnType<typeof preparePayPal>> | null = null;
    flow.current = null;
    setStatus('Loading sandbox checkout');
    void preparePayPal(session, attempt, {
      onApprove: id => approve.current(id),
      onCancel: () => { if (active) { flow.current = null; setStatus('PayPal approval canceled. No payment outcome is assumed. Check the payment status.'); } },
      onError: () => { if (active) { flow.current = null; setStatus('PayPal checkout could not continue. Check the payment status before reopening it.'); } },
    }).then(prepared => {
      if (!active) { prepared.dispose(); return; }
      preparedFlow = prepared; flow.current = prepared; setStatus('Ready to open the existing sandbox order');
    }).catch(error => {
      if (active) setStatus(error instanceof PayPalError && error.code === 'PAYPAL_INELIGIBLE' ? 'PayPal is not eligible for this sandbox checkout. The existing order remains saved.' : 'Sandbox checkout could not load. Check the existing payment status before retrying.');
    });
    return () => { active = false; preparedFlow?.dispose(); flow.current = null; };
  }, [flowKey]);
  function open() {
    const prepared = flow.current;
    if (!prepared || busy) return;
    flow.current = null; setStatus('Complete buyer approval in PayPal. The server must still verify payment.');
    void prepared.start().catch(() => setStatus('Sandbox checkout could not open. Check the payment status.'));
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
// The approval is a cart mandate: a SHA-256 fingerprint of exactly what was approved.
const fingerprint = (digest: string) => `${digest.slice(0, 8)}…${digest.slice(-8)}`;
export function receiptHtml(r: Review, a: Attempt): string {
  const row = (label: string, value: string) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SpendConsent receipt</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1a1714}h1{font-size:22px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px dashed #cfc6b6}td:last-child{text-align:right;font-family:monospace}.total td{font-weight:700;font-size:18px;border:0}p{color:#6a6258;font-size:13px}</style></head><body>
<h1>Payment receipt</h1><p>PayPal sandbox — test money only. Fictional goods; no real shipment.</p><table>
${row('Merchant', r.merchant.name)}${row('Item', `${r.item.name} (${r.item.sku})`)}${row('Quantity', `${r.item.packs} packs × ${r.item.pack_units} = ${r.item.individual_units} units`)}
${row('Items', money(r.subtotal_cents))}${row('Delivery', money(r.shipping_cents))}${row('Tax (test rate)', money(r.tax_cents))}${row('Discount', `−${money(r.discount_cents)}`)}
<tr class="total"><td>Total paid</td><td>${escapeHtml(money(a.total_cents))} USD</td></tr></table><table>
${row('Status', a.refund?.state === 'REFUNDED' ? 'Cancelled and refunded in full' : a.state === 'PAID' ? 'Paid, verified by the server' : a.state.toLowerCase())}${row('Cart mandate (SHA-256)', r.digest)}${row('PayPal transaction ID', a.capture_id ?? '—')}${row('Payment reference', idShort(a.id))}${row('Updated', dateTime(a.updated_at))}
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

function purchaseState(p: PurchaseRequest): { label: string; tone: string; hint: string } {
  const a = p.attempt;
  if (a?.refund?.state === 'REFUNDED') return { label: 'Cancelled · refunded', tone: 'refunded', hint: 'This order was cancelled and the full amount refunded through PayPal.' };
  if (a?.state === 'PAID') return a.refund
    ? { label: 'Refund in progress', tone: 'refunded', hint: refundText[a.refund.state] }
    : { label: 'Paid', tone: 'ok', hint: 'Paid and confirmed with PayPal. You can cancel and get a refund for 7 days after payment.' };
  if (a && a.state !== 'STOPPED') return { label: attemptText[a.state].short, tone: a.state === 'PAYMENT_REVIEW' ? 'error' : a.state === 'UNKNOWN' ? 'warn' : 'busy', hint: attemptText[a.state].body };
  if (a?.state === 'STOPPED') return { label: 'Not completed', tone: 'stopped', hint: 'The payment was cancelled before any money was taken.' };
  if (p.approval?.status === 'APPROVED') return { label: 'Approved · not paid', tone: 'busy', hint: 'You approved this cart but haven’t paid yet.' };
  if (p.approval?.status === 'EXPIRED') return { label: 'Not paid · approval expired', tone: 'expired', hint: 'Approvals last a few minutes. No money was taken. Buy again to start a fresh one.' };
  if (p.approval?.status === 'REVOKED') return { label: 'Not paid · price changed', tone: 'expired', hint: 'The shop changed the price or offer after you approved, so the approval was cancelled. No money was taken.' };
  return { label: 'Not approved', tone: 'muted', hint: 'You reviewed this cart but didn’t approve it. No money was taken.' };
}
function PurchasesPanel({ api, canBuyAgain, onClose, onBuyAgain }: { api: Api; canBuyAgain: boolean; onClose: () => void; onBuyAgain: (p: PurchaseRequest) => void }) {
  const [rows, setRows] = useState<PurchaseRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const load = (signal?: AbortSignal) => api.purchases(signal).then(result => setRows(result.purchases)).catch(() => { if (!signal?.aborted) setFailed(true); });
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { controller.abort(); window.removeEventListener('keydown', onKey); };
  }, []);
  const paid = rows?.filter(p => p.attempt?.state === 'PAID' && p.attempt.refund?.state !== 'REFUNDED') ?? [];
  const paidTotal = paid.reduce((sum, p) => sum + p.attempt!.total_cents, 0);
  const saved = paid.reduce((sum, p) => sum + Math.max(0, savings(p, p.review!.item.offer_id).vsNext ?? 0), 0);
  const open = rows?.find(p => p.id === openId) ?? null;
  return <div className="drawer-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="purchases-heading">
      <header className="drawer-head"><div><h2 id="purchases-heading">{open ? 'Order details' : 'Your purchases'}</h2><p className="fine-print">In this browser · PayPal sandbox{!open && rows?.length ? ` · ${money(paidTotal)} paid` : ''}{!open && saved > 0 ? ` · ${money(saved)} saved vs next offers` : ''}</p></div>
        <button ref={close} type="button" className="icon-button" aria-label="Close purchases" onClick={onClose}><Icon name="plus" /></button></header>
      {failed && <p className="alert is-error">Purchases could not be loaded. Close and try again.</p>}
      {!rows && !failed && <div className="skeletons"><div className="skeleton short" /><div className="skeleton short" /><div className="skeleton short" /></div>}
      {open && <OrderDetail api={api} purchase={open} canBuyAgain={canBuyAgain} onBack={() => setOpenId(null)} onBuyAgain={onBuyAgain} onChanged={() => void load()} />}
      {!open && rows && rows.length === 0 && <div className="empty"><Icon name="list" /><p>No purchases yet. Carts you review, approve and pay will appear here.</p></div>}
      {!open && rows && rows.length > 0 && <ol className="purchase-list">{rows.map((p, i) => {
        const r = p.review!; const s = purchaseState(p);
        return <li key={p.id} className="purchase reveal" style={delay(i)}>
          <button type="button" className="purchase-open" onClick={() => { setOpenId(p.id); play('tick'); }} aria-label={`Open order: ${r.item.name}, ${s.label}`}>
            <span className="purchase-main"><span className="purchase-name">{r.item.name}</span>
              <span className="fine-print">{plural(r.item.individual_units, 'unit')} · <time dateTime={r.created_at}>{dateTime(r.created_at)}</time></span></span>
            <span className="purchase-side"><strong className="mono">{money(r.total_cents)}</strong><span className={`status-chip is-${s.tone}`}>{s.label}</span></span>
            <span className="purchase-more">View order<Icon name="arrow" /></span>
          </button>
        </li>;
      })}</ol>}
    </aside>
  </div>;
}
// One order: what was bought, what it cost, its payment, its history, and what you can do now.
function OrderDetail({ api, purchase: p, canBuyAgain, onBack, onBuyAgain, onChanged }: { api: Api; purchase: PurchaseRequest; canBuyAgain: boolean; onBack: () => void; onBuyAgain: (p: PurchaseRequest) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const r = p.review!; const a = p.attempt; const s = purchaseState(p);
  async function act(label: string, path: string) {
    setBusy(label); setError('');
    try { await api.mutateAttempt(path); play('success'); onChanged(); }
    catch (e) { setError(asError(e).message); play('error'); }
    finally { setBusy(''); }
  }
  return <div className="order reveal">
    <button type="button" className="ghost-link" onClick={onBack}>← All purchases</button>
    <header className="order-head"><div><h3>{r.item.name}</h3><p className="fine-print">{r.merchant.name} · {a?.state === 'PAID' ? 'ordered' : 'cart prepared'} <time dateTime={r.created_at}>{dateTime(r.created_at)}</time></p></div>
      <span className={`status-chip is-${s.tone}`}>{s.label}</span></header>
    <p className="order-hint">{s.hint}</p>
    {error && <p className="alert is-error" role="alert">{error}</p>}
    <dl className="receipt-facts">
      <div><dt>Quantity</dt><dd>{r.item.packs} packs × {r.item.pack_units} = {plural(r.item.individual_units, 'unit')}</dd></div>
      <div><dt>Size</dt><dd>{r.item.specification}</dd></div>
      <div><dt>Delivery to</dt><dd>{r.shipping.destination_label}</dd></div>
    </dl>
    <PriceBreakdown charges={r} />
    {a && <dl className="receipt-facts">
      <div><dt>Payment</dt><dd>{attemptText[a.state].short}{a.state === 'PAID' && <> · <time dateTime={a.updated_at}>{dateTime(a.updated_at)}</time></>}</dd></div>
      {a.capture_id && <div><dt>PayPal transaction ID</dt><dd className="mono">{a.capture_id}</dd></div>}
      <div><dt>Cart mandate</dt><dd className="mono" title={r.digest}>{fingerprint(r.digest)}</dd></div>
    </dl>}
    {a && <RefundPanel attempt={a} busy={!!busy} onRefund={() => void act('Sending the refund to PayPal', `/api/attempts/${a.id}/refund`)} />}
    {busy && <p className="fine-print" role="status">{busy}…</p>}
    <div className="purchase-actions">
      {a?.state === 'PAID' && <button type="button" className="btn small" onClick={() => downloadReceipt(r, a)}><Icon name="download" />Receipt</button>}
      {a && pending(a) && <button type="button" className="btn small" disabled={!!busy} onClick={() => void act('Checking the payment status', `/api/attempts/${a.id}/reconcile`)}><Icon name="refresh" />Check payment status</button>}
      <button type="button" className="btn small quiet" disabled={!canBuyAgain} onClick={() => onBuyAgain(p)}><Icon name="refresh" />Buy again</button>
    </div>
    <details className="order-history"><summary>Order history · {plural(p.events.length, 'event')}</summary>
      <ol>{p.events.map(e => <li key={e.id}><time dateTime={e.created_at}>{dateTime(e.created_at)}</time><span>{e.message}</span></li>)}</ol></details>
  </div>;
}

function AskOwner({ api, review, busy, onSent }: { api: Api; review: Review; busy: boolean; onSent: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function send() {
    setSending(true); setFailed(false);
    try {
      const created = await api.createLink(review.id);
      setLink(`${window.location.origin}/?approve=${created.token}`); onSent(); play('select');
    } catch { setFailed(true); play('error'); } finally { setSending(false); }
  }
  async function copy() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); play('tick'); } catch { /* The field stays selectable for manual copy. */ }
  }
  return <section className="panel ask-owner reveal" aria-labelledby="ask-owner-heading">
    <div className="panel-head"><Icon name="send" /><div><h2 id="ask-owner-heading">Not your card to pay?</h2>
      <p className="fine-print">Send this exact cart to the owner. They approve and pay with PayPal from their own device, and this page updates live.</p></div></div>
    {!link ? <button className="btn" disabled={busy || sending} onClick={() => void send()}>{sending && <span className="spinner" aria-hidden="true" />}Ask the owner to approve<Icon name="arrow" /></button>
      : <div className="share">
        <input readOnly value={link} aria-label="Owner approval link" onFocus={e => e.currentTarget.select()} />
        <div className="actions"><button type="button" className="btn small" onClick={() => void copy()}><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Copied' : 'Copy link'}</button>
          <a className="btn small quiet" href={link} target="_blank" rel="noopener noreferrer">Open owner view</a></div>
        <p className="waiting"><span className="spinner" aria-hidden="true" />Waiting for the owner to approve…</p>
      </div>}
    {failed && <p className="field-error" role="alert">The link could not be created. Reload the status, then try again.</p>}
  </section>;
}

// The page an approval link opens: one exact cart, approve, then pay with PayPal sandbox.
export function OwnerApproval({ token }: { token: string }) {
  const [api] = useState(() => new Api());
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<LinkView | null>(null);
  const [busy, setBusy] = useState('Opening the approval request');
  const [error, setError] = useState('');
  useEffect(() => {
    document.documentElement.dataset.theme = savedTheme();
    return unlockAudio();
  }, []);
  async function load() {
    const next = await api.link(token);
    setView(next);
    return next;
  }
  async function act(label: string, run: () => Promise<unknown>, cue?: Parameters<typeof play>[0]) {
    setBusy(label); setError('');
    try { await run(); if (cue) play(cue); } catch (e) { setError(e instanceof ApiError ? e.message : 'That did not go through. Reload and check the status.'); play('error'); }
    try { await load(); } catch { /* Keep the last known state on screen. */ }
    setBusy('');
  }
  useEffect(() => {
    void (async () => {
      try { setSession(await api.session()); await load(); } catch {
        setError('This approval link is invalid, expired, or its cart has changed. Ask for a new one.');
        try { window.sessionStorage.removeItem('spendconsent-approval-link'); } catch { /* Nothing stored. */ }
      }
      setBusy('');
    })();
  }, []);
  const attempt = view?.request.attempt ?? null;
  const pollable = pending(attempt);
  useEffect(() => {
    if (!pollable || busy) return;
    const timer = setInterval(() => void load().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [pollable, busy]);
  const previous = useRef<Attempt | null>(null);
  useEffect(() => {
    if (previous.current && attempt && previous.current.state !== attempt.state && attempt.state === 'PAID') play('success');
    previous.current = attempt;
  }, [attempt?.state]);
  const review = view?.request.review && view.request.review.id === view.review_id ? view.request.review : null;
  const approval = view?.request.approval && review && view.request.approval.review_id === review.id ? view.request.approval : null;
  const paySession = session && view ? { ...session, capabilities: view.capabilities, paypal: view.paypal } : null;
  const title = !view ? 'Approval request' : attempt?.state === 'PAID' ? 'Paid. Thank you.' : approval?.status === 'APPROVED' ? 'Approved. Pay with PayPal.' : 'Approve this purchase?';
  return <>
    <div className="loadbar" data-active={!!busy} aria-hidden="true" />
    <header className="topbar"><span className="brand"><Mark /><span>SpendConsent</span></span>
      <span className="sandbox-chip"><span className="test-dot" aria-hidden="true" />Sandbox<span className="wide-only"> · test money</span></span></header>
    <main className="owner-page stage">
      <div className="stage-head" key={title}><p className="eyebrow">Approval requested</p><h1>{title}</h1>
        <p className="lede">Someone on your team prepared this exact cart in SpendConsent. Nothing is paid until you approve it and confirm in PayPal.</p></div>
      <div className="live-status sr-only" role="status" aria-live="polite">{busy}</div>
      {error && <div className="alert is-error" role="alert"><Icon name="alert" /><div><strong>That didn’t go through</strong><p>{error}</p></div></div>}
      {view && !review && <div className="alert is-warning"><Icon name="alert" /><div><strong>This cart has changed</strong><p>A newer review replaced it. Ask for a new approval link.</p></div></div>}
      {!view && !error && <div className="skeletons"><div className="skeleton" /><div className="skeleton short" /></div>}
      {review && view && <Insight request={view.request} review={review} />}
      {review && <ReviewCard review={review} approval={approval} locked={!!attempt} disabled={!!busy}
        onApprove={() => void act('Recording your approval', () => api.linkApprove(token, { expected_version: review.version, expected_digest: review.digest }), 'stamp')} />}
      {approval?.status === 'APPROVED' && !attempt && view && <section className="panel checkout reveal" aria-labelledby="owner-pay-heading">
        <div className="panel-head"><Icon name="card" /><div><h2 id="owner-pay-heading">Pay with PayPal sandbox</h2><p className="fine-print">One order for this exact approved total. You confirm it in the PayPal window.</p></div></div>
        <button className="btn primary wide" disabled={!!busy || !view.capabilities.financial_actions_enabled} onClick={() => void act('Creating the PayPal order', () => api.linkStart(token), 'select')}>Continue to payment<Icon name="arrow" /></button>
        {!view.capabilities.financial_actions_enabled && <p className="fine-print">Payment is not available for this cart right now (sandbox checkout off, strict consent mode, or the approval expired).</p>}
      </section>}
      {attempt && attempt.state !== 'STOPPED' && <>
        <PaymentStatus attempt={attempt} financialEnabled={view?.capabilities.financial_actions_enabled ?? false} busy={!!busy} pollEnded={false}
          onAction={action => void act(action === 'reconcile' ? 'Checking the payment' : 'Requesting a stop', () => api.linkAction(token, action))} />
        {paySession && permitted(attempt, 'open_paypal', paySession.capabilities.financial_actions_enabled) && <PayPalCheckout session={paySession} attempt={attempt} busy={!!busy}
          onApprove={async () => { await act('Verifying the payment', () => api.linkAction(token, 'capture')); }} />}
        <RefundPanel attempt={attempt} busy={!!busy} onRefund={() => void act('Sending the refund to PayPal', () => api.linkAction(token, 'refund'))} />
        {attempt.state === 'PAID' && review && <button type="button" className="btn primary next" onClick={() => downloadReceipt(review, attempt)}><Icon name="download" />Download receipt</button>}
      </>}
    </main>
    <div className="toast" data-show={!!busy} aria-hidden="true"><span className="spinner" /><span>{busy}</span></div>
  </>;
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
  send: <path d="M4 12 20 4l-4 16-4.5-6.5Zm7.5 1.5L20 4" />,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></>,
  list: <path d="M8 7h11M8 12h11M8 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />,
  download: <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />,
  sound: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  mute: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path d="m16 9.5 5 5m0-5-5 5" /></>,
};
function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
