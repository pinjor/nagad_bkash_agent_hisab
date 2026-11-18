import { useEffect, useState } from 'react';
import { UnlockKeyhole, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Keypad } from './Keypad';
import { db, type Settings } from './db';
import { hashPin, pinFailure } from './security';
import { number } from './money';
export function PinLock({ settings, onUnlock }: { settings: Settings; onUnlock: () => void }) {
  const [pin, setPin] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState(settings.blocked_until); const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const blocked = blockedUntil > now;
  async function unlock() {
    if (pin.length !== 4 || busy || blocked) return;
    setBusy(true);
    try {
      const result = await hashPin(pin, settings.pin_salt);
      if (result.hash === settings.pin_hash) { await db.settings.update('main', { failed_attempts: 0, blocked_until: 0 }); onUnlock(); }
      else { const current = await db.settings.get('main'); const failure = pinFailure(current?.failed_attempts ?? 0, Date.now()); await db.settings.update('main', failure); setBlockedUntil(failure.blocked_until); setError('ভুল পিন — আবার দিন'); setPin(''); }
    } catch { setError('পিন যাচাই করা যায়নি। আবার চেষ্টা করুন।'); }
    finally { setBusy(false); }
  }
  return <main className="lock-screen"><div className="lock-inner auth-card"><h1>{settings.shop_name || 'আমার হিসাব'}</h1><p className="auth-pin-label">পিন দিন</p><div className="pin-dots" aria-label={`${number(pin.length)}টি সংখ্যা`}>{Array.from({ length: 4 }, (_, i) => <span className={i < pin.length ? 'filled' : ''} key={i} />)}</div>
    <div className="form-error" role="status">{blocked ? `${number(Math.ceil((blockedUntil - now) / 1000))} সেকেন্ড অপেক্ষা করুন` : error}</div>
    <Keypad value={pin} onChange={v => { if (!blocked) setPin(v); }} pin digits={settings.digits} />
    <Button variant="ledger" size="primary" disabled={pin.length !== 4 || blocked || busy} onClick={unlock}><UnlockKeyhole />খুলুন</Button>
    <Button variant="ghost" size="touch" aria-label="পিন পড়ুন" onClick={() => { const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('bn')); if (voice) { const u = new SpeechSynthesisUtterance('চার সংখ্যার পিন দিন'); u.voice = voice; speechSynthesis.speak(u); } }}><Volume2 />পিন দিন</Button>
    <p className="lock-note">পিন ভুলে গেলে এই ফোনের ডেটা মুছবেন না।</p>
  </div></main>;
}
