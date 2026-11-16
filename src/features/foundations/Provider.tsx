import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initialize, type Settings } from './db';
import { balances } from './money';
import { BACKGROUND_LOCK_MS } from './security';
import { PinLock } from './PinLock';
import { registerOffline } from './pwa';
interface AppState { settings?: Settings; ready: boolean; totals: Record<string, number>; hidden: boolean; setHidden: (value: boolean) => void; lock: () => void; storage: string; online: boolean; error: string; speak: (text: string) => void }
const AppContext = createContext<AppState | null>(null);
export function useHisab() { const state = useContext(AppContext); if (!state) throw new Error('Missing Hisab provider'); return state; }
export function HisabProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false); const [locked, setLocked] = useState(false);
  const [storage, setStorage] = useState('যাচাই হচ্ছে'); const [online, setOnline] = useState(true);
  const data = useLiveQuery(async () => ready ? { settings: await db.settings.get('main'), pockets: await db.pockets.toArray(), txns: await db.transactions.toArray(), legs: await db.txn_legs.toArray() } : undefined, [ready]);
  useEffect(() => {
    initialize().then(async () => { const s = await db.settings.get('main'); setLocked(Boolean(s?.pin_hash)); setHidden(s?.privacy_default ?? false); setReady(true); }).catch(() => setError('হিসাব খুলতে সমস্যা হয়েছে। ব্রাউজারের স্টোরেজ দেখুন।'));
    const connected = () => setOnline(navigator.onLine); connected();
    window.addEventListener('online', connected); window.addEventListener('offline', connected);
    if (navigator.storage?.persist) navigator.storage.persist().then(ok => setStorage(ok ? 'স্থায়ী স্টোরেজ চালু' : 'স্থায়ী স্টোরেজ মেলেনি — ব্রাউজারের ডেটা মুছবেন না')).catch(() => setStorage('স্টোরেজ যাচাই করা যায়নি'));
    else setStorage('স্থায়ী স্টোরেজ সমর্থিত নয়');
    void registerOffline();
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', connected); };
  }, []);
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
  return <AppContext.Provider value={{ settings: data?.settings, ready, totals: data ? balances(data.pockets, data.txns, data.legs) : {}, hidden, setHidden, lock: () => setLocked(true), storage, online, error, speak }}>
    {locked && data?.settings?.pin_hash ? <PinLock settings={data.settings} onUnlock={() => { setLocked(false); setHidden(data.settings?.privacy_default ?? false); }} /> : children}
    {error && <div className="status-toast" role="status">{error}</div>}
  </AppContext.Provider>;
}
