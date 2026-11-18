import type { CachedLoan, LedgerCache, LoanEventRow, LoanRow } from './db';
import { balances, type MoneyLeg, type MoneyTransaction } from './money';

export interface LedgerView {
  totals: Record<string, number>;
  today: LedgerCache['today'];
  lendOpen: number;
  borrowOpen: number;
  lendCount: number;
  borrowCount: number;
  configured: boolean;
}

const emptyToday = { sale_paisa: 0, cash_out_paisa: 0, txn_count: 0 };

export function localToday(transactions: (MoneyTransaction & { txn_type: string; amount_paisa: number; date: string })[], today = new Date().toLocaleDateString('en-CA')) {
  const view = { ...emptyToday };
  for (const txn of transactions) {
    if (txn.status !== 'active' || txn.date !== today) continue;
    view.txn_count += 1;
    if (txn.txn_type === 'CASH_IN') view.sale_paisa += txn.amount_paisa;
    if (txn.txn_type === 'CASH_OUT') view.cash_out_paisa += txn.amount_paisa;
  }
  return view;
}

export function mergeLedger(base: LedgerCache | undefined, local: {
  pockets: { id: string }[];
  transactions: (MoneyTransaction & { txn_type: string; amount_paisa: number; date: string })[];
  legs: MoneyLeg[];
  loans: LoanRow[];
  events: LoanEventRow[];
}): LedgerView {
  const totals = { ...(base?.pockets ?? {}) };
  for (const pocket of local.pockets) totals[pocket.id] ??= 0;
  const pending = balances(local.pockets, local.transactions, local.legs);
  for (const [id, amount] of Object.entries(pending)) totals[id] = (totals[id] ?? 0) + amount;
  const today = localToday(local.transactions);
  const day = {
    sale_paisa: (base?.today.sale_paisa ?? 0) + today.sale_paisa,
    cash_out_paisa: (base?.today.cash_out_paisa ?? 0) + today.cash_out_paisa,
    txn_count: (base?.today.txn_count ?? 0) + today.txn_count,
  };
  let lendOpen = base?.lend_open ?? 0;
  let borrowOpen = base?.borrow_open ?? 0;
  let lendCount = base?.lend_count ?? 0;
  let borrowCount = base?.borrow_count ?? 0;
  const localIds = new Set(local.loans.map((loan) => loan.id));
  for (const loan of local.loans) {
    const repaid = local.events.filter((event) => event.loan_id === loan.id && event.type === 'repayment').reduce((sum, event) => sum + event.amount_paisa, 0);
    const remaining = loan.principal_paisa - repaid;
    if (loan.direction === 'lend') { lendOpen += remaining; lendCount += 1; }
    else { borrowOpen += remaining; borrowCount += 1; }
  }
  for (const event of local.events) {
    if (event.type !== 'repayment' || localIds.has(event.loan_id)) continue;
    const known = base?.loans.find((loan) => loan.id === event.loan_id);
    if (!known) continue;
    if (known.direction === 'lend') lendOpen -= event.amount_paisa;
    else borrowOpen -= event.amount_paisa;
  }
  return { totals, today: day, lendOpen, borrowOpen, lendCount, borrowCount, configured: Boolean(base?.configured) };
}

export function loansWithPending(cached: CachedLoan[] | undefined, localLoans: LoanRow[], events: LoanEventRow[], names: Map<string, string>) {
  const known = new Set((cached ?? []).map((loan) => loan.id));
  const adjusted = (cached ?? []).map((loan) => {
    const extra = events.filter((event) => event.loan_id === loan.id && event.type === 'repayment' && !loan.events.some((row) => row.id === event.id));
    const remaining = loan.remaining_paisa - extra.reduce((sum, event) => sum + event.amount_paisa, 0);
    return {
      ...loan,
      remaining_paisa: remaining,
      status: remaining <= 0 ? 'closed' : loan.status,
      events: [...loan.events, ...extra.map((event) => ({ id: event.id, type: event.type, amount_paisa: event.amount_paisa, at: new Date(event.at).toISOString() }))],
    };
  });
  const pending = localLoans.filter((loan) => !known.has(loan.id)).map((loan) => {
    const rows = events.filter((event) => event.loan_id === loan.id);
    const repaid = rows.filter((event) => event.type === 'repayment').reduce((sum, event) => sum + event.amount_paisa, 0);
    return {
      ...loan,
      person_name: names.get(loan.person_id) ?? '',
      remaining_paisa: loan.principal_paisa - repaid,
      opened_at: new Date(loan.opened_at).toISOString(),
      due_at: loan.due_at ? new Date(loan.due_at).toISOString() : null,
      closed_at: null,
      pending: true,
      events: rows.map((event) => ({ id: event.id, type: event.type, amount_paisa: event.amount_paisa, at: new Date(event.at).toISOString() })),
    };
  });
  return [...adjusted, ...pending];
}
