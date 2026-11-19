import { clearSessionCookie, sessionCookie, userFromRequest } from "./auth";
import { addEmployee, applySync, balances, changeOwnPin, checkOwnPin, dayHistory, listEmployees, loans, login, ownProfile, people, recentEntries, registerShop, renameShop, repayLoan, report, setEmployeePhone, setEmployeePin, setOwnPhone, shopReady, today, voidTransaction } from "./ledger";

function json(data: unknown, status = 200, headers?: HeadersInit) {
  const head = new Headers(headers);
  head.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers: head });
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "server";
  const status = message === "forbidden" ? 403 : message === "bad_login" ? 401 : message === "shop_exists" || message === "name_taken" || message === "phone_taken" ? 409 : message.startsWith("bad_") ? 400 : 500;
  if (status === 500) console.error(error);
  return json({ error: status === 500 ? "server" : message }, status);
}

async function readJson(request: Request) {
  try { return await request.json(); } catch { return {}; }
}

export async function handleApi(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  try {
    if (request.method === "GET" && path === "/api/setup") return json(await shopReady());
    if (request.method === "POST" && path === "/api/register") {
      const result = await registerShop(await readJson(request));
      return json(result, 200, { "set-cookie": sessionCookie(result.token, request) });
    }
    if (request.method === "POST" && path === "/api/login") {
      const result = await login(await readJson(request));
      return json(result, 200, { "set-cookie": sessionCookie(result.token, request) });
    }
    if (request.method === "POST" && path === "/api/logout") return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(request) });
    const user = await userFromRequest(request);
    if (!user) return json({ error: "unauthorized" }, 401);
    if (request.method === "GET" && path === "/api/me") return json(await ownProfile(user));
    if (request.method === "POST" && path === "/api/pin/check") return json(await checkOwnPin(user, String((await readJson(request)).pin ?? "")));
    if (request.method === "GET" && path === "/api/balances") return json(await balances(user));
    if (request.method === "GET" && path === "/api/today") return json(await today(user));
    if (request.method === "GET" && path === "/api/entries") return json(await recentEntries(user));
    if (request.method === "GET" && path === "/api/people") return json(await people(user));
    if (request.method === "GET" && path === "/api/loans") return json(await loans(user));
    if (request.method === "GET" && path === "/api/employees") return json(await listEmployees(user));
    if (request.method === "GET" && path === "/api/reports/day") return json(await report(user));
    if (request.method === "GET" && path === "/api/reports/days") return json(await dayHistory(user, { range: url.searchParams.get("range") ?? "", kind: url.searchParams.get("kind") ?? "", pocket: url.searchParams.get("pocket") ?? "", from: url.searchParams.get("from") ?? "", to: url.searchParams.get("to") ?? "" }));
    if (request.method === "POST" && path === "/api/sync") return json(await applySync(user, await readJson(request)));
    if (request.method === "POST" && path === "/api/pin") return json(await changeOwnPin(user, await readJson(request)));
    if (request.method === "POST" && path === "/api/me/phone") return json(await setOwnPhone(user, String((await readJson(request)).phone ?? "")));
    if (request.method === "POST" && path === "/api/employees") return json(await addEmployee(user, await readJson(request)));
    const staffPin = path.match(/^\/api\/employees\/([^/]+)\/pin$/);
    if (request.method === "POST" && staffPin) return json(await setEmployeePin(user, staffPin[1], String((await readJson(request)).pin ?? "")));
    const staffPhone = path.match(/^\/api\/employees\/([^/]+)\/phone$/);
    if (request.method === "POST" && staffPhone) return json(await setEmployeePhone(user, staffPhone[1], String((await readJson(request)).phone ?? "")));
    if (request.method === "PATCH" && path === "/api/shop") return json(await renameShop(user, String((await readJson(request)).name ?? "")));
    const loanPatch = path.match(/^\/api\/loans\/([^/]+)$/);
    if (request.method === "PATCH" && loanPatch) return json(await repayLoan(user, loanPatch[1], await readJson(request)));
    const voidMatch = path.match(/^\/api\/transactions\/([^/]+)\/void$/);
    if (request.method === "POST" && voidMatch) return json(await voidTransaction(user, voidMatch[1]));
    if (request.method === "PATCH" || request.method === "DELETE") return json({ error: "forbidden" }, user.role === "admin" ? 405 : 403);
    return json({ error: "not_found" }, 404);
  } catch (error) {
    return fail(error);
  }
}
