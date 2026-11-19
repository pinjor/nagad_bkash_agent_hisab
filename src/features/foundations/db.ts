import Dexie, { type EntityTable } from 'dexie';
import type { Digits, MoneyLeg, MoneyTransaction } from './money';
export interface CachedLoanEvent { id: string; type: string; amount_paisa: number; at: string; writer?: string }
export interface CachedLoan { id: string; person_id: string; person_name: string; direction: 'lend' | 'borrow'; principal_paisa: number; remaining_paisa: number; pocket_id: string; opened_at: string; closed_at: string | null; status: string; writer?: string; events: CachedLoanEvent[] }
export interface CachedPerson { id: string; name: string; phone: string; writer?: string }
export interface LedgerCache { pockets: Record<string, number>; today: { sale_paisa: number; cash_out_paisa: number; lend_paisa: number; borrow_paisa: number; txn_count: number }; lend_open: number; borrow_open: number; lend_count: number; borrow_count: number; configured: boolean; people: CachedPerson[]; loans: CachedLoan[] }
export interface DoorPerson { id: string; name: string; role: 'admin' | 'employee' }
export interface Settings { id: string; shop_name: string; shop_id?: string; owner_name: string; door_people?: DoorPerson[]; digits: Digits; pin_hash?: string; pin_salt?: string; configured: boolean; privacy_default: boolean; voice_on: boolean; updated_at: number; failed_attempts: number; blocked_until: number; cache?: LedgerCache }
export interface Pocket { id: string; code: string; name_bn: string; type: string; color: string; icon: string; active: boolean; sort: number; opening_balance_paisa: number }
export interface Transaction extends MoneyTransaction { txn_type: string; amount_paisa: number; date: string; created_at: number; updated_at: number; device_id: string; synced: boolean; version: number; deleted: boolean; void_reason?: string; phone?: string; party?: string; writer?: string }
export interface Leg extends MoneyLeg { id: string }
export interface LocalRow { id: string; created_at?: number; updated_at?: number; deleted?: boolean; [key: string]: unknown }
export interface SessionRow { id: 'main'; token: string; role: 'admin' | 'employee'; user_id: string; shop_id: string; name: string; phone?: string; shop_name: string; pending: boolean; pin?: string; device_id: string }
export interface LoanRow { id: string; person_id: string; direction: 'lend' | 'borrow'; principal_paisa: number; pocket_id: string; opened_at: number; due_at?: number; status: string; synced: boolean; writer?: string }
export interface LoanEventRow { id: string; loan_id: string; type: 'open' | 'repayment'; amount_paisa: number; at: number; note?: string; synced: boolean; writer?: string }
export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const db = new Dexie('amar-hisab') as Dexie & {
  settings: EntityTable<Settings, 'id'>; pockets: EntityTable<Pocket, 'id'>; transactions: EntityTable<Transaction, 'id'>;
  txn_legs: EntityTable<Leg, 'id'>; people: EntityTable<LocalRow, 'id'>; products: EntityTable<LocalRow, 'id'>;
  stock_batches: EntityTable<LocalRow, 'id'>; phone_units: EntityTable<LocalRow, 'id'>;
  reminders: EntityTable<LocalRow, 'id'>; day_closes: EntityTable<LocalRow, 'id'>; audit_log: EntityTable<LocalRow, 'id'>; conflicts: EntityTable<LocalRow, 'id'>;
  loans: EntityTable<LoanRow, 'id'>; loan_events: EntityTable<LoanEventRow, 'id'>; session: EntityTable<SessionRow, 'id'>;
};
db.version(1).stores({ settings: 'id', pockets: 'id, code, sort', people: 'id, name, phone',
  transactions: 'id, [date+business], [person_id+date], date, status, synced', txn_legs: 'id, txn_id, pocket_id',
  products: 'id, name, kind', stock_batches: 'id, product_id, expiry_date', phone_units: 'id, imei1, product_id',
  reminders: 'id, person_id, due_date', day_closes: 'id, date', audit_log: 'id, entity_id, at', conflicts: 'id, entity_id' });
db.version(2).stores({ loans: 'id, person_id, synced', loan_events: 'id, loan_id, synced', session: 'id' });
export const seedPockets: Pocket[] = [
  ['CASH', 'হাতে নগদ', 'cash', 'cash', 'banknote'], ['BKASH', 'বিকাশ', 'mfs', 'bkash', 'send'],
  ['NAGAD', 'নগদ', 'mfs', 'nagad', 'sun'], ['ROCKET', 'রকেট', 'mfs', 'rocket', 'rocket'], ['FLEXI', 'ফ্লেক্সিলোড', 'flexi', 'flexi', 'smartphone'], ['PHARMA', 'ফার্মেসি', 'pharma', 'pharma', 'pill'],
].map(([id, name_bn, type, color, icon], sort) => ({ id, code: id, name_bn, type, color, icon, sort, active: true, opening_balance_paisa: 0 }));
export async function initialize() {
  await db.transaction('rw', db.pockets, db.settings, async () => {
    const have = new Set((await db.pockets.toArray()).map((pocket) => pocket.id));
    const missing = seedPockets.filter((pocket) => !have.has(pocket.id));
    if (missing.length) await db.pockets.bulkAdd(missing);
    if (!(await db.settings.get('main'))) await db.settings.add({ id: 'main', shop_name: 'আমার দোকান', owner_name: '', digits: 'bn', configured: false, privacy_default: false, voice_on: true, updated_at: Date.now(), failed_attempts: 0, blocked_until: 0 });
  });
}
export async function deviceId() {
  const session = await db.session.get('main');
  if (session?.device_id) return session.device_id;
  return newId();
}
async function writerName() {
  return (await db.session.get('main'))?.name?.trim() ?? '';
}
async function partyName(personId: string, fallback = '') {
  const local = await db.people.get(personId);
  const cache = (await db.settings.get('main'))?.cache;
  const cached = cache?.people?.find((person) => person.id === personId)?.name ?? '';
  return String(local?.name ?? cached ?? fallback).trim().slice(0, 80);
}
export async function saveOpening(amounts: Record<string, number>, shop_name: string, pin_hash?: string, pin_salt?: string) {
  const id = newId(); const now = Date.now(); const device_id = await deviceId();
  await db.transaction('rw', db.settings, db.transactions, db.txn_legs, db.audit_log, async () => {
    await db.transactions.add({ id, txn_type: 'OPENING', amount_paisa: Object.values(amounts).reduce((a, b) => a + b, 0), date: new Date().toLocaleDateString('en-CA'), created_at: now, updated_at: now, device_id, synced: false, version: 1, deleted: false, status: 'active' });
    await db.txn_legs.bulkAdd(Object.entries(amounts).map(([pocket_id, amount_paisa]) => ({ id: newId(), txn_id: id, pocket_id, amount_paisa })));
    await db.settings.update('main', { configured: true, shop_name: shop_name.trim() || 'আমার দোকান', pin_hash, pin_salt, updated_at: now });
    await db.audit_log.add({ id: newId(), entity_id: id, action: 'opening', at: now });
  });
  return id;
}
export async function voidOpening(id: string) {
  await db.transaction('rw', db.transactions, db.settings, db.audit_log, async () => {
    await db.transactions.update(id, { status: 'void', void_reason: 'ফিরিয়ে নিন', updated_at: Date.now(), version: 2 });
    await db.settings.update('main', { configured: false });
    await db.audit_log.add({ id: newId(), entity_id: id, action: 'void', reason: 'ফিরিয়ে নিন', at: Date.now() });
  });
}
export async function queueEntry(txn_type: string, pocket_id: string, amount_paisa: number, extra?: { pocket_to?: string; phone?: string }) {
  const id = newId(); const now = Date.now(); const device_id = await deviceId(); const writer = await writerName();
  const legs = extra?.pocket_to
    ? [{ id: newId(), txn_id: id, pocket_id, amount_paisa: -amount_paisa }, { id: newId(), txn_id: id, pocket_id: extra.pocket_to, amount_paisa }]
    : [{ id: newId(), txn_id: id, pocket_id, amount_paisa: txn_type === 'CASH_OUT' ? -amount_paisa : amount_paisa }];
  await db.transaction('rw', db.transactions, db.txn_legs, async () => {
    await db.transactions.add({ id, txn_type, amount_paisa, date: new Date().toLocaleDateString('en-CA'), phone: extra?.phone ?? '', writer, created_at: now, updated_at: now, device_id, synced: false, version: 1, deleted: false, status: 'active' });
    await db.txn_legs.bulkAdd(legs);
  });
  return id;
}
export async function queuePerson(name: string, phone: string) {
  const id = newId();
  await db.people.add({ id, name: name.trim(), phone: phone.trim(), writer: await writerName(), created_at: Date.now(), synced: false });
  return id;
}
export async function queueLoan(input: { person_id: string; direction: 'lend' | 'borrow'; principal_paisa: number; pocket_id: string; due_at?: number }) {
  const id = newId(); const now = Date.now(); const device_id = await deviceId(); const writer = await writerName();
  const party = await partyName(input.person_id);
  const txn_type = input.direction === 'lend' ? 'LEND' : 'BORROW';
  const signed = input.direction === 'lend' ? -input.principal_paisa : input.principal_paisa;
  await db.transaction('rw', db.loans, db.loan_events, db.transactions, db.txn_legs, async () => {
    await db.loans.add({ id, ...input, opened_at: now, status: 'open', synced: false, writer });
    await db.loan_events.add({ id: newId(), loan_id: id, type: 'open', amount_paisa: input.principal_paisa, at: now, synced: false, writer });
    const txn_id = newId();
    await db.transactions.add({ id: txn_id, txn_type, amount_paisa: input.principal_paisa, party, writer, date: new Date().toLocaleDateString('en-CA'), created_at: now, updated_at: now, device_id, synced: false, version: 1, deleted: false, status: 'active' });
    await db.txn_legs.add({ id: newId(), txn_id, pocket_id: input.pocket_id, amount_paisa: signed });
  });
  return id;
}
export async function queueRepayment(input: { loan_id: string; amount_paisa: number; pocket_id: string; direction: 'lend' | 'borrow' }) {
  const now = Date.now(); const device_id = await deviceId(); const writer = await writerName();
  const loan = await db.loans.get(input.loan_id);
  const cache = (await db.settings.get('main'))?.cache;
  const cached = cache?.loans?.find((row) => row.id === input.loan_id);
  const party = await partyName(loan?.person_id ?? cached?.person_id ?? '', cached?.person_name ?? '');
  const txn_type = input.direction === 'lend' ? 'REPAY_IN' : 'REPAY_OUT';
  const signed = input.direction === 'lend' ? input.amount_paisa : -input.amount_paisa;
  await db.transaction('rw', db.loan_events, db.transactions, db.txn_legs, async () => {
    await db.loan_events.add({ id: newId(), loan_id: input.loan_id, type: 'repayment', amount_paisa: input.amount_paisa, at: now, synced: false, writer });
    const txn_id = newId();
    await db.transactions.add({ id: txn_id, txn_type, amount_paisa: input.amount_paisa, party, writer, date: new Date().toLocaleDateString('en-CA'), created_at: now, updated_at: now, device_id, synced: false, version: 1, deleted: false, status: 'active' });
    await db.txn_legs.add({ id: newId(), txn_id, pocket_id: input.pocket_id, amount_paisa: signed });
  });
}