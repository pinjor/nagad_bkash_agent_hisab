import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Pencil, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Keypad } from './Keypad';
import { seedPockets, saveOpening } from './db';
import { PocketMark } from './PocketMark';
import { number, taka, toPaisa } from './money';
import { useHisab } from './Provider';
import { ApiError, api } from './sync';

export function OpeningWizard({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { settings, shopName } = useHisab(); const digits = settings?.digits ?? 'bn';
  const [step, setStep] = useState(0);
  const [amounts, setAmounts] = useState<Record<string, number>>({}); const [value, setValue] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const pockets = seedPockets.length; const pinStep = pockets; const reviewStep = pockets + 1;
  const pocket = seedPockets[step]; const total = Object.values(amounts).reduce((a, b) => a + b, 0);
  const shop = shopName || settings?.shop_name || 'আমার দোকান';
  async function next() {
    setError('');
    if (step < pockets && pocket) { setAmounts({ ...amounts, [pocket.id]: toPaisa(value || '0') }); setStep(step + 1); setValue(''); return; }
    if (step === pinStep) {
      if (value.length !== 4) return;
      setBusy(true);
      try {
        await api('/api/pin/check', { method: 'POST', body: JSON.stringify({ pin: value }) });
        setStep(reviewStep); setValue('');
      } catch (cause) {
        setError(cause instanceof ApiError && cause.message === 'bad_pin' ? 'পিন মিলেনি। আগের পিন দিন।' : 'পিন যাচাই হয়নি।');
        setValue('');
      } finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try { onSaved(await saveOpening(amounts, shop)); } catch { setError('সেভ হয়নি। আবার চেষ্টা করুন।'); } finally { setBusy(false); }
  }
  const back = () => { setError(''); const prev = step === reviewStep ? pinStep : step - 1; setStep(Math.max(0, prev)); setValue(prev >= 0 && prev < pockets ? String((amounts[seedPockets[prev].id] ?? 0) / 100) : ''); };
  return <div className="modal-shade"><section className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <div className="wizard-header"><Button variant="ghost" size="touch" aria-label="পেছনে" disabled={step === 0} onClick={back}><ArrowLeft /></Button><span>শুরুর হিসাব · {number(step + 1, digits)}/{number(pockets + 2, digits)}</span><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={onClose}><X /></Button></div>
    <div className="wizard-content">
    <div className={`wizard-symbol ${pocket?.color ?? 'cash'}`}>{step === pinStep ? <LockKeyhole /> : pocket ? <PocketMark id={pocket.id} /> : <Wallet />}</div>
    <h2 id="wizard-title">{pocket ? `${pocket.name_bn} কত আছে?` : step === pinStep ? 'আগের পিন দিন' : 'হিসাব ঠিক আছে?'}</h2>
    {step < pockets ? <>
      <div className="amount-display">{taka(toPaisa(value || '0'), digits)}</div><Keypad value={value} onChange={setValue} digits={digits} />
    </> : step === pinStep ? <><div className="pin-dots">{Array.from({ length: 4 }, (_, i) => <span className={i < value.length ? 'filled' : ''} key={i} />)}</div><Keypad value={value} onChange={setValue} pin digits={digits} /></> : <>
      <div className="confirmation"><h3>{shop}</h3>{seedPockets.map((item) => <div key={item.id}><span className={item.color}><PocketMark id={item.id} />{item.name_bn}</span><strong>{taka(amounts[item.id] ?? 0, digits)}</strong></div>)}<div className="confirmation-total"><span>আমার মোট টাকা</span><strong>{taka(total, digits)}</strong></div></div>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <Button variant="ledger" size="primary" onClick={next} disabled={busy || (step === pinStep && value.length !== 4)}>{step === reviewStep ? <Check /> : <ArrowRight />}{step === reviewStep ? 'ঠিক আছে' : 'পরের ধাপ'}</Button>
    {step === reviewStep && <Button variant="secondary" size="primary" onClick={back}><Pencil />ঠিক করুন</Button>}
    </div>
  </section></div>;
}
