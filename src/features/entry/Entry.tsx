import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { seedPockets, queueEntry } from '../foundations/db';
import { toPaisa, taka, number, phoneDigits, phoneOk } from '../foundations/money';
import { useHisab } from '../foundations/Provider';
import { PocketMark } from '../foundations/PocketMark';
import { SavedPopup } from '../foundations/SavedPopup';

const kinds = [{ id: 'CASH_IN', label: 'টাকা ঢুকেছে' }, { id: 'CASH_OUT', label: 'টাকা বের হয়েছে' }] as const;
const kindLabel: Record<string, string> = { CASH_IN: 'টাকা ঢুকেছে', CASH_OUT: 'টাকা বের হয়েছে' };
const pocketName = Object.fromEntries(seedPockets.map((pocket) => [pocket.id, pocket.name_bn]));

export function Entry() {
  const { settings, syncNow, totals, hidden } = useHisab();
  const [step, setStep] = useState<'write' | 'summary'>('write');
  const [kind, setKind] = useState<(typeof kinds)[number]['id']>('CASH_IN');
  const [pocket, setPocket] = useState('CASH');
  const [phone, setPhone] = useState('');
  const [item, setItem] = useState('');
  const [qty, setQty] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ title: string; detail: string } | null>(null);
  const digits = settings?.digits;
  const balance = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  const money = (amount: number) => (hidden ? '৳ ••••' : taka(amount, digits));
  const dial = phoneDigits(phone);
  const skipPhone = pocket === 'PHARMA' || pocket === 'MOBILE';
  const parsed = (() => { try { return toPaisa(value || '0'); } catch { return null; } })();
  const shown = parsed == null ? '' : number(parsed / 100, digits);
  const party = pocket === 'PHARMA' ? `${item.trim()} × ${qty.trim()}` : pocket === 'MOBILE' ? item.trim() : '';

  function ready() {
    if (parsed == null) return 'সঠিক টাকা লিখুন';
    if (!parsed) return 'টাকার পরিমাণ দিন';
    if (kind === 'CASH_OUT' && parsed > balance) return 'ব্যবহারযোগ্য ব্যালেন্সের বেশি যাবে না';
    if (pocket === 'PHARMA' && !item.trim()) return 'ওষুধের নাম দিন';
    if (pocket === 'PHARMA' && !qty.trim()) return 'পরিমাণ দিন';
    if (pocket === 'MOBILE' && !item.trim()) return 'মোবাইলের নাম দিন';
    if (!skipPhone && !phoneOk(dial)) return 'ফোন নম্বর ১১ সংখ্যা, ০১ দিয়ে';
    return '';
  }

  function review() {
    const problem = ready();
    setError(problem);
    if (!problem) setStep('summary');
  }

  async function save() {
    setError('');
    try {
      const problem = ready();
      if (problem) { setError(problem); return; }
      const amount = toPaisa(value || '0');
      await queueEntry(kind, pocket, amount, { phone: skipPhone ? '' : dial, party });
      setValue('');
      setPhone('');
      setItem('');
      setQty('');
      setStep('write');
      setSaved({ title: 'হিসাব সেভ হয়েছে', detail: `${kindLabel[kind]} · ${pocketName[pocket] ?? 'পকেট'} · ${taka(amount, digits)}` });
      await syncNow();
    } catch { setError('সেভ হয়নি। আবার চেষ্টা করুন।'); }
  }

  return <div className="send-sheet">
    {step === 'summary' && <button type="button" className="day-back" onClick={() => { setError(''); setStep('write'); }}><ArrowLeft />পেছনে</button>}

    {step === 'write' ? <>
      <div className="send-kinds" role="group" aria-label="ধরন">
        {kinds.map((item) => <button type="button" key={item.id} className={`${item.id === 'CASH_IN' ? 'kind-in' : 'kind-out'}${kind === item.id ? ' on' : ''}`} aria-pressed={kind === item.id} onClick={() => setKind(item.id)}>{item.label}</button>)}
      </div>
      <div className="pocket-circles entry-pockets" role="group" aria-label="পকেট">
        {seedPockets.map((item) => <button type="button" key={item.id} className={`pocket-circle ${item.color}${pocket === item.id ? ' on' : ''}`} aria-pressed={pocket === item.id} onClick={() => setPocket(item.id)}><span className="pocket-bubble"><PocketMark id={item.id} /></span><span className="pocket-name">{item.name_bn}</span></button>)}
      </div>
      {!skipPhone && <section className="send-block">
        <p>ফোন</p>
        <input className="send-phone" aria-label="ফোন" placeholder="ফোন নম্বর, ০১ দিয়ে ১১ সংখ্যা" inputMode="tel" maxLength={11} value={phone} onChange={(event) => setPhone(phoneDigits(event.target.value))} />
      </section>}
      {pocket === 'PHARMA' && <section className="send-block">
        <p>ওষুধের নাম</p>
        <input className="send-phone" aria-label="ওষুধের নাম" placeholder="ওষুধের নাম" maxLength={80} value={item} onChange={(event) => setItem(event.target.value)} />
        <p>পরিমাণ</p>
        <input className="send-phone" aria-label="পরিমাণ" placeholder="কতটা" inputMode="numeric" maxLength={8} value={qty} onChange={(event) => setQty(event.target.value)} />
      </section>}
      {pocket === 'MOBILE' && <section className="send-block">
        <p>মোবাইলের নাম</p>
        <input className="send-phone" aria-label="মোবাইলের নাম" placeholder="মোবাইলের নাম" maxLength={80} value={item} onChange={(event) => setItem(event.target.value)} />
      </section>}
      <section className="send-amount">
        <p>পরিমাণ</p>
        <label className={`send-figure${value ? ' has-value' : ''}`}>
          <span aria-hidden>৳</span>
          <input aria-label="টাকার পরিমাণ" inputMode="decimal" placeholder="0" value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
      </section>
      <p className="send-balance">ব্যবহারযোগ্য ব্যালেন্স: {money(balance)}</p>
      {error && <p className="form-error send-error" role="alert">{error}</p>}
      <button type="button" className="send-next" onClick={review}>পরবর্তী<ArrowRight /></button>
    </> : <section className="send-summary" aria-label="হিসাবের সারাংশ">
      <p className="send-total">{hidden ? '৳ ••••' : `৳${shown}`}</p>
      <div className="send-row"><span>ধরন</span><b>{kindLabel[kind]}</b></div>
      <div className="send-row"><span>পকেট</span><b><PocketMark id={pocket} />{pocketName[pocket]}</b></div>
      {pocket === 'PHARMA' && <div className="send-row"><span>ওষুধের নাম</span><b>{item.trim()}</b></div>}
      {pocket === 'PHARMA' && <div className="send-row"><span>পরিমাণ</span><b>{qty.trim()}</b></div>}
      {pocket === 'MOBILE' && <div className="send-row"><span>মোবাইলের নাম</span><b>{item.trim()}</b></div>}
      {!skipPhone && <div className="send-row"><span>ফোন</span><b>{dial}</b></div>}
      <div className="send-row"><span>ব্যবহারযোগ্য ব্যালেন্স</span><b>{money(balance)}</b></div>
      {error && <p className="form-error send-error" role="alert">{error}</p>}
      <button type="button" className="send-save" onClick={save}>সেভ করুন</button>
    </section>}
    {saved && <SavedPopup title={saved.title} detail={saved.detail} onClose={() => setSaved(null)} />}
  </div>;
}
