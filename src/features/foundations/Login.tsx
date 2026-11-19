import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { db, newId } from './db';
import { Keypad } from './Keypad';
import { normalizeDigits } from './money';
import { api, ApiError } from './sync';

type DoorShop = { id: string; name: string };

function authError(cause: unknown) {
  if (!(cause instanceof ApiError)) return 'সেভ হয়নি। আবার চেষ্টা করুন।';
  if (cause.status === 401 || cause.message === 'bad_login') return 'পিন মিলেনি';
  if (cause.message === 'shop_exists') return 'এই দোকান আছে। ফোন নম্বর লিখুন।';
  if (cause.message === 'name_taken') return 'এই নাম আছে';
  if (cause.message === 'phone_taken') return 'এই ফোন আছে';
  if (cause.message === 'bad_phone') return 'ফোন নম্বর ১১ সংখ্যা, ০১ দিয়ে';
  return 'সেভ হয়নি। আবার চেষ্টা করুন।';
}

function phoneDigits(value: string) {
  return normalizeDigits(value).replace(/\D/g, '').slice(0, 11);
}

function phoneOk(value: string) {
  return /^01\d{9}$/.test(phoneDigits(value));
}

function holdForOpen() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise((resolve) => window.setTimeout(resolve, reduce ? 0 : 420));
}

async function remember(shopName: string, person: string, shopId: string, role: 'admin' | 'employee' = 'admin') {
  await db.settings.update('main', { shop_name: shopName, shop_id: shopId, ...(role === 'admin' ? { owner_name: person } : {}), updated_at: Date.now() });
}

export function Login({ online }: { online: boolean }) {
  const [ready, setReady] = useState(true);
  const [shops, setShops] = useState<DoorShop[]>([]);
  const [shop, setShop] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopId, setShopId] = useState('');
  const [pickingShop, setPickingShop] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [door, setDoor] = useState<'login' | 'signup' | null>(null);
  const sent = useRef('');
  const wrongGen = useRef(0);
  const saved = useLiveQuery(() => db.settings.get('main'));
  const chosen = shops.find((row) => row.id === shopId);
  const signingUp = door === 'signup' || (door === null && !ready);
  const showShops = !signingUp && ready && shops.length > 1 && (pickingShop || !shopId);
  const shopName = chosen?.name || (saved?.shop_name ?? '').trim();
  useEffect(() => {
    if (shops.length || !saved?.shop_id) return;
    setShops([{ id: saved.shop_id, name: saved.shop_name }]);
    setShopId(saved.shop_id);
  }, [saved, shops.length]);
  useEffect(() => {
    if (!online) return;
    api<{ ready: boolean; shops?: DoorShop[] }>('/api/setup').then((row) => {
      setReady(row.ready);
      if (row.shops?.length) setShops(row.shops.map((item) => ({ id: item.id, name: item.name })));
    }).catch(() => setReady(true));
  }, [online]);
  useEffect(() => {
    if (!ready || !shops.length || pickingShop) return;
    const byId = shops.find((row) => row.id === (shopId || saved?.shop_id));
    const named = shops.filter((row) => row.name && row.name === (saved?.shop_name ?? '').trim());
    const match = byId ?? (named.length === 1 ? named[0] : undefined) ?? (shops.length === 1 ? shops[0] : undefined);
    if (!match) return;
    if (shopId !== match.id) setShopId(match.id);
    if (saved && saved.shop_id !== match.id) {
      void db.settings.update('main', { shop_id: match.id, shop_name: match.name, updated_at: Date.now() });
    }
  }, [ready, shops, saved, shopId, pickingShop]);
  async function submit() {
    if (pin.length !== 4 || busy || wrong) return;
    if (signingUp && (!shop.trim() || !name.trim() || !phoneOk(phone))) return;
    if (!signingUp && (!phoneOk(phone) || (shops.length > 1 && !shopId))) return;
    setBusy(true); setError('');
    try {
      if (signingUp) {
        const user_id = newId(); const newShop = newId(); const device_id = newId();
        const shopName = shop.trim(); const personName = name.trim(); const ownPhone = phoneDigits(phone);
        if (!online) {
          await remember(shopName, personName, newShop);
          setOpening(true);
          await holdForOpen();
          await db.session.put({ id: 'main', token: '', role: 'admin', user_id, shop_id: newShop, name: personName, phone: ownPhone, shop_name: shopName, pending: true, pin, device_id });
          return;
        }
        const result = await api<{ token: string; role: 'admin'; user_id: string; shop_id: string; name: string; shop_name: string }>('/api/register', { method: 'POST', body: JSON.stringify({ shop_id: newShop, shop_name: shopName, user_id, name: personName, phone: ownPhone, pin }) });
        await remember(result.shop_name, result.name, result.shop_id);
        setOpening(true);
        await holdForOpen();
        await db.session.put({ id: 'main', token: result.token, role: 'admin', user_id: result.user_id, shop_id: result.shop_id, name: result.name, shop_name: result.shop_name, pending: false, device_id });
      } else {
        if (!online) { setError('ঢুকতে ইন্টারনেট লাগবে'); return; }
        const result = await api<{ token: string; role: 'admin' | 'employee'; user_id: string; shop_id: string; name: string; shop_name: string }>('/api/login', { method: 'POST', body: JSON.stringify({ phone: phoneDigits(phone), pin, ...(shopId ? { shop_id: shopId } : {}) }) });
        await remember(result.shop_name, result.name, result.shop_id, result.role);
        setOpening(true);
        await holdForOpen();
        await db.session.put({ id: 'main', token: result.token, role: result.role, user_id: result.user_id, shop_id: result.shop_id, name: result.name, shop_name: result.shop_name, pending: false, device_id: newId() });
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.message === 'shop_exists') { setReady(true); setDoor('login'); }
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
    if (wrong || busy || showShops) return;
    const need = signingUp && (!shop.trim() || !name.trim()) ? 'আগে দোকান আর নিজের নাম লিখুন' : !phone.trim() ? 'আগে ফোন নম্বর লিখুন' : !phoneOk(phone) ? 'ফোন নম্বর ১১ সংখ্যা, ০১ দিয়ে' : '';
    if (need) {
      const gen = ++wrongGen.current;
      setError(need);
      setWrong(true);
      setShake((n) => n + 1);
      window.setTimeout(() => {
        if (wrongGen.current !== gen) return;
        setPin('');
        setWrong(false);
      }, 650);
      return;
    }
    const key = `${signingUp}:${shopId}:${phoneDigits(phone)}:${pin}`;
    if (sent.current === key) return;
    sent.current = key;
    void submit();
  }, [pin, signingUp, shop, name, phone, shopId, wrong, busy, showShops]);
  function changePin(next: string) {
    if (busy || opening) return;
    wrongGen.current += 1;
    setWrong(false);
    setError('');
    setPin(next);
  }
  function chooseShop(id: string) {
    const row = shops.find((item) => item.id === id);
    setShopId(id);
    setPickingShop(false);
    setName('');
    setPhone('');
    changePin('');
    if (row) void db.settings.update('main', { shop_id: row.id, shop_name: row.name, updated_at: Date.now() });
  }
  const dots = wrong ? 'pin-dots wrong' : opening ? 'pin-dots opening' : busy ? 'pin-dots checking' : 'pin-dots';
  return <main className={opening ? 'lock-screen opening' : 'lock-screen'}><div className="lock-inner auth-card">
    <h1>{signingUp ? 'আমার হিসাব' : (shopName || 'আমার হিসাব')}</h1>
    {!showShops && <p className="auth-lead">{signingUp ? 'দোকানের নাম, নিজের নাম, ফোন, তারপর পিন' : 'ফোন নম্বর লিখুন, তারপর পিন'}</p>}
    {signingUp && <div className="auth-fields">
      <label>দোকানের নাম<input className="text-input" aria-label="দোকানের নাম" placeholder="যেমন আমার দোকান" value={shop} onChange={(event) => setShop(event.target.value)} maxLength={60} /></label>
      <label>নাম<input className="text-input" aria-label="নাম" placeholder="যেমন রহিম" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="name" /></label>
    </div>}
    {showShops && <div className="auth-shops" role="listbox" aria-label="কোন দোকান">{shops.map((row) => <button key={row.id} type="button" className="auth-shop" onClick={() => chooseShop(row.id)}><strong>{row.name}</strong></button>)}</div>}
    {!showShops && <div className="auth-pin">
      <label className="auth-name">ফোন<input className="text-input" aria-label="ফোন" placeholder="যেমন ০১৭১১০০০০০০" inputMode="tel" enterKeyHint="done" value={phone} onChange={(event) => setPhone(phoneDigits(event.target.value))} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} maxLength={11} autoComplete="tel" /></label>
      <p className="auth-pin-label">৪ সংখ্যার পিন</p>
      <div key={shake} className={dots} aria-label={wrong ? 'পিন মিলেনি' : `${pin.length}টি সংখ্যা`}>{Array.from({ length: 4 }, (_, i) => <span key={i} className={i < pin.length ? 'filled' : ''} />)}</div>
      <Keypad value={pin} onChange={changePin} pin />
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="auth-pin-status" aria-live="polite">{busy && !opening ? (signingUp ? 'খুলছে…' : 'ঢুকছে…') : opening ? 'খুলছে…' : '৪ সংখ্যা দিলেই ঢুকবে'}</p>
      {signingUp && <Button variant="ledger" size="primary" disabled={pin.length !== 4 || !shop.trim() || !name.trim() || !phoneOk(phone) || busy || wrong} onClick={submit}>দোকান খুলুন</Button>}
      {!signingUp && <Button variant="ledger" size="primary" disabled={pin.length !== 4 || !phoneOk(phone) || busy || wrong} onClick={submit}>ঢুকুন</Button>}
    </div>}
    {!signingUp && shops.length > 1 && !showShops && <button type="button" className="auth-other" onClick={() => { setPickingShop(true); setPhone(''); changePin(''); }}>অন্য দোকান</button>}
    <div className="auth-door"><span>অথবা</span><button type="button" disabled={busy || opening} onClick={() => { setDoor(signingUp ? 'login' : 'signup'); setPickingShop(false); setError(''); changePin(''); }}>{signingUp ? 'দোকান আছে' : 'নতুন দোকান'}</button></div>
  </div></main>;
}
