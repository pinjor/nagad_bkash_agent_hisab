export const POCKETS = ["CASH", "BKASH", "NAGAD", "ROCKET", "FLEXI", "PHARMA"] as const;
export type Role = "admin" | "employee";

export interface SyncTxn {
  id: string;
  txn_type: string;
  amount_paisa: number;
  date: string;
  status: "active" | "void";
  created_at: number;
  void_reason?: string;
  phone?: string;
  party?: string;
}
export interface SyncLeg { id: string; txn_id: string; pocket_id: string; amount_paisa: number }
export interface SyncPerson { id: string; name: string; phone?: string; created_at: number }
export interface SyncLoan {
  id: string;
  person_id: string;
  direction: "lend" | "borrow";
  principal_paisa: number;
  pocket_id: string;
  opened_at: number;
  due_at?: number | null;
}
export interface SyncEvent {
  id: string;
  loan_id: string;
  type: "open" | "repayment";
  amount_paisa: number;
  at: number;
  note?: string;
}
export interface SyncBody {
  device_id: string;
  transactions: SyncTxn[];
  legs: SyncLeg[];
  people: SyncPerson[];
  loans: SyncLoan[];
  loan_events: SyncEvent[];
}

const ADD_TYPES = new Set(["CASH_IN", "CASH_OUT", "FLEXI", "LEND", "BORROW", "OPENING", "REPAY_IN", "REPAY_OUT"]);
const ADMIN_TYPES = new Set(["OPENING", "REPAY_IN", "REPAY_OUT"]);

function validPaisa(value: number, signed = false) {
  if (!Number.isInteger(value)) return false;
  const amount = Math.abs(value);
  if (!signed && value < 0) return false;
  return amount <= 100_000_000_000;
}

export function reviewSync(role: Role, body: SyncBody) {
  const rejected: { id: string; reason: string }[] = [];
  const reject = (id: string, reason: string) => rejected.push({ id, reason });
  const transactions: SyncTxn[] = [];
  const voids: SyncTxn[] = [];
  for (const txn of body.transactions ?? []) {
    if (!txn?.id || !ADD_TYPES.has(txn.txn_type) || !validPaisa(txn.amount_paisa) || !/^\d{4}-\d{2}-\d{2}$/.test(txn.date ?? "")) {
      reject(txn?.id ?? "?", "bad_txn");
      continue;
    }
    if (txn.status === "void") {
      if (role !== "admin") reject(txn.id, "admin_only");
      else voids.push(txn);
      continue;
    }
    if (ADMIN_TYPES.has(txn.txn_type) && role !== "admin") {
      reject(txn.id, "admin_only");
      continue;
    }
    if (txn.status !== "active") {
      reject(txn.id, "bad_status");
      continue;
    }
    transactions.push({ ...txn, phone: String(txn.phone ?? "").replace(/[^\d০-৯]/g, "").slice(0, 15), party: String(txn.party ?? "").trim().slice(0, 80) });
  }
  const txnIds = new Set(transactions.map((txn) => txn.id));
  const legs = (body.legs ?? []).filter((leg) => {
    if (!leg?.id || !txnIds.has(leg.txn_id) || !POCKETS.includes(leg.pocket_id as (typeof POCKETS)[number]) || !validPaisa(leg.amount_paisa, true)) {
      reject(leg?.id ?? "?", "bad_leg");
      return false;
    }
    return true;
  });
  const people = (body.people ?? []).filter((person) => {
    if (!person?.id || !String(person.name ?? "").trim()) {
      reject(person?.id ?? "?", "bad_person");
      return false;
    }
    return true;
  });
  const loans = (body.loans ?? []).filter((loan) => {
    if (!loan?.id || (loan.direction !== "lend" && loan.direction !== "borrow") || !validPaisa(loan.principal_paisa) || !POCKETS.includes(loan.pocket_id as (typeof POCKETS)[number])) {
      reject(loan?.id ?? "?", "bad_loan");
      return false;
    }
    return true;
  });
  const loanIds = new Set(loans.map((loan) => loan.id));
  const loan_events = (body.loan_events ?? []).filter((event) => {
    if (!event?.id || (event.type !== "open" && event.type !== "repayment") || !validPaisa(event.amount_paisa)) {
      reject(event?.id ?? "?", "bad_event");
      return false;
    }
    if (event.type === "repayment" && role !== "admin") {
      reject(event.id, "admin_only");
      return false;
    }
    if (event.type === "open" && !loanIds.has(event.loan_id)) {
      reject(event.id, "missing_loan");
      return false;
    }
    return true;
  });
  return {
    accept: {
      device_id: String(body.device_id ?? "local").slice(0, 64),
      transactions,
      legs,
      people,
      loans,
      loan_events,
    },
    voids,
    rejected,
  };
}
