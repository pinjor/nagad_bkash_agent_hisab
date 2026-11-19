import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Keypad } from './Keypad';
import { seedPockets, saveOpening } from './db';
import { PocketMark } from './PocketMark';
import { taka, toPaisa } from './money';
import { useHisab } from './Provider';
import { ApiError, api } from './sync';

export function OpeningWizard({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { settings, shopName } = useHisab(); const digits = settings?.digits ?? 'bn';
  const [pick, setPick] = useState(seedPockets[0]?.id ?? 'CASH');
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'money' | 'pin'>('money');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const total = Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
  const shop = shopName || settings?.shop_name || 'আমার দোকান';
  function choose(id: string) {
    setError('');
    setPick(id);
    setDraft(amounts[id] ? String(amounts[id] / 100) : '');
  }
  function typeAmount(value: string) {
    setDraft(value);
    setAmounts({ ...amounts, [pick]: toPaisa(value || '0') });
  }
  function askPin() { setError(''); setPin(''); setStep('pin'); }
  async function save() {
    setError('');
    if (pin.length !== 4) { setError('৪ সংখ্যার পিন দিন।'); return; }
    setBusy(true);
    try {
      await api('/api/pin/check', { method: 'POST', body: JSON.stringify({ pin }) });
      onSaved(await saveOpening(amounts, shop));
    } catch (cause) {
      setError(cause instanceof ApiError && cause.message === 'bad_pin' ? 'পিন মিলেনি। আগের পিন দিন।' : 'সেভ হয়নি। আবার চেষ্টা করুন।');
      if (cause instanceof ApiError && cause.message === 'bad_pin') setPin('');
    } finally { setBusy(false); }
  }
  return <div className="modal-shade"><section className="wizard opening-sheet" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <div className="wizard-header">{step === 'pin' ? <button type="button" className="open-back" onClick={() => { setStep('money'); setError(''); }}>পিছনে</button> : <span id="wizard-title">শুরুর হিসাব</span>}{step === 'pin' && <span id="wizard-title">পিন দিন</span>}<Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={onClose}><X /></Button></div>
    <div className="wizard-content">
      {step === 'money' ? <>
      <div className="pocket-circles entry-pockets open-pockets">
        {seedPockets.map((item) => <button type="button" key={item.id} className={`pocket-circle ${item.color}${pick === item.id ? ' on' : ''}`} aria-pressed={pick === item.id} onClick={() => choose(item.id)}><span className="pocket-bubble"><PocketMark id={item.id} /></span><span className="pocket-name">{item.name_bn}</span><strong>{taka(amounts[item.id] ?? 0, digits)}</strong></button>)}
      </div>
      <div className="open-total"><span>মোট</span><strong>{taka(total, digits)}</strong></div>
      <Keypad value={draft} onChange={typeAmount} digits={digits} quick={[500, 1000, 2000, 5000, 10000, 20000]} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button variant="ledger" size="primary" onClick={askPin}><Check />সেভ করুন</Button>
      </> : <>
      <div className="pin-dots" aria-label="পিন">{Array.from({ length: 4 }, (_, i) => <span className={i < pin.length ? 'filled' : ''} key={i} />)}</div>
      <Keypad value={pin} onChange={setPin} pin digits={digits} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button variant="ledger" size="primary" onClick={save} disabled={busy}><Check />সেভ করুন</Button>
      </>}
    </div>
  </section></div>;
}
