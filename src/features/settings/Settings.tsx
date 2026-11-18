import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Store, LockKeyhole, ShieldCheck, Volume2, Eye, Check, Pencil, Smartphone, Languages, X, UserPlus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHisab } from '../foundations/Provider';
import { db } from '../foundations/db';
import { Keypad } from '../foundations/Keypad';
import { hashPin } from '../foundations/security';
import { api } from '../foundations/sync';
export function SettingsPage() {
  const { settings, storage, lock, speak, role, shopName } = useHisab(); const [shop, setShop] = useState(''); const [editing, setEditing] = useState(false); const [error, setError] = useState('');
  const [pinMode, setPinMode] = useState(false); const [pin, setPin] = useState(''); const [first, setFirst] = useState(''); const [pinStep, setPinStep] = useState(0);
  async function update(fields: Partial<NonNullable<typeof settings>>) { try { await db.settings.update('main', { ...fields, updated_at: Date.now() }); } catch { setError('সেভ হয়নি। আবার চেষ্টা করুন।'); } }
  async function savePin() {
    if (pin.length !== 4) return;
    if (pinStep === 0 && settings?.pin_hash) { const result = await hashPin(pin, settings.pin_salt); if (result.hash !== settings.pin_hash) { setError('ভুল পিন'); setPin(''); return; } setPinStep(1); setPin(''); return; }
    if (pinStep < 2) { setFirst(pin); setPinStep(2); setPin(''); return; }
    if (first !== pin) { setError('পিন মেলেনি'); setPin(''); return; }
    const result = await hashPin(pin); await update({ pin_hash: result.hash, pin_salt: result.salt }); setPinMode(false); setPin(''); setError('');
  }
  return <><div className="settings-groups">
    <section className="settings-group"><h2>দোকান</h2><p className="field-hint">দোকানের নাম আর আপনি কে</p><div className="settings-list">
      <article><Store /><div><h3>দোকানের নাম</h3>{editing ? <input className="text-input" aria-label="দোকানের নাম" placeholder="নতুন দোকানের নাম" value={shop} maxLength={60} onChange={e => setShop(e.target.value)} /> : <p>{shopName}</p>}</div>{role === 'admin' && <Button variant="outline" size="touch" onClick={async () => { if (!editing) { setShop(shopName); setEditing(true); return; } if (!shop.trim()) return; try { await api('/api/shop', { method: 'PATCH', body: JSON.stringify({ name: shop.trim() }) }); await update({ shop_name: shop.trim() }); await db.session.update('main', { shop_name: shop.trim() }); setEditing(false); setError(''); } catch { setError('নাম সেভ হয়নি'); } }}>{editing ? <Check /> : <Pencil />}{editing ? 'সেভ করুন' : 'বদলান'}</Button>}</article>
      <article><Smartphone /><div><h3>আপনার ভূমিকা</h3><p>{role === 'employee' ? 'কর্মচারী। শুধু নতুন হিসাব যোগ করতে পারবেন।' : 'মালিক। সব হিসাব বদলাতে পারবেন।'}</p></div></article>
    </div></section>
    <section className="settings-group"><h2>দেখানো</h2><p className="field-hint">সংখ্যা, লুকানো টাকা, আর কণ্ঠ</p><div className="settings-list">
      <article><Languages /><div><h3>সংখ্যা</h3><p>টাকার অঙ্ক বাংলায় না ইংরেজিতে</p></div><div className="segmented"><Button variant={settings?.digits === 'bn' ? 'ledger' : 'ghost'} size="touch" onClick={() => update({ digits: 'bn' })}><Languages />বাংলা</Button><Button variant={settings?.digits === 'en' ? 'ledger' : 'ghost'} size="touch" onClick={() => update({ digits: 'en' })}><Languages />English</Button></div></article>
      <article><Eye /><div><h3>খোলার পর টাকা লুকান</h3><p>পিন দিয়ে ঢোকার পরও টাকা ঢাকা থাকবে</p></div><Button variant="outline" size="touch" role="switch" aria-checked={settings?.privacy_default ?? false} aria-label="খোলার পর টাকা লুকান" onClick={() => update({ privacy_default: !settings?.privacy_default })}><Eye />{settings?.privacy_default ? 'চালু' : 'বন্ধ'}</Button></article>
      <article><Volume2 /><div><h3>বাংলা কণ্ঠ</h3><p>ফোনে বাংলা কণ্ঠ থাকলে হিসাব শুনতে পাবেন</p></div><Button variant="outline" size="touch" role="switch" aria-checked={settings?.voice_on ?? true} aria-label="বাংলা কণ্ঠ" onClick={() => update({ voice_on: !settings?.voice_on })}><Volume2 />{settings?.voice_on ? 'চালু' : 'বন্ধ'}</Button><Button variant="ghost" size="touch" aria-label="কণ্ঠ পরীক্ষা" onClick={() => speak('আমার হিসাব। আপনার টাকা আপনার কাছে।')}><Volume2 />শুনুন</Button></article>
    </div></section>
    <section className="settings-group"><h2>সুরক্ষা</h2><p className="field-hint">পিন আর ফোনে রাখা হিসাব</p><div className="settings-list">
      <article><LockKeyhole /><div><h3>পিন সুরক্ষা</h3><p>{settings?.pin_hash ? 'চার সংখ্যার পিন চালু। অ্যাপ ছাড়লে আবার পিন লাগবে।' : 'পিন সেট করা হয়নি।'}</p></div><Button variant="outline" size="touch" onClick={() => { setPinMode(true); setPinStep(settings?.pin_hash ? 0 : 1); setPin(''); setError(''); }}><Pencil />পিন বদলান</Button>{settings?.pin_hash && <Button variant="ledger" size="touch" onClick={lock}><LockKeyhole />লক করুন</Button>}</article>
      <article><ShieldCheck /><div><h3>ফোনের স্টোরেজ</h3><p>{storage}</p><p>ব্রাউজারের ডেটা মুছলে এই ফোনের কপি হারাতে পারেন। সার্ভারে যাওয়া হিসাব থাকে।</p></div></article>
    </div></section>
    {role === 'admin' && <section className="settings-group"><h2>কর্মচারী</h2><p className="field-hint">নাম, পিন, আর তাদের কাজের হিসাব</p><div className="settings-list"><article><UserPlus /><div><h3>সব কর্মচারী</h3><p>নতুন কর্মচারী যোগ, পিন বদল, হিসাব</p></div><Button variant="outline" size="touch" asChild><Link to="/employees">দেখুন</Link></Button></article></div></section>}
    <section className="settings-group"><h2>বের হোন</h2><p className="field-hint">এই ফোন থেকে অ্যাকাউন্ট ছাড়ুন</p><div className="settings-list"><article><LogOut /><div><h3>লগ আউট</h3><p>আবার ঢুকতে শুধু পিন লাগবে। ফোনের হিসাব মুছবে না।</p></div><Button variant="outline" size="touch" onClick={async () => { try { await api('/api/logout', { method: 'POST' }); } catch { /* ফোন অফলাইনে থাকলেও বের হবে */ } await db.session.delete('main'); }}>লগ আউট</Button></article></div></section>
  </div>{error && <p className="form-error" role="alert">{error}</p>}
  {pinMode && <div className="modal-shade"><section className="wizard" role="dialog" aria-label="পিন বদলান"><div className="wizard-header"><h2>{pinStep === 0 ? 'আগের পিন দিন' : pinStep === 1 ? 'নতুন পিন দিন' : 'আবার পিন দিন'}</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setPinMode(false)}><X /></Button></div><div className="wizard-content"><div className="pin-dots">{Array.from({ length: 4 }, (_, i) => <span key={i} className={i < pin.length ? 'filled' : ''} />)}</div><Keypad value={pin} onChange={setPin} pin digits={settings?.digits} />{error && <p className="form-error">{error}</p>}<Button variant="ledger" size="primary" disabled={pin.length !== 4} onClick={savePin}><Check />ঠিক আছে</Button></div></section></div>}
  </>;
}
