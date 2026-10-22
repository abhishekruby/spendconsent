import type { Action, Attempt, Constraints, PurchaseRequest } from './contract.js';

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
// A finished (PAID) or stopped purchase allows a new request; uncertain ones never do.
export const canStartNew = (request: PurchaseRequest | null) => !request?.attempt || ['STOPPED', 'PAID'].includes(request.attempt.state);
export function purchaseDisplay(request: PurchaseRequest | null, draftMode = false) {
  const stoppedReview = request?.attempt?.state === 'STOPPED' && request.approval?.status === 'CONSUMED'
    && request.approval.review_id === request.review?.id;
  const currentReview = !stoppedReview && request?.review?.request_version === request?.version ? request?.review ?? null : null;
  const currentApproval = currentReview && request?.approval?.review_id === currentReview.id ? request.approval : null;
  const activeAttempt = !!request?.attempt && request.attempt.state !== 'STOPPED';
  const stage = draftMode || !request ? 'Request' : activeAttempt ? 'Payment' : currentReview ? 'Review'
    : ['READY', 'NO_MATCH'].includes(request.status) ? 'Compare' : 'Request';
  return { currentReview, currentApproval, stage, collapseComparison: !!currentReview || activeAttempt };
}
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
// What the comparison saved: chosen offer vs the next cheapest that also fits exactly.
export function savings(p: PurchaseRequest, offerId: string): { vsNext: number | null; fitting: number; ruledOut: number } {
  const mine = p.candidates.find(c => c.offer_id === offerId);
  const others = p.candidates.filter(c => c.offer_id !== offerId).map(c => c.total_cents);
  return { vsNext: mine && others.length ? Math.min(...others) - mine.total_cents : null, fitting: p.candidates.length, ruledOut: p.excluded.length };
}

// Which of the buyer's own words grounded each value the AI read, for display.
// Each value is located in the text (first non-overlapping match); nothing is inferred.
export type ReadingField = 'item' | 'quantity' | 'size' | 'budget' | 'terms' | 'cost';
export type Reading = { text: string; field?: ReadingField };
const ITEM_WORDS = { cloth: 'microfib(?:er|re)\\s+cloths?|cloths?|rags?|towels?', bag: '(?:waste|garbage|trash|bin)\\s+bags?|bin\\s+liners?|bags?',
  bottle: 'spray\\s+bottles?|bottles?', notebook: 'notebooks?' } as const;
export function readRequest(text: string, c: Constraints): Reading[] {
  const a = c.attributes ?? {};
  const dollars = c.budget_cents === undefined ? null : c.budget_cents % 100 ? (c.budget_cents / 100).toFixed(2) : `${c.budget_cents / 100}(?:\\.00)?`;
  const size = c.category === 'cloth' && a.width_cm && a.height_cm ? `${a.width_cm}\\s*(?:cm)?\\s*(?:[×x*]|by)\\s*${a.height_cm}(?:\\s*cm)?`
    : c.category === 'bag' && a.capacity_l ? `${a.capacity_l}\\s*-?\\s*(?:l|liters?|litres?)\\b`
    : c.category === 'bottle' && a.volume_ml ? `${a.volume_ml}\\s*-?\\s*(?:ml|milliliters?|millilitres?)\\b`
    : c.category === 'notebook' && a.paper_size ? `\\b${a.paper_size}\\b` : null;
  const patterns: [ReadingField, string | null][] = [
    ['size', size],
    ['budget', dollars && `\\$\\s?${dollars}\\b|\\b${dollars}\\s?(?:dollars|usd)\\b`],
    ['quantity', c.quantity ? `(?<![\\d$.])${c.quantity}(?![\\d.])` : null],
    ['item', c.category ? ITEM_WORDS[c.category] : null],
    ['terms', c.one_time ? 'one[- ]time|\\bonce\\b|single purchase' : null],
    ['cost', 'includ(?:ing|es)\\s+(?:delivery|shipping)(?:\\s+and\\s+tax)?|\\bdelivered\\b'],
  ];
  const taken: [number, number, ReadingField][] = [];
  for (const [field, source] of patterns) {
    if (!source) continue;
    for (const m of text.matchAll(new RegExp(source, 'gi'))) {
      const start = m.index, end = m.index + m[0].length;
      if (taken.every(([s, e]) => end <= s || start >= e)) { taken.push([start, end, field]); break; }
    }
  }
  taken.sort((x, y) => x[0] - y[0]);
  const out: Reading[] = [];
  let at = 0;
  for (const [start, end, field] of taken) {
    if (start > at) out.push({ text: text.slice(at, start) });
    out.push({ text: text.slice(start, end), field });
    at = end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
