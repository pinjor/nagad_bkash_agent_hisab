import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from '@tanstack/react-router';
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

interface Line { id: string; txn_type: string; amount_paisa: number; created_at: string; actor: string; pocket_id: string; phone?: string; party?: string; pending?: boolean }
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
function inRange(date: string, range: string, from = '', to = '') {
  if (from || to) return (!from || date >= from) && (!to || date <= to);
  if (range === 'all' || range === 'custom') return !from && !to;
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
function wrote(name?: string) {
  const clean = (name ?? '').trim();
  return clean || 'কে লিখেছে জানা নেই';
}
const dharTypes = new Set(['LEND', 'BORROW', 'REPAY_IN', 'REPAY_OUT']);
function chipClass(type: string) {
  if (type === 'LEND') return 'lend';
  if (type === 'BORROW') return 'borrow';
  if (type === 'REPAY_IN' || type === 'CASH_IN') return 'repay-in';
  if (type === 'FLEXI') return 'flexi';
  return 'repay-out';
}
function lineTitle(line: Line) {
  if (dharTypes.has(line.txn_type) || line.pocket_id === 'PHARMA' || line.pocket_id === 'MOBILE') return (line.party ?? '').trim() || 'নাম নেই';
  return (line.phone ?? '').trim() || 'ফোন নেই';
}
function HisabCards({ items, digits }: { items: Line[]; digits: Parameters<typeof taka>[1] }) {
  if (!items.length) return null;
  return <div className="hisab-cards">{items.map((line) => <article className="hisab-card" key={line.id}><header><strong>{lineTitle(line)}</strong><span className={`loan-way ${chipClass(line.txn_type)}`}>{kindLabel[line.txn_type] ?? line.txn_type}</span></header><p className="loan-left"><strong>{taka(line.amount_paisa, digits)}</strong></p><p className="hisab-meta"><PocketMark id={line.pocket_id} />{pocketName[line.pocket_id] ?? 'পকেট'} · {stamp(line.created_at)}{line.pending ? ' · ফোনে আছে' : ''}</p><p className="hisab-writer">লিখেছে {wrote(line.actor)}</p></article>)}</div>;
}

export function dharPaisa(items: { txn_type: string; amount_paisa: number }[]) {
  const of = (type: string) => items.filter((line) => line.txn_type === type).reduce((total, line) => total + line.amount_paisa, 0);
  return { given: of('LEND') - of('REPAY_IN'), taken: of('BORROW') - of('REPAY_OUT'), backIn: of('REPAY_IN'), backOut: of('REPAY_OUT') };
}

export function Reports({ initial }: { initial?: { pocket?: string; kind?: string; range?: string } }) {
  const { settings, online, role } = useHisab();
  const historyOnly = role === 'employee';
  const startRange = initial?.range === 'today' || initial?.range === '7' || initial?.range === '30' || initial?.range === 'all' ? initial.range : '7';
  const [range, setRange] = useState<string>(startRange);
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [kind, setKind] = useState(initial?.kind ?? '');
  const [pocket, setPocket] = useState(initial?.pocket ?? '');
  const focused = Boolean(initial?.pocket || initial?.kind);
  useEffect(() => {
    setPocket(initial?.pocket ?? '');
    setKind(initial?.kind ?? '');
    setRange(initial?.range === 'today' || initial?.range === '7' || initial?.range === '30' || initial?.range === 'all' ? initial.range : '7');
  }, [initial?.pocket, initial?.kind, initial?.range]);
  const [open, setOpen] = useState(false);
  const [finding, setFinding] = useState(false);
  const [find, setFind] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [dayStat, setDayStat] = useState('');
  const [server, setServer] = useState<Day[]>([]);
  const [error, setError] = useState('');
  const local = useLiveQuery(async () => {
    const txns = await db.transactions.filter((txn) => txn.status === 'active' && txn.txn_type !== 'OPENING').toArray();
    const legs = await db.txn_legs.toArray();
    return txns.map((txn) => {
      const own = legs.filter((leg) => leg.txn_id === txn.id);
      const from = own.find((leg) => leg.amount_paisa < 0) ?? own[0];
      return { id: txn.id, txn_type: txn.txn_type, amount_paisa: txn.amount_paisa, date: txn.date, created_at: new Date(txn.created_at).toISOString(), actor: txn.writer ?? '', party: txn.party ?? '', pocket_id: from?.pocket_id ?? '', phone: txn.phone ?? '', pending: true } satisfies Line & { date: string };
    });
  }, []);
  useEffect(() => {
    if (!online) return;
    const query = new URLSearchParams({ range, kind, pocket });
    if (fromDay) query.set('from', fromDay);
    if (toDay) query.set('to', toDay);
    api<{ days: Day[] }>(`/api/reports/days?${query}`).then((body) => { setServer(body.days); setError(''); }).catch(() => setError('রিপোর্ট আসেনি'));
  }, [online, range, kind, pocket, fromDay, toDay]);
  const pending = (local ?? []).filter((row) => inRange(row.date, range, fromDay, toDay) && matchesKind(row.txn_type, kind) && (!pocket || row.pocket_id === pocket));
  const seen = new Set(pending.map((row) => row.id));
  const days: Day[] = server.filter((day) => inRange(day.date, range, fromDay, toDay)).map((day) => ({ date: day.date, lines: [...pending.filter((row) => row.date === day.date), ...day.lines.filter((line) => !seen.has(line.id))] }));
  for (const row of pending) {
    if (days.some((day) => day.date === row.date)) continue;
    days.push({ date: row.date, lines: pending.filter((item) => item.date === row.date) });
  }
  days.sort((a, b) => b.date.localeCompare(a.date));
  const lineBits = (line: Line) => [kindLabel[line.txn_type], pocketName[line.pocket_id], line.phone, line.party, wrote(line.actor), line.pending ? 'ফোনে আছে' : '', stamp(line.created_at), taka(line.amount_paisa, settings?.digits)];
  const listed = days.map((day) => matchesQuery(find, [dayTitle(day.date)]) ? day : { ...day, lines: day.lines.filter((line) => matchesQuery(find, [dayTitle(day.date), ...lineBits(line)])) }).filter((day) => !find.trim() || day.lines.length);
  const lines = listed.flatMap((day) => day.lines);
  const digits = settings?.digits;
  const filtersOn = range !== '7' || kind !== '' || pocket !== '' || fromDay !== '' || toDay !== '';
  const chosen = days.find((day) => day.date === openDate);
  const statHit = (line: Line, stat: string) => {
    if (!stat) return true;
    if (stat.startsWith('pocket:')) return line.pocket_id === stat.slice(7);
    return line.txn_type === stat;
  };
  const chosenLines = chosen ? chosen.lines.filter((line) => statHit(line, dayStat) && matchesQuery(find, [dayTitle(chosen.date), ...lineBits(line)])) : [];
  const rangeLabel = fromDay || toDay ? `${fromDay || '…'} – ${toDay || '…'}` : (ranges.find((item) => item.id === range)?.label ?? '');
  const kindText = kinds.find((item) => item.id === kind)?.label ?? 'সব ধরন';
  const pocketText = pocket ? (pocketName[pocket] ?? 'পকেট') : 'সব পকেট';
  const stats = (items: Line[]) => {
    const dhar = dharPaisa(items);
    const pocket = (id: string) => items.filter((line) => line.pocket_id === id).reduce((total, line) => total + line.amount_paisa, 0);
    return [
      { key: 'CASH_IN', tone: 'in', label: 'ঢুকেছে', amount: taka(sum(items, 'CASH_IN'), digits), money: 'money-gave' },
      { key: 'CASH_OUT', tone: 'out', label: 'বের হয়েছে', amount: taka(sum(items, 'CASH_OUT'), digits), money: 'money-took' },
      { key: 'pocket:CASH', tone: 'cash', label: 'হাতে নগদ', amount: taka(pocket('CASH'), digits), money: '' },
      { key: 'pocket:BKASH', tone: 'bkash', label: 'বিকাশ', amount: taka(pocket('BKASH'), digits), money: '' },
      { key: 'pocket:NAGAD', tone: 'nagad', label: 'নগদ', amount: taka(pocket('NAGAD'), digits), money: '' },
      { key: 'pocket:ROCKET', tone: 'rocket', label: 'রকেট', amount: taka(pocket('ROCKET'), digits), money: '' },
      { key: 'FLEXI', tone: 'flexi', label: 'ফ্লেক্সিলোড', amount: taka(sum(items, 'FLEXI'), digits), money: '' },
      { key: 'pocket:PHARMA', tone: 'pharma', label: 'ফার্মেসি', amount: taka(pocket('PHARMA'), digits), money: '' },
      { key: 'pocket:MOBILE', tone: 'mobile', label: 'মোবাইল', amount: taka(pocket('MOBILE'), digits), money: '' },
      { key: 'LEND', tone: 'lend', label: 'ধার দিয়েছি', amount: taka(dhar.given, digits), money: 'money-gave' },
      { key: 'REPAY_IN', tone: 'repay-in', label: 'ফেরত পেয়েছি', amount: taka(dhar.backIn, digits), money: 'money-gave' },
      { key: 'BORROW', tone: 'borrow', label: 'ধার নিয়েছি', amount: taka(dhar.taken, digits), money: 'money-took' },
      { key: 'REPAY_OUT', tone: 'repay-out', label: 'ফেরত দিয়েছি', amount: taka(dhar.backOut, digits), money: 'money-took' },
    ];
  };
  const openDay = (date: string, stat: string) => { setOpenDate(date); setDayStat(stat); };
  const focusTitle = pocket ? (pocketName[pocket] ?? 'পকেট') : (kinds.find((item) => item.id === kind)?.label ?? 'হিসাব');
  if (focused) return <div className="report-page">
    <Link to="/" className="day-back"><ArrowLeft />পেছনে</Link>
    <section className="settings-group">
      <h2>{focusTitle}</h2>
      <p className="field-hint">{number(lines.length, digits)}টি হিসাব</p>
      {lines.length === 0 && <p className="khata-empty">এই ফিল্টারে কোনো হিসাব নেই।</p>}
      <HisabCards items={lines} digits={digits} />
    </section>
  </div>;
  return <div className="report-page">
    <div className="report-top">
      <div className="report-actions">
        <button type="button" className={`search-open${finding ? ' on' : ''}`} aria-expanded={finding} onClick={() => { setFinding((shown) => !shown); setFind(''); }}><Search />খুঁজুন</button>
        <button type="button" className={`filter-open${filtersOn ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><SlidersHorizontal />ফিল্টার</button>
      </div>
    </div>
    {finding && <input className="text-input" aria-label="রিপোর্ট খুঁজুন" placeholder="দিন, নাম, পকেট, টাকা" value={find} autoFocus onChange={(event) => setFind(event.target.value)} />}
    {open && <div className="modal-shade" onClick={() => setOpen(false)}><section className="wizard" role="dialog" aria-modal="true" aria-label="ফিল্টার" onClick={(event) => event.stopPropagation()}><div className="wizard-header"><h2>ফিল্টার</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setOpen(false)}><X /></Button></div><div className="wizard-content report-filters"><p className="field-hint">সময়, ধরন, আর পকেট বেছে নিন। তারপর দেখুন চাপুন।</p><div><span>সময়</span><div className="filter-row">{ranges.map((item) => <button type="button" key={item.id} className={!fromDay && !toDay && range === item.id ? 'on' : ''} aria-pressed={!fromDay && !toDay && range === item.id} onClick={() => { setFromDay(''); setToDay(''); setRange(item.id); }}>{item.label}</button>)}</div><div className="filter-dates"><label>শুরু<input type="date" aria-label="শুরুর দিন" value={fromDay} onChange={(event) => { setFromDay(event.target.value); setRange('custom'); }} /></label><label>শেষ<input type="date" aria-label="শেষ দিন" value={toDay} onChange={(event) => { setToDay(event.target.value); setRange('custom'); }} /></label></div></div><div><span>ধরন</span><div className="filter-row">{kinds.map((item) => <button type="button" key={item.id || 'all'} className={kind === item.id ? 'on' : ''} aria-pressed={kind === item.id} onClick={() => setKind(item.id)}>{item.label}</button>)}</div></div><div><span>পকেট</span><div className="filter-row"><button type="button" className={pocket === '' ? 'on' : ''} aria-pressed={pocket === ''} onClick={() => setPocket('')}>সব পকেট</button>{seedPockets.map((item) => <button type="button" key={item.id} className={pocket === item.id ? 'on' : ''} aria-pressed={pocket === item.id} onClick={() => setPocket(item.id)}><PocketMark id={item.id} />{item.name_bn}</button>)}</div></div><Button variant="ledger" size="touch" onClick={() => setOpen(false)}>দেখুন</Button>{filtersOn && <Button variant="outline" size="touch" onClick={() => { setRange('7'); setKind(''); setPocket(''); setFromDay(''); setToDay(''); }}>সব মুছুন</Button>}</div></section></div>}
    {error && <p className="form-error">{error}</p>}
    {!online && <p className="field-hint">অফলাইন। ফোনে যা আছে সেটাই দেখাচ্ছে।</p>}
    {chosen ? <section className="day-card day-detail">
      <button type="button" className="day-back" onClick={() => openDay('', '')}><ArrowLeft />সব দিন</button>
      <header><h2>{dayTitle(chosen.date)}</h2><span>{number(chosenLines.length, digits)}টি হিসাব</span></header>
      <p className="field-hint">{rangeLabel} · {dayStat ? (stats([]).find((row) => row.key === dayStat)?.label ?? kindText) : kindText} · {pocketText}</p>
      {!historyOnly && <div className="day-rows">{stats(chosenLines).map((row) => <div key={row.key}><span><i className={`tone ${row.tone}`} />{row.label}</span><b className={row.money}>{row.amount}</b></div>)}</div>}
      <HisabCards items={chosenLines} digits={digits} />
    </section> : <>
    {!historyOnly && <section className="settings-group">
      <h2>এই সময়ে</h2>
      <p className="field-hint">{rangeLabel} · {kindText} · {pocketText} · {number(lines.length, digits)}টি হিসাব</p>
      <div className="settings-list report-totals">
        {stats(lines).map((row) => <article key={row.key}><i className={`tone ${row.tone}`} /><div><h3>{row.label}</h3></div><strong className={row.money}>{row.amount}</strong></article>)}
      </div>
    </section>}
    <section className="settings-group">
      <h2>দিন ধরে</h2>
      {days.length === 0 && <p className="khata-empty">এই ফিল্টারে কোনো হিসাব নেই।</p>}
      {days.length > 0 && listed.length === 0 && <p className="khata-empty">কিছু মেলেনি।</p>}
      <div className="day-list">{listed.map((day) => <article className="day-card day-summary" key={day.date}>
        <button type="button" className="day-open" onClick={() => openDay(day.date, '')}><span>{dayTitle(day.date)}</span><b>{number(day.lines.length, digits)}টি হিসাব</b></button>
        {!historyOnly && <div className="stat-grid">{stats(day.lines).map((row) => <button type="button" key={row.key} onClick={() => openDay(day.date, row.key)}><span><i className={`tone ${row.tone}`} />{row.label}</span><b className={row.money}>{row.amount}</b></button>)}</div>}
      </article>)}</div>
    </section></>}
  </div>;
}
