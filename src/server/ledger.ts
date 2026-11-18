import { checkPin, createSession, hashPin, type SessionUser } from "./auth";
import { db } from "./db";
import { POCKETS, reviewSync, type SyncBody } from "./policy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pocketSeed = [
  ["CASH", "হাতে নগদ", 0],
  ["BKASH", "বিকাশ", 1],
  ["NAGAD", "নগদ", 2],
  ["ROCKET", "রকেট", 3],
  ["FLEXI", "ফ্লেক্সিলোড", 4],
  ["PHARMA", "ফার্মেসি", 5],
] as const;

function uuid(value: unknown) {
  const id = String(value ?? "");
  if (!UUID.test(id)) throw new Error("bad_id");
  return id;
}

function pinOf(value: unknown) {
  const pin = String(value ?? "").replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit))).replace(/\D/g, "");
  if (!/^\d{4}$/.test(pin)) throw new Error("bad_pin");
  return pin;
}

export async function registerShop(input: { shop_id: string; shop_name: string; user_id: string; name: string; pin: string }) {
  const pin = pinOf(input.pin);
  const shopId = uuid(input.shop_id);
  const userId = uuid(input.user_id);
  const shopName = input.shop_name.trim().slice(0, 60);
  const name = input.name.trim().slice(0, 60);
  if (!shopName || !name) throw new Error("bad_name");
  const sql = await db();
  const named = await sql`select id from shops limit 1`;
  if (named.length) throw new Error("shop_exists");
  const { hash, salt } = hashPin(pin);
  await sql.begin(async (tx) => {
    await tx`insert into shops (id, name) values (${shopId}, ${shopName}) on conflict (id) do nothing`;
    const admins = await tx`select id from users where shop_id = ${shopId} and role = 'admin'`;
    if (admins.length && admins[0].id !== userId) throw new Error("shop_exists");
    await tx`insert into users (id, shop_id, name, role, pin_hash, pin_salt) values (${userId}, ${shopId}, ${name}, 'admin', ${hash}, ${salt}) on conflict (id) do nothing`;
    for (const [id, nameBn, sort] of pocketSeed) {
      await tx`insert into pockets (shop_id, id, name_bn, sort) values (${shopId}, ${id}, ${nameBn}, ${sort}) on conflict do nothing`;
    }
  });
  const token = await createSession(userId, shopId);
  return { token, role: "admin" as const, user_id: userId, shop_id: shopId, name, shop_name: shopName };
}

export async function shopReady() {
  const sql = await db();
  const rows = await sql`select id from shops limit 1`;
  return { ready: rows.length > 0 };
}

export async function login(input: { shop_name?: string; name?: string; pin: string }) {
  const pin = pinOf(input.pin);
  const sql = await db();
  const shop = String(input.shop_name ?? "").trim();
  const person = String(input.name ?? "").trim();
  const rows = await sql<{ id: string; shop_id: string; name: string; role: "admin" | "employee"; pin_hash: string; pin_salt: string; shop_name: string }[]>`
    select u.id, u.shop_id, u.name, u.role, u.pin_hash, u.pin_salt, s.name as shop_name
    from users u join shops s on s.id = u.shop_id
    where u.active and (${shop} = '' or s.name = ${shop}) and (${person} = '' or u.name = ${person})
  `;
  const matches = rows.filter((user) => checkPin(pin, user.pin_hash, user.pin_salt));
  if (matches.length !== 1) throw new Error("bad_login");
  const user = matches[0];
  const token = await createSession(user.id, user.shop_id);
  return { token, role: user.role, user_id: user.id, shop_id: user.shop_id, name: user.name, shop_name: user.shop_name };
}

export async function addEmployee(actor: SessionUser, input: { name: string; pin: string }) {
  if (actor.role !== "admin") throw new Error("forbidden");
  const pin = pinOf(input.pin);
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error("bad_name");
  const sql = await db();
  const id = crypto.randomUUID();
  const { hash, salt } = hashPin(pin);
  const rows = await sql`insert into users (id, shop_id, name, role, pin_hash, pin_salt) values (${id}, ${actor.shop_id}, ${name}, 'employee', ${hash}, ${salt}) on conflict (shop_id, name) do nothing returning id`;
  if (!rows.length) throw new Error("name_taken");
  return { id, name, role: "employee" as const };
}

export async function setEmployeePin(actor: SessionUser, id: string, pin: string) {
  if (actor.role !== "admin") throw new Error("forbidden");
  const nextPin = pinOf(pin);
  const employeeId = uuid(id);
  const sql = await db();
  const { hash, salt } = hashPin(nextPin);
  const rows = await sql`update users set pin_hash = ${hash}, pin_salt = ${salt} where id = ${employeeId} and shop_id = ${actor.shop_id} and role = 'employee' and active returning id`;
  if (!rows.length) throw new Error("bad_employee");
  return { ok: true };
}

export async function renameShop(actor: SessionUser, name: string) {
  if (actor.role !== "admin") throw new Error("forbidden");
  const next = name.trim().slice(0, 60);
  if (!next) throw new Error("bad_name");
  const sql = await db();
  await sql`update shops set name = ${next} where id = ${actor.shop_id}`;
  return { shop_name: next };
}

export async function listEmployees(actor: SessionUser) {
  if (actor.role !== "admin") throw new Error("forbidden");
  const sql = await db();
  const staff = await sql<{ id: string; name: string; created_at: Date }[]>`
    select id, name, created_at from users
    where shop_id = ${actor.shop_id} and role = 'employee' and active
    order by created_at
  `;
  const totals = await sql<{ created_by: string; txn_type: string; count: number; amount: string }[]>`
    select created_by, txn_type, count(*)::int as count, coalesce(sum(amount_paisa), 0)::text as amount
    from transactions
    where shop_id = ${actor.shop_id} and status = 'active' and created_by is not null
    group by created_by, txn_type
  `;
  const peopleCounts = await sql<{ created_by: string; count: number }[]>`
    select created_by, count(*)::int as count from people
    where shop_id = ${actor.shop_id} and created_by is not null
    group by created_by
  `;
  const loanTotals = await sql<{ created_by: string; direction: string; count: number; amount: string }[]>`
    select created_by, direction, count(*)::int as count, coalesce(sum(principal_paisa), 0)::text as amount
    from loans
    where shop_id = ${actor.shop_id} and created_by is not null
    group by created_by, direction
  `;
  const events = await sql<{ user_id: string; kind: string; detail: string; amount_paisa: number; at: Date; phone: string }[]>`
    select * from (
      select t.created_by as user_id, 'txn' as kind, t.txn_type as detail, t.amount_paisa, t.created_at as at, coalesce(t.phone, '') as phone
      from transactions t join users u on u.id = t.created_by
      where t.shop_id = ${actor.shop_id} and u.role = 'employee' and u.active and t.status = 'active'
      union all
      select p.created_by, 'person', p.name, 0, p.created_at, ''
      from people p join users u on u.id = p.created_by
      where p.shop_id = ${actor.shop_id} and u.role = 'employee' and u.active
      union all
      select l.created_by, 'loan', l.direction, l.principal_paisa, l.opened_at, ''
      from loans l join users u on u.id = l.created_by
      where l.shop_id = ${actor.shop_id} and u.role = 'employee' and u.active
    ) activity
    order by at desc
    limit 200
  `;
  return staff.map((person) => {
    const mine = totals.filter((row) => row.created_by === person.id);
    const loans = loanTotals.filter((row) => row.created_by === person.id);
    const amount = (type: string) => mine.filter((row) => row.txn_type === type).reduce((sum, row) => sum + Number(row.amount), 0);
    const activity = events.filter((row) => row.user_id === person.id).slice(0, 40).map((row) => ({
      at: row.at,
      kind: row.kind,
      detail: row.detail,
      amount_paisa: Number(row.amount_paisa),
      phone: row.phone ?? "",
    }));
    return {
      id: person.id,
      name: person.name,
      created_at: person.created_at,
      txn_count: mine.reduce((sum, row) => sum + Number(row.count), 0),
      cash_in_paisa: amount("CASH_IN"),
      cash_out_paisa: amount("CASH_OUT"),
      flexi_paisa: amount("FLEXI"),
      lend_count: loans.filter((row) => row.direction === "lend").reduce((sum, row) => sum + Number(row.count), 0),
      borrow_count: loans.filter((row) => row.direction === "borrow").reduce((sum, row) => sum + Number(row.count), 0),
      person_count: Number(peopleCounts.find((row) => row.created_by === person.id)?.count ?? 0),
      last_at: activity[0]?.at ?? null,
      activity,
    };
  });
}

export async function applySync(actor: SessionUser, body: SyncBody) {
  const reviewed = reviewSync(actor.role, body);
  const sql = await db();
  const accepted = { transactions: [] as string[], legs: [] as string[], people: [] as string[], loans: [] as string[], loan_events: [] as string[] };
  const rejected = [...reviewed.rejected];
  await sql.begin(async (tx) => {
    for (const person of reviewed.accept.people) {
      const id = uuid(person.id);
      await tx`insert into people (id, shop_id, name, phone, created_at, created_by) values (${id}, ${actor.shop_id}, ${person.name.trim().slice(0, 80)}, ${String(person.phone ?? "").slice(0, 20)}, ${new Date(person.created_at)}, ${actor.id}) on conflict (id) do nothing`;
      accepted.people.push(id);
    }
    for (const txn of reviewed.accept.transactions) {
      const id = uuid(txn.id);
      await tx`insert into transactions (id, shop_id, txn_type, amount_paisa, date, status, device_id, created_by, created_at, phone) values (${id}, ${actor.shop_id}, ${txn.txn_type}, ${txn.amount_paisa}, ${txn.date}, 'active', ${reviewed.accept.device_id}, ${actor.id}, ${new Date(txn.created_at)}, ${txn.phone ?? ""}) on conflict (id) do nothing`;
      accepted.transactions.push(id);
    }
    for (const leg of reviewed.accept.legs) {
      const id = uuid(leg.id);
      const rows = await tx`insert into txn_legs (id, shop_id, txn_id, pocket_id, amount_paisa) select ${id}, ${actor.shop_id}, ${leg.txn_id}, ${leg.pocket_id}, ${leg.amount_paisa} where exists (select 1 from transactions t where t.id = ${leg.txn_id} and t.shop_id = ${actor.shop_id}) on conflict (id) do nothing returning id`;
      const known = rows.length || (await tx`select id from txn_legs where id = ${id} and shop_id = ${actor.shop_id}`).length;
      if (known) accepted.legs.push(id);
      else rejected.push({ id, reason: "missing_txn" });
    }
    for (const loan of reviewed.accept.loans) {
      const id = uuid(loan.id);
      const rows = await tx`insert into loans (id, shop_id, person_id, direction, principal_paisa, pocket_id, opened_at, due_at, status, created_by) select ${id}, ${actor.shop_id}, ${loan.person_id}, ${loan.direction}, ${loan.principal_paisa}, ${loan.pocket_id}, ${new Date(loan.opened_at)}, ${loan.due_at ? new Date(loan.due_at) : null}, 'open', ${actor.id} where exists (select 1 from people p where p.id = ${loan.person_id} and p.shop_id = ${actor.shop_id}) on conflict (id) do nothing returning id`;
      const known = rows.length || (await tx`select id from loans where id = ${id} and shop_id = ${actor.shop_id}`).length;
      if (known) accepted.loans.push(id);
      else rejected.push({ id, reason: "missing_person" });
    }
    for (const event of reviewed.accept.loan_events) {
      const id = uuid(event.id);
      if (event.type === "repayment") {
        const ok = await repay(tx, actor, { loan_id: event.loan_id, amount_paisa: event.amount_paisa, at: event.at, event_id: id, note: event.note ?? "", withTxn: false });
        if (ok) accepted.loan_events.push(id);
        else rejected.push({ id, reason: "bad_repayment" });
        continue;
      }
      const rows = await tx`insert into loan_events (id, shop_id, loan_id, type, amount_paisa, at, actor_id, note) select ${id}, ${actor.shop_id}, ${event.loan_id}, 'open', ${event.amount_paisa}, ${new Date(event.at)}, ${actor.id}, ${String(event.note ?? "").slice(0, 120)} where exists (select 1 from loans l where l.id = ${event.loan_id} and l.shop_id = ${actor.shop_id}) on conflict (id) do nothing returning id`;
      const known = rows.length || (await tx`select id from loan_events where id = ${id} and shop_id = ${actor.shop_id}`).length;
      if (known) accepted.loan_events.push(id);
      else rejected.push({ id, reason: "missing_loan" });
    }
    for (const txn of reviewed.voids) {
      await tx`update transactions set status = 'void', void_reason = ${txn.void_reason ?? "void"}, voided_at = now() where id = ${uuid(txn.id)} and shop_id = ${actor.shop_id}`;
      accepted.transactions.push(txn.id);
    }
  });
  return { accepted, rejected };
}

async function repay(tx: Awaited<ReturnType<typeof db>>, actor: SessionUser, input: { loan_id: string; amount_paisa: number; at: number; event_id: string; note: string; pocket_id?: string; withTxn: boolean }) {
  const already = await tx`select id from loan_events where id = ${input.event_id} and shop_id = ${actor.shop_id}`;
  if (already.length) return true;
  const loans = await tx`select id, direction, principal_paisa, pocket_id from loans where id = ${input.loan_id} and shop_id = ${actor.shop_id}`;
  const loan = loans[0];
  if (!loan) return false;
  const paidRows = await tx`select coalesce(sum(amount_paisa), 0)::bigint as paid from loan_events where loan_id = ${loan.id} and type = 'repayment'`;
  const paid = Number(paidRows[0].paid);
  const remaining = Number(loan.principal_paisa) - paid;
  if (input.amount_paisa <= 0 || input.amount_paisa > remaining) return false;
  const pocket = input.pocket_id && POCKETS.includes(input.pocket_id as (typeof POCKETS)[number]) ? input.pocket_id : String(loan.pocket_id);
  const at = new Date(input.at);
  await tx`insert into loan_events (id, shop_id, loan_id, type, amount_paisa, at, actor_id, note) values (${input.event_id}, ${actor.shop_id}, ${loan.id}, 'repayment', ${input.amount_paisa}, ${at}, ${actor.id}, ${input.note})`;
  const next = remaining - input.amount_paisa;
  await tx`update loans set status = ${next === 0 ? "closed" : "partial"}, closed_at = ${next === 0 ? at : null} where id = ${loan.id}`;
  if (!input.withTxn) return true;
  const txnId = crypto.randomUUID();
  const txnType = loan.direction === "lend" ? "REPAY_IN" : "REPAY_OUT";
  const signed = loan.direction === "lend" ? input.amount_paisa : -input.amount_paisa;
  await tx`insert into transactions (id, shop_id, txn_type, amount_paisa, date, status, device_id, created_by, created_at) values (${txnId}, ${actor.shop_id}, ${txnType}, ${input.amount_paisa}, ${at.toISOString().slice(0, 10)}, 'active', 'server', ${actor.id}, ${at})`;
  await tx`insert into txn_legs (id, shop_id, txn_id, pocket_id, amount_paisa) values (${crypto.randomUUID()}, ${actor.shop_id}, ${txnId}, ${pocket}, ${signed})`;
  return true;
}

export async function repayLoan(actor: SessionUser, loanId: string, input: { amount_paisa: number; at: number; pocket_id?: string }) {
  if (actor.role !== "admin") throw new Error("forbidden");
  const sql = await db();
  const ok = await sql.begin((tx) => repay(tx, actor, { loan_id: loanId, amount_paisa: input.amount_paisa, at: input.at, event_id: crypto.randomUUID(), note: "", pocket_id: input.pocket_id, withTxn: true }));
  if (!ok) throw new Error("bad_repayment");
  return loanDetail(actor, loanId);
}

export async function voidTransaction(actor: SessionUser, id: string) {
  if (actor.role !== "admin") throw new Error("forbidden");
  const sql = await db();
  await sql`update transactions set status = 'void', void_reason = ${"ফিরিয়ে নিন"}, voided_at = now() where id = ${uuid(id)} and shop_id = ${actor.shop_id}`;
  return { id };
}

export async function balances(actor: SessionUser) {
  const sql = await db();
  const legs = await sql`select l.pocket_id, coalesce(sum(l.amount_paisa), 0)::bigint as amount from txn_legs l join transactions t on t.id = l.txn_id where l.shop_id = ${actor.shop_id} and t.status = 'active' group by l.pocket_id`;
  const pockets = Object.fromEntries(POCKETS.map((id) => [id, 0]));
  for (const row of legs) pockets[row.pocket_id] = Number(row.amount);
  const open = await sql`select direction, count(*)::int as count, coalesce(sum(principal_paisa), 0)::bigint as principal from loans where shop_id = ${actor.shop_id} and status <> 'closed' group by direction`;
  const paid = await sql`select l.direction, coalesce(sum(e.amount_paisa), 0)::bigint as paid from loan_events e join loans l on l.id = e.loan_id where e.shop_id = ${actor.shop_id} and e.type = 'repayment' and l.status <> 'closed' group by l.direction`;
  const lend = open.find((row) => row.direction === "lend");
  const borrow = open.find((row) => row.direction === "borrow");
  const configured = await sql`select 1 from transactions where shop_id = ${actor.shop_id} and txn_type = 'OPENING' and status = 'active' limit 1`;
  return {
    pockets,
    lend_open: Number(lend?.principal ?? 0) - Number(paid.find((row) => row.direction === "lend")?.paid ?? 0),
    borrow_open: Number(borrow?.principal ?? 0) - Number(paid.find((row) => row.direction === "borrow")?.paid ?? 0),
    lend_count: Number(lend?.count ?? 0),
    borrow_count: Number(borrow?.count ?? 0),
    configured: configured.length > 0,
  };
}

export async function recentEntries(actor: SessionUser) {
  const sql = await db();
  const rows = await sql<{ id: string; txn_type: string; amount_paisa: number; created_at: Date; actor: string; pocket_id: string; phone: string }[]>`
    select t.id, t.txn_type, t.amount_paisa, t.created_at, coalesce(u.name, '') as actor, coalesce(t.phone, '') as phone,
      coalesce(
        (select l.pocket_id from txn_legs l where l.txn_id = t.id and l.amount_paisa < 0 limit 1),
        (select l.pocket_id from txn_legs l where l.txn_id = t.id limit 1),
        ''
      ) as pocket_id
    from transactions t
    left join users u on u.id = t.created_by
    where t.shop_id = ${actor.shop_id} and t.status = 'active'
      and t.txn_type in ('CASH_IN', 'CASH_OUT', 'FLEXI')
    order by t.created_at desc
    limit 40
  `;
  return rows.map((row) => ({ ...row, amount_paisa: Number(row.amount_paisa) }));
}

export async function today(actor: SessionUser) {
  const sql = await db();
  const rows = await sql`select txn_type, coalesce(sum(amount_paisa), 0)::bigint as amount, count(*)::int as count from transactions where shop_id = ${actor.shop_id} and status = 'active' and date = (now() at time zone 'Asia/Dhaka')::date group by txn_type`;
  const of = (type: string) => Number(rows.find((row) => row.txn_type === type)?.amount ?? 0);
  return { sale_paisa: of("CASH_IN"), cash_out_paisa: of("CASH_OUT"), txn_count: rows.reduce((sum, row) => sum + Number(row.count), 0) };
}

export async function people(actor: SessionUser) {
  const sql = await db();
  return sql`select id, name, phone, created_at from people where shop_id = ${actor.shop_id} order by created_at desc`;
}

export async function loans(actor: SessionUser) {
  const sql = await db();
  const rows = await sql`select l.id, l.person_id, p.name as person_name, l.direction, l.principal_paisa, l.pocket_id, l.opened_at, l.due_at, l.closed_at, l.status, l.principal_paisa - coalesce((select sum(amount_paisa) from loan_events e where e.loan_id = l.id and e.type = 'repayment'), 0) as remaining_paisa from loans l join people p on p.id = l.person_id where l.shop_id = ${actor.shop_id} order by l.opened_at desc`;
  const events = await sql`select id, loan_id, type, amount_paisa, at, note from loan_events where shop_id = ${actor.shop_id} order by at`;
  return rows.map((loan) => ({ ...loan, principal_paisa: Number(loan.principal_paisa), remaining_paisa: Number(loan.remaining_paisa), events: events.filter((event) => event.loan_id === loan.id).map((event) => ({ ...event, amount_paisa: Number(event.amount_paisa) })) }));
}

async function loanDetail(actor: SessionUser, id: string) {
  const all = await loans(actor);
  return all.find((loan) => loan.id === id) ?? null;
}

const historyKinds: Record<string, string[]> = {
  CASH_IN: ["CASH_IN"],
  CASH_OUT: ["CASH_OUT"],
  FLEXI: ["FLEXI"],
  LEND: ["LEND"],
  BORROW: ["BORROW"],
  REPAY: ["REPAY_IN", "REPAY_OUT"],
};

export async function dayHistory(actor: SessionUser, query: { range: string; kind: string; pocket: string }) {
  if (actor.role !== "admin") throw new Error("forbidden");
  const range = query.range === "today" || query.range === "30" || query.range === "all" ? query.range : "7";
  const kinds = historyKinds[query.kind] ?? [];
  const pocket = ["CASH", "BKASH", "NAGAD", "ROCKET", "FLEXI", "PHARMA"].includes(query.pocket) ? query.pocket : "";
  const back = range === "today" ? 0 : range === "30" ? 29 : range === "7" ? 6 : null;
  const since = back === null ? "" : new Date(Date.now() + 6 * 60 * 60 * 1000 - back * 86400000).toISOString().slice(0, 10);
  const sql = await db();
  const rows = await sql<{ id: string; txn_type: string; amount_paisa: number; date: string; created_at: Date; actor: string; pocket_id: string; phone: string }[]>`
    select t.id, t.txn_type, t.amount_paisa, t.date::text as date, t.created_at, coalesce(u.name, '') as actor, coalesce(t.phone, '') as phone,
      coalesce(
        (select l.pocket_id from txn_legs l where l.txn_id = t.id and l.amount_paisa < 0 limit 1),
        (select l.pocket_id from txn_legs l where l.txn_id = t.id limit 1),
        ''
      ) as pocket_id
    from transactions t
    left join users u on u.id = t.created_by
    where t.shop_id = ${actor.shop_id}
      and t.status = 'active'
      and t.txn_type <> 'OPENING'
      ${kinds.length ? sql`and t.txn_type in ${sql(kinds)}` : sql``}
      ${pocket ? sql`and exists (select 1 from txn_legs l where l.txn_id = t.id and l.pocket_id = ${pocket})` : sql``}
      ${since ? sql`and t.date >= cast(${since} as date)` : sql``}
    order by t.created_at desc
    limit 400
  `;
  const days: { date: string; lines: { id: string; txn_type: string; amount_paisa: number; created_at: string; actor: string; pocket_id: string; phone: string }[] }[] = [];
  for (const row of rows) {
    const date = String(row.date).slice(0, 10);
    let day = days.find((item) => item.date === date);
    if (!day) {
      day = { date, lines: [] };
      days.push(day);
    }
    day.lines.push({ id: row.id, txn_type: row.txn_type, amount_paisa: Number(row.amount_paisa), created_at: new Date(row.created_at).toISOString(), actor: row.actor, pocket_id: row.pocket_id, phone: row.phone ?? "" });
  }
  return { days };
}

export async function report(actor: SessionUser) {
  if (actor.role !== "admin") throw new Error("forbidden");
  const sql = await db();
  const day = await today(actor);
  const open = await balances(actor);
  const repayments = await sql`select e.at, e.amount_paisa, l.direction, p.name as person_name from loan_events e join loans l on l.id = e.loan_id join people p on p.id = l.person_id where e.shop_id = ${actor.shop_id} and e.type = 'repayment' and (e.at at time zone 'Asia/Dhaka')::date = (now() at time zone 'Asia/Dhaka')::date order by e.at`;
  return { ...day, lend_open: open.lend_open, borrow_open: open.borrow_open, repayments: repayments.map((row) => ({ ...row, amount_paisa: Number(row.amount_paisa) })) };
}
