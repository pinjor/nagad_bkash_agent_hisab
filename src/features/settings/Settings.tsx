import { useState } from 'react';
import { Store, LockKeyhole, ShieldCheck, Volume2, Eye, Check, Pencil, Smartphone, Languages, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHisab } from '../foundations/Provider';
import { db } from '../foundations/db';
import { Keypad } from '../foundations/Keypad';
import { hashPin } from '../foundations/security';
export function SettingsPage() {
  const { settings, storage, lock, speak } = useHisab(); const [shop, setShop] = useState(''); const [editing, setEditing] = useState(false); const [error, setError] = useState('');
  const [pinMode, setPinMode] = useState(false); const [pin, setPin] = useState(''); const [first, setFirst] = useState(''); const [pinStep, setPinStep] = useState(0);
  async function update(fields: Partial<NonNullable<typeof settings>>) { try { await db.settings.update('main', { ...fields, updated_at: Date.now() }); } catch { setError('সেভ হয়নি। আবার চেষ্টা করুন।'); } }
  async function savePin() {
    if (pin.length !== 4) return;
    if (pinStep === 0 && settings?.pin_hash) { const result = await hashPin(pin, settings.pin_salt); if (result.hash !== settings.pin_hash) { setError('ভুল পিন'); setPin(''); return; } setPinStep(1); setPin(''); return; }
    if (pinStep < 2) { setFirst(pin); setPinStep(2); setPin(''); return; }
    if (first !== pin) { setError('পিন মেলেনি'); setPin(''); return; }
    const result = await hashPin(pin); await update({ pin_hash: result.hash, pin_salt: result.salt }); setPinMode(false); setPin(''); setError('');
  }
  return <><div className="page-heading"><div><span className="eyebrow">আপনার মতো করে</span><h1>সেটিংস</h1></div></div><div className="settings-list">
    <section><Store /><div><h2>দোকানের নাম</h2>{editing ? <input className="text-input" aria-label="দোকানের নাম" value={shop} maxLength={60} onChange={e => setShop(e.target.value)} /> : <p>{settings?.shop_name}</p>}</div><Button variant="outline" size="touch" onClick={async () => { if (editing) { if (!shop.trim()) return; await update({ shop_name: shop.trim() }); setEditing(false); } else { setShop(settings?.shop_name ?? ''); setEditing(true); } }}>{editing ? <Check /> : <Pencil />}{editing ? 'সেভ করুন' : 'বদলান'}</Button></section>
    <section><Languages /><div><h2>সংখ্যা</h2><p>বাংলা / English</p></div><div className="segmented"><Button variant={settings?.digits === 'bn' ? 'ledger' : 'ghost'} size="touch" onClick={() => update({ digits: 'bn' })}><Languages />বাংলা</Button><Button variant={settings?.digits === 'en' ? 'ledger' : 'ghost'} size="touch" onClick={() => update({ digits: 'en' })}><Languages />English</Button></div></section>
    <section><Eye /><div><h2>খোলার পর টাকা লুকান</h2><p>পিন দেওয়ার পরও ব্যালেন্স ঢাকা থাকবে</p></div><Button variant="outline" size="touch" role="switch" aria-checked={settings?.privacy_default ?? false} aria-label="খোলার পর টাকা লুকান" onClick={() => update({ privacy_default: !settings?.privacy_default })}><Eye />{settings?.privacy_default ? 'চালু' : 'বন্ধ'}</Button></section>
    <section><Volume2 /><div><h2>বাংলা কণ্ঠ</h2><p>ফোনে বাংলা কণ্ঠ থাকলে শুনতে পাবেন</p></div><Button variant="outline" size="touch" role="switch" aria-checked={settings?.voice_on ?? true} aria-label="বাংলা কণ্ঠ" onClick={() => update({ voice_on: !settings?.voice_on })}><Volume2 />{settings?.voice_on ? 'চালু' : 'বন্ধ'}</Button><Button variant="ghost" size="touch" aria-label="কণ্ঠ পরীক্ষা" onClick={() => speak('আমার হিসাব। আপনার টাকা আপনার কাছে।')}><Volume2 /></Button></section>
    <section><LockKeyhole /><div><h2>পিন সুরক্ষা</h2><p>{settings?.pin_hash ? 'চার সংখ্যার পিন চালু' : 'পিন সেট করা হয়নি'}</p></div><Button variant="outline" size="touch" onClick={() => { setPinMode(true); setPinStep(settings?.pin_hash ? 0 : 1); setPin(''); setError(''); }}><Pencil />পিন বদলান</Button>{settings?.pin_hash && <Button variant="ledger" size="touch" onClick={lock}><LockKeyhole />লক করুন</Button>}</section>
    <section><ShieldCheck /><div><h2>ফোনের স্টোরেজ</h2><p>{storage}</p><p>ব্রাউজারের ডেটা মুছলে হিসাব হারাতে পারেন।</p></div></section>
    <section><Smartphone /><div><h2>আমার হিসাব</h2><p>ধাপ ১ · এই ফোনে সেভ হয়</p><p>ব্যাকআপ ও অন্য ফোনে নেওয়া ধাপ ৫-এ আসবে।</p></div></section>
  </div>{error && <p className="form-error" role="alert">{error}</p>}
  {pinMode && <div className="modal-shade"><section className="wizard" role="dialog" aria-label="পিন বদলান"><div className="wizard-header"><h2>{pinStep === 0 ? 'আগের পিন দিন' : pinStep === 1 ? 'নতুন পিন দিন' : 'আবার পিন দিন'}</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setPinMode(false)}><X /></Button></div><div className="wizard-content"><div className="pin-dots">{Array.from({ length: 4 }, (_, i) => <span key={i} className={i < pin.length ? 'filled' : ''} />)}</div><Keypad value={pin} onChange={setPin} pin digits={settings?.digits} />{error && <p className="form-error">{error}</p>}<Button variant="ledger" size="primary" disabled={pin.length !== 4} onClick={savePin}><Check />ঠিক আছে</Button></div></section></div>}
  </>;
}
