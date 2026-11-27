import { databaseHost, touchesLiveDatabaseHost } from '@/lib/deploy-env';

export class OrderingUnavailable extends Error {
  constructor() { super('ORDERING_UNAVAILABLE'); }
}

/** Production opt-in: live Turso ordering stays off until this is exactly `1`. */
export function orderingLiveEnabled() {
  return process.env.ORDERING_LIVE_ENABLED === '1';
}

/** Pure guard: no client or connection is constructed to make this decision. */
export function orderDatabaseAllowed(url: string) {
  if (url.startsWith('file:')) return true;
  if (touchesLiveDatabaseHost(url)) return orderingLiveEnabled();
  const host = databaseHost(url);
  return Boolean(host && /^(libsql|https):/i.test(url));
}
export function assertOrderDatabaseAllowed(url: string) {
  if (!orderDatabaseAllowed(url)) throw new OrderingUnavailable();
}
