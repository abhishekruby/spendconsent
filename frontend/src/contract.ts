export type Category = 'cloth' | 'bag' | 'bottle' | 'notebook';
export type Constraints = {
  category?: Category;
  quantity?: number;
  budget_cents?: number;
  currency?: 'USD';
  one_time?: true;
  attributes?: { width_cm?: number; height_cm?: number; capacity_l?: number; volume_ml?: number; paper_size?: 'A4' | 'A5' | 'A6' };
};
export type Session = {
  environment: 'sandbox'; csrf_token: string;
  capabilities: { ai_ready: boolean; paypal_ready: boolean; financial_actions_enabled: boolean; consent_mode?: 'buyer' | 'operator' };
  current_request_id: string | null;
  paypal: { client_id: string; currency: 'USD' } | null;
};
export type Charges = {
  currency: 'USD'; subtotal_cents: number; shipping_cents: number;
  tax_cents: number; discount_cents: number; total_cents: number;
};
export type Evidence = { offer_id: string; offer_version: number; source: 'sample_catalog'; summary: string };
export type Item = { offer_id: string; sku: string; name: string; specification: string; pack_units: number; packs: number; individual_units: number };
export type Candidate = Item & Charges & { id: string; reasons: string[]; evidence: Evidence[] };
export type Review = Charges & {
  id: string; version: number; request_version: number; quote_version: number; digest: string;
  created_at: string; expires_at: string; merchant: { id: string; name: string };
  item: Item & { variant_id: string };
  shipping: { option_id: string; label: string; destination_ref: string; destination_label: string };
  terms: { one_time: true; description: string }; evidence: Evidence[];
};
export type Approval = { id: string; review_id: string; approved_at: string; expires_at: string; status: 'APPROVED' | 'EXPIRED' | 'REVOKED' | 'CONSUMED' };
export type Action = 'open_paypal' | 'capture' | 'check_status' | 'stop';
export type AttemptState = 'CREATING' | 'AWAITING_BUYER' | 'CAPTURING' | 'VERIFYING' | 'UNKNOWN' | 'PAYMENT_REVIEW' | 'PAID' | 'STOPPED';
export type Attempt = {
  id: string; state: AttemptState; pending_operation: string | null; reason_code: string | null;
  created_at: string; updated_at: string; provider_order_id: string | null; capture_id: string | null;
  total_cents: number; currency: 'USD'; allowed_actions: Action[];
};
export type PurchaseRequest = {
  id: string; version: number; text: string;
  status: 'NEEDS_CLARIFICATION' | 'COMPARING' | 'READY' | 'NO_MATCH' | 'MODEL_ERROR' | 'CHECKOUT' | 'PAID';
  constraints: Constraints; clarification: { question: string; missing_fields: string[] } | null;
  candidates: Candidate[]; excluded: { offer_id: string; name: string; reasons: string[] }[];
  review: Review | null; approval: Approval | null; attempt: Attempt | null;
  events: { id: string; type: string; reason_code: string | null; message: string; created_at: string }[];
  model: { used: boolean; name: string; elapsed_ms: number; tool_calls: { name: 'search_catalog' | 'get_offer' | 'compare_quotes'; status: 'completed' | 'error'; elapsed_ms: number }[] } | null;
};

// Validate the local API boundary before rendering or enabling any action.
type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === 'string' && v.length <= 12000;
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const positive = (v: unknown): v is number => integer(v) && v > 0;
const nullableString = (v: unknown) => v === null || string(v);
const array = (v: unknown, test: (x: unknown) => boolean, max = 500): boolean => Array.isArray(v) && v.length <= max && v.every(test);
const strings = (v: unknown) => array(v, string, 50);
const date = (v: unknown) => string(v) && Number.isFinite(Date.parse(v));
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const member = (v: unknown, values: readonly string[]) => typeof v === 'string' && values.includes(v);

export function isSession(v: unknown): v is Session {
  if (!object(v) || v.environment !== 'sandbox' || !string(v.csrf_token) || !/^[a-zA-Z0-9]{32,128}$/.test(v.csrf_token) || !object(v.capabilities)) return false;
  return ['ai_ready', 'paypal_ready', 'financial_actions_enabled'].every(k => typeof (v.capabilities as Obj)[k] === 'boolean')
    && [undefined, 'buyer', 'operator'].includes((v.capabilities as Obj).consent_mode as string | undefined)
    && (v.current_request_id === null || uuid(v.current_request_id))
    && (v.paypal === null || (object(v.paypal) && string(v.paypal.client_id) && v.paypal.currency === 'USD'));
}
export function isConstraints(v: unknown): v is Constraints {
  if (!object(v) || Object.keys(v).some(k => !['category', 'quantity', 'budget_cents', 'currency', 'one_time', 'attributes'].includes(k))) return false;
  if (v.category !== undefined && !member(v.category, ['cloth', 'bag', 'bottle', 'notebook'])) return false;
  if ((v.quantity !== undefined && (!positive(v.quantity) || v.quantity > 10000)) || (v.budget_cents !== undefined && (!positive(v.budget_cents) || v.budget_cents > 1000000))) return false;
  if ((v.currency !== undefined && v.currency !== 'USD') || (v.one_time !== undefined && v.one_time !== true)) return false;
  if (v.attributes === undefined) return true;
  if (!object(v.attributes)) return false;
  const keys: Record<string, string[]> = { cloth: ['width_cm', 'height_cm'], bag: ['capacity_l'], bottle: ['volume_ml'], notebook: ['paper_size'] };
  return Object.entries(v.attributes).every(([k, value]) => typeof v.category === 'string' && keys[v.category]?.includes(k)
    && (k === 'paper_size' ? member(value, ['A4', 'A5', 'A6']) : positive(value) && value <= 10000));
}
function isCharges(v: Obj): boolean {
  return v.currency === 'USD' && ['subtotal_cents', 'shipping_cents', 'tax_cents', 'discount_cents', 'total_cents'].every(k => integer(v[k]))
    && (v.subtotal_cents as number) + (v.shipping_cents as number) + (v.tax_cents as number) - (v.discount_cents as number) === v.total_cents;
}
function isItem(v: unknown): boolean {
  return object(v) && uuid(v.offer_id) && ['sku', 'name', 'specification'].every(k => string(v[k]))
    && ['pack_units', 'packs', 'individual_units'].every(k => positive(v[k]))
    && (v.pack_units as number) * (v.packs as number) === v.individual_units;
}
function isEvidence(v: unknown): boolean {
  return object(v) && uuid(v.offer_id) && positive(v.offer_version) && v.source === 'sample_catalog' && string(v.summary);
}
function isCandidate(v: unknown): boolean {
  return object(v) && uuid(v.id) && isItem(v) && isCharges(v) && strings(v.reasons) && array(v.evidence, isEvidence, 20);
}
function isReview(v: unknown): boolean {
  return object(v) && uuid(v.id) && positive(v.version) && positive(v.request_version) && positive(v.quote_version)
    && typeof v.digest === 'string' && /^[0-9a-f]{64}$/.test(v.digest) && date(v.created_at) && date(v.expires_at)
    && object(v.merchant) && string(v.merchant.id) && string(v.merchant.name)
    && isItem(v.item) && object(v.item) && string(v.item.variant_id)
    && object(v.shipping) && ['option_id', 'label', 'destination_ref', 'destination_label'].every(k => string((v.shipping as Obj)[k]))
    && object(v.terms) && v.terms.one_time === true && string(v.terms.description)
    && isCharges(v) && array(v.evidence, isEvidence, 20);
}
function isApproval(v: unknown): boolean {
  return object(v) && uuid(v.id) && uuid(v.review_id) && date(v.approved_at) && date(v.expires_at)
    && member(v.status, ['APPROVED', 'EXPIRED', 'REVOKED', 'CONSUMED']);
}
export function isAttempt(v: unknown): v is Attempt {
  return object(v) && uuid(v.id) && member(v.state, ['CREATING', 'AWAITING_BUYER', 'CAPTURING', 'VERIFYING', 'UNKNOWN', 'PAYMENT_REVIEW', 'PAID', 'STOPPED'])
    && nullableString(v.pending_operation) && nullableString(v.reason_code) && date(v.created_at) && date(v.updated_at)
    && nullableString(v.provider_order_id) && nullableString(v.capture_id) && integer(v.total_cents) && v.currency === 'USD'
    && (v.state !== 'PAID' || (string(v.provider_order_id) && !!v.provider_order_id && string(v.capture_id) && !!v.capture_id))
    && array(v.allowed_actions, x => member(x, ['open_paypal', 'capture', 'check_status', 'stop']), 4);
}
export function isPurchaseRequest(v: unknown): v is PurchaseRequest {
  return object(v) && uuid(v.id) && positive(v.version) && string(v.text)
    && member(v.status, ['NEEDS_CLARIFICATION', 'COMPARING', 'READY', 'NO_MATCH', 'MODEL_ERROR', 'CHECKOUT', 'PAID'])
    && isConstraints(v.constraints)
    && (v.clarification === null || (object(v.clarification) && string(v.clarification.question) && strings(v.clarification.missing_fields)))
    && array(v.candidates, isCandidate, 3)
    && array(v.excluded, x => object(x) && uuid(x.offer_id) && string(x.name) && strings(x.reasons), 20)
    && (v.review === null || isReview(v.review)) && (v.approval === null || isApproval(v.approval)) && (v.attempt === null || isAttempt(v.attempt))
    && array(v.events, x => object(x) && uuid(x.id) && string(x.type) && nullableString(x.reason_code) && string(x.message) && date(x.created_at))
    && (v.model === null || (object(v.model) && typeof v.model.used === 'boolean' && string(v.model.name) && integer(v.model.elapsed_ms)
      && array(v.model.tool_calls, x => object(x) && member(x.name, ['search_catalog', 'get_offer', 'compare_quotes']) && member(x.status, ['completed', 'error']) && integer(x.elapsed_ms), 6)));
}

// Live comparison progress: what the AI understood before its final confirmation.
export type Progress = { stage: 'READING' | 'DONE' } | { stage: 'UNDERSTOOD'; constraints: Constraints; eligible: number; status: 'READY' | 'NO_MATCH' | 'NEEDS_CLARIFICATION' };
export function isProgress(v: unknown): v is Progress {
  if (!object(v)) return false;
  if (v.stage === 'READING' || v.stage === 'DONE') return Object.keys(v).length === 1;
  return v.stage === 'UNDERSTOOD' && Object.keys(v).length === 4 && isConstraints(v.constraints) && integer(v.eligible) && v.eligible <= 16
    && member(v.status, ['READY', 'NO_MATCH', 'NEEDS_CLARIFICATION']);
}

export function isPurchaseList(v: unknown): v is { purchases: PurchaseRequest[] } {
  return object(v) && Object.keys(v).length === 1 && Array.isArray(v.purchases) && v.purchases.length <= 20 && v.purchases.every(isPurchaseRequest);
}
