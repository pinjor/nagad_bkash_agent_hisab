import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { LockKeyhole, ShoppingBag, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, newId } from './db';
import { Keypad } from './Keypad';
import { normalizeDigits } from './money';
import { api, ApiError } from './sync';

function authError(cause: unknown) {
  if (!(cause instanceof ApiError)) return 'সেভ হয়নি। আবার চেষ্টা করুন।';
  if (cause.status === 401 || cause.message === 'bad_login') return 'পিন মিলেনি';
  if (cause.message === 'bad_phone') return 'ফোন নম্বর ১১ সংখ্যা, ০১ দিয়ে';
  return 'সেভ হয়নি। আবার চেষ্টা করুন।';
}

function phoneDigits(value: string) {
  return normalizeDigits(value).replace(/\D/g, '').slice(0, 11);
}

function phoneOk(value: string) {
  return /^01\d{9}$/.test(phoneDigits(value));
}

export function Login({ online }: { online: boolean }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pad, setPad] = useState<'phone' | 'pin'>('phone');
  const go = useNavigate();
  const sent = useRef('');
  const wrongGen = useRef(0);
  async function submit() {
    if (pin.length !== 4 || busy || wrong) return;
    if (!phoneOk(phone)) return;
    setBusy(true); setError('');
    try {
      if (!online) { setError('ঢুকতে ইন্টারনেট লাগবে'); return; }
      const result = await api<{ token: string; role: 'admin' | 'employee'; user_id: string; shop_id: string; name: string; shop_name: string }>('/api/login', { method: 'POST', body: JSON.stringify({ phone: phoneDigits(phone), pin }) });
      await db.settings.update('main', { shop_name: result.shop_name, shop_id: result.shop_id, ...(result.role === 'admin' ? { owner_name: result.name } : {}), updated_at: Date.now() });
      await db.session.put({ id: 'main', token: result.token, role: result.role, user_id: result.user_id, shop_id: result.shop_id, name: result.name, shop_name: result.shop_name, pending: false, device_id: newId() });
      await go({ to: '/' });
    } catch (cause) {
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
    if (wrong || busy) return;
    const need = !phone.trim() ? 'আগে ফোন নম্বর লিখুন' : !phoneOk(phone) ? 'ফোন নম্বর ১১ সংখ্যা, ০১ দিয়ে' : '';
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
    const key = `${phoneDigits(phone)}:${pin}`;
    if (sent.current === key) return;
    sent.current = key;
    void submit();
  }, [pin, phone, wrong, busy]);
  function changePin(next: string) {
    if (busy) return;
    wrongGen.current += 1;
    setWrong(false);
    setError('');
    setPin(next.slice(0, 4));
  }
  function onPad(next: string) {
    if (pad === 'phone') {
      const typed = phoneDigits(next);
      setPhone(typed);
      if (typed.length === 11) setPad('pin');
      return;
    }
    changePin(next);
  }
  const dots = wrong ? 'pin-dots wrong' : busy ? 'pin-dots checking' : 'pin-dots';
  return <main className="lock-screen"><div className="login-shell">
    <aside className="login-art" aria-hidden="true">
      <div className="login-art-card">
        <ShoppingBag />
        <span>দোকানের হিসাব</span>
      </div>
    </aside>
    <div className="lock-inner auth-card">
      <span className="login-badge" aria-hidden><ShoppingBag /></span>
      <h1>আমার হিসাব</h1>
      <p className="auth-lead">ফোন নম্বর লিখুন, তারপর পিন</p>
      <p className="need-label">ফোন<i className="need" aria-hidden>*</i></p>
      <label className={`login-field${pad === 'phone' ? ' on' : ''}`}><span onClick={() => setPad('phone')}><Smartphone /><input className="text-input" aria-label="ফোন" placeholder="যেমন ০১৭১১০০০০০০" inputMode="none" enterKeyHint="done" value={phone} onFocus={() => setPad('phone')} onChange={(event) => setPhone(phoneDigits(event.target.value))} maxLength={11} autoComplete="tel" /></span></label>
      <div className="auth-pin">
        <p className="need-label">পিন<i className="need" aria-hidden>*</i></p>
        <div key={shake} className={`login-pin${wrong ? ' wrong' : ''}${pad === 'pin' ? ' on' : ''}`} onClick={() => setPad('pin')}>
          <LockKeyhole />
          {pin.length === 0 ? <span className="login-pin-hint">৪ সংখ্যার পিন</span> : <span className={dots} aria-label={wrong ? 'পিন মিলেনি' : `${pin.length}টি সংখ্যা`}>{Array.from({ length: 4 }, (_, i) => <span key={i} className={i < pin.length ? 'filled' : ''} />)}</span>}
        </div>
        <Keypad value={pad === 'phone' ? phoneDigits(phone) : pin} onChange={onPad} pin={pad === 'pin'} quick={[]} max={pad === 'phone' ? 11 : 4} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button className="login-go" variant="ledger" size="primary" disabled={pin.length !== 4 || !phoneOk(phone) || busy || wrong} onClick={submit}>ঢুকুন</Button>
      </div>
    </div>
  </div></main>;
}
