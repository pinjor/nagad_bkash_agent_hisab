import { Link } from '@tanstack/react-router';
import { House, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import book from '@/assets/empty-khata.png';
export function FuturePage({ title, phase, icon: Icon }: { title: string; phase: string; icon: LucideIcon }) {
  return <><div className="page-heading"><div><span className="eyebrow">আমার হিসাব</span><h1><Icon />{title}</h1></div></div><section className="future-empty"><img src={book} width={220} height={220} alt="খালি হিসাবের খাতা" /><h2>{phase} আসবে</h2><p>এখন শুরুর টাকা ও পিন সেট করতে পারবেন।</p><Button variant="ledger" size="touch" asChild><Link to="/"><House />হোমে ফিরুন</Link></Button></section></>;
}
