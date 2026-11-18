import { describe, expect, it } from "vitest";
import type { LedgerCache } from "@/features/foundations/db";
import { mergeLedger } from "@/features/foundations/ledger-view";

const cache: LedgerCache = {
  pockets: { CASH: 55000, BKASH: 10000 },
  today: { sale_paisa: 50000, cash_out_paisa: 10000, lend_paisa: 0, borrow_paisa: 0, txn_count: 7 },
  lend_open: 10000,
  borrow_open: 5000,
  lend_count: 1,
  borrow_count: 1,
  configured: true,
  people: [],
  loans: [{ id: "loan-1", person_id: "p1", person_name: "করিম", direction: "lend", principal_paisa: 20000, remaining_paisa: 10000, pocket_id: "CASH", opened_at: "2026-11-17T10:00:00.000Z", closed_at: null, status: "partial", events: [] }],
};

describe("offline ledger", () => {
  it("keeps the last server balances and adds the phone-only entry", () => {
    const view = mergeLedger(cache, {
      pockets: [{ id: "CASH" }, { id: "BKASH" }],
      transactions: [
        { id: "new", status: "active", txn_type: "CASH_IN", amount_paisa: 2500, date: new Date().toLocaleDateString("en-CA") },
        { id: "lend", status: "active", txn_type: "LEND", amount_paisa: 4000, date: new Date().toLocaleDateString("en-CA") },
        { id: "borrow", status: "active", txn_type: "BORROW", amount_paisa: 1500, date: new Date().toLocaleDateString("en-CA") },
      ],
      legs: [{ txn_id: "new", pocket_id: "CASH", amount_paisa: 2500 }],
      loans: [],
      events: [{ id: "pay", loan_id: "loan-1", type: "repayment", amount_paisa: 1000, at: 1, synced: false }],
    });
    expect(view.totals.CASH).toBe(57500);
    expect(view.totals.BKASH).toBe(10000);
    expect(view.today.sale_paisa).toBe(52500);
    expect(view.today.lend_paisa).toBe(4000);
    expect(view.today.borrow_paisa).toBe(1500);
    expect(view.today.txn_count).toBe(10);
    expect(view.lendOpen).toBe(9000);
    expect(view.configured).toBe(true);
  });
});
