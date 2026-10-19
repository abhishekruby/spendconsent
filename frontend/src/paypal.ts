import { isAttempt, isSession } from './contract.js';
import type { Attempt, Session } from './contract.js';
import { permitted } from './logic.js';

const SOURCE = 'https://www.sandbox.paypal.com/web-sdk/v6/core';
type Failure = 'SDK_UNAVAILABLE' | 'PAYPAL_INELIGIBLE' | 'CHECKOUT_UNAVAILABLE' | 'CALLBACK_MISMATCH';
export class PayPalError extends Error {
  constructor(public code: Failure) { super(code); }
}
type Callbacks = {
  // Only the local attempt ID crosses this boundary. A callback is not payment proof.
  onApprove: (attemptId: string) => Promise<void>;
  onCancel: (attemptId: string) => void;
  onError: (code: Failure) => void;
};
type PaymentSession = { start(options: { presentationMode: 'auto' }, order: Promise<{ orderId: string }>): Promise<void> };
type SDK = {
  findEligibleMethods(options: { currencyCode: 'USD'; amount: string }): Promise<{ isEligible(method: 'paypal'): boolean }>;
  createPayPalOneTimePaymentSession(options: {
    onApprove(data: unknown): Promise<void>; onCancel(): void; onError(): void;
  }): PaymentSession;
};
type Core = { createInstance(options: { clientId: string; components: ['paypal-payments']; pageType: 'checkout' }): Promise<SDK> };
let core: Promise<Core> | undefined;

function loadCore(): Promise<Core> {
  if (core) return core;
  // Refuse an unknown preloaded SDK, including a Live SDK. Importing this file loads nothing.
  if ('paypal' in window || document.querySelector('script[src*="paypal.com/"]')) return Promise.reject(new PayPalError('SDK_UNAVAILABLE'));
  core = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { clearTimeout(timer); reject(new PayPalError('SDK_UNAVAILABLE')); };
    const timer = setTimeout(fail, 15000);
    script.src = SOURCE;
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      const loaded = (window as Window & { paypal?: Core }).paypal;
      if (loaded && typeof loaded.createInstance === 'function') resolve(loaded);
      else fail();
    };
    document.head.append(script);
  });
  return core;
}

/** Unwired preparation only. Call after server enablement and a stored order exists.
 * Dispose when the session/attempt changes or its UI unmounts. Start from a user click.
 */
export async function preparePayPal(session: Session, attempt: Attempt, callbacks: Callbacks) {
  if (!isSession(session) || !isAttempt(attempt) || !session.capabilities.ai_ready
      || !session.capabilities.paypal_ready || !session.paypal
      || !/^[A-Za-z0-9_-]{1,256}$/.test(session.paypal.client_id)
      || !permitted(attempt, 'open_paypal', session.capabilities.financial_actions_enabled)
      || !attempt.provider_order_id || !/^[A-Z0-9]{1,36}$/.test(attempt.provider_order_id)) {
    throw new PayPalError('CHECKOUT_UNAVAILABLE');
  }
  const attemptId = attempt.id;
  const orderId = attempt.provider_order_id;
  let sdk: SDK;
  try {
    sdk = await (await loadCore()).createInstance({ clientId: session.paypal.client_id, components: ['paypal-payments'], pageType: 'checkout' });
    const eligible = await sdk.findEligibleMethods({ currencyCode: 'USD', amount: (attempt.total_cents / 100).toFixed(2) });
    if (!eligible.isEligible('paypal')) throw new PayPalError('PAYPAL_INELIGIBLE');
  } catch (error) {
    throw error instanceof PayPalError ? error : new PayPalError('SDK_UNAVAILABLE');
  }
  let active = true;
  let started = false;
  const fail = (code: Failure) => {
    if (active) { active = false; callbacks.onError(code); }
  };
  let payment: PaymentSession;
  try { payment = sdk.createPayPalOneTimePaymentSession({
    async onApprove(data) {
      if (!active || !started) return;
      if (data === null || typeof data !== 'object' || (data as { orderId?: unknown }).orderId !== orderId) {
        fail('CALLBACK_MISMATCH');
        return;
      }
      active = false;
      await callbacks.onApprove(attemptId);
    },
    onCancel() {
      if (active && started) { active = false; callbacks.onCancel(attemptId); }
    },
    onError() { fail('SDK_UNAVAILABLE'); },
  }); } catch { throw new PayPalError('SDK_UNAVAILABLE'); }
  return {
    async start() {
      if (!active || started) throw new PayPalError('CHECKOUT_UNAVAILABLE');
      started = true;
      try {
        // Reopen exactly the server's persisted order. Never allocate another order here.
        await payment.start({ presentationMode: 'auto' }, Promise.resolve({ orderId }));
      } catch { fail('SDK_UNAVAILABLE'); }
    },
    dispose() { active = false; },
  };
}
