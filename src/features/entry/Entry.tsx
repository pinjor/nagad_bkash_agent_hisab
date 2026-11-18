import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownLeft, ArrowUpRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, seedPockets, queueEntry } from '../foundations/db';
import { Keypad } from '../foundations/Keypad';
import { toPaisa, taka, normalizeDigits, matchesQuery, inDhakaWindow } from '../foundations/money';
import { api } from '../foundations/sync';
import { useHisab } from '../foundations/Provider';
import { PocketMark } from '../foundations/PocketMark';
import { SavedPopup } from '../foundations/SavedPopup';

const kinds = [{ id: 'CASH_IN', label: 'টাকা ঢুকেছে', icon: ArrowDownLeft }, { id: 'CASH_OUT', label: 'টাকা বের হয়েছে', icon: ArrowUpRight }] as const;
const kindLabel: Record<string, string> = { CASH_IN: 'টাকা ঢুকেছে', CASH_OUT: 'টাকা বের হয়েছে', FLEXI: 'ফ্লেক্সিলোড' };
const pocketName = Object.fromEntries(seedPockets.map((pocket) => [pocket.id, pocket.name_bn]));

interface EntryRow { id: string; txn_type: string; amount_paisa: number; created_at: string; actor: string; pocket_id: string; phone?: string; pending?: boolean }

function stamp(value: string | number) {
  return new Date(value).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
function wrote(name?: string) {
  const clean = (name ?? '').trim();
  return clean || 'কে লিখেছে জানা নেই';
}

export function Entry() {
  const { settings, syncNow, online } = useHisab();
  const [kind, setKind] = useState<(typeof kinds)[number]['id']>('CASH_IN');
  const [pocket, setPocket] = useState('CASH');
  const [phone, setPhone] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ title: string; detail: string } | null>(null);
  const [finding, setFinding] = useState(false);
  const [find, setFind] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [histRange, setHistRange] = useState('all');
  const [histKind, setHistKind] = useState('');
  const [histPocket, setHistPocket] = useState('');
  const [server, setServer] = useState<EntryRow[]>([]);
  const local = useLiveQuery(async () => {
    const txns = await db.transactions.filter((txn) => txn.status === 'active' && txn.txn_type in kindLabel).toArray();
    const legs = await db.txn_legs.toArray();
    return txns.map((txn) => {
      const own = legs.filter((leg) => leg.txn_id === txn.id);
      const from = own.find((leg) => leg.amount_paisa < 0) ?? own[0];
      return { id: txn.id, txn_type: txn.txn_type, amount_paisa: txn.amount_paisa, created_at: new Date(txn.created_at).toISOString(), actor: txn.writer ?? '', pocket_id: from?.pocket_id ?? '', phone: txn.phone ?? '', pending: true } satisfies EntryRow;
    });
  }, []);
  async function load() {
    if (!navigator.onLine) return;
    try { setServer(await api<EntryRow[]>('/api/entries')); } catch { /* last list stays */ }
  }
  useEffect(() => { void load(); }, [online]);
  async function save() {
    setError('');
    try {
      const amount = toPaisa(value || '0');
      if (!amount) { setError('টাকার পরিমাণ দিন'); return; }
      const digitsOnly = normalizeDigits(phone).replace(/\D/g, '').slice(0, 15);
      await queueEntry(kind, pocket, amount, { phone: digitsOnly });
      setValue(''); setPhone('');
      setSaved({ title: 'হিসাব সেভ হয়েছে', detail: `${kindLabel[kind]} · ${pocketName[pocket] ?? 'পকেট'} · ${taka(amount, settings?.digits)}` });
      await syncNow();
      await load();
    } catch { setError('সেভ হয়নি। আবার চেষ্টা করুন।'); }
  }
  const seen = new Set((local ?? []).map((row) => row.id));
  const history = [...(local ?? []), ...server.filter((row) => !seen.has(row.id))].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const histOn = histRange !== 'all' || histKind !== '' || histPocket !== '';
  const found = history.filter((row) => inDhakaWindow(row.created_at, histRange) && (!histKind || row.txn_type === histKind) && (!histPocket || row.pocket_id === histPocket) && matchesQuery(find, [kindLabel[row.txn_type], pocketName[row.pocket_id], row.phone, wrote(row.actor), row.pending ? 'ফোনে আছে' : '', stamp(row.created_at), taka(row.amount_paisa, settings?.digits)]));
  const shown = (() => { try { return taka(toPaisa(value || '0'), settings?.digits); } catch { return taka(0, settings?.digits); } })();
  return <div className="entry-screen">
    <div className="entry-layout">
      <div className="entry-grid">
        <div className="loan-card entry-kinds">{kinds.map((item) => <Button key={item.id} variant={kind === item.id ? 'ledger' : 'outline'} size="touch" onClick={() => setKind(item.id)}><item.icon />{item.label}</Button>)}</div>
        <div className="loan-card entry-pad"><div className="entry-meta"><label className="entry-pocket">পকেট<div className="pocket-picks" role="group" aria-label="পকেট">{seedPockets.map((item) => <button type="button" key={item.id} className={pocket === item.id ? 'on' : ''} aria-pressed={pocket === item.id} onClick={() => setPocket(item.id)}><PocketMark id={item.id} />{item.name_bn}</button>)}</div></label><label>ফোন<input className="text-input" aria-label="ফোন" placeholder="যেমন ০১৭১১০০০০০০" inputMode="tel" maxLength={15} value={phone} onChange={(event) => setPhone(event.target.value)} /></label></div>
          <div className="entry-amount"><span>টাকার পরিমাণ</span><strong>{shown}</strong></div>
          <Keypad value={value} onChange={setValue} digits={settings?.digits} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button variant="ledger" size="touch" onClick={save}>সেভ করুন</Button>
        </div>
      </div>
      <section className="entry-history" aria-label="আগের হিসাব">
        <div className="finder-bar"><h2>আগের হিসাব</h2><div className="finder-actions"><button type="button" className={`search-open${finding ? ' on' : ''}`} aria-expanded={finding} onClick={() => { setFinding((open) => !open); setFind(''); }}><Search />খুঁজুন</button><button type="button" className={`filter-open${histOn ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={filtering} onClick={() => setFiltering(true)}><SlidersHorizontal />ফিল্টার</button></div></div>
        {finding && <input className="text-input" aria-label="আগের হিসাব খুঁজুন" placeholder="পকেট, ফোন, টাকা, নাম" value={find} autoFocus onChange={(event) => setFind(event.target.value)} />}
        <p className="field-hint">কে, কখন, কোন পকেটে টাকা ঢুকিয়েছে বা বের করেছে</p>
        {history.length === 0 && <p className="khata-empty">এখনো কোনো হিসাব নেই। টাকা লিখে সেভ করুন।</p>}
        {history.length > 0 && found.length === 0 && <p className="khata-empty">কিছু মেলেনি।</p>}
        {filtering && <div className="modal-shade" onClick={() => setFiltering(false)}><section className="wizard" role="dialog" aria-modal="true" aria-label="ফিল্টার" onClick={(event) => event.stopPropagation()}><div className="wizard-header"><h2>ফিল্টার</h2><Button variant="ghost" size="touch" aria-label="বন্ধ করুন" onClick={() => setFiltering(false)}><X /></Button></div><div className="wizard-content report-filters"><div><span>সময়</span><div className="filter-row">{[['all', 'সব'], ['today', 'আজ'], ['7', '৭ দিন'], ['30', '৩০ দিন']].map(([id, label]) => <button type="button" key={id} className={histRange === id ? 'on' : ''} aria-pressed={histRange === id} onClick={() => setHistRange(id)}>{label}</button>)}</div></div><div><span>ধরন</span><div className="filter-row"><button type="button" className={histKind === '' ? 'on' : ''} aria-pressed={histKind === ''} onClick={() => setHistKind('')}>সব ধরন</button>{Object.entries(kindLabel).map(([id, label]) => <button type="button" key={id} className={histKind === id ? 'on' : ''} aria-pressed={histKind === id} onClick={() => setHistKind(id)}>{label}</button>)}</div></div><div><span>পকেট</span><div className="filter-row"><button type="button" className={histPocket === '' ? 'on' : ''} aria-pressed={histPocket === ''} onClick={() => setHistPocket('')}>সব পকেট</button>{seedPockets.map((item) => <button type="button" key={item.id} className={histPocket === item.id ? 'on' : ''} aria-pressed={histPocket === item.id} onClick={() => setHistPocket(item.id)}><PocketMark id={item.id} />{item.name_bn}</button>)}</div></div><Button variant="ledger" size="touch" onClick={() => setFiltering(false)}>দেখুন</Button>{histOn && <Button variant="outline" size="touch" onClick={() => { setHistRange('all'); setHistKind(''); setHistPocket(''); }}>সব মুছুন</Button>}</div></section></div>}
        <ul>{found.map((row) => <li key={row.id}><div><strong>{kindLabel[row.txn_type] ?? row.txn_type}</strong><span><PocketMark id={row.pocket_id} />{pocketName[row.pocket_id] ?? 'পকেট'}{row.phone ? ` · ${row.phone}` : ''} · লিখেছে {wrote(row.actor)}{row.pending ? ' · ফোনে আছে' : ''} · {stamp(row.created_at)}</span></div><b className={row.txn_type === 'CASH_OUT' ? 'out' : 'in'}>{row.txn_type === 'CASH_OUT' ? '−' : row.txn_type === 'CASH_IN' ? '+' : ''}{taka(row.amount_paisa, settings?.digits)}</b></li>)}</ul>
      </section>
    </div>
    {saved && <SavedPopup title={saved.title} detail={saved.detail} onClose={() => setSaved(null)} />}
  </div>;
}
