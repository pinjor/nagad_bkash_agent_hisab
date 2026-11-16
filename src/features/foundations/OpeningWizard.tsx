import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Pencil, LockKeyhole, Wallet, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Keypad } from './Keypad';
import { hashPin } from './security';
import { seedPockets, saveOpening } from './db';
import { number, taka, toPaisa } from './money';
import { useHisab } from './Provider';
export function OpeningWizard({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { settings, speak } = useHisab(); const digits = settings?.digits ?? 'bn';
  const [step, setStep] = useState(-1); const [shop, setShop] = useState(settings?.shop_name ?? 'আমার দোকান');
  const [amounts, setAmounts] = useState<Record<string, number>>({}); const [value, setValue] = useState('');
  const [pin, setPin] = useState(''); const [hash, setHash] = useState<{ hash: string; salt: string }>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const pocket = seedPockets[step]; const total = Object.values(amounts).reduce((a,b) => a+b, 0);
  async function next() {
    setError('');
    if (step === -1) { setStep(0); setValue(''); return; }
    if (step < 5 && pocket) { const nextAmounts = { ...amounts, [pocket.id]: toPaisa(value || '0') }; setAmounts(nextAmounts); setStep(step + 1); setValue(''); return; }
    if (step === 5) { if (value.length !== 4) return; setPin(value); setStep(6); setValue(''); return; }
    if (step === 6) {
      if (value !== pin) { setError('পিন মেলেনি। আবার দিন।'); setValue(''); return; }
      setBusy(true); try { setHash(await hashPin(pin)); setStep(7); speak(`শুরুর মোট টাকা ${taka(total, digits)}। ঠিক থাকলে ঠিক আছে চাপুন।`); } finally { setBusy(false); } return;
    }
    if (!hash) return;
    setBusy(true); try { onSaved(await saveOpening(amounts, shop, hash.hash, hash.salt)); } catch { setError('সেভ হয়নি। স্টোরেজ পরীক্ষা করে আবার চেষ্টা করুন।'); } finally { setBusy(false); }
  }
  const back = () => { setError(''); const prev = step === 7 ? 0 : step - 1; setStep(prev); setValue(prev >= 0 && prev < 5 ? String((amounts[seedPockets[prev].id] ?? 0) / 100) : ''); };
  return <div className="modal-shade"><section className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <div className="wizard-header"><Button variant="ghost" size="touch" aria-label="পেছনে" disabled={step === -1} onClick={back}><ArrowLeft /></Button><span>শুরুর হিসাব · {number(Math.max(1, step + 2), digits)}/{number(9, digits)}</span><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={onClose}><X /></Button></div>
    <div className="wizard-content">
    <div className={`wizard-symbol ${pocket?.color ?? 'cash'}`}>{step === 5 || step === 6 ? <LockKeyhole /> : <Wallet />}</div>
    <h2 id="wizard-title">{step === -1 ? 'দোকানের নাম' : pocket ? `${pocket.name_bn} কত আছে?` : step === 5 ? 'নতুন পিন দিন' : step === 6 ? 'আবার পিন দিন' : 'হিসাব ঠিক আছে?'}</h2>
    {step === -1 ? <input className="text-input" aria-label="দোকানের নাম" value={shop} onChange={e => setShop(e.target.value)} maxLength={60} /> : step < 5 ? <>
      <div className="amount-display">{taka(toPaisa(value || '0'), digits)}</div><Keypad value={value} onChange={setValue} digits={digits} />
    </> : step < 7 ? <><div className="pin-dots">{Array.from({ length: 4 }, (_, i) => <span className={i < value.length ? 'filled' : ''} key={i} />)}</div><Keypad value={value} onChange={setValue} pin digits={digits} /></> : <>
      <div className="confirmation"><h3>{shop}</h3>{seedPockets.map(p => <div key={p.id}><span className={p.color}><Wallet />{p.name_bn}</span><strong>{taka(amounts[p.id] ?? 0, digits)}</strong></div>)}<div className="confirmation-total"><span>আমার মোট টাকা</span><strong>{taka(total, digits)}</strong></div></div>
      <Button variant="ghost" size="touch" onClick={() => speak(`মোট টাকা ${taka(total, digits)}`)}><Volume2 />শুনুন</Button>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <Button variant="ledger" size="primary" onClick={next} disabled={busy || (step === -1 && !shop.trim()) || ((step === 5 || step === 6) && value.length !== 4)}>{step === 7 ? <Check /> : <ArrowRight />}{step === 7 ? 'ঠিক আছে' : 'পরের ধাপ'}</Button>
    {step === 7 && <Button variant="secondary" size="primary" onClick={back}><Pencil />ঠিক করুন</Button>}
    </div>
  </section></div>;
}
