import { db, type SessionRow } from './db';

export class ApiError extends Error {
  status: number;
  token: string;
  constructor(status: number, message: string, token = "") { super(message); this.status = status; this.token = token; }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await db.session.get('main');
  const token = session?.token ?? '';
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, body.error || 'failed', token);
  return body as T;
}

export interface Accepted { transactions: string[]; legs: string[]; people: string[]; loans: string[]; loan_events: string[] }
export interface HomeBalances { pockets: Record<string, number>; lend_open: number; borrow_open: number; lend_count: number; borrow_count: number; configured: boolean }
export interface Today { sale_paisa: number; cash_out_paisa: number; lend_paisa: number; borrow_paisa: number; txn_count: number }

export async function purgeAccepted(accepted: Accepted) {
  await db.transaction('rw', [db.transactions, db.txn_legs, db.people, db.loans, db.loan_events], async () => {
    if (accepted.transactions.length) await db.transactions.bulkDelete(accepted.transactions);
    if (accepted.legs.length) await db.txn_legs.bulkDelete(accepted.legs);
    if (accepted.people.length) await db.people.bulkDelete(accepted.people);
    if (accepted.loans.length) await db.loans.bulkDelete(accepted.loans);
    if (accepted.loan_events.length) await db.loan_events.bulkDelete(accepted.loan_events);
  });
}

export async function countPending() {
  const [txns, people, loans, events] = await Promise.all([db.transactions.count(), db.people.count(), db.loans.count(), db.loan_events.count()]);
  return txns + people + loans + events;
}

export async function buildOutbox() {
  const session = await db.session.get('main');
  const [transactions, legs, people, loans, loan_events] = await Promise.all([
    db.transactions.toArray(), db.txn_legs.toArray(), db.people.toArray(), db.loans.toArray(), db.loan_events.toArray(),
  ]);
  return {
    device_id: session?.device_id ?? 'local',
    transactions: transactions.map((txn) => ({ id: txn.id, txn_type: txn.txn_type, amount_paisa: txn.amount_paisa, date: txn.date, status: txn.status, created_at: txn.created_at, void_reason: txn.void_reason, phone: txn.phone ?? '', party: txn.party ?? '' })),
    legs: legs.map((leg) => ({ id: leg.id, txn_id: leg.txn_id, pocket_id: leg.pocket_id, amount_paisa: leg.amount_paisa })),
    people: people.map((person) => ({ id: person.id, name: String(person.name ?? ''), phone: String(person.phone ?? ''), created_at: Number(person.created_at ?? Date.now()) })),
    loans: loans.map((loan) => ({ id: loan.id, person_id: loan.person_id, direction: loan.direction, principal_paisa: loan.principal_paisa, pocket_id: loan.pocket_id, opened_at: loan.opened_at, due_at: loan.due_at ?? null })),
    loan_events: loan_events.map((event) => ({ id: event.id, loan_id: event.loan_id, type: event.type, amount_paisa: event.amount_paisa, at: event.at, note: event.note })),
  };
}

export async function syncPending() {
  const session = await db.session.get('main');
  if (!session) return { pending: await countPending(), rejected: [] as { id: string; reason: string }[] };
  if (session.pending) {
    if (!session.pin) throw new ApiError(400, 'bad_pin');
    const result = await api<SessionRow & { token: string }>('/api/register', { method: 'POST', body: JSON.stringify({ shop_id: session.shop_id, shop_name: session.shop_name, user_id: session.user_id, name: session.name, pin: session.pin }) });
    await db.session.put({ ...session, token: result.token, role: 'admin', pending: false, pin: undefined });
  }
  const payload = await buildOutbox();
  const empty = !payload.transactions.length && !payload.people.length && !payload.loans.length && !payload.loan_events.length;
  if (empty) return { pending: 0, rejected: [] as { id: string; reason: string }[] };
  const result = await api<{ accepted: Accepted; rejected: { id: string; reason: string }[] }>('/api/sync', { method: 'POST', body: JSON.stringify(payload) });
  const blocked = result.rejected.filter((row) => row.reason === "admin_only").map((row) => row.id);
  const blockedLegs = (await db.txn_legs.toArray()).filter((leg) => blocked.includes(leg.txn_id)).map((leg) => leg.id);
  await purgeAccepted({
    transactions: [...result.accepted.transactions, ...blocked],
    legs: [...result.accepted.legs, ...blockedLegs],
    people: result.accepted.people,
    loans: result.accepted.loans,
    loan_events: [...result.accepted.loan_events, ...blocked],
  });
  return { pending: await countPending(), rejected: result.rejected };
}

export async function undoOpening(id: string) {
  const row = await db.transactions.get(id);
  if (row) {
    await db.transaction('rw', [db.transactions, db.txn_legs, db.settings, db.audit_log], async () => {
      await db.txn_legs.where('txn_id').equals(id).delete();
      await db.transactions.delete(id);
      await db.settings.update('main', { configured: false });
    });
    return;
  }
  await api(`/api/transactions/${id}/void`, { method: 'POST', body: '{}' });
}
