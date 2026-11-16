import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { BookOpen, House, Plus, Users, ChartNoAxesCombined, Settings, Eye, EyeOff, Volume2, ShieldCheck, WifiOff, Download, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHisab } from './Provider';
import { taka } from './money';
const items = [{ to: '/', label: 'হোম', icon: House }, { to: '/entry', label: 'নতুন হিসাব', icon: Plus }, { to: '/people', label: 'খাতা', icon: Users }, { to: '/reports', label: 'রিপোর্ট', icon: ChartNoAxesCombined }, { to: '/settings', label: 'সেটিংস', icon: Settings }] as const;
export function Shell({ children }: { children: ReactNode }) {
  const { settings, hidden, setHidden, online, totals, speak } = useHisab(); const path = useLocation().pathname;
  const [install, setInstall] = useState<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null);
  const [update, setUpdate] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstall(e as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }); };
    const refresh = () => setUpdate(true);
    window.addEventListener('beforeinstallprompt', handler); window.addEventListener('hisab:update', refresh);
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('hisab:update', refresh); };
  }, []);
  return <div className="app-shell">
    <aside className="desktop-sidebar"><Link to="/" className="brand"><span className="brand-mark"><BookOpen /></span><span>আমার হিসাব<small>আপনার প্রতিদিনের খাতা</small></span></Link>
      <nav aria-label="প্রধান মেনু">{items.map(item => <Button key={item.to} variant="nav" size="touch" asChild><Link to={item.to} className={path === item.to ? 'active' : ''}><item.icon /><span>{item.label}</span>{path === item.to && <span className="nav-dot" />}</Link></Button>)}</nav>
      <div className="sidebar-foot"><ShieldCheck /><span>হিসাব এই ফোনে থাকে<small>আপনার টাকা, আপনার কাছে</small></span></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="shop-title"><div className="shop-icon"><BookOpen /></div><span>{settings?.shop_name ?? 'আমার দোকান'}<small><span className="connection-dot" />{online ? 'এই ফোনে সেভ হয়' : 'অফলাইন'}</small></span></div>
      <div className="header-actions"><span className="local-chip">{online ? <ShieldCheck /> : <WifiOff />}{online ? 'ফোনে সুরক্ষিত' : 'অফলাইন'}</span><Button variant="ghost" size="touch" title={hidden ? 'টাকা দেখান' : 'টাকা লুকান'} aria-label={hidden ? 'টাকা দেখান' : 'টাকা লুকান'} onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff /> : <Eye />}</Button><Button variant="ghost" size="touch" aria-label="হিসাব শুনুন" title="হিসাব শুনুন" onClick={() => speak(`আমার মোট টাকা ${taka(Object.values(totals).reduce((a,b) => a+b,0), settings?.digits)}`)}><Volume2 /></Button></div>
    </header>
    {install && <div className="app-notice"><Download /><span>ফোনে আমার হিসাব</span><Button variant="outline" size="touch" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}><Download />ইনস্টল করুন</Button></div>}
    {update && <div className="app-notice"><RefreshCw /><span>নতুন আপডেট আছে</span><Button variant="outline" size="touch" onClick={() => window.location.reload()}><Check />আপডেট করুন</Button></div>}
    <main className="page-content">{children}</main><footer className="desktop-footer"><ShieldCheck />হিসাব সেভ হয় এই ফোনে<span>আমার হিসাব</span></footer>
    </div>
    <nav className="mobile-nav" aria-label="প্রধান মেনু">{items.map(item => <Button key={item.to} variant="nav" size="touch" asChild><Link to={item.to} className={path === item.to ? 'active' : ''}><item.icon /><span>{item.label}</span></Link></Button>)}</nav>
  </div>;
}
