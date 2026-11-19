import { describe, expect, it } from "vitest";
import { openingCredentials, seedOpeningOwner } from "./opening";

function memorySql(admins: { id: string }[]) {
  const queries: string[] = [];
  const run = (strings: TemplateStringsArray) => {
    queries.push(strings.join("?"));
    return Promise.resolve(admins);
  };
  return { sql: Object.assign(run, { begin: async (fn: (tx: typeof run) => Promise<void>) => { await fn(run); } }), queries };
}

describe("opening owner", () => {
  it("accepts an 11-digit phone and a 4-digit pin", () => {
    expect(openingCredentials({ OPENING_PHONE: "০১৭১১১১১১১১", OPENING_PIN: "২৪৬৮" })).toMatchObject({ phone: "01711111111", pin: "2468", name: "মালিক" });
  });

  it("ignores a blank or bad pair", () => {
    expect(openingCredentials({})).toBeNull();
    expect(openingCredentials({ OPENING_PHONE: "171", OPENING_PIN: "12" })).toBeNull();
  });

  it("does not write when an admin already exists", async () => {
    const db = memorySql([{ id: "owner" }]);
    await expect(seedOpeningOwner(db.sql, { OPENING_PHONE: "01711111111", OPENING_PIN: "2468" })).resolves.toBe("exists");
    expect(db.queries.some((query) => query.startsWith("insert"))).toBe(false);
  });

  it("inserts the shop, owner, and pockets only when none exist", async () => {
    const db = memorySql([]);
    await expect(seedOpeningOwner(db.sql, { OPENING_PHONE: "01711111111", OPENING_PIN: "2468" })).resolves.toBe("created");
    expect(db.queries.filter((query) => query.startsWith("insert into users"))).toHaveLength(1);
    expect(db.queries.filter((query) => query.startsWith("insert into pockets"))).toHaveLength(6);
  });
});
