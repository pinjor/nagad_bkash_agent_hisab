import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, ArrowRight, Wallet, HandCoins, LockKeyhole, Check, Undo2, Pencil, CalendarDays, ShieldCheck } from 'lucide-react';
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
  const { settings, totals, hidden, ready, role, configured, today, lendOpen, borrowOpen, lendCount, borrowCount, pending, syncNow } = useHisab(); const [wizard, setWizard] = useState(false);
  const [undo, setUndo] = useState<string | null>(null); const [error, setError] = useState('');
  const total = Object.values(totals).reduce((a,b) => a+b, 0); const money = (amount: number) => hidden ? '৳ ••••' : taka(amount, settings?.digits);
  const canOpen = role === 'admin' && !configured;
  const saved = (id: string) => { setWizard(false); setUndo(id); void syncNow(); setTimeout(() => setUndo(current => current === id ? null : current), UNDO_MS); };
  return <>
    <div className="page-heading"><span className="date-label"><CalendarDays />{new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span></div>
    <section className="balance-banner"><div><span className="balance-label"><Wallet />আমার মোট টাকা</span><div className="total-amount">{money(total)}</div></div><div className="banner-right"><Button variant="outline" size="touch" asChild><Link to="/entry"><Plus />নতুন হিসাব</Link></Button></div></section>
    <section className="pockets-section"><div className="section-heading"><h2>আমার পকেট</h2><span>প্রতিটিতে এখন কত টাকা</span></div><div className="pocket-grid">{seedPockets.map((p) => <Button key={p.id} variant="tile" className={`pocket-tile ${p.color}`} onClick={() => { if (canOpen) setWizard(true); }}><span className="pocket-icon"><PocketMark id={p.id} /></span><span className="pocket-copy"><span className="pocket-name">{p.name_bn}</span>{!configured && <span className="pocket-detail">শুরুর টাকা দিন</span>}</span><strong>{money(totals[p.id] ?? 0)}</strong></Button>)}</div></section>
    <div className="debt-grid"><Link to="/people" className="debt-item owed"><span className="debt-icon"><HandCoins /></span><div><span>ধার দিয়েছি</span><strong>{money(lendOpen)}</strong></div><span className="debt-count">{number(lendCount,settings?.digits)} জন<ArrowUpRight /></span></Link><Link to="/people" className="debt-item held"><span className="debt-icon"><LockKeyhole /></span><div><span>ধার নিয়েছি</span><strong>{money(borrowOpen)}</strong></div><span className="debt-count">{number(borrowCount,settings?.digits)} জন<ArrowUpRight /></span></Link></div>
    <section className="today-band"><h2>আজকের</h2><div><span><ArrowDownLeft />আজ ঢুকেছে</span><strong>{money(today.sale_paisa)}</strong></div><div><span><ArrowUpRight />আজ বের হয়েছে</span><strong>{money(today.cash_out_paisa)}</strong></div><div><span><Wallet />আজকের লেনদেন</span><strong>{number(today.txn_count, settings?.digits)} টি</strong></div></section>
    <section className="recent-section"><div className="section-heading"><h2>আজকের খাতা</h2><span><span className="connection-dot" />{pending ? `${number(pending, settings?.digits)}টি সার্ভারে যায়নি` : 'সব ঠিক আছে'}</span></div><div className="empty-ledger"><div><h3>{configured ? 'শুরুর হিসাব সেভ হয়েছে' : 'নতুন খাতা, নতুন শুরু'}</h3><p>{pending ? 'অনলাইনে এলে ফোনের কপি মুছে যাবে' : configured ? 'আজকের হিসাব সার্ভারে' : 'আপনার পকেটে এখন কত টাকা আছে?'}</p>{canOpen && <Button variant="ledger" size="touch" onClick={() => setWizard(true)}><Pencil />শুরুর হিসাব<ArrowRight /></Button>}</div></div></section>
    <div className="home-bottom"><ShieldCheck /><span>ইন্টারনেট ছাড়া নতুন হিসাব ফোনে থাকে, পরে সার্ভারে যায়</span></div>
    {wizard && ready && canOpen && <OpeningWizard onClose={() => setWizard(false)} onSaved={saved} />}
    {undo && role === 'admin' && <div className="undo-toast" role="status"><Check /><span>সেভ হয়েছে</span><Button variant="ghost" size="touch" onClick={async () => { try { await undoOpening(undo); setUndo(null); setWizard(true); await syncNow(); } catch { setError('ফিরিয়ে নেওয়া যায়নি। আবার চেষ্টা করুন।'); } }}><Undo2 />ফিরিয়ে নিন</Button></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </>;
}
