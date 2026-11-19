import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { seedOpeningOwner } from "./opening";

let sql: ReturnType<typeof postgres> | undefined;
let ready: Promise<void> | undefined;

function schemaPath() {
  const candidates = [
    resolve(process.cwd(), "server/sql/001_init.sql"),
    resolve(process.cwd(), "nagad_bkash_agent_hisab/server/sql/001_init.sql"),
  ];
  return candidates.find((path) => {
    try { readFileSync(path); return true; } catch { return false; }
  });
}

export async function db() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL missing");
    sql = postgres(url, { max: 5 });
  }
  if (!ready) {
    const path = schemaPath();
    if (!path) throw new Error("SQL schema file missing");
    const schema = readFileSync(path, "utf8");
    ready = sql.unsafe(schema).then(() => seedOpeningOwner(sql)).then(() => undefined);
  }
  await ready;
  return sql;
}

export type Sql = ReturnType<typeof postgres>;
