import { OrderError } from "./errors";

export const TENDER_KINDS = ["cash", "card"] as const;
export type TenderKind = (typeof TENDER_KINDS)[number];

export type TenderLine = { kind: TenderKind; amountMinor: number };

/** Settled counter payment_method summary derived from tender lines. */
export type CounterPaymentMethod = "cash" | "card" | "split";

/** Unsettled staff POS method — kitchen-visible before Collected. */
export const COUNTER_PENDING = "counter" as const;

export function isTenderKind(value: unknown): value is TenderKind {
  return value === "cash" || value === "card";
}

/** True when completing this unpaid counter order requires tender lines. */
export function tendersRequiredForCollect(paymentMethod: string, paidAt: string | null): boolean {
  return paymentMethod === COUNTER_PENDING && paidAt == null;
}

/**
 * Validate tender lines for an order total.
 * Zero-due (100% discount): empty tenders only.
 * Otherwise 1–2 lines, distinct kinds, each amount > 0, sum === totalMinor.
 */
export function validateTenders(tenders: TenderLine[], totalMinor: number): TenderLine[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new OrderError("INVALID_TENDER", 400);
  if (totalMinor === 0) {
    if (!Array.isArray(tenders) || tenders.length !== 0) throw new OrderError("INVALID_TENDER", 400);
    return [];
  }
  if (!Array.isArray(tenders) || tenders.length < 1 || tenders.length > 2) {
    throw new OrderError("INVALID_TENDER", 400);
  }
  const seen = new Set<TenderKind>();
  let sum = 0;
  const normalized: TenderLine[] = [];
  for (const line of tenders) {
    if (!isTenderKind(line?.kind) || !Number.isSafeInteger(line.amountMinor) || line.amountMinor <= 0) {
      throw new OrderError("INVALID_TENDER", 400);
    }
    if (seen.has(line.kind)) throw new OrderError("INVALID_TENDER", 400);
    seen.add(line.kind);
    sum += line.amountMinor;
    normalized.push({ kind: line.kind, amountMinor: line.amountMinor });
  }
  if (sum !== totalMinor) throw new OrderError("INVALID_TENDER", 400);
  return normalized;
}

/** One owner for payment_method summary from lines. Zero-due settles as cash. */
export function paymentMethodFromTenders(tenders: TenderLine[]): CounterPaymentMethod {
  if (tenders.length === 0) return "cash";
  if (tenders.length === 1) return tenders[0].kind;
  return "split";
}

/** All-cash / all-card shortcuts for UI — still validated on settle. */
export function singleTender(kind: TenderKind, totalMinor: number): TenderLine[] {
  if (totalMinor === 0) return validateTenders([], 0);
  return validateTenders([{ kind, amountMinor: totalMinor }], totalMinor);
}

/** CSV / ops export payment cell — one owner for staff vs pickup wording. */
export function ordersExportPaymentLabel(row: {
  paidAt: string | null;
  paymentMethod: string;
}): string {
  if (row.paidAt) {
    if (row.paymentMethod === "cash") return "Cash";
    if (row.paymentMethod === "card") return "Card";
    if (row.paymentMethod === "split") return "Split";
    return "Paid";
  }
  if (row.paymentMethod === COUNTER_PENDING) return "Pay at counter";
  if (row.paymentMethod === "pay_at_pickup") return "Pay at pickup";
  return "Unpaid";
}

export type SplitCashReason = "empty" | "invalid" | "too_small" | "too_large";

export type SplitCashParse =
  | { ok: true; cashMinor: number; cardMinor: number }
  | { ok: false; reason: SplitCashReason };

/**
 * Parse a staff-entered cash portion (major QAR) for a cash+card split.
 * Cash must be a positive amount strictly less than the order total (card gets the rest).
 */
export function parseSplitCashMajor(raw: string, totalMinor: number): SplitCashParse {
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) return { ok: false, reason: "invalid" };
  const value = raw.trim();
  if (!value) return { ok: false, reason: "empty" };
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return { ok: false, reason: "invalid" };
  const cashMinor = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cashMinor)) return { ok: false, reason: "invalid" };
  if (cashMinor <= 0) return { ok: false, reason: "too_small" };
  if (cashMinor >= totalMinor) return { ok: false, reason: "too_large" };
  return { ok: true, cashMinor, cardMinor: totalMinor - cashMinor };
}

/** Keep only digits and at most two decimal places while typing. */
export function sanitizeCashMajorInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot < 0) return cleaned.slice(0, 8);
  return `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`.slice(0, 11);
}
