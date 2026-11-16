export type Digits = 'bn' | 'en';
export const normalizeDigits = (value: string) => value.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
export function number(value: number, digits: Digits = 'bn') {
  return new Intl.NumberFormat(digits === 'bn' ? 'bn-BD' : 'en-IN', { maximumFractionDigits: 2 }).format(value);
}
export const taka = (paisa: number, digits: Digits = 'bn') => `৳ ${number(paisa / 100, digits)}`;
export function toPaisa(value: string) {
  const normalized = normalizeDigits(value);
  if (!/^\d{1,10}(\.\d{0,2})?$/.test(normalized)) throw new Error('সঠিক টাকা লিখুন');
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export type MoneyLeg = { pocket_id: string; amount_paisa: number; txn_id: string };
export type MoneyTransaction = { id: string; status: 'active' | 'void' };
export function balances(pockets: { id: string }[], transactions: MoneyTransaction[], legs: MoneyLeg[]) {
  const active = new Set(transactions.filter(t => t.status === 'active').map(t => t.id));
  const totals: Record<string, number> = Object.fromEntries(pockets.map(p => [p.id, 0]));
  for (const leg of legs) if (active.has(leg.txn_id)) totals[leg.pocket_id] = (totals[leg.pocket_id] ?? 0) + leg.amount_paisa;
  return totals;
}