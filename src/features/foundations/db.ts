import Dexie, { type EntityTable } from 'dexie';
import type { Digits, MoneyLeg, MoneyTransaction } from './money';
export interface Settings { id: string; shop_name: string; owner_name: string; digits: Digits; pin_hash?: string; pin_salt?: string; configured: boolean; privacy_default: boolean; voice_on: boolean; updated_at: number; failed_attempts: number; blocked_until: number }
export interface Pocket { id: string; code: string; name_bn: string; type: string; color: string; icon: string; active: boolean; sort: number; opening_balance_paisa: number }
export interface Transaction extends MoneyTransaction { txn_type: string; amount_paisa: number; date: string; created_at: number; updated_at: number; device_id: string; synced: boolean; version: number; deleted: boolean; void_reason?: string }
export interface Leg extends MoneyLeg { id: string }
export interface LocalRow { id: string; created_at?: number; updated_at?: number; deleted?: boolean; [key: string]: unknown }
export const db = new Dexie('amar-hisab') as Dexie & {
  settings: EntityTable<Settings, 'id'>; pockets: EntityTable<Pocket, 'id'>; transactions: EntityTable<Transaction, 'id'>;
  txn_legs: EntityTable<Leg, 'id'>; people: EntityTable<LocalRow, 'id'>; products: EntityTable<LocalRow, 'id'>;
  stock_batches: EntityTable<LocalRow, 'id'>; phone_units: EntityTable<LocalRow, 'id'>;
  reminders: EntityTable<LocalRow, 'id'>; day_closes: EntityTable<LocalRow, 'id'>; audit_log: EntityTable<LocalRow, 'id'>; conflicts: EntityTable<LocalRow, 'id'>;
};
db.version(1).stores({ settings: 'id', pockets: 'id, code, sort', people: 'id, name, phone',
  transactions: 'id, [date+business], [person_id+date], date, status, synced', txn_legs: 'id, txn_id, pocket_id',
  products: 'id, name, kind', stock_batches: 'id, product_id, expiry_date', phone_units: 'id, imei1, product_id',
  reminders: 'id, person_id, due_date', day_closes: 'id, date', audit_log: 'id, entity_id, at', conflicts: 'id, entity_id' });
export const seedPockets: Pocket[] = [
  ['CASH', 'হাতে নগদ', 'cash', 'cash', 'banknote'], ['BKASH', 'বিকাশ', 'mfs', 'bkash', 'send'],
  ['NAGAD', 'নগদ', 'mfs', 'nagad', 'sun'], ['ROCKET', 'রকেট', 'mfs', 'rocket', 'rocket'], ['FLEXI', 'ফ্লেক্সিলোড', 'flexi', 'flexi', 'smartphone'],
].map(([id, name_bn, type, color, icon], sort) => ({ id, code: id, name_bn, type, color, icon, sort, active: true, opening_balance_paisa: 0 }));
export async function initialize() {
  await db.transaction('rw', db.pockets, db.settings, async () => {
    if (!(await db.pockets.count())) await db.pockets.bulkAdd(seedPockets);
    if (!(await db.settings.get('main'))) await db.settings.add({ id: 'main', shop_name: 'আমার দোকান', owner_name: '', digits: 'bn', configured: false, privacy_default: false, voice_on: true, updated_at: Date.now(), failed_attempts: 0, blocked_until: 0 });
  });
}
export async function saveOpening(amounts: Record<string, number>, shop_name: string, pin_hash?: string, pin_salt?: string) {
  const id = crypto.randomUUID(); const now = Date.now();
  await db.transaction('rw', db.settings, db.transactions, db.txn_legs, db.audit_log, async () => {
    await db.transactions.add({ id, txn_type: 'OPENING', amount_paisa: Object.values(amounts).reduce((a, b) => a + b, 0), date: new Date().toLocaleDateString('en-CA'), created_at: now, updated_at: now, device_id: 'local', synced: false, version: 1, deleted: false, status: 'active' });
    await db.txn_legs.bulkAdd(Object.entries(amounts).map(([pocket_id, amount_paisa]) => ({ id: crypto.randomUUID(), txn_id: id, pocket_id, amount_paisa })));
    await db.settings.update('main', { configured: true, shop_name: shop_name.trim() || 'আমার দোকান', pin_hash, pin_salt, updated_at: now });
    await db.audit_log.add({ id: crypto.randomUUID(), entity_id: id, action: 'opening', at: now });
  });
  return id;
}
export async function voidOpening(id: string) {
  await db.transaction('rw', db.transactions, db.settings, db.audit_log, async () => {
    await db.transactions.update(id, { status: 'void', void_reason: 'ফিরিয়ে নিন', updated_at: Date.now(), version: 2 });
    await db.settings.update('main', { configured: false });
    await db.audit_log.add({ id: crypto.randomUUID(), entity_id: id, action: 'void', reason: 'ফিরিয়ে নিন', at: Date.now() });
  });
}