import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, queueLoan, queuePerson, queueRepayment, seedPockets, type CachedPerson } from '../foundations/db';
import { PocketMark } from '../foundations/PocketMark';
import { loansWithPending } from '../foundations/ledger-view';
import { inDhakaWindow, matchesQuery, taka, toPaisa } from '../foundations/money';
import { useHisab } from '../foundations/Provider';
import { api } from '../foundations/sync';

interface Person { id: string; name: string; phone: string; pending?: boolean }
interface LoanEvent { id: string; type: string; amount_paisa: number; at: string }
interface Loan { id: string; person_id: string; person_name: string; direction: 'lend' | 'borrow'; principal_paisa: number; remaining_paisa: number; pocket_id: string; opened_at: string; due_at?: string | null; closed_at: string | null; status: string; events: LoanEvent[]; pending?: boolean }

export function People() {
  const { role, settings, online, syncNow } = useHisab();
  const [people, setPeople] = useState<Person[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [adding, setAdding] = useState(false);
  const [personId, setPersonId] = useState(''); const [direction, setDirection] = useState<'lend' | 'borrow'>('lend');
  const [amount, setAmount] = useState(''); const [pocket, setPocket] = useState('CASH');
  const [dueDate, setDueDate] = useState('');
  const [repay, setRepay] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pane, setPane] = useState<'list' | 'write'>('write');
  const [finding, setFinding] = useState(false);
  const [find, setFind] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [loanWay, setLoanWay] = useState('');
  const [loanState, setLoanState] = useState('');
  const [loanWhen, setLoanWhen] = useState('all');
  async function load() {
    const localPeople = (await db.people.toArray()).map((row) => ({ id: row.id, name: String(row.name ?? ''), phone: String(row.phone ?? ''), pending: true }));
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
    if (!name.trim()) return;
    const id = await queuePerson(name, phone); setPersonId(id); setName(''); setPhone(''); setAdding(false); await syncNow(); await load();
  }
  async function addLoan() {
    setError('');
    try {
      const principal = toPaisa(amount || '0');
      if (!personId || !principal) { setError('আগে নাম বেছে নিন, তারপর টাকার পরিমাণ দিন'); return; }
      await queueLoan({ person_id: personId, direction, principal_paisa: principal, pocket_id: pocket, due_at: dueStamp() });
      setAmount(''); setDueDate(''); setPane('list'); await syncNow(); await load();
    } catch { setError('সেভ হয়নি'); }
  }
  async function pay(loan: Loan) {
    if (role !== 'admin') return;
    try {
      const paisa = toPaisa(repay[loan.id] || '0');
      if (!paisa) return;
      await queueRepayment({ loan_id: loan.id, amount_paisa: paisa, pocket_id: loan.pocket_id, direction: loan.direction });
      await syncNow(); await load();
    } catch { setError('ফেরত সেভ হয়নি'); }
  }
  const stamp = (value: string) => new Date(value).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const statusText = (loan: Loan) => loan.pending ? 'ফোনে আছে, পরে যাবে' : loan.status === 'closed' ? 'শোধ হয়ে গেছে' : loan.status === 'partial' ? 'কিছু ফিরেছে' : 'এখনো খোলা';
  const groups = new Map<string, { id: string; name: string; phone: string; loans: Loan[] }>();
  for (const person of people) groups.set(person.id, { id: person.id, name: person.name, phone: person.phone, loans: [] });
  for (const loan of loans) {
    const bucket = groups.get(loan.person_id) ?? { id: loan.person_id, name: loan.person_name, phone: '', loans: [] };
    bucket.loans.push(loan);
    groups.set(loan.person_id, bucket);
  }
  const loanOn = loanWay !== '' || loanState !== '' || loanWhen !== 'all';
  const listed = [...groups.values()].map((group) => {
    const personHit = matchesQuery(find, [group.name, group.phone]);
    const loans = group.loans.filter((loan) => {
      if (loanWay && loan.direction !== loanWay) return false;
      if (loanState === 'open' && loan.status !== 'open') return false;
      if (loanState === 'partial' && loan.status !== 'partial') return false;
      if (loanState === 'closed' && loan.status !== 'closed') return false;
      if (!inDhakaWindow(loan.opened_at, loanWhen)) return false;
      return personHit || matchesQuery(find, [group.name, group.phone, loan.direction === 'lend' ? 'আমি দিয়েছি' : 'আমি নিয়েছি', statusText(loan), taka(loan.remaining_paisa, settings?.digits), taka(loan.principal_paisa, settings?.digits), stamp(loan.opened_at), loan.due_at ? stamp(loan.due_at) : 'ফেরতের দিন ঠিক নেই', ...loan.events.map((event) => `${taka(event.amount_paisa, settings?.digits)} ${stamp(event.at)}`)]);
    });
    return { ...group, loans };
  }).filter((group) => (loanOn ? group.loans.length > 0 : matchesQuery(find, [group.name, group.phone]) || group.loans.length > 0));
  return <div className={`khata-screen ${pane}`}>
    <div className="khata-tabs" role="group" aria-label="খাতা দেখা বা নতুন লেখা">
      <Button variant={pane === 'write' ? 'ledger' : 'outline'} size="touch" aria-pressed={pane === 'write'} onClick={() => setPane('write')}>নতুন লিখি</Button>
      <Button variant={pane === 'list' ? 'ledger' : 'outline'} size="touch" aria-pressed={pane === 'list'} onClick={() => setPane('list')}>খাতা দেখি</Button>
    </div>
    <div className="khata-compose">
      <section className="loan-card khata-loan"><h2>নতুন ধার</h2>
        <label>কার কাছে<select className="text-input" aria-label="কার কাছে" value={personId} onChange={(event) => setPersonId(event.target.value)}><option value="">নাম বেছে নিন</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <Button variant="outline" size="touch" onClick={() => setAdding(true)}>নতুন নাম যোগ করুন</Button>
        <div className="segmented"><Button variant={direction === 'lend' ? 'ledger' : 'ghost'} size="touch" onClick={() => setDirection('lend')}>আমি দিয়েছি</Button><Button variant={direction === 'borrow' ? 'ledger' : 'ghost'} size="touch" onClick={() => setDirection('borrow')}>আমি নিয়েছি</Button></div>
        <label>টাকার পরিমাণ<input className="text-input" aria-label="টাকার পরিমাণ" placeholder="যেমন ৫০০" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>কোন পকেট থেকে<div className="pocket-picks" role="group" aria-label="কোন পকেট থেকে">{seedPockets.map((item) => <button type="button" key={item.id} className={pocket === item.id ? 'on' : ''} aria-pressed={pocket === item.id} onClick={() => setPocket(item.id)}><PocketMark id={item.id} />{item.name_bn}</button>)}</div></label>
        <label>কবে ফেরত আশা করেন<input className="text-input" aria-label="কবে ফেরত আশা করেন" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <Button variant="ledger" size="touch" onClick={addLoan}>ধার সেভ করুন</Button>
      </section>
    </div>
    {adding && <div className="modal-shade"><section className="wizard" role="dialog" aria-label="নতুন মানুষ"><div className="wizard-header"><h2>নতুন মানুষ</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setAdding(false)}>বন্ধ</Button></div><div className="wizard-content"><p className="field-hint">যার সঙ্গে ধার রাখবেন, তার নাম দিন। ফোন না থাকলে খালি রাখুন।</p><label>নাম<input className="text-input" aria-label="নাম" placeholder="যেমন করিম" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} /></label><label>ফোন, না থাকলে খালি রাখুন<input className="text-input" aria-label="ফোন" placeholder="যেমন ০১৭১১০০০০০০" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} /></label><Button variant="ledger" size="touch" onClick={addPerson}>খাতায় যোগ করুন</Button></div></section></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="finder"><div className="finder-actions"><button type="button" className={`search-open${finding ? ' on' : ''}`} aria-expanded={finding} onClick={() => { setFinding((open) => !open); setFind(''); }}><Search />খুঁজুন</button><button type="button" className={`filter-open${loanOn ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={filtering} onClick={() => setFiltering(true)}><SlidersHorizontal />ফিল্টার</button></div>{finding && <input className="text-input" aria-label="খাতা খুঁজুন" placeholder="নাম, ফোন, টাকা" value={find} autoFocus onChange={(event) => setFind(event.target.value)} />}{filtering && <div className="modal-shade" onClick={() => setFiltering(false)}><section className="wizard" role="dialog" aria-modal="true" aria-label="ফিল্টার" onClick={(event) => event.stopPropagation()}><div className="wizard-header"><h2>ফিল্টার</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setFiltering(false)}><X /></Button></div><div className="wizard-content report-filters"><div><span>সময়</span><div className="filter-row">{[['all', 'সব'], ['today', 'আজ'], ['7', '৭ দিন'], ['30', '৩০ দিন']].map(([id, label]) => <button type="button" key={id} className={loanWhen === id ? 'on' : ''} aria-pressed={loanWhen === id} onClick={() => setLoanWhen(id)}>{label}</button>)}</div></div><div><span>ধরন</span><div className="filter-row"><button type="button" className={loanWay === '' ? 'on' : ''} aria-pressed={loanWay === ''} onClick={() => setLoanWay('')}>সব</button><button type="button" className={loanWay === 'lend' ? 'on' : ''} aria-pressed={loanWay === 'lend'} onClick={() => setLoanWay('lend')}>আমি দিয়েছি</button><button type="button" className={loanWay === 'borrow' ? 'on' : ''} aria-pressed={loanWay === 'borrow'} onClick={() => setLoanWay('borrow')}>আমি নিয়েছি</button></div></div><div><span>অবস্থা</span><div className="filter-row"><button type="button" className={loanState === '' ? 'on' : ''} aria-pressed={loanState === ''} onClick={() => setLoanState('')}>সব</button><button type="button" className={loanState === 'open' ? 'on' : ''} aria-pressed={loanState === 'open'} onClick={() => setLoanState('open')}>এখনো খোলা</button><button type="button" className={loanState === 'partial' ? 'on' : ''} aria-pressed={loanState === 'partial'} onClick={() => setLoanState('partial')}>কিছু ফিরেছে</button><button type="button" className={loanState === 'closed' ? 'on' : ''} aria-pressed={loanState === 'closed'} onClick={() => setLoanState('closed')}>শোধ হয়ে গেছে</button></div></div><Button variant="ledger" size="touch" onClick={() => setFiltering(false)}>দেখুন</Button>{loanOn && <Button variant="outline" size="touch" onClick={() => { setLoanWay(''); setLoanState(''); setLoanWhen('all'); }}>সব মুছুন</Button>}</div></section></div>}</div>
    <div className="loan-list">{groups.size === 0 && <p className="khata-empty">এখনো কেউ নেই। নতুন লিখি খুলে নতুন নাম যোগ করুন।</p>}{groups.size > 0 && listed.length === 0 && <p className="khata-empty">কিছু মেলেনি।</p>}{listed.map((group) => <section className="loan-card person-block" key={group.id}><header><strong>{group.name}</strong><span>{group.phone || 'ফোন নেই'}</span></header>{group.loans.length === 0 && <p>এই নামে এখনো ধার নেই।</p>}{group.loans.map((loan) => <article key={loan.id}><p>{loan.direction === 'lend' ? 'আমি দিয়েছি' : 'আমি নিয়েছি'} · <PocketMark id={loan.pocket_id} />{seedPockets.find((item) => item.id === loan.pocket_id)?.name_bn ?? 'পকেট'} · {statusText(loan)}</p><p>এখন বাকি {taka(loan.remaining_paisa, settings?.digits)} · মোট ছিল {taka(loan.principal_paisa, settings?.digits)} · খোলা {stamp(loan.opened_at)} · {loan.due_at ? `ফেরত আশা ${stamp(loan.due_at)}` : 'ফেরতের দিন ঠিক নেই'}</p><ul className="timeline">{loan.events.map((event) => <li key={event.id}>{event.type === 'open' ? (loan.direction === 'lend' ? 'শুরুতে দিয়েছি' : 'শুরুতে নিয়েছি') : (loan.direction === 'lend' ? 'ফেরত পেয়েছি' : 'ফেরত দিয়েছি')} {taka(event.amount_paisa, settings?.digits)} · {stamp(event.at)}</li>)}</ul>{role === 'admin' && loan.status !== 'closed' && !loan.pending && <div className="repay-row"><label>কত টাকা ফিরে এল<input className="text-input" aria-label="কত টাকা ফিরে এল" placeholder="যেমন ১০০" inputMode="decimal" value={repay[loan.id] ?? ''} onChange={(event) => setRepay({ ...repay, [loan.id]: event.target.value })} /></label><Button variant="outline" size="touch" onClick={() => pay(loan)}>{loan.direction === 'lend' ? 'ফেরত পেয়েছি' : 'ফেরত দিয়েছি'}</Button></div>}</article>)}</section>)}</div>
  </div>;
}
