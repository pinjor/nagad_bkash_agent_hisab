import { describe, expect, it } from "vitest";
import { dharPaisa } from "./Reports";

describe("report dhar", () => {
  it("subtracts repayments from the dhar that was given or taken", () => {
    const totals = dharPaisa([
      { txn_type: "LEND", amount_paisa: 100000 },
      { txn_type: "REPAY_IN", amount_paisa: 40000 },
      { txn_type: "BORROW", amount_paisa: 50000 },
      { txn_type: "REPAY_OUT", amount_paisa: 20000 },
    ]);
    expect(totals.given).toBe(60000);
    expect(totals.backIn).toBe(40000);
    expect(totals.taken).toBe(30000);
    expect(totals.backOut).toBe(20000);
  });
});
