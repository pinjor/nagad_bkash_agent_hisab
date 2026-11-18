import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from './db';
import { Keypad } from './Keypad';
import { api, ApiError } from './sync';

function authError(cause: unknown) {
  if (!(cause instanceof ApiError)) return 'সেভ হয়নি। আবার চেষ্টা করুন।';
  if (cause.status === 401 || cause.message === 'bad_login') return 'ভুল';
  if (cause.message === 'shop_exists') return 'এই দোকান আছে। ঢুকুন চাপুন।';
  if (cause.message === 'name_taken') return 'এই নাম আছে';
  return 'সেভ হয়নি। আবার চেষ্টা করুন।';
}

async function remember(shopName: string, person: string) {
  await db.settings.update('main', { shop_name: shopName, owner_name: person, updated_at: Date.now() });
}

export function Login({ online }: { online: boolean }) {
  const [ready, setReady] = useState(true);
  const [shop, setShop] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const sent = useRef('');
  const wrongGen = useRef(0);
  useEffect(() => {
    if (!online) return;
    api<{ ready: boolean }>('/api/setup').then((row) => setReady(row.ready)).catch(() => setReady(true));
  }, [online]);
  async function submit() {
    if (pin.length !== 4 || busy || wrong) return;
    if (!ready && (!shop.trim() || !name.trim())) return;
    setBusy(true); setError('');
    try {
      if (!ready) {
        const user_id = crypto.randomUUID(); const shop_id = crypto.randomUUID(); const device_id = crypto.randomUUID();
        const shopName = shop.trim(); const person = name.trim();
        if (!online) {
          await remember(shopName, person);
          await db.session.put({ id: 'main', token: '', role: 'admin', user_id, shop_id, name: person, shop_name: shopName, pending: true, pin, device_id });
          return;
        }
        const result = await api<{ token: string; role: 'admin'; user_id: string; shop_id: string; name: string; shop_name: string }>('/api/register', { method: 'POST', body: JSON.stringify({ shop_id, shop_name: shopName, user_id, name: person, pin }) });
        await remember(result.shop_name, result.name);
        await db.session.put({ id: 'main', token: result.token, role: 'admin', user_id: result.user_id, shop_id: result.shop_id, name: result.name, shop_name: result.shop_name, pending: false, device_id });
      } else {
        if (!online) { setError('ঢুকতে ইন্টারনেট লাগবে'); return; }
        const result = await api<{ token: string; role: 'admin' | 'employee'; user_id: string; shop_id: string; name: string; shop_name: string }>('/api/login', { method: 'POST', body: JSON.stringify({ pin }) });
        await remember(result.shop_name, result.name);
        await db.session.put({ id: 'main', token: result.token, role: result.role, user_id: result.user_id, shop_id: result.shop_id, name: result.name, shop_name: result.shop_name, pending: false, device_id: crypto.randomUUID() });
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.message === 'shop_exists') setReady(true);
      const gen = ++wrongGen.current;
      setError(authError(cause));
      setWrong(true);
      setShake((n) => n + 1);
      window.setTimeout(() => {
        if (wrongGen.current !== gen) return;
        setPin('');
        setWrong(false);
      }, 650);
    } finally { setBusy(false); }
  }
  useEffect(() => {
    if (pin.length < 4) { sent.current = ''; return; }
    if (wrong || busy || (!ready && (!shop.trim() || !name.trim()))) return;
    const key = `${ready}:${pin}`;
    if (sent.current === key) return;
    sent.current = key;
    void submit();
  }, [pin, ready, shop, name, wrong, busy]);
  function changePin(next: string) {
    wrongGen.current += 1;
    setWrong(false);
    setError('');
    setPin(next);
  }
  return <main className="lock-screen"><div className="lock-inner auth-card">
    <div className="brand-mark"><BookOpen /></div>
    <h1>আমার হিসাব</h1>
    {!ready && <div className="auth-fields">
      <label>দোকানের নাম<input className="text-input" aria-label="দোকানের নাম" placeholder="যেমন আমার দোকান" value={shop} onChange={(event) => setShop(event.target.value)} maxLength={60} /></label>
      <label>আপনার নাম<input className="text-input" aria-label="নাম" placeholder="যেমন রহিম" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} /></label>
    </div>}
    <p className="auth-pin-label">৪ সংখ্যার পিন</p>
    <div key={shake} className={wrong ? 'pin-dots wrong' : 'pin-dots'} aria-label={wrong ? 'ভুল' : `${pin.length}টি সংখ্যা`}>{Array.from({ length: 4 }, (_, i) => <span key={i} className={i < pin.length ? 'filled' : ''} />)}</div>
    <Keypad value={pin} onChange={changePin} pin />
    {error && <p className="form-error" role="alert">{error}</p>}
    <Button variant="ledger" size="primary" disabled={pin.length !== 4 || (!ready && (!shop.trim() || !name.trim())) || busy || wrong} onClick={submit}>{ready ? 'ঢুকুন' : 'দোকান খুলুন'}</Button>
  </div></main>;
}
