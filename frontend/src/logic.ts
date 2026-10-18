import type { Action, Attempt, PurchaseRequest } from './contract.js';

export function money(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Expected nonnegative integer cents');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
export function parseCents(input: string): number | null {
  if (!/^(?:0|[1-9]\d{0,4})(?:\.\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ''] = input.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 && cents <= 1000000 ? cents : null;
}
export function unitCost(cents: number, units: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(units) || units <= 0) throw new Error('Invalid delivered unit cost');
  return `$${(Math.round(cents / units) / 100).toFixed(2)}`;
}
export const pending = (attempt: Attempt | null) => !!attempt && ['CREATING', 'CAPTURING', 'VERIFYING', 'UNKNOWN'].includes(attempt.state);
export const locksRequest = (request: PurchaseRequest | null) => !!request?.attempt && request.attempt.state !== 'STOPPED';
export function permitted(attempt: Attempt, action: Action, financialEnabled: boolean): boolean {
  if (['PAID', 'STOPPED'].includes(attempt.state)) return false;
  if (attempt.state === 'PAYMENT_REVIEW' && action !== 'check_status') return false;
  if ((action === 'open_paypal' || action === 'capture') && (!financialEnabled || attempt.state !== 'AWAITING_BUYER')) return false;
  return attempt.allowed_actions.includes(action);
}
export function newerRequest(current: PurchaseRequest | null, incoming: PurchaseRequest): PurchaseRequest {
  if (current?.id === incoming.id && incoming.version < current.version) return current;
  if (current?.id === incoming.id && incoming.version === current.version && (incoming.review?.version ?? 0) < (current.review?.version ?? 0)) return current;
  if (current?.id === incoming.id && current.attempt && incoming.attempt?.id === current.attempt.id
      && Date.parse(incoming.attempt.updated_at) < Date.parse(current.attempt.updated_at)) return { ...incoming, attempt: current.attempt };
  return incoming;
}
export function newerAttempt(current: PurchaseRequest | null, incoming: Attempt): PurchaseRequest | null {
  if (!current || (current.attempt && current.attempt.id !== incoming.id)) return current;
  if (current.attempt && Date.parse(incoming.updated_at) < Date.parse(current.attempt.updated_at)) return current;
  return { ...current, attempt: incoming };
}
