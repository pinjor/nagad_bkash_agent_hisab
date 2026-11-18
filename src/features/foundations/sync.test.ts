import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db } from "@/features/foundations/db";
import { purgeAccepted } from "@/features/foundations/sync";

describe("outbox purge", () => {
  it("deletes rows the server accepted and leaves the session", async () => {
    const txn = crypto.randomUUID();
    const leg = crypto.randomUUID();
    await db.transactions.add({ id: txn, txn_type: "CASH_IN", amount_paisa: 100, date: "2026-11-17", created_at: 1, updated_at: 1, device_id: "phone", synced: false, version: 1, deleted: false, status: "active" });
    await db.txn_legs.add({ id: leg, txn_id: txn, pocket_id: "CASH", amount_paisa: 100 });
    await db.session.put({ id: "main", token: "keep", role: "admin", user_id: crypto.randomUUID(), shop_id: crypto.randomUUID(), name: "মালিক", shop_name: "দোকান", pending: false, device_id: "phone" });
    await purgeAccepted({ transactions: [txn], legs: [leg], people: [], loans: [], loan_events: [] });
    expect(await db.transactions.count()).toBe(0);
    expect(await db.txn_legs.count()).toBe(0);
    expect((await db.session.get("main"))?.token).toBe("keep");
  });
});
