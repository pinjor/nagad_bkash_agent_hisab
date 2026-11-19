import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, queueLoan, queuePerson, queueRepayment, seedPockets, type CachedPerson } from '../foundations/db';
import { PocketMark } from '../foundations/PocketMark';
import { loansWithPending } from '../foundations/ledger-view';
import { inDateSpan, inDhakaWindow, matchesQuery, number, phoneDigits, phoneOk, taka, toPaisa } from '../foundations/money';
import { useHisab } from '../foundations/Provider';
import { usePageTitle } from '../foundations/Shell';
import { api } from '../foundations/sync';
import { SavedPopup } from '../foundations/SavedPopup';

interface Person { id: string; name: string; phone: string; writer?: string; pending?: boolean }
interface LoanEvent { id: string; type: string; amount_paisa: number; at: string; writer?: string }
interface Loan { id: string; person_id: string; person_name: string; direction: 'lend' | 'borrow'; principal_paisa: number; remaining_paisa: number; pocket_id: string; opened_at: string; due_at?: string | null; closed_at: string | null; status: string; writer?: string; events: LoanEvent[]; pending?: boolean }
function wrote(name?: string) {
  const clean = (name ?? '').trim();
  return clean || 'কে লিখেছে জানা নেই';
}

function nextDhakaDay() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  const [year, month, day] = today.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export function People() {
  const { role, settings, online, syncNow, totals, hidden } = useHisab();
  const [people, setPeople] = useState<Person[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [adding, setAdding] = useState(false);
  const [personId, setPersonId] = useState(''); const [direction, setDirection] = useState<'lend' | 'borrow'>('lend');
  const [amount, setAmount] = useState(''); const [pocket, setPocket] = useState('CASH');
  const [dueDate, setDueDate] = useState(nextDhakaDay);
  const [repay, setRepay] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ title: string; detail: string } | null>(null);
  const [pane, setPane] = useState<'list' | 'write'>('write');
  const [finding, setFinding] = useState(false);
  const [find, setFind] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [loanWay, setLoanWay] = useState('');
  const [loanState, setLoanState] = useState('');
  const [loanWhen, setLoanWhen] = useState('all');
  const [loanFrom, setLoanFrom] = useState('');
  const [loanTo, setLoanTo] = useState('');
  const [openId, setOpenId] = useState('');
  const [step, setStep] = useState<'write' | 'summary'>('write');
  const balance = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  const money = (value: number) => (hidden ? '৳ ••••' : taka(value, settings?.digits));
  async function load() {
    const localPeople = (await db.people.toArray()).map((row) => ({ id: row.id, name: String(row.name ?? ''), phone: String(row.phone ?? ''), writer: String(row.writer ?? ''), pending: true }));
    const localLoans = await db.loans.toArray();
    const events = await db.loan_events.toArray();
    const names = new Map<string, string>();
    const cache = (await db.settings.get('main'))?.cache;
    const showCached = (peopleRows: CachedPerson[], loanRows: Loan[]) => {
      for (const person of [...peopleRows, ...localPeople]) names.set(person.id, person.name);
      const ids = new Set(peopleRows.map((item) => item.id));
      setPeople([...peopleRows, ...localPeople.filter((item) => !ids.has(item.id))]);
      setLoans(loansWithPending(loanRows, localLoans, events, names) as Loan[]);
    };
    if (!online) { showCached(cache?.people ?? [], (cache?.loans ?? []) as Loan[]); return; }
    try {
      const [remotePeople, remoteLoans] = await Promise.all([api<Person[]>('/api/people'), api<Loan[]>('/api/loans')]);
      showCached(remotePeople, remoteLoans);
    } catch { showCached(cache?.people ?? [], (cache?.loans ?? []) as Loan[]); }
  }
  useEffect(() => { void load(); }, [online]);
  function dueStamp() {
    return dueDate ? Date.parse(`${dueDate}T18:00:00+06:00`) : undefined;
  }
  async function addPerson() {
    const who = name.trim();
    if (!who) return;
    if (phone.trim() && !phoneOk(phone)) { setError('ফোন নম্বর ১১ সংখ্যা, ০১ দিয়ে'); return; }
    try {
      const id = await queuePerson(who, phoneDigits(phone)); setPersonId(id); setName(''); setPhone(''); setAdding(false);
      setSaved({ title: 'খাতায় যোগ হয়েছে', detail: who });
      await syncNow(); await load();
    } catch { setError('সেভ হয়নি'); }
  }
  function loanAmount() {
    try { return toPaisa(amount || '0'); } catch { return null; }
  }
  function reviewLoan() {
    setError('');
    const principal = loanAmount();
    if (principal == null) { setError('সঠিক টাকা লিখুন'); return; }
    if (!personId) { setError('আগে নাম বেছে নিন'); return; }
    if (!principal) { setError('টাকার পরিমাণ দিন'); return; }
    if (direction === 'lend' && principal > balance) { setError('ব্যবহারযোগ্য ব্যালেন্সের বেশি যাবে না'); return; }
    setStep('summary');
  }
  async function addLoan() {
    setError('');
    try {
      const principal = loanAmount();
      if (principal == null) { setError('সঠিক টাকা লিখুন'); return; }
      if (!personId || !principal) { setError('আগে নাম বেছে নিন, তারপর টাকার পরিমাণ দিন'); return; }
      if (direction === 'lend' && principal > balance) { setError('ব্যবহারযোগ্য ব্যালেন্সের বেশি যাবে না'); return; }
      await queueLoan({ person_id: personId, direction, principal_paisa: principal, pocket_id: pocket, due_at: dueStamp() });
      setAmount(''); setDueDate(nextDhakaDay()); setStep('write'); setPane('list');
      setSaved({ title: 'ধার সেভ হয়েছে', detail: `${direction === 'lend' ? 'আমি দিয়েছি' : 'আমি নিয়েছি'} · ${taka(principal, settings?.digits)}` });
      await syncNow(); await load();
    } catch { setError('সেভ হয়নি'); }
  }
  async function pay(loan: Loan) {
    if (role !== 'admin') return;
    try {
      const paisa = toPaisa(repay[loan.id] || '0');
      if (!paisa) return;
      await queueRepayment({ loan_id: loan.id, amount_paisa: paisa, pocket_id: loan.pocket_id, direction: loan.direction });
      setRepay({ ...repay, [loan.id]: '' });
      setSaved({ title: 'ফেরত সেভ হয়েছে', detail: `${loan.direction === 'lend' ? 'ফেরত পেয়েছি' : 'ফেরত দিয়েছি'} · ${taka(paisa, settings?.digits)}` });
      await syncNow(); await load();
    } catch { setError('ফেরত সেভ হয়নি'); }
  }
  const stamp = (value: string) => new Date(value).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const statusText = (loan: Loan) => loan.pending ? 'ফোনে আছে, পরে যাবে' : loan.status === 'closed' ? 'শোধ হয়ে গেছে' : loan.status === 'partial' ? 'কিছু ফিরেছে' : 'এখনো খোলা';
  const groups = new Map<string, { id: string; name: string; phone: string; writer: string; loans: Loan[] }>();
  for (const person of people) groups.set(person.id, { id: person.id, name: person.name, phone: person.phone, writer: person.writer ?? '', loans: [] });
  for (const loan of loans) {
    const bucket = groups.get(loan.person_id) ?? { id: loan.person_id, name: loan.person_name, phone: '', writer: '', loans: [] };
    bucket.loans.push(loan);
    groups.set(loan.person_id, bucket);
  }
  const loanOn = loanWay !== '' || loanState !== '' || loanWhen !== 'all' || loanFrom !== '' || loanTo !== '';
  const listed = [...groups.values()].map((group) => {
    const personHit = matchesQuery(find, [group.name, group.phone]);
    const loans = group.loans.filter((loan) => {
      if (loanWay && loan.direction !== loanWay) return false;
      if (loanState === 'open' && loan.status !== 'open') return false;
      if (loanState === 'partial' && loan.status !== 'partial') return false;
      if (loanState === 'closed' && loan.status !== 'closed') return false;
      if (loanFrom || loanTo) { if (!inDateSpan(loan.opened_at, loanFrom, loanTo)) return false; }
      else if (!inDhakaWindow(loan.opened_at, loanWhen)) return false;
      return personHit || matchesQuery(find, [group.name, group.phone, wrote(group.writer), wrote(loan.writer), loan.direction === 'lend' ? 'আমি দিয়েছি' : 'আমি নিয়েছি', statusText(loan), taka(loan.remaining_paisa, settings?.digits), taka(loan.principal_paisa, settings?.digits), stamp(loan.opened_at), loan.due_at ? stamp(loan.due_at) : 'ফেরতের দিন ঠিক নেই', ...loan.events.map((event) => `${taka(event.amount_paisa, settings?.digits)} ${stamp(event.at)} ${wrote(event.writer)}`)]);
    });
    return { ...group, loans };
  }).filter((group) => (loanOn ? group.loans.length > 0 : matchesQuery(find, [group.name, group.phone]) || group.loans.length > 0));
  const open = [...groups.values()].find((group) => group.id === openId);
  usePageTitle(open?.name ?? '');
  const brief = (group: { loans: Loan[] }) => {
    const lend = group.loans.filter((loan) => loan.direction === 'lend').reduce((sum, loan) => sum + loan.remaining_paisa, 0);
    const borrow = group.loans.filter((loan) => loan.direction === 'borrow').reduce((sum, loan) => sum + loan.remaining_paisa, 0);
    if (!group.loans.length) return 'এখনো ধার নেই';
    const bits = [lend ? `দিয়েছি বাকি ${taka(lend, settings?.digits)}` : '', borrow ? `নিয়েছি বাকি ${taka(borrow, settings?.digits)}` : ''].filter(Boolean);
    return bits.join(' · ') || 'শোধ হয়ে গেছে';
  };
  return <div className={`khata-screen ${pane}${open ? ' person' : ''}`}>
    <div className="khata-tabs" role="group" aria-label="খাতা দেখা বা নতুন লেখা">
      <Button variant={pane === 'write' ? 'ledger' : 'outline'} size="touch" aria-pressed={pane === 'write'} onClick={() => setPane('write')}>নতুন লিখি</Button>
      <Button variant={pane === 'list' ? 'ledger' : 'outline'} size="touch" aria-pressed={pane === 'list'} onClick={() => setPane('list')}>খাতা দেখি</Button>
    </div>
    <div className="khata-compose">
      <section className="khata-loan">
        {step === 'summary' && <button type="button" className="day-back" onClick={() => { setError(''); setStep('write'); }}><ArrowLeft />পেছনে</button>}
        {step === 'write' ? <>
          <div className="send-kinds" role="group" aria-label="ধারের ধরন">
            <button type="button" className={`kind-out${direction === 'lend' ? ' on' : ''}`} aria-pressed={direction === 'lend'} onClick={() => setDirection('lend')}>ধার দিয়েছি</button>
            <button type="button" className={`kind-in${direction === 'borrow' ? ' on' : ''}`} aria-pressed={direction === 'borrow'} onClick={() => setDirection('borrow')}>ধার নিয়েছি</button>
          </div>
          <div className="pocket-circles entry-pockets" role="group" aria-label="কোন পকেট থেকে">{seedPockets.map((item) => <button type="button" key={item.id} className={`pocket-circle ${item.color}${pocket === item.id ? ' on' : ''}`} aria-pressed={pocket === item.id} onClick={() => setPocket(item.id)}><span className="pocket-bubble"><PocketMark id={item.id} /></span><span className="pocket-name">{item.name_bn}</span></button>)}</div>
          <section className="send-block">
            <p>কার কাছে</p>
            <div className="khata-name-row"><select className="send-phone" aria-label="কার কাছে" value={personId} onChange={(event) => setPersonId(event.target.value)}><option value="">নাম বেছে নিন</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><Button className="mini-btn" variant="outline" size="touch" onClick={() => setAdding(true)}>নতুন নাম</Button></div>
          </section>
          <section className="send-amount">
            <label className={`send-figure${amount ? ' has-value' : ''}`}><span aria-hidden>৳</span><input aria-label="টাকার পরিমাণ" inputMode="decimal" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          </section>
          <label className="khata-due">কবে ফেরত আশা করেন<input aria-label="কবে ফেরত আশা করেন" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <p className="send-balance">ব্যবহারযোগ্য ব্যালেন্স: {money(balance)}</p>
          {error && <p className="form-error send-error" role="alert">{error}</p>}
          <button type="button" className="send-next" onClick={reviewLoan}>পরবর্তী<ArrowRight /></button>
        </> : <section className="send-summary" aria-label="ধারের সারাংশ">
          <p className="send-total">{hidden ? '৳ ••••' : `৳${number((loanAmount() ?? 0) / 100, settings?.digits)}`}</p>
          <div className="send-row"><span>ধরন</span><b>{direction === 'lend' ? 'ধার দিয়েছি' : 'ধার নিয়েছি'}</b></div>
          <div className="send-row"><span>পকেট</span><b><PocketMark id={pocket} />{seedPockets.find((item) => item.id === pocket)?.name_bn}</b></div>
          <div className="send-row"><span>কার কাছে</span><b>{people.find((person) => person.id === personId)?.name || 'নাম নেই'}</b></div>
          <div className="send-row"><span>ফেরত</span><b>{dueDate || 'দিন ঠিক নেই'}</b></div>
          <div className="send-row"><span>ব্যবহারযোগ্য ব্যালেন্স</span><b>{money(balance)}</b></div>
          {error && <p className="form-error send-error" role="alert">{error}</p>}
          <button type="button" className="send-save" onClick={addLoan}>সেভ করুন</button>
        </section>}
      </section>
    </div>
    {adding && <div className="modal-shade"><section className="wizard" role="dialog" aria-label="নতুন মানুষ"><div className="wizard-header"><h2>নতুন মানুষ</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setAdding(false)}>বন্ধ</Button></div><div className="wizard-content"><p className="field-hint">যার সঙ্গে ধার রাখবেন, তার নাম দিন। ফোন না থাকলে খালি রাখুন।</p><label>নাম<input className="text-input" aria-label="নাম" placeholder="যেমন করিম" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} /></label><label>ফোন, না থাকলে খালি রাখুন<input className="text-input" aria-label="ফোন" placeholder="যেমন ০১৭১১০০০০০০" inputMode="tel" value={phone} onChange={(event) => setPhone(phoneDigits(event.target.value))} maxLength={11} /></label><Button variant="ledger" size="touch" onClick={addPerson}>খাতায় যোগ করুন</Button></div></section></div>}
    {pane === 'list' && error && <p className="form-error" role="alert">{error}</p>}
    <div className="finder"><div className="finder-actions"><button type="button" className={`search-open${finding ? ' on' : ''}`} aria-expanded={finding} onClick={() => { setFinding((open) => !open); setFind(''); }}><Search />খুঁজুন</button><button type="button" className={`filter-open${loanOn ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={filtering} onClick={() => setFiltering(true)}><SlidersHorizontal />ফিল্টার</button></div>{finding && <input className="text-input" aria-label="খাতা খুঁজুন" placeholder="নাম, ফোন, টাকা" value={find} autoFocus onChange={(event) => setFind(event.target.value)} />}{filtering && <div className="modal-shade" onClick={() => setFiltering(false)}><section className="wizard" role="dialog" aria-modal="true" aria-label="ফিল্টার" onClick={(event) => event.stopPropagation()}><div className="wizard-header"><h2>ফিল্টার</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setFiltering(false)}><X /></Button></div><div className="wizard-content report-filters"><div><span>সময়</span><div className="filter-row">{[['all', 'সব'], ['today', 'আজ'], ['7', '৭ দিন'], ['30', '৩০ দিন']].map(([id, label]) => <button type="button" key={id} className={!loanFrom && !loanTo && loanWhen === id ? 'on' : ''} aria-pressed={!loanFrom && !loanTo && loanWhen === id} onClick={() => { setLoanWhen(id); setLoanFrom(''); setLoanTo(''); }}>{label}</button>)}</div><div className="filter-dates"><label>শুরু<input type="date" aria-label="শুরুর দিন" value={loanFrom} onChange={(event) => setLoanFrom(event.target.value)} /></label><label>শেষ<input type="date" aria-label="শেষ দিন" value={loanTo} onChange={(event) => setLoanTo(event.target.value)} /></label></div></div><div><span>ধরন</span><div className="filter-row"><button type="button" className={loanWay === '' ? 'on' : ''} aria-pressed={loanWay === ''} onClick={() => setLoanWay('')}>সব</button><button type="button" className={loanWay === 'lend' ? 'on' : ''} aria-pressed={loanWay === 'lend'} onClick={() => setLoanWay('lend')}>আমি দিয়েছি</button><button type="button" className={loanWay === 'borrow' ? 'on' : ''} aria-pressed={loanWay === 'borrow'} onClick={() => setLoanWay('borrow')}>আমি নিয়েছি</button></div></div><div><span>অবস্থা</span><div className="filter-row"><button type="button" className={loanState === '' ? 'on' : ''} aria-pressed={loanState === ''} onClick={() => setLoanState('')}>সব</button><button type="button" className={loanState === 'open' ? 'on' : ''} aria-pressed={loanState === 'open'} onClick={() => setLoanState('open')}>এখনো খোলা</button><button type="button" className={loanState === 'partial' ? 'on' : ''} aria-pressed={loanState === 'partial'} onClick={() => setLoanState('partial')}>কিছু ফিরেছে</button><button type="button" className={loanState === 'closed' ? 'on' : ''} aria-pressed={loanState === 'closed'} onClick={() => setLoanState('closed')}>শোধ হয়ে গেছে</button></div></div><Button variant="ledger" size="touch" onClick={() => setFiltering(false)}>দেখুন</Button>{loanOn && <Button variant="outline" size="touch" onClick={() => { setLoanWay(''); setLoanState(''); setLoanWhen('all'); setLoanFrom(''); setLoanTo(''); }}>সব মুছুন</Button>}</div></section></div>}</div>
    {saved && <SavedPopup title={saved.title} detail={saved.detail} onClose={() => setSaved(null)} />}
    {open ? <div className="khata-detail">
      <Button variant="ghost" size="touch" className="day-back" onClick={() => setOpenId('')}><ArrowLeft />খাতায় ফিরুন</Button>
      <header className="khata-detail-head"><h2>{open.name}</h2><p>{open.phone || 'ফোন নেই'}</p><p>খাতায় যোগ করেছেন {wrote(open.writer)}</p></header>
      {open.loans.length === 0 && <p className="khata-empty">এই নামে এখনো ধার নেই।</p>}
      {open.loans.map((loan) => {
        const way = loan.direction === 'lend' ? 'আমি দিয়েছি' : 'আমি নিয়েছি';
        const pocketName = seedPockets.find((item) => item.id === loan.pocket_id)?.name_bn ?? 'পকেট';
        return <section className="khata-loan-detail" key={loan.id}>
          <p className={`loan-way ${loan.direction}`}>{way}</p>
          <p className="khata-status">{statusText(loan)}</p>
          <p className="loan-left"><span>এখন বাকি</span><strong className={loan.direction === 'lend' ? 'money-gave' : 'money-took'}>{taka(loan.remaining_paisa, settings?.digits)}</strong></p>
          <div className="khata-facts">
            <div className="khata-fact"><span>মোট ছিল</span><b>{taka(loan.principal_paisa, settings?.digits)}</b></div>
            <div className="khata-fact"><span>পকেট</span><b><PocketMark id={loan.pocket_id} />{pocketName}</b></div>
            <div className="khata-fact"><span>কবে খোলা</span><b>{stamp(loan.opened_at)}</b></div>
            <div className="khata-fact"><span>কবে ফেরত আশা</span><b>{loan.due_at ? stamp(loan.due_at) : 'দিন ঠিক নেই'}</b></div>
            <div className="khata-fact"><span>কে লিখেছে</span><b>{wrote(loan.writer)}</b></div>
          </div>
          <h3>যা হয়েছে</h3>
          <ul className="khata-story">{loan.events.map((event) => <li key={event.id}><span>{event.type === 'open' ? (loan.direction === 'lend' ? 'শুরুতে দিয়েছি' : 'শুরুতে নিয়েছি') : (loan.direction === 'lend' ? 'ফেরত পেয়েছি' : 'ফেরত দিয়েছি')}<small>{stamp(event.at)} · {wrote(event.writer)}</small></span><b>{taka(event.amount_paisa, settings?.digits)}</b></li>)}</ul>
          {role === 'admin' && loan.status !== 'closed' && !loan.pending && <div className="repay-row"><label>কত টাকা ফিরে এল<input className="text-input" aria-label="কত টাকা ফিরে এল" placeholder="যেমন ১০০" inputMode="decimal" value={repay[loan.id] ?? ''} onChange={(event) => setRepay({ ...repay, [loan.id]: event.target.value })} /></label><Button variant="outline" size="touch" onClick={() => pay(loan)}>{loan.direction === 'lend' ? 'ফেরত পেয়েছি' : 'ফেরত দিয়েছি'}</Button></div>}
        </section>;
      })}
    </div> : <div className="loan-list">{groups.size === 0 && <p className="khata-empty">এখনো কেউ নেই। নতুন লিখি খুলে নতুন নাম যোগ করুন।</p>}{groups.size > 0 && listed.length === 0 && <p className="khata-empty">কিছু মেলেনি।</p>}{listed.map((group) => <button type="button" className="khata-person-card" key={group.id} onClick={() => { setOpenId(group.id); setPane('list'); }}><span><strong>{group.name}</strong><small>{group.phone || 'ফোন নেই'} · {brief(group)}</small></span><ChevronRight /></button>)}</div>}
  </div>;
}
