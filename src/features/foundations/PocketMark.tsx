import { Banknote, Pill, Smartphone } from 'lucide-react';
import { Bkash, Nagad, Rocket } from 'react-bangla-pay-icons';

export function PocketMark({ id }: { id: string }) {
  if (id === 'BKASH') return <Bkash className="pay-mark" aria-hidden />;
  if (id === 'NAGAD') return <Nagad className="pay-mark nagad-mark" aria-hidden />;
  if (id === 'ROCKET') return <Rocket className="pay-mark" aria-hidden />;
  if (id === 'FLEXI') return <Smartphone className="plain-mark" aria-hidden />;
  if (id === 'PHARMA') return <Pill className="plain-mark" aria-hidden />;
  if (id === 'MOBILE') return <Smartphone className="plain-mark" aria-hidden />;
  return <Banknote className="plain-mark" aria-hidden />;
}
