import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, ArrowRight, Wallet, Banknote, Send, Sun, Rocket, Smartphone, HandCoins, LockKeyhole, Check, Undo2, Pencil, CalendarDays, ShieldCheck } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import book from '@/assets/empty-khata.png';
import { useHisab } from '../foundations/Provider';
import { seedPockets, voidOpening } from '../foundations/db';
import { number, taka } from '../foundations/money';
import { OpeningWizard } from '../foundations/OpeningWizard';
import { UNDO_MS } from '../foundations/security';
const icons = [Banknote, Send, Sun, Rocket, Smartphone];
export function Home() {
  const { settings, totals, hidden, ready } = useHisab(); const [wizard, setWizard] = useState(false);
  const [undo, setUndo] = useState<string | null>(null); const [error, setError] = useState('');
  const total = Object.values(totals).reduce((a,b) => a+b, 0); const money = (amount: number) => hidden ? '৳ ••••' : taka(amount, settings?.digits);
  const saved = (id: string) => { setWizard(false); setUndo(id); setTimeout(() => setUndo(current => current === id ? null : current), UNDO_MS); };
  return <>
    <div className="page-heading"><div><span className="eyebrow">আপনার হিসাব, এক নজরে</span><h1>আজকের হিসাব</h1></div><span className="date-label"><CalendarDays />{new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span></div>
    <section className="balance-banner"><div><span className="balance-label"><Wallet />আমার মোট টাকা</span><div className="total-amount">{money(total)}</div><span className="balance-caption">হাতে নগদ ও সব পকেট মিলিয়ে</span></div><div className="banner-right"><div className="banner-wallet"><Wallet /></div><Button variant="outline" size="touch" asChild><Link to="/entry"><Plus />নতুন হিসাব</Link></Button></div></section>
    <section className="pockets-section"><div className="section-heading"><h2>আমার পকেট</h2><span>{number(5, settings?.digits)}টি পকেট</span></div><div className="pocket-grid">{seedPockets.map((p,i) => { const Icon = icons[i]; return <Button key={p.id} variant="tile" className={`pocket-tile ${p.color}`} onClick={() => setWizard(true)}><span className="pocket-icon"><Icon /></span><span className="pocket-name">{p.name_bn}</span><strong>{money(totals[p.id] ?? 0)}</strong><span className="pocket-detail">{settings?.configured ? 'শুরুর ব্যালেন্স' : 'শুরুর টাকা দিন'}<ArrowUpRight /></span></Button>; })}</div></section>
    <div className="debt-grid"><Link to="/people" className="debt-item owed"><span className="debt-icon"><HandCoins /></span><div><span>বাকি পাবো</span><strong>{money(0)}</strong></div><span className="debt-count">{number(0,settings?.digits)} জন<ArrowUpRight /></span></Link><Link to="/people" className="debt-item held"><span className="debt-icon"><LockKeyhole /></span><div><span>আমানত দিতে হবে</span><strong>{money(0)}</strong></div><span className="debt-count">{number(0,settings?.digits)} জন<ArrowUpRight /></span></Link></div>
    <section className="today-band"><h2>আজকের</h2><div><span><ArrowDownLeft />আজ বিক্রি</span><strong>{money(0)}</strong></div><div><span><ArrowUpRight />কমিশন / লাভ</span><strong>{money(0)}</strong></div><div><span><Wallet />আজকের লেনদেন</span><strong>{number(0, settings?.digits)} টি</strong></div></section>
    <section className="recent-section"><div className="section-heading"><h2>আজকের খাতা</h2><span><span className="connection-dot" />সব ঠিক আছে</span></div><div className="empty-ledger"><img src={book} width={160} height={160} alt="খোলা হিসাবের খাতা" loading="lazy" /><div><h3>{settings?.configured ? 'শুরুর হিসাব সেভ হয়েছে' : 'নতুন খাতা, নতুন শুরু'}</h3><p>{settings?.configured ? 'আজ কোনো লেনদেন নেই' : 'আপনার পকেটে এখন কত টাকা আছে?'}</p><Button variant="ledger" size="touch" onClick={() => setWizard(true)}>{settings?.configured ? <Plus /> : <Pencil />}{settings?.configured ? 'পকেট দেখুন' : 'শুরুর হিসাব'}<ArrowRight /></Button></div></div></section>
    <div className="home-bottom"><ShieldCheck /><span>ইন্টারনেট ছাড়াও হিসাব আপনার ফোনে থাকবে</span></div>
    {wizard && ready && <OpeningWizard onClose={() => setWizard(false)} onSaved={saved} />}
    {undo && <div className="undo-toast" role="status"><Check /><span>সেভ হয়েছে</span><Button variant="ghost" size="touch" onClick={async () => { try { await voidOpening(undo); setUndo(null); setWizard(true); } catch { setError('ফিরিয়ে নেওয়া যায়নি। আবার চেষ্টা করুন।'); } }}><Undo2 />ফিরিয়ে নিন</Button></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </>;
}
