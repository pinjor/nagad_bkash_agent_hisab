import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initialize, type CachedLoan, type CachedPerson, type LedgerCache, type Settings } from './db';
import { BACKGROUND_LOCK_MS } from './security';
import { PinLock } from './PinLock';
import { Login } from './Login';
import { registerOffline } from './pwa';
import { ApiError, countPending, syncPending, api, type HomeBalances, type Today } from './sync';
import { mergeLedger } from './ledger-view';

interface AppState { settings?: Settings; ready: boolean; totals: Record<string, number>; hidden: boolean; setHidden: (value: boolean) => void; lock: () => void; storage: string; online: boolean; error: string; serverOk: boolean; speak: (text: string) => void; role: 'admin' | 'employee' | null; pending: number; configured: boolean; today: Today; lendOpen: number; borrowOpen: number; lendCount: number; borrowCount: number; syncNow: () => Promise<void>; authed: boolean; shopName: string }
const AppContext = createContext<AppState | null>(null);
export function useHisab() { const state = useContext(AppContext); if (!state) throw new Error('Missing Hisab provider'); return state; }
export function HisabProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false); const [locked, setLocked] = useState(false);
  const [storage, setStorage] = useState('যাচাই হচ্ছে'); const [online, setOnline] = useState(true); const [serverOk, setServerOk] = useState(true);
  const [server, setServer] = useState<{ balances: HomeBalances; today: Today } | null>(null);
  const [pending, setPending] = useState(0);
  const data = useLiveQuery(async () => ready ? { settings: await db.settings.get('main'), pockets: await db.pockets.toArray(), txns: await db.transactions.toArray(), legs: await db.txn_legs.toArray(), loans: await db.loans.toArray(), events: await db.loan_events.toArray(), session: await db.session.get('main') } : undefined, [ready]);
  const refresh = async () => {
    const [balancesBody, todayBody] = await Promise.all([api<HomeBalances>('/api/balances'), api<Today>('/api/today')]);
    const previous = (await db.settings.get('main'))?.cache;
    let people: CachedPerson[] = previous?.people ?? [];
    let loans: CachedLoan[] = previous?.loans ?? [];
    try {
      [people, loans] = await Promise.all([api<CachedPerson[]>('/api/people'), api<CachedLoan[]>('/api/loans')]);
    } catch { /* phone keeps the last khata copy */ }
    const cache: LedgerCache = { pockets: balancesBody.pockets, today: todayBody, lend_open: balancesBody.lend_open, borrow_open: balancesBody.borrow_open, lend_count: balancesBody.lend_count, borrow_count: balancesBody.borrow_count, configured: balancesBody.configured, people, loans };
    setServer({ balances: balancesBody, today: todayBody });
    await db.settings.update('main', { cache, ...(balancesBody.configured ? { configured: true } : {}) });
  };
  const syncNow = async () => {
    const left = async () => { const count = await countPending(); setPending(count); return count; };
    if (!navigator.onLine) { await left(); setServerOk(false); return; }
    try {
      const result = await syncPending();
      setPending(result.pending);
      if ((await db.session.get('main'))?.token) await refresh();
      setServerOk(true);
    } catch (cause) {
      await left();
      if (cause instanceof ApiError && cause.status === 401) { await db.session.delete('main'); return; }
      setServerOk(false);
    }
  };
  useEffect(() => {
    initialize().then(async () => { const s = await db.settings.get('main'); setLocked(Boolean(s?.pin_hash)); setHidden(s?.privacy_default ?? false); setPending(await countPending()); setReady(true); }).catch(() => setError('হিসাব খুলতে সমস্যা হয়েছে। ব্রাউজারের স্টোরেজ দেখুন।'));
    const connected = () => setOnline(navigator.onLine); connected();
    window.addEventListener('online', connected); window.addEventListener('offline', connected);
    if (navigator.storage?.persist) navigator.storage.persist().then(ok => setStorage(ok ? 'স্থায়ী স্টোরেজ চালু' : 'স্থায়ী স্টোরেজ মেলেনি — ব্রাউজারের ডেটা মুছবেন না')).catch(() => setStorage('স্টোরেজ যাচাই করা যায়নি'));
    else setStorage('স্থায়ী স্টোরেজ সমর্থিত নয়');
    void registerOffline();
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', connected); };
  }, []);
  useEffect(() => {
    const session = data?.session;
    if (!ready || !session?.name) return;
    void db.settings.update('main', { shop_name: session.shop_name, owner_name: session.name, updated_at: Date.now() });
  }, [ready, data?.session?.name, data?.session?.shop_name]);
  useEffect(() => {
    if (!ready || !online || !data?.session) return;
    void syncNow();
    const timer = setInterval(() => { if (navigator.onLine) void syncNow(); }, 15000);
    return () => clearInterval(timer);
  }, [ready, online, data?.session?.token, data?.session?.pending]);
  useEffect(() => {
    let backgroundAt = 0; let timer: ReturnType<typeof setTimeout> | undefined;
    const visibility = () => {
      if (document.hidden) { backgroundAt = Date.now(); timer = setTimeout(() => { if (data?.settings?.pin_hash) setLocked(true); }, BACKGROUND_LOCK_MS); }
      else { if (timer) clearTimeout(timer); if (backgroundAt && Date.now() - backgroundAt >= BACKGROUND_LOCK_MS && data?.settings?.pin_hash) setLocked(true); }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); if (timer) clearTimeout(timer); };
  }, [data?.settings?.pin_hash]);
  const speak = (text: string) => {
    if (!data?.settings?.voice_on || !('speechSynthesis' in window)) return;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('bn'));
    if (!voice) { setError('এই ফোনে বাংলা কণ্ঠ নেই।'); setTimeout(() => setError(''), 4000); return; }
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.voice = voice; utterance.lang = 'bn-BD'; utterance.rate = .9; window.speechSynthesis.speak(utterance);
  };
  const baseline = online && server ? { pockets: server.balances.pockets, today: server.today, lend_open: server.balances.lend_open, borrow_open: server.balances.borrow_open, lend_count: server.balances.lend_count, borrow_count: server.balances.borrow_count, configured: server.balances.configured, people: data?.settings?.cache?.people ?? [], loans: data?.settings?.cache?.loans ?? [] } : data?.settings?.cache;
  const view = mergeLedger(baseline, { pockets: data?.pockets ?? [], transactions: data?.txns ?? [], legs: data?.legs ?? [], loans: data?.loans ?? [], events: data?.events ?? [] });
  const value: AppState = { settings: data?.settings, ready, totals: view.totals, hidden, setHidden, lock: () => setLocked(true), storage, online, error, serverOk, speak, role: data?.session?.role ?? null, pending, configured: view.configured || Boolean(data?.settings?.configured), today: view.today, lendOpen: view.lendOpen, borrowOpen: view.borrowOpen, lendCount: view.lendCount, borrowCount: view.borrowCount, syncNow, authed: Boolean(data?.session), shopName: data?.session?.shop_name || data?.settings?.shop_name || 'আমার দোকান' };
  return <AppContext.Provider value={value}>
    {!ready ? null : !data?.session ? <Login online={online} /> : locked && data.settings?.pin_hash ? <PinLock settings={data.settings} onUnlock={() => { setLocked(false); setHidden(data.settings?.privacy_default ?? false); }} /> : children}
    {error && <div className="status-toast" role="status">{error}</div>}
  </AppContext.Provider>;
}
