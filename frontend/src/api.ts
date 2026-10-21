import { isAttempt, isLinkCreated, isLinkView, isMarket, isProgress, isPurchaseList, isPurchaseRequest, isSession, uuid } from './contract.js';
import type { Attempt, PurchaseRequest, Session } from './contract.js';

const messages: Record<string, string> = {
  MODEL_UNAVAILABLE: 'Actual AI comparison is unavailable. Your request was saved; no comparison or payment was made.',
  MODEL_BUSY: 'The local model is busy. Check the saved request before trying again.',
  MODEL_ERROR: 'The model could not produce a validated comparison. No purchase was approved.',
  INVALID_REQUEST: 'The request was rejected. Check the requirements and try again.',
  CSRF_FAILED: 'This page’s security token is no longer valid. Reload the connection before retrying.',
  SESSION_REQUIRED: 'Reconnect to initialize this browser session.',
  FORBIDDEN: 'This action is not permitted in this session.',
  NOT_FOUND: 'This record was not found in this browser session.',
  REVIEW_CHANGED: 'The purchase changed. Reload its saved status and review the current exact cart.',
  REVIEW_EXPIRED: 'The review expired. Reload its saved status and request a fresh review.',
  APPROVAL_EXPIRED: 'Approval expired. A fresh review and approval are required.',
  STALE_VERSION: 'The saved request changed. Reload its current version before continuing.',
  VERSION_CONFLICT: 'The saved request changed. Reload its current version before continuing.',
  FINANCIAL_ACTIONS_DISABLED: 'Payment was not allowed for this cart: its approval expired or is no longer valid. No money was taken. Review the cart and approve again to pay.',
  INTEGRATION_UNAVAILABLE: 'Payment integration is unavailable. The stored status has not been resolved.',
};
export class ApiError extends Error {
  constructor(public code: string, message: string, public requestId: string | null = null, public attempt: Attempt | null = null) { super(message); }
}
export function safeApiError(data: unknown, status: number): ApiError {
  const v = data !== null && typeof data === 'object' ? data as Record<string, unknown> : {};
  const err = v.error !== null && typeof v.error === 'object' ? v.error as Record<string, unknown> : {};
  const code = typeof err.code === 'string' && Object.hasOwn(messages, err.code) ? err.code : 'REQUEST_FAILED';
  return new ApiError(code, messages[code] ?? (status === 403 ? 'The server rejected this action. Reconnect before retrying.' : 'The server could not complete this action. Reload the saved status.'), uuid(v.request_id) ? v.request_id : null, isAttempt(v.attempt) ? v.attempt : null);
}

export class Api {
  private csrf = '';
  constructor(private transport: typeof fetch = fetch) {}
  async call<T>(path: string, validate: (v: unknown) => v is T, body?: unknown, signal?: AbortSignal): Promise<T> {
    if (!/^\/api\/(session|progress|purchases|links\/[A-Za-z0-9_-]{20,100}(?:\/(approve|attempts|attempt\/(capture|stop|reconcile)))?|reviews\/[0-9a-f-]+\/link|requests(?:\/[0-9a-f-]+(?:\/(clarify|reviews|market))?)?|reviews\/[0-9a-f-]+\/approve|approvals\/[0-9a-f-]+\/attempts|attempts\/[0-9a-f-]+(?:\/(stop|reconcile|capture))?)$/.test(path)) throw new ApiError('INVALID_PATH', 'Invalid local API route.');
    if (body !== undefined && !this.csrf) throw new ApiError('SESSION_REQUIRED', messages.SESSION_REQUIRED);
    const deadline = AbortSignal.timeout(100000);
    try {
      const transport = this.transport;
      const response = await transport(path, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': this.csrf },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      });
      let data: unknown;
      try { data = await response.json(); } catch { throw safeApiError(null, response.status); }
      if (!response.ok) throw safeApiError(data, response.status);
      if (!validate(data)) throw new ApiError('INVALID_RESPONSE', 'The server returned an unsupported response. Reload saved status; no outcome is assumed.');
      return data;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof ApiError) throw error;
      throw new ApiError('CONNECTION_LOST', 'Connection interrupted. Check the saved request or payment status before trying another action.');
    }
  }
  async session(signal?: AbortSignal): Promise<Session> {
    const session = await this.call('/api/session', isSession, undefined, signal);
    this.csrf = session.csrf_token;
    return session;
  }
  request(id: string, signal?: AbortSignal) { return this.call(`/api/requests/${id}`, isPurchaseRequest, undefined, signal); }
  mutateRequest(path: string, body: unknown, signal?: AbortSignal) { return this.call<PurchaseRequest>(path, isPurchaseRequest, body, signal); }
  attempt(id: string, signal?: AbortSignal) { return this.call(`/api/attempts/${id}`, isAttemptEnvelope, undefined, signal); }
  market(id: string, signal?: AbortSignal) { return this.call(`/api/requests/${id}/market`, isMarket, undefined, signal); }
  progress(signal?: AbortSignal) { return this.call('/api/progress', isProgress, undefined, signal); }
  purchases(signal?: AbortSignal) { return this.call('/api/purchases', isPurchaseList, undefined, signal); }
  createLink(reviewId: string, signal?: AbortSignal) { return this.call(`/api/reviews/${reviewId}/link`, isLinkCreated, {}, signal); }
  link(token: string, signal?: AbortSignal) { return this.call(`/api/links/${token}`, isLinkView, undefined, signal); }
  linkApprove(token: string, body: unknown, signal?: AbortSignal) { return this.call(`/api/links/${token}/approve`, isPurchaseRequest, body, signal); }
  linkStart(token: string, signal?: AbortSignal) { return this.call(`/api/links/${token}/attempts`, isAttemptEnvelope, {}, signal); }
  linkAction(token: string, action: 'capture' | 'stop' | 'reconcile', signal?: AbortSignal) { return this.call(`/api/links/${token}/attempt/${action}`, isAttemptEnvelope, {}, signal); }
  mutateAttempt(path: string, signal?: AbortSignal) { return this.call(path, isAttemptEnvelope, {}, signal); }
}
function isAttemptEnvelope(v: unknown): v is { attempt: Attempt } {
  return v !== null && typeof v === 'object' && isAttempt((v as Record<string, unknown>).attempt);
}
