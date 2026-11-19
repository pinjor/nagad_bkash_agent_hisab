import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { BookOpen, House, Plus, Users, ChartNoAxesCombined, Settings, ShieldCheck, Download, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHisab } from './Provider';
import { number } from './money';
const items = [{ to: '/', label: 'হোম', icon: House }, { to: '/entry', label: 'নতুন হিসাব', icon: Plus }, { to: '/people', label: 'খাতা', icon: Users }, { to: '/reports', label: 'রিপোর্ট', icon: ChartNoAxesCombined }, { to: '/settings', label: 'সেটিংস', icon: Settings }] as const;
const pageTitle: Record<string, string> = { '/': 'আজকের হিসাব', '/entry': 'নতুন হিসাব', '/people': 'খাতা', '/reports': 'রিপোর্ট', '/settings': 'সেটিংস', '/employees': 'কর্মচারী' };
const pageNote: Record<string, string> = { '/': 'আজ কত টাকা আছে', '/entry': 'টাকা ঢোকান বা বের করুন', '/people': 'কার কাছে কত ধার', '/reports': 'দিনের হিসাব দেখুন', '/settings': 'দোকান ও পিন', '/employees': 'যাঁরা হিসাব লেখেন' };
const TitleContext = createContext<(value: string) => void>(() => {});
export function usePageTitle(title: string) {
  const setTitle = useContext(TitleContext);
  useEffect(() => { setTitle(title); return () => setTitle(''); }, [setTitle, title]);
}
export function Shell({ children }: { children: ReactNode }) {
  const { settings, online, role, pending, serverOk } = useHisab(); const path = useLocation().pathname;
  const [detail, setDetail] = useState('');
  const [install, setInstall] = useState<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null);
  const [update, setUpdate] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstall(e as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }); };
    const refresh = () => setUpdate(true);
    window.addEventListener('beforeinstallprompt', handler); window.addEventListener('hisab:update', refresh);
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('hisab:update', refresh); };
  }, []);
  const title = detail || (role === 'employee' && path === '/reports' ? 'আগের হিসাব' : pageTitle[path]) || 'আমার হিসাব';
  const note = detail ? 'এই কর্মচারীর কাজ' : (role === 'employee' && path === '/' ? 'নতুন হিসাব লিখুন' : role === 'employee' && path === '/reports' ? 'প্রতিটি হিসাব' : pageNote[path]) || 'আপনার প্রতিদিনের খাতা';
  const link = !online ? (pending ? `অফলাইন · ফোনে ${number(pending, settings?.digits)}` : 'অফলাইন') : !serverOk ? (pending ? `ফোনে ${number(pending, settings?.digits)}` : 'সার্ভার ধীর') : pending ? `ফোনে ${number(pending, settings?.digits)}` : '';
  return <TitleContext.Provider value={setDetail}><div className="app-shell">
    <aside className="desktop-sidebar"><Link to="/" className="brand"><span className="brand-mark"><BookOpen /></span><span>আমার হিসাব<small>আপনার প্রতিদিনের খাতা</small></span></Link>
      <nav aria-label="প্রধান মেনু">{items.map(item => <Button key={item.to} variant="nav" size="touch" asChild><Link to={item.to} className={path === item.to ? 'active' : ''}><item.icon /><span>{item.label}</span>{path === item.to && <span className="nav-dot" />}</Link></Button>)}</nav>
      <div className="sidebar-foot"><ShieldCheck /><span>হিসাব এই ফোনে থাকে<small>আপনার টাকা, আপনার কাছে</small></span></div>
    </aside>
    <div className="main-shell"><header className="topbar"><h1 className="shop-title"><span>{title}</span><small className={link ? (online ? 'link-wait' : 'link-offline') : ''}>{note}{link ? ` · ${link}` : ''}</small></h1>
      <div className="header-actions"><span className="local-chip"><ShieldCheck />{role === 'employee' ? 'কর্মচারী' : 'মালিক'}</span></div>
    </header>
    {install && <div className="app-notice"><Download /><span>ফোনে আমার হিসাব</span><Button variant="outline" size="touch" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}><Download />ইনস্টল করুন</Button></div>}
    {update && <div className="app-notice"><RefreshCw /><span>নতুন আপডেট আছে</span><Button variant="outline" size="touch" onClick={() => window.location.reload()}><Check />আপডেট করুন</Button></div>}
    <main className="page-content">{children}</main><footer className="desktop-footer"><ShieldCheck />হিসাব সেভ হয় এই ফোনে<span>আমার হিসাব</span></footer>
    </div>
    <nav className="mobile-nav" aria-label="প্রধান মেনু">{items.map(item => <Button key={item.to} variant="nav" size="touch" asChild><Link to={item.to} className={path === item.to ? 'active' : ''}><item.icon /><span>{item.label}</span></Link></Button>)}</nav>
  </div></TitleContext.Provider>;
}
