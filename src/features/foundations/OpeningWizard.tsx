import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Pencil, LockKeyhole, Wallet, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Keypad } from './Keypad';
import { hashPin } from './security';
import { seedPockets, saveOpening } from './db';
import { PocketMark } from './PocketMark';
import { number, taka, toPaisa } from './money';
import { useHisab } from './Provider';
export function OpeningWizard({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { settings, speak } = useHisab(); const digits = settings?.digits ?? 'bn';
  const [step, setStep] = useState(-1); const [shop, setShop] = useState(settings?.shop_name ?? 'আমার দোকান');
  const [amounts, setAmounts] = useState<Record<string, number>>({}); const [value, setValue] = useState('');
  const [pin, setPin] = useState(''); const [hash, setHash] = useState<{ hash: string; salt: string }>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const pockets = seedPockets.length; const pinStep = pockets; const againStep = pockets + 1; const reviewStep = pockets + 2;
  const pocket = seedPockets[step]; const total = Object.values(amounts).reduce((a,b) => a+b, 0);
  async function next() {
    setError('');
    if (step === -1) { setStep(0); setValue(''); return; }
    if (step < pockets && pocket) { const nextAmounts = { ...amounts, [pocket.id]: toPaisa(value || '0') }; setAmounts(nextAmounts); setStep(step + 1); setValue(''); return; }
    if (step === pinStep) { if (value.length !== 4) return; setPin(value); setStep(againStep); setValue(''); return; }
    if (step === againStep) {
      if (value !== pin) { setError('পিন মেলেনি। আবার দিন।'); setValue(''); return; }
      setBusy(true); try { setHash(await hashPin(pin)); setStep(reviewStep); speak(`শুরুর মোট টাকা ${taka(total, digits)}। ঠিক থাকলে ঠিক আছে চাপুন।`); } finally { setBusy(false); } return;
    }
    if (!hash) return;
    setBusy(true); try { onSaved(await saveOpening(amounts, shop, hash.hash, hash.salt)); } catch { setError('সেভ হয়নি। স্টোরেজ পরীক্ষা করে আবার চেষ্টা করুন।'); } finally { setBusy(false); }
  }
  const back = () => { setError(''); const prev = step === reviewStep ? 0 : step - 1; setStep(prev); setValue(prev >= 0 && prev < pockets ? String((amounts[seedPockets[prev].id] ?? 0) / 100) : ''); };
  return <div className="modal-shade"><section className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <div className="wizard-header"><Button variant="ghost" size="touch" aria-label="পেছনে" disabled={step === -1} onClick={back}><ArrowLeft /></Button><span>শুরুর হিসাব · {number(Math.max(1, step + 2), digits)}/{number(pockets + 4, digits)}</span><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={onClose}><X /></Button></div>
    <div className="wizard-content">
    <div className={`wizard-symbol ${pocket?.color ?? 'cash'}`}>{step === pinStep || step === againStep ? <LockKeyhole /> : pocket ? <PocketMark id={pocket.id} /> : <Wallet />}</div>
    <h2 id="wizard-title">{step === -1 ? 'দোকানের নাম' : pocket ? `${pocket.name_bn} কত আছে?` : step === pinStep ? 'নতুন পিন দিন' : step === againStep ? 'আবার পিন দিন' : 'হিসাব ঠিক আছে?'}</h2>
    {step === -1 ? <input className="text-input" aria-label="দোকানের নাম" placeholder="যেমন আমার দোকান" value={shop} onChange={e => setShop(e.target.value)} maxLength={60} /> : step < pockets ? <>
      <div className="amount-display">{taka(toPaisa(value || '0'), digits)}</div><Keypad value={value} onChange={setValue} digits={digits} />
    </> : step < reviewStep ? <><div className="pin-dots">{Array.from({ length: 4 }, (_, i) => <span className={i < value.length ? 'filled' : ''} key={i} />)}</div><Keypad value={value} onChange={setValue} pin digits={digits} /></> : <>
      <div className="confirmation"><h3>{shop}</h3>{seedPockets.map(p => <div key={p.id}><span className={p.color}><PocketMark id={p.id} />{p.name_bn}</span><strong>{taka(amounts[p.id] ?? 0, digits)}</strong></div>)}<div className="confirmation-total"><span>আমার মোট টাকা</span><strong>{taka(total, digits)}</strong></div></div>
      <Button variant="ghost" size="touch" onClick={() => speak(`মোট টাকা ${taka(total, digits)}`)}><Volume2 />শুনুন</Button>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <Button variant="ledger" size="primary" onClick={next} disabled={busy || (step === -1 && !shop.trim()) || ((step === pinStep || step === againStep) && value.length !== 4)}>{step === reviewStep ? <Check /> : <ArrowRight />}{step === reviewStep ? 'ঠিক আছে' : 'পরের ধাপ'}</Button>
    {step === reviewStep && <Button variant="secondary" size="primary" onClick={back}><Pencil />ঠিক করুন</Button>}
    </div>
  </section></div>;
}
