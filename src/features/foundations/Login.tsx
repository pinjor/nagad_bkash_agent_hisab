import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { db, newId, type DoorPerson } from './db';
import { Keypad } from './Keypad';
import { api, ApiError } from './sync';

type DoorShop = { id: string; name: string; people: DoorPerson[] };

function authError(cause: unknown) {
  if (!(cause instanceof ApiError)) return 'সেভ হয়নি। আবার চেষ্টা করুন।';
  if (cause.status === 401 || cause.message === 'bad_login') return 'পিন মিলেনি';
  if (cause.message === 'shop_exists') return 'এই দোকান আছে। নিজের নাম চাপুন।';
  if (cause.message === 'name_taken') return 'এই নাম আছে';
  return 'সেভ হয়নি। আবার চেষ্টা করুন।';
}

function holdForOpen() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise((resolve) => window.setTimeout(resolve, reduce ? 0 : 420));
}

function roleLabel(role: DoorPerson['role']) {
  return role === 'admin' ? 'মালিক' : 'কর্মী';
}

async function remember(shopName: string, person: string, shopId: string, role: 'admin' | 'employee' = 'admin', people?: DoorPerson[]) {
  await db.settings.update('main', { shop_name: shopName, shop_id: shopId, ...(role === 'admin' ? { owner_name: person } : {}), ...(people ? { door_people: people } : {}), updated_at: Date.now() });
}

export function Login({ online }: { online: boolean }) {
  const [ready, setReady] = useState(true);
  const [shops, setShops] = useState<DoorShop[]>([]);
  const [shop, setShop] = useState('');
  const [name, setName] = useState('');
  const [shopId, setShopId] = useState('');
  const [personId, setPersonId] = useState('');
  const [pickingShop, setPickingShop] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const sent = useRef('');
  const wrongGen = useRef(0);
  const saved = useLiveQuery(() => db.settings.get('main'));
  const chosen = shops.find((row) => row.id === shopId);
  const person = ready ? chosen?.people.find((row) => row.id === personId) : undefined;
  const shopName = chosen?.name || (saved?.shop_name ?? '').trim();
  useEffect(() => {
    if (shops.length || !saved?.shop_id || !saved.door_people?.length) return;
    setShops([{ id: saved.shop_id, name: saved.shop_name, people: saved.door_people }]);
    setShopId(saved.shop_id);
    const last = saved.door_people.find((row) => row.name === saved.owner_name);
    if (last) setPersonId(last.id);
  }, [saved, shops.length]);
  useEffect(() => {
    if (!online) return;
    api<{ ready: boolean; shops?: DoorShop[] }>('/api/setup').then((row) => {
      setReady(row.ready);
      if (row.shops?.length) setShops(row.shops);
    }).catch(() => setReady(true));
  }, [online]);
  useEffect(() => {
    if (!ready || !shops.length || pickingShop) return;
    const byId = shops.find((row) => row.id === (shopId || saved?.shop_id));
    const named = shops.filter((row) => row.name && row.name === (saved?.shop_name ?? '').trim());
    const match = byId ?? (named.length === 1 ? named[0] : undefined) ?? (shops.length === 1 ? shops[0] : undefined);
    if (!match) return;
    if (shopId !== match.id) setShopId(match.id);
    if (!personId) {
      const last = match.people.find((row) => row.name === (saved?.owner_name ?? '').trim());
      if (last) setPersonId(last.id);
    }
    if (saved && (saved.shop_id !== match.id || !saved.door_people?.length)) {
      void db.settings.update('main', { shop_id: match.id, shop_name: match.name, door_people: match.people, updated_at: Date.now() });
    }
  }, [ready, shops, saved, shopId, personId, pickingShop]);
  async function submit() {
    if (pin.length !== 4 || busy || wrong) return;
    if (!ready && (!shop.trim() || !name.trim())) return;
    if (ready && !personId) return;
    setBusy(true); setError('');
    try {
      if (!ready) {
        const user_id = newId(); const newShop = newId(); const device_id = newId();
        const shopName = shop.trim(); const personName = name.trim();
        if (!online) {
          await remember(shopName, personName, newShop);
          setOpening(true);
          await holdForOpen();
          await db.session.put({ id: 'main', token: '', role: 'admin', user_id, shop_id: newShop, name: personName, shop_name: shopName, pending: true, pin, device_id });
          return;
        }
        const result = await api<{ token: string; role: 'admin'; user_id: string; shop_id: string; name: string; shop_name: string }>('/api/register', { method: 'POST', body: JSON.stringify({ shop_id: newShop, shop_name: shopName, user_id, name: personName, pin }) });
        await remember(result.shop_name, result.name, result.shop_id);
        setOpening(true);
        await holdForOpen();
        await db.session.put({ id: 'main', token: result.token, role: 'admin', user_id: result.user_id, shop_id: result.shop_id, name: result.name, shop_name: result.shop_name, pending: false, device_id });
      } else {
        if (!online) { setError('ঢুকতে ইন্টারনেট লাগবে'); return; }
        const result = await api<{ token: string; role: 'admin' | 'employee'; user_id: string; shop_id: string; name: string; shop_name: string }>('/api/login', { method: 'POST', body: JSON.stringify({ user_id: personId, pin }) });
        await remember(result.shop_name, result.name, result.shop_id, result.role, chosen?.people);
        setOpening(true);
        await holdForOpen();
        await db.session.put({ id: 'main', token: result.token, role: result.role, user_id: result.user_id, shop_id: result.shop_id, name: result.name, shop_name: result.shop_name, pending: false, device_id: newId() });
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
    if (wrong || busy || (!ready && (!shop.trim() || !name.trim())) || (ready && !personId)) return;
    const key = `${ready}:${personId}:${pin}`;
    if (sent.current === key) return;
    sent.current = key;
    void submit();
  }, [pin, ready, shop, name, personId, wrong, busy]);
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
    setPersonId('');
    changePin('');
    if (row) void db.settings.update('main', { shop_id: row.id, shop_name: row.name, door_people: row.people, updated_at: Date.now() });
  }
  function choosePerson(id: string) {
    const row = chosen?.people.find((item) => item.id === id);
    setPersonId(id);
    changePin('');
    if (row) void db.settings.update('main', { owner_name: row.name, updated_at: Date.now() });
  }
  const showShops = ready && (pickingShop || !chosen);
  const showPeople = ready && Boolean(chosen) && !pickingShop;
  const dots = wrong ? 'pin-dots wrong' : opening ? 'pin-dots opening' : busy ? 'pin-dots checking' : 'pin-dots';
  return <main className={opening ? 'lock-screen opening' : 'lock-screen'}><div className="lock-inner auth-card">
    <h1>{!ready ? 'আমার হিসাব' : showShops ? 'কোন দোকান' : (shopName || 'আমার হিসাব')}</h1>
    {!ready && <div className="auth-fields">
      <label>দোকানের নাম<input className="text-input" aria-label="দোকানের নাম" placeholder="যেমন আমার দোকান" value={shop} onChange={(event) => setShop(event.target.value)} maxLength={60} /></label>
      <label>আপনার নাম<input className="text-input" aria-label="নাম" placeholder="যেমন রহিম" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} /></label>
    </div>}
    {showShops && <div className="auth-shops">{shops.map((row) => <button key={row.id} type="button" className="auth-person" onClick={() => chooseShop(row.id)}><strong>{row.name}</strong><small>{row.people.map((item) => item.name).join(' · ')}</small></button>)}</div>}
    {showPeople && <div className="auth-people" role="listbox" aria-label="কে ঢুকছেন">{chosen?.people.map((row) => <button key={row.id} type="button" role="option" aria-selected={row.id === personId} className={row.id === personId ? 'auth-person on' : 'auth-person'} onClick={() => choosePerson(row.id)}><strong>{row.name}</strong><small>{roleLabel(row.role)}</small></button>)}</div>}
    {(person || !ready) && <div className="auth-pin">
      <p className="auth-pin-label">{person ? `${person.name} এর পিন` : '৪ সংখ্যার পিন'}</p>
      <div key={shake} className={dots} aria-label={wrong ? 'পিন মিলেনি' : `${pin.length}টি সংখ্যা`}>{Array.from({ length: 4 }, (_, i) => <span key={i} className={i < pin.length ? 'filled' : ''} />)}</div>
      <Keypad value={pin} onChange={changePin} pin />
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="auth-pin-status" aria-live="polite">{busy && !opening ? (ready ? 'ঢুকছে…' : 'খুলছে…') : opening ? 'খুলছে…' : '৪ সংখ্যা দিলেই ঢুকবে'}</p>
      {!ready && <Button variant="ledger" size="primary" disabled={pin.length !== 4 || !shop.trim() || !name.trim() || busy || wrong} onClick={submit}>দোকান খুলুন</Button>}
    </div>}
    {showPeople && !person && <p className="auth-pin-label">নিজের নাম চাপুন, তারপর পিন দিন</p>}
    {showPeople && shops.length > 1 && <button type="button" className="auth-other" onClick={() => { setPickingShop(true); setPersonId(''); changePin(''); }}>অন্য দোকান</button>}
  </div></main>;
}
