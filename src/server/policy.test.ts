import { describe, expect, it } from "vitest";
import { reviewSync, type SyncBody } from "./policy";

const base: SyncBody = {
  device_id: "phone",
  transactions: [{ id: "t1", txn_type: "CASH_IN", amount_paisa: 5000, date: "2026-11-17", status: "active", created_at: 1 }],
  legs: [{ id: "l1", txn_id: "t1", pocket_id: "CASH", amount_paisa: 5000 }],
  people: [],
  loans: [],
  loan_events: [],
};

describe("sync policy", () => {
  it("lets an employee add cash and blocks repayment", () => {
    const result = reviewSync("employee", {
      ...base,
      transactions: [...base.transactions, { id: "t2", txn_type: "REPAY_IN", amount_paisa: 100, date: "2026-11-17", status: "active", created_at: 2 }, { id: "t3", txn_type: "OPENING", amount_paisa: 100, date: "2026-11-17", status: "active", created_at: 3 }],
      loan_events: [{ id: "e1", loan_id: "loan", type: "repayment", amount_paisa: 100, at: 4 }],
    });
    expect(result.accept.transactions.map((txn) => txn.id)).toEqual(["t1"]);
    expect(result.rejected.map((row) => row.reason)).toEqual(["admin_only", "admin_only", "admin_only"]);
  });

  it("lets an admin void and replay the same add", () => {
    const once = reviewSync("admin", base);
    const twice = reviewSync("admin", base);
    expect(once.accept.transactions).toHaveLength(1);
    expect(twice.accept.transactions[0].id).toBe("t1");
    const voided = reviewSync("admin", { ...base, transactions: [{ ...base.transactions[0], status: "void", void_reason: "ফিরিয়ে নিন" }] });
    expect(voided.voids).toHaveLength(1);
    expect(voided.accept.transactions).toHaveLength(0);
  });
});
