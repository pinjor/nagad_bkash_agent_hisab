import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, seedPockets } from '../foundations/db';
import { PocketMark } from '../foundations/PocketMark';
import { matchesQuery, number, taka } from '../foundations/money';
import { api } from '../foundations/sync';
import { useHisab } from '../foundations/Provider';

const ranges = [{ id: 'today', label: 'আজ' }, { id: '7', label: '৭ দিন' }, { id: '30', label: '৩০ দিন' }, { id: 'all', label: 'সব' }] as const;
const kinds = [{ id: '', label: 'সব ধরন' }, { id: 'CASH_IN', label: 'টাকা ঢুকেছে' }, { id: 'CASH_OUT', label: 'টাকা বের হয়েছে' }, { id: 'FLEXI', label: 'ফ্লেক্সিলোড' }, { id: 'LEND', label: 'ধার দিয়েছি' }, { id: 'BORROW', label: 'ধার নিয়েছি' }, { id: 'REPAY', label: 'ফেরত' }] as const;
const kindLabel: Record<string, string> = { CASH_IN: 'টাকা ঢুকেছে', CASH_OUT: 'টাকা বের হয়েছে', FLEXI: 'ফ্লেক্সিলোড', LEND: 'ধার দিয়েছি', BORROW: 'ধার নিয়েছি', REPAY_IN: 'ফেরত পেয়েছি', REPAY_OUT: 'ফেরত দিয়েছি' };
const pocketName = Object.fromEntries(seedPockets.map((pocket) => [pocket.id, pocket.name_bn]));

interface Line { id: string; txn_type: string; amount_paisa: number; created_at: string; actor: string; pocket_id: string; phone?: string; pending?: boolean }
interface Day { date: string; lines: Line[] }

function dhakaToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}
function shiftDate(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
function inRange(date: string, range: string) {
  if (range === 'all') return true;
  const back = range === 'today' ? 0 : range === '30' ? 29 : 6;
  return date >= shiftDate(dhakaToday(), back) && date <= dhakaToday();
}
function matchesKind(type: string, kind: string) {
  if (!kind) return true;
  if (kind === 'REPAY') return type === 'REPAY_IN' || type === 'REPAY_OUT';
  return type === kind;
}
function dayTitle(date: string) {
  return new Date(`${date}T12:00:00+06:00`).toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' });
}
function stamp(value: string) {
  return new Date(value).toLocaleTimeString('bn-BD', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit' });
}
function sum(lines: Line[], type: string) {
  return lines.filter((line) => line.txn_type === type).reduce((total, line) => total + line.amount_paisa, 0);
}

export function Reports() {
  const { settings, online, role } = useHisab();
  const historyOnly = role === 'employee';
  const [range, setRange] = useState<(typeof ranges)[number]['id']>('7');
  const [kind, setKind] = useState('');
  const [pocket, setPocket] = useState('');
  const [open, setOpen] = useState(false);
  const [finding, setFinding] = useState(false);
  const [find, setFind] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [server, setServer] = useState<Day[]>([]);
  const [error, setError] = useState('');
  const local = useLiveQuery(async () => {
    const txns = await db.transactions.filter((txn) => txn.status === 'active' && txn.txn_type !== 'OPENING').toArray();
    const legs = await db.txn_legs.toArray();
    return txns.map((txn) => {
      const own = legs.filter((leg) => leg.txn_id === txn.id);
      const from = own.find((leg) => leg.amount_paisa < 0) ?? own[0];
      return { id: txn.id, txn_type: txn.txn_type, amount_paisa: txn.amount_paisa, date: txn.date, created_at: new Date(txn.created_at).toISOString(), actor: '', pocket_id: from?.pocket_id ?? '', phone: txn.phone ?? '', pending: true } satisfies Line & { date: string };
    });
  }, []);
  useEffect(() => {
    if (!online) return;
    const query = new URLSearchParams({ range, kind, pocket });
    api<{ days: Day[] }>(`/api/reports/days?${query}`).then((body) => { setServer(body.days); setError(''); }).catch(() => setError('রিপোর্ট আসেনি'));
  }, [online, range, kind, pocket]);
  const pending = (local ?? []).filter((row) => inRange(row.date, range) && matchesKind(row.txn_type, kind) && (!pocket || row.pocket_id === pocket));
  const seen = new Set(pending.map((row) => row.id));
  const days: Day[] = server.map((day) => ({ date: day.date, lines: [...pending.filter((row) => row.date === day.date), ...day.lines.filter((line) => !seen.has(line.id))] }));
  for (const row of pending) {
    if (days.some((day) => day.date === row.date)) continue;
    days.push({ date: row.date, lines: pending.filter((item) => item.date === row.date) });
  }
  days.sort((a, b) => b.date.localeCompare(a.date));
  const lineBits = (line: Line) => [kindLabel[line.txn_type], pocketName[line.pocket_id], line.phone, line.actor, line.pending ? 'ফোনে আছে' : '', stamp(line.created_at), taka(line.amount_paisa, settings?.digits)];
  const listed = days.map((day) => matchesQuery(find, [dayTitle(day.date)]) ? day : { ...day, lines: day.lines.filter((line) => matchesQuery(find, [dayTitle(day.date), ...lineBits(line)])) }).filter((day) => !find.trim() || day.lines.length);
  const lines = listed.flatMap((day) => day.lines);
  const digits = settings?.digits;
  const filtersOn = range !== '7' || kind !== '' || pocket !== '';
  const chosen = days.find((day) => day.date === openDate);
  const chosenLines = chosen ? chosen.lines.filter((line) => matchesQuery(find, [dayTitle(chosen.date), ...lineBits(line)])) : [];
  const rangeLabel = ranges.find((item) => item.id === range)?.label ?? '';
  const kindText = kinds.find((item) => item.id === kind)?.label ?? 'সব ধরন';
  const pocketText = pocket ? (pocketName[pocket] ?? 'পকেট') : 'সব পকেট';
  const rows = (items: Line[]) => [
    ['in', 'ঢুকেছে', taka(sum(items, 'CASH_IN'), digits)],
    ['out', 'বের হয়েছে', taka(sum(items, 'CASH_OUT'), digits)],
    ['flexi', 'ফ্লেক্সিলোড', taka(sum(items, 'FLEXI'), digits)],
    ['loan', 'ধার', taka(sum(items, 'LEND') + sum(items, 'BORROW'), digits)],
  ] as const;
  return <div className="report-page">
    <div className="report-top">
      <p className="field-hint">{historyOnly ? 'আগের হিসাব। কে লিখেছে, কোন পকেট, কত টাকা।' : 'কোন দিনে কত টাকা ঢুকেছে, বের হয়েছে, কে লিখেছে'}</p>
      <div className="report-actions">
        <button type="button" className={`search-open${finding ? ' on' : ''}`} aria-expanded={finding} onClick={() => { setFinding((shown) => !shown); setFind(''); }}><Search />খুঁজুন</button>
        <button type="button" className={`filter-open${filtersOn ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><SlidersHorizontal />ফিল্টার</button>
      </div>
    </div>
    {finding && <input className="text-input" aria-label="রিপোর্ট খুঁজুন" placeholder="দিন, নাম, পকেট, টাকা" value={find} autoFocus onChange={(event) => setFind(event.target.value)} />}
    {open && <div className="modal-shade" onClick={() => setOpen(false)}><section className="wizard" role="dialog" aria-modal="true" aria-label="ফিল্টার" onClick={(event) => event.stopPropagation()}><div className="wizard-header"><h2>ফিল্টার</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setOpen(false)}><X /></Button></div><div className="wizard-content report-filters"><p className="field-hint">সময়, ধরন, আর পকেট বেছে নিন। তারপর দেখুন চাপুন।</p><div><span>সময়</span><div className="filter-row">{ranges.map((item) => <button type="button" key={item.id} className={range === item.id ? 'on' : ''} aria-pressed={range === item.id} onClick={() => setRange(item.id)}>{item.label}</button>)}</div></div><div><span>ধরন</span><div className="filter-row">{kinds.map((item) => <button type="button" key={item.id || 'all'} className={kind === item.id ? 'on' : ''} aria-pressed={kind === item.id} onClick={() => setKind(item.id)}>{item.label}</button>)}</div></div><div><span>পকেট</span><div className="filter-row"><button type="button" className={pocket === '' ? 'on' : ''} aria-pressed={pocket === ''} onClick={() => setPocket('')}>সব পকেট</button>{seedPockets.map((item) => <button type="button" key={item.id} className={pocket === item.id ? 'on' : ''} aria-pressed={pocket === item.id} onClick={() => setPocket(item.id)}><PocketMark id={item.id} />{item.name_bn}</button>)}</div></div><Button variant="ledger" size="touch" onClick={() => setOpen(false)}>দেখুন</Button>{filtersOn && <Button variant="outline" size="touch" onClick={() => { setRange('7'); setKind(''); setPocket(''); }}>সব মুছুন</Button>}</div></section></div>}
    {error && <p className="form-error">{error}</p>}
    {!online && <p className="field-hint">অফলাইন। ফোনে যা আছে সেটাই দেখাচ্ছে।</p>}
    {chosen ? <section className="day-card day-detail">
      <button type="button" className="day-back" onClick={() => setOpenDate('')}><ArrowLeft />সব দিন</button>
      <header><h2>{dayTitle(chosen.date)}</h2><span>{number(chosenLines.length, digits)}টি হিসাব</span></header>
      <p className="field-hint">{rangeLabel} · {kindText} · {pocketText}</p>
      {!historyOnly && <div className="day-rows">{rows(chosenLines).map(([tone, label, amount]) => <div key={label}><span><i className={`tone ${tone}`} />{label}</span><b>{amount}</b></div>)}</div>}
      <ul className="day-lines">{chosenLines.map((line) => <li key={line.id}><div><strong>{kindLabel[line.txn_type] ?? line.txn_type}</strong><span><PocketMark id={line.pocket_id} />{pocketName[line.pocket_id] ?? 'পকেট'}{line.phone ? ` · ${line.phone}` : ''} · {line.pending ? 'ফোনে আছে' : line.actor || 'মালিক'} · {stamp(line.created_at)}</span></div><b className={line.txn_type === 'CASH_OUT' || line.txn_type === 'LEND' || line.txn_type === 'REPAY_OUT' ? 'out' : 'in'}>{taka(line.amount_paisa, digits)}</b></li>)}</ul>
    </section> : <>
    {!historyOnly && <section className="settings-group">
      <h2>এই সময়ে</h2>
      <p className="field-hint">{rangeLabel} · {kindText} · {pocketText} · {number(lines.length, digits)}টি হিসাব</p>
      <div className="settings-list report-totals">
        {rows(lines).map(([tone, label, amount]) => <article key={label}><i className={`tone ${tone}`} /><div><h3>{label}</h3></div><strong>{amount}</strong></article>)}
      </div>
    </section>}
    <section className="settings-group">
      <h2>দিন ধরে</h2>
      <p className="field-hint">একটা দিন চাপলে সেই দিনের প্রতিটি হিসাব খুলবে।</p>
      {days.length === 0 && <p className="khata-empty">এই ফিল্টারে কোনো হিসাব নেই।</p>}
      {days.length > 0 && listed.length === 0 && <p className="khata-empty">কিছু মেলেনি।</p>}
      <div className="day-list">{listed.map((day) => <button type="button" className="day-card day-summary" key={day.date} onClick={() => setOpenDate(day.date)}>
        <header><h2>{dayTitle(day.date)}</h2><span>বিস্তারিত</span></header>
        <p>{number(day.lines.length, digits)}টি হিসাব</p>
        {!historyOnly && <div className="stat-grid">{rows(day.lines).map(([tone, label, amount]) => <div key={label}><span><i className={`tone ${tone}`} />{label}</span><b>{amount}</b></div>)}</div>}
      </button>)}</div>
    </section></>}
  </div>;
}
