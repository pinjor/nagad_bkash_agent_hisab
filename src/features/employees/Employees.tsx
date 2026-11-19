import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeDigits, number, taka } from '../foundations/money';
import { api, ApiError } from '../foundations/sync';
import { useHisab } from '../foundations/Provider';
import { usePageTitle } from '../foundations/Shell';

interface StaffActivity { at: string; kind: string; detail: string; amount_paisa: number; phone?: string }
interface StaffMember {
  id: string; name: string; phone?: string; pin?: string; created_at: string; txn_count: number;
  cash_in_paisa: number; cash_out_paisa: number; flexi_paisa: number;
  lend_count: number; borrow_count: number; person_count: number;
  last_at: string | null; activity: StaffActivity[];
}

function pinDigits(value: string) {
  return normalizeDigits(value).replace(/\D/g, '').slice(0, 4);
}
function phoneDigits(value: string) {
  return normalizeDigits(value).replace(/\D/g, '').slice(0, 11);
}
function when(value: string) {
  return new Date(value).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
function activityLine(row: StaffActivity, digits: 'bn' | 'en' | undefined) {
  const money = taka(row.amount_paisa, digits);
  const time = when(row.at);
  if (row.kind === 'person') return `নতুন মানুষ ${row.detail} · ${time}`;
  if (row.kind === 'loan') return `${row.detail === 'lend' ? 'ধার দিয়েছে' : 'ধার নিয়েছে'} ${money} · ${time}`;
  const names: Record<string, string> = { CASH_IN: 'টাকা ঢুকিয়েছে', CASH_OUT: 'টাকা বের করেছে', FLEXI: 'ফ্লেক্সি করেছে', LEND: 'ধার দিয়েছে', BORROW: 'ধার নিয়েছে', REPAY_IN: 'ফেরত পেয়েছে', REPAY_OUT: 'ফেরত দিয়েছে', OPENING: 'শুরুর হিসাব দিয়েছে' };
  return `${names[row.detail] ?? row.detail} ${money}${row.phone ? ` · ${row.phone}` : ''} · ${time}`;
}

export function EmployeesPage() {
  const { settings, role, online } = useHisab();
  const [adding, setAdding] = useState(false);
  const [staff, setStaff] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [openId, setOpenId] = useState('');
  const [pinFor, setPinFor] = useState(false);
  const [nextPin, setNextPin] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [phoneFor, setPhoneFor] = useState(false);
  const [nextPhone, setNextPhone] = useState('');
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [seePin, setSeePin] = useState(false);
  const [error, setError] = useState('');
  const digits = settings?.digits;
  const load = () => api<StaffMember[]>('/api/employees').then(setStaffList).catch(() => setError('তালিকা আসেনি'));
  useEffect(() => { if (role === 'admin' && online) void load(); }, [role, online]);
  async function addStaff() {
    if (role !== 'admin') return;
    if (!staff.trim()) { setError('নাম দিন'); return; }
    if (!/^01\d{9}$/.test(phoneDigits(staffPhone))) { setError('ফোন নম্বর ১১ সংখ্যা, ০১ দিয়ে'); return; }
    if (staffPin.length !== 4) { setError('৪ সংখ্যার পিন দিন'); return; }
    if (!online) { setError('কর্মচারী যোগ করতে ইন্টারনেট লাগবে'); return; }
    try {
      await api('/api/employees', { method: 'POST', body: JSON.stringify({ name: staff.trim(), phone: phoneDigits(staffPhone), pin: staffPin }) });
      setStaff(''); setStaffPhone(''); setStaffPin(''); setError(''); setAdding(false);
      await load();
    } catch (cause) {
      const message = cause instanceof ApiError && cause.message === 'name_taken' ? 'এই নাম আছে' : cause instanceof ApiError && cause.message === 'phone_taken' ? 'এই ফোন আছে' : 'যোগ হয়নি';
      setError(message);
    }
  }
  async function changeStaffPhone(id: string) {
    if (role !== 'admin' || !/^01\d{9}$/.test(phoneDigits(nextPhone))) { setError('ফোন নম্বর ১১ সংখ্যা, ০১ দিয়ে'); return; }
    if (!online) { setError('ফোন বদলাতে ইন্টারনেট লাগবে'); return; }
    try {
      const saved = await api<{ phone: string }>(`/api/employees/${id}/phone`, { method: 'POST', body: JSON.stringify({ phone: phoneDigits(nextPhone) }) });
      setStaffList((rows) => rows.map((row) => row.id === id ? { ...row, phone: saved.phone } : row));
      setPhoneFor(false); setNextPhone(''); setPhoneSaved(true); setError('');
    } catch (cause) {
      setError(cause instanceof ApiError && cause.message === 'phone_taken' ? 'এই ফোন আছে' : 'ফোন বদলায়নি');
    }
  }
  async function changeStaffPin(id: string) {
    if (role !== 'admin' || nextPin.length !== 4) { setError('৪ সংখ্যার পিন দিন'); return; }
    if (!online) { setError('পিন বদলাতে ইন্টারনেট লাগবে'); return; }
    try {
      const saved = await api<{ pin?: string }>(`/api/employees/${id}/pin`, { method: 'POST', body: JSON.stringify({ pin: nextPin }) });
      setStaffList((rows) => rows.map((row) => row.id === id ? { ...row, pin: saved.pin || nextPin } : row));
      setPinFor(false); setNextPin(''); setPinSaved(true); setSeePin(true); setError('');
    } catch { setError('পিন বদলায়নি'); }
  }
  const open = staffList.find((item) => item.id === openId);
  usePageTitle(open?.name ?? '');
  if (role !== 'admin') return <p className="field-hint">শুধু মালিক দেখতে পারেন।</p>;
  if (open) return <div className="report-page">
    <Button variant="ghost" size="touch" className="day-back" onClick={() => { setOpenId(''); setPinFor(false); setNextPin(''); setPinSaved(false); setPhoneFor(false); setNextPhone(''); setPhoneSaved(false); setError(''); }}><ArrowLeft />সব কর্মচারী</Button>
    <p className="field-hint">{open.phone || 'ফোন নেই'} · যোগ {when(open.created_at)}{open.last_at ? ` · শেষ কাজ ${when(open.last_at)}` : ''}</p>
    <section className="loan-card"><h2>হিসাব</h2><div className="stat-grid">
      <div><span><i className="tone in" />ঢুকিয়েছে</span><b>{taka(open.cash_in_paisa, digits)}</b></div>
      <div><span><i className="tone out" />বের করেছে</span><b>{taka(open.cash_out_paisa, digits)}</b></div>
      <div><span><i className="tone flexi" />ফ্লেক্সি</span><b>{taka(open.flexi_paisa, digits)}</b></div>
      <div><span><i className="tone loan" />ধার দিয়েছে</span><b>{number(open.lend_count, digits)}টি</b></div>
      <div><span><i className="tone loan" />ধার নিয়েছে</span><b>{number(open.borrow_count, digits)}টি</b></div>
      <div><span><i className="tone in" />মানুষ</span><b>{number(open.person_count, digits)} জন</b></div>
      <div><span><i className="tone in" />মোট হিসাব</span><b>{number(open.txn_count, digits)}টি</b></div>
    </div></section>
    <section className="settings-group"><h2>ফোন</h2>{phoneFor ? <div className="staff-fields"><label>নতুন ফোন<input className="text-input" aria-label={`${open.name} এর ফোন`} placeholder="যেমন ০১৭১১০০০০০০" inputMode="tel" maxLength={11} value={nextPhone} onChange={(event) => setNextPhone(phoneDigits(event.target.value))} /></label><Button variant="ledger" size="touch" onClick={() => changeStaffPhone(open.id)}>ফোন সেভ করুন</Button><Button variant="ghost" size="touch" onClick={() => { setPhoneFor(false); setNextPhone(''); }}>বন্ধ</Button></div> : <Button variant="outline" size="touch" onClick={() => { setPhoneFor(true); setNextPhone(open.phone ?? ''); setPhoneSaved(false); setError(''); }}>ফোন বদলান</Button>}{phoneSaved && <p>ফোন বদলেছে</p>}</section>
    <section className="settings-group"><h2>পিন</h2><div className="profile-row"><strong>{seePin ? (open.pin || 'এখনো সেভ নেই') : '••••'}</strong><Button variant="outline" size="touch" aria-label={seePin ? 'পিন লুকান' : 'পিন দেখুন'} onClick={() => setSeePin((shown) => !shown)}>{seePin ? <EyeOff /> : <Eye />}</Button></div>{pinFor ? <div className="staff-fields"><label>নতুন ৪ সংখ্যার পিন<input className="text-input" aria-label={`${open.name} এর নতুন পিন`} placeholder="যেমন ২২২২" inputMode="numeric" maxLength={4} value={nextPin} onChange={(event) => setNextPin(pinDigits(event.target.value))} /></label><Button variant="ledger" size="touch" onClick={() => changeStaffPin(open.id)}>পিন সেভ করুন</Button><Button variant="ghost" size="touch" onClick={() => { setPinFor(false); setNextPin(''); }}>বন্ধ</Button></div> : <Button variant="outline" size="touch" onClick={() => { setPinFor(true); setNextPin(''); setPinSaved(false); setError(''); }}>পিন বদলান</Button>}{pinSaved && <p>পিন বদলেছে</p>}</section>
    <section className="settings-group"><h2>কাজ</h2>{open.activity.length === 0 ? <p>এখনো কোনো কাজ নেই</p> : <ul className="timeline">{open.activity.map((row, index) => <li key={`${row.at}-${index}`}>{activityLine(row, digits)}</li>)}</ul>}</section>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
  return <div className="report-page">
    <div className="report-top">
      <div className="report-actions"><Button variant="ledger" size="touch" onClick={() => { setAdding(true); setError(''); }}><UserPlus />নতুন কর্মচারী</Button></div>
    </div>
    {!adding && error && <p className="form-error" role="alert">{error}</p>}
    {adding && <div className="modal-shade" onClick={() => { setAdding(false); setError(''); }}><section className="wizard" role="dialog" aria-modal="true" aria-label="নতুন কর্মচারী" onClick={(event) => event.stopPropagation()}><div className="wizard-header"><h2>নতুন কর্মচারী</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => { setAdding(false); setError(''); }}><X /></Button></div><div className="wizard-content staff-fields"><label>নাম<input className="text-input" aria-label="কর্মচারীর নাম" placeholder="যেমন রহিম" value={staff} maxLength={60} onChange={(event) => setStaff(event.target.value)} /></label><label>ফোন<input className="text-input" aria-label="কর্মচারীর ফোন" placeholder="যেমন ০১৭১১০০০০০০" inputMode="tel" maxLength={11} value={staffPhone} onChange={(event) => setStaffPhone(phoneDigits(event.target.value))} /></label><label>৪ সংখ্যার পিন<input className="text-input" aria-label="কর্মচারীর পিন" placeholder="যেমন ২২২২" inputMode="numeric" maxLength={4} value={staffPin} onChange={(event) => setStaffPin(pinDigits(event.target.value))} /></label><Button variant="ledger" size="touch" onClick={addStaff}>যোগ করুন</Button>{error && <p className="form-error" role="alert">{error}</p>}</div></section></div>}
    <section className="settings-group"><h2>সবাই</h2><p className="field-hint">{number(staffList.length, digits)} জন</p>
      {staffList.length === 0 && <p>এখনো কোনো কর্মচারী নেই।</p>}
      <div className="day-list">{staffList.map((item) => <button className="staff-card" key={item.id} onClick={() => { setOpenId(item.id); setError(''); }}>
        <header><strong>{item.name}</strong><span>{item.phone || 'ফোন নেই'} · যোগ {when(item.created_at)}</span></header>
        <div className="stat-grid">
          <div><span>হিসাব</span><b>{number(item.txn_count, digits)}টি</b></div>
          <div><span>ঢুকিয়েছে</span><b>{taka(item.cash_in_paisa, digits)}</b></div>
          <div><span>বের করেছে</span><b>{taka(item.cash_out_paisa, digits)}</b></div>
          <div><span>ধার</span><b>{number(item.lend_count + item.borrow_count, digits)}টি</b></div>
        </div>
      </button>)}</div>
    </section>
  </div>;
}
