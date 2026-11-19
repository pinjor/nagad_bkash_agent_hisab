import { useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, ArrowRight, HandCoins, LockKeyhole, Check, Undo2, Pencil, ShieldCheck } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useHisab } from '../foundations/Provider';
import { seedPockets } from '../foundations/db';
import { number, taka } from '../foundations/money';
import { OpeningWizard } from '../foundations/OpeningWizard';
import { PocketMark } from '../foundations/PocketMark';
import { undoOpening } from '../foundations/sync';
import { UNDO_MS } from '../foundations/security';
export function Home() {
  const { settings, totals, hidden, ready, role, configured, today, lendOpen, borrowOpen, pending, syncNow } = useHisab(); const [wizard, setWizard] = useState(false);
  const [undo, setUndo] = useState<string | null>(null); const [error, setError] = useState('');
  const [peek, setPeek] = useState(false); const [showMoney, setShowMoney] = useState(false); const wait = useRef(0);
  const total = Object.values(totals).reduce((a,b) => a+b, 0); const money = (amount: number) => hidden ? '৳ ••••' : taka(amount, settings?.digits);
  const canOpen = role === 'admin' && !configured;
  const staff = role === 'employee';
  const saved = (id: string) => { setWizard(false); setUndo(id); void syncNow(); setTimeout(() => setUndo(current => current === id ? null : current), UNDO_MS); };
  const revealBalance = () => {
    window.clearTimeout(wait.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPeek((open) => !open); setShowMoney((open) => !open); return; }
    if (peek) { setShowMoney(false); setPeek(false); return; }
    setPeek(true);
    wait.current = window.setTimeout(() => setShowMoney(true), 460);
  };
  return <>
    {staff && <section className="balance-banner"><div className="banner-right"><Button variant="ledger" size="touch" className="hero-add" asChild><Link to="/entry"><Plus />নতুন হিসাব</Link></Button></div></section>}
    {!staff && <section className="home-hero"><div className="home-hero-top"><button type="button" className={`balance-peek${peek ? ' go' : ''}`} aria-pressed={showMoney} onClick={revealBalance}><span className="balance-peek-mark" aria-hidden>৳</span><span className="balance-peek-text">{showMoney ? money(total) : 'ব্যালেন্স দেখুন'}</span><span className="balance-peek-sizer" aria-hidden>ব্যালেন্স দেখুন</span></button><Button variant="ledger" size="touch" className="hero-add" asChild><Link to="/entry"><Plus />নতুন হিসাব</Link></Button></div><div className="home-sheet"><h2>আমার পকেট</h2><div className="pocket-circles">{seedPockets.map((p) => <Link key={p.id} to="/reports" search={{ pocket: p.id, kind: '', range: 'all' }} className={`pocket-circle ${p.color}`}><span className="pocket-bubble"><PocketMark id={p.id} /></span><span className="pocket-name">{p.name_bn}</span><strong>{money(totals[p.id] ?? 0)}</strong></Link>)}<Link to="/reports" search={{ pocket: '', kind: 'LEND', range: 'all' }} className="pocket-circle gave"><span className="pocket-bubble"><HandCoins /></span><span className="pocket-name">ধার দিয়েছি</span><strong className="money-gave">{money(lendOpen)}</strong></Link><Link to="/reports" search={{ pocket: '', kind: 'BORROW', range: 'all' }} className="pocket-circle took"><span className="pocket-bubble"><LockKeyhole /></span><span className="pocket-name">ধার নিয়েছি</span><strong className="money-took">{money(borrowOpen)}</strong></Link></div></div></section>}
    {!staff && <section className="today-band"><h2>আজকের</h2><div><strong>{money(today.sale_paisa)}</strong><span><ArrowDownLeft />আজ ঢুকেছে</span></div><div><strong>{money(today.cash_out_paisa)}</strong><span><ArrowUpRight />আজ বের হয়েছে</span></div><Link to="/reports" search={{ pocket: '', kind: 'LEND', range: 'today' }}><strong className="money-gave">{money(today.lend_paisa)}</strong><span><HandCoins />আজ ধার দিয়েছি</span></Link><Link to="/reports" search={{ pocket: '', kind: 'BORROW', range: 'today' }}><strong className="money-took">{money(today.borrow_paisa)}</strong><span><LockKeyhole />আজ ধার নিয়েছি</span></Link></section>}
    {!staff && <section className="recent-section"><div className="section-heading"><h2>আজকের খাতা</h2><span><span className="connection-dot" />{pending ? `${number(pending, settings?.digits)}টি সার্ভারে যায়নি` : 'সব ঠিক আছে'}</span></div><div className="empty-ledger"><div><h3>{configured ? 'শুরুর হিসাব সেভ হয়েছে' : 'নতুন খাতা, নতুন শুরু'}</h3><p>{pending ? 'অনলাইনে এলে ফোনের কপি মুছে যাবে' : configured ? 'আজকের হিসাব সার্ভারে' : 'আপনার পকেটে এখন কত টাকা আছে?'}</p>{canOpen && <Button variant="ledger" size="touch" onClick={() => setWizard(true)}><Pencil />শুরুর হিসাব<ArrowRight /></Button>}</div></div></section>}
    <div className="home-bottom"><ShieldCheck /><span>ইন্টারনেট ছাড়া নতুন হিসাব ফোনে থাকে, পরে সার্ভারে যায়</span></div>
    {wizard && ready && canOpen && <OpeningWizard onClose={() => setWizard(false)} onSaved={saved} />}
    {undo && role === 'admin' && <div className="undo-toast" role="status"><Check /><span>সেভ হয়েছে</span><Button variant="ghost" size="touch" onClick={async () => { try { await undoOpening(undo); setUndo(null); setWizard(true); await syncNow(); } catch { setError('ফিরিয়ে নেওয়া যায়নি। আবার চেষ্টা করুন।'); } }}><Undo2 />ফিরিয়ে নিন</Button></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </>;
}
