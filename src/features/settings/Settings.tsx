import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Store, Eye, EyeOff, Check, Pencil, Phone, Languages, X, UserPlus, LogOut, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHisab } from '../foundations/Provider';
import { db } from '../foundations/db';
import { Keypad } from '../foundations/Keypad';
import { hashPin } from '../foundations/security';
import { normalizeDigits, number } from '../foundations/money';
import { ApiError, api } from '../foundations/sync';
export function SettingsPage() {
  const { settings, role, shopName, userName, online } = useHisab(); const [shop, setShop] = useState(''); const [editing, setEditing] = useState(false); const [error, setError] = useState('');
  const [ownPhone, setOwnPhone] = useState(''); const [ownPin, setOwnPin] = useState(''); const [showPin, setShowPin] = useState(false);
  const [phoneEdit, setPhoneEdit] = useState(false); const [phoneDraft, setPhoneDraft] = useState('');
  const [naming, setNaming] = useState(false); const [nameDraft, setNameDraft] = useState('');
  const [staffCount, setStaffCount] = useState<number | null>(null);
  useEffect(() => { if (!online) return; api<{ phone?: string; pin?: string }>('/api/me').then((me) => { setOwnPhone(me.phone ?? ''); setOwnPin(me.pin ?? ''); }).catch(() => undefined); }, [online]);
  useEffect(() => { if (!online || role !== 'admin') return; api<unknown[]>('/api/employees').then((rows) => setStaffCount(rows.length)).catch(() => setStaffCount(null)); }, [online, role]);
  const [pinMode, setPinMode] = useState(false); const [pin, setPin] = useState(''); const [oldPin, setOldPin] = useState(''); const [first, setFirst] = useState(''); const [pinStep, setPinStep] = useState(0);
  async function update(fields: Partial<NonNullable<typeof settings>>) { try { await db.settings.update('main', { ...fields, updated_at: Date.now() }); } catch { setError('সেভ হয়নি। আবার চেষ্টা করুন।'); } }
  function openPin() { setPinMode(true); setPinStep(0); setPin(''); setOldPin(''); setFirst(''); setError(''); }
  async function savePin() {
    if (pin.length !== 4) return;
    if (pinStep === 0) { setOldPin(pin); setPinStep(1); setPin(''); setError(''); return; }
    if (pinStep === 1) { setFirst(pin); setPinStep(2); setPin(''); setError(''); return; }
    if (first !== pin) { setError('পিন মেলেনি'); setPin(''); return; }
    try {
      await api('/api/pin', { method: 'POST', body: JSON.stringify({ current: oldPin, next: pin }) });
      const result = await hashPin(pin);
      await db.settings.update('main', { pin_hash: result.hash, pin_salt: result.salt, updated_at: Date.now() });
      setOwnPin(pin);
      setPinMode(false); setPin(''); setOldPin(''); setFirst(''); setError('');
    } catch (cause) {
      const wrong = cause instanceof ApiError && cause.message === 'bad_pin';
      setError(wrong ? 'আগের পিন মিলেনি' : 'পিন সেভ হয়নি। আবার চেষ্টা করুন।');
      setPinStep(0); setPin(''); setOldPin(''); setFirst('');
    }
  }
  return <><div className="settings-groups">
    <section className="profile-card">
      <div className="profile-head">
        <span className="profile-mark"><User /></span>
        <div className="profile-name">{naming ? <input aria-label="আপনার নাম" maxLength={60} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} /> : <h2>{userName || 'নাম নেই'}</h2>}</div>
        {role === 'admin' && <button type="button" className="profile-edit" aria-label={naming ? 'নাম সেভ' : 'নাম বদলান'} onClick={async () => { if (!naming) { setNameDraft(userName); setNaming(true); return; } const next = nameDraft.trim(); if (!next) return; try { const saved = await api<{ name: string }>('/api/me/name', { method: 'POST', body: JSON.stringify({ name: next }) }); await db.session.update('main', { name: saved.name }); await db.settings.update('main', { owner_name: saved.name }); setNaming(false); setError(''); } catch (cause) { setError(cause instanceof ApiError && cause.message === 'name_taken' ? 'এই নাম আছে' : 'নাম সেভ হয়নি'); } }}>{naming ? <Check /> : <Pencil />}</button>}
      </div>
      <div className="profile-body">
        <div className="profile-sub phone">
          <div className="profile-lead"><span className="profile-ico"><Phone /></span><span>ফোন</span></div>
          {role === 'admin' && phoneEdit ? <input aria-label="আপনার ফোন" inputMode="tel" maxLength={11} value={phoneDraft} onChange={(event) => setPhoneDraft(normalizeDigits(event.target.value).replace(/\D/g, '').slice(0, 11))} /> : <strong>{ownPhone || 'ফোন নেই'}</strong>}
          {role === 'admin' && <button type="button" className="sub-edit" aria-label={phoneEdit ? 'ফোন সেভ' : 'ফোন বদলান'} onClick={async () => { if (!phoneEdit) { setPhoneDraft(ownPhone); setPhoneEdit(true); return; } if (!/^01\d{9}$/.test(phoneDraft)) { setError('ফোন নম্বর ১১ সংখ্যা, ০১ দিয়ে'); return; } try { const saved = await api<{ phone: string }>('/api/me/phone', { method: 'POST', body: JSON.stringify({ phone: phoneDraft }) }); setOwnPhone(saved.phone); setPhoneEdit(false); setError(''); } catch (cause) { setError(cause instanceof ApiError && cause.message === 'phone_taken' ? 'এই ফোন আছে' : 'ফোন সেভ হয়নি'); } }}>{phoneEdit ? <Check /> : <Pencil />}</button>}
        </div>
        <div className="profile-sub pin">
          <div className="profile-lead"><span className="profile-ico"><Lock /></span><span>পিন</span></div>
          <div className="pin-line"><strong>{showPin ? (ownPin || '••••') : '••••'}</strong><button type="button" className="pin-eye" aria-label={showPin ? 'পিন লুকান' : 'পিন দেখুন'} onClick={() => setShowPin((open) => !open)}>{showPin ? <EyeOff /> : <Eye />}</button></div>
          <button type="button" className="profile-reset" onClick={openPin}>রিসেট</button>
        </div>
      </div>
    </section>
    <div className="settings-side">
    <section className="settings-group"><h2>দোকান</h2><div className="settings-list">
      <article><Store /><div><h3>দোকানের নাম</h3>{editing ? <input className="text-input" aria-label="দোকানের নাম" value={shop} maxLength={60} onChange={e => setShop(e.target.value)} /> : <p>{shopName}</p>}</div>{role === 'admin' && <Button variant="outline" size="touch" onClick={async () => { if (!editing) { setShop(shopName); setEditing(true); return; } if (!shop.trim()) return; try { await api('/api/shop', { method: 'PATCH', body: JSON.stringify({ name: shop.trim() }) }); await update({ shop_name: shop.trim() }); await db.session.update('main', { shop_name: shop.trim() }); setEditing(false); setError(''); } catch { setError('নাম সেভ হয়নি'); } }}>{editing ? <Check /> : <Pencil />}</Button>}</article>
      <article><Languages /><div><h3>সংখ্যা</h3></div><div className="segmented"><Button variant={settings?.digits === 'bn' ? 'ledger' : 'ghost'} size="touch" onClick={() => update({ digits: 'bn' })}>বাংলা</Button><Button variant={settings?.digits === 'en' ? 'ledger' : 'ghost'} size="touch" onClick={() => update({ digits: 'en' })}>English</Button></div></article>
    </div></section>
    {role === 'admin' && <section className="settings-group"><h2>কর্মচারী</h2><div className="settings-list"><article><UserPlus /><div><h3>সব কর্মচারী</h3>{staffCount != null && <p>{number(staffCount, settings?.digits)} জন</p>}</div><Button className="staff-see" variant="outline" size="touch" asChild><Link to="/employees">দেখুন</Link></Button></article></div></section>}
    <section className="settings-group"><div className="settings-list"><article><LogOut /><div><h3>লগ আউট</h3></div><Button variant="outline" size="touch" onClick={async () => { try { await api('/api/logout', { method: 'POST' }); } catch { /* অফলাইনেও বের হবে */ } await db.session.delete('main'); }}>লগ আউট</Button></article></div></section>
    </div>
  </div>{error && <p className="form-error" role="alert">{error}</p>}
  {pinMode && <div className="modal-shade"><section className="wizard" role="dialog" aria-label="পিন বদলান"><div className="wizard-header"><h2>{pinStep === 0 ? 'আগের পিন দিন' : pinStep === 1 ? 'নতুন পিন দিন' : 'আবার পিন দিন'}</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setPinMode(false)}><X /></Button></div><div className="wizard-content"><div className="pin-dots">{Array.from({ length: 4 }, (_, i) => <span key={i} className={i < pin.length ? 'filled' : ''} />)}</div><Keypad value={pin} onChange={setPin} pin digits={settings?.digits} />{error && <p className="form-error">{error}</p>}<Button variant="ledger" size="primary" disabled={pin.length !== 4} onClick={savePin}><Check />ঠিক আছে</Button></div></section></div>}
  </>;
}
