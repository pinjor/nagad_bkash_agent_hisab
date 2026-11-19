import { hashPin } from "./auth";

const pockets = [
  ["CASH", "হাতে নগদ", 0],
  ["BKASH", "বিকাশ", 1],
  ["NAGAD", "নগদ", 2],
  ["ROCKET", "রকেট", 3],
  ["FLEXI", "ফ্লেক্সিলোড", 4],
  ["PHARMA", "ফার্মেসি", 5],
  ["MOBILE", "মোবাইল", 6],
] as const;

type Query = (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<readonly unknown[]>;
type Sql = Query & { begin: (fn: (tx: Query) => Promise<void>) => Promise<void> };

function digits(value: string) {
  return value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit))).replace(/\D/g, "");
}

export function openingCredentials(env: NodeJS.ProcessEnv = process.env) {
  const phone = digits(env.OPENING_PHONE ?? "");
  const pin = digits(env.OPENING_PIN ?? "");
  if (!phone && !pin) return null;
  if (!/^01\d{9}$/.test(phone) || !/^\d{4}$/.test(pin)) return null;
  const shopName = (env.OPENING_SHOP_NAME || "আমার দোকান").trim().slice(0, 60) || "আমার দোকান";
  const name = (env.OPENING_NAME || "মালিক").trim().slice(0, 60) || "মালিক";
  return { phone, pin, shopName, name };
}

let warned = false;

export async function seedOpeningOwner(sql: Sql, env: NodeJS.ProcessEnv = process.env) {
  const phone = digits(env.OPENING_PHONE ?? "");
  const pin = digits(env.OPENING_PIN ?? "");
  const creds = openingCredentials(env);
  if (!creds) {
    if ((phone || pin) && !warned) {
      warned = true;
      console.error("OPENING_PHONE must be 11 digits starting with 01, and OPENING_PIN must be 4 digits. No opening owner was created.");
    }
    return "skip" as const;
  }
  const existing = await sql`select id from users where role = 'admin' and active limit 1`;
  if (existing.length) return "exists" as const;
  const { hash, salt } = hashPin(creds.pin);
  const shopId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await sql.begin(async (tx) => {
    const again = await tx`select id from users where role = 'admin' and active limit 1`;
    if (again.length) return;
    await tx`insert into shops (id, name) values (${shopId}, ${creds.shopName})`;
    await tx`insert into users (id, shop_id, name, phone, role, pin_hash, pin_salt, pin_note) values (${userId}, ${shopId}, ${creds.name}, ${creds.phone}, 'admin', ${hash}, ${salt}, ${creds.pin})`;
    for (const [id, nameBn, sort] of pockets) {
      await tx`insert into pockets (shop_id, id, name_bn, sort) values (${shopId}, ${id}, ${nameBn}, ${sort}) on conflict do nothing`;
    }
  });
  console.log("Opening owner created from OPENING_PHONE. Later phone or PIN changes in the app replace it.");
  return "created" as const;
}
