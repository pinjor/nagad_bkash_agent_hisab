import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SavedPopup({ title, detail, onClose }: { title: string; detail: string; onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const timer = window.setTimeout(() => close.current(), 2400);
    return () => window.clearTimeout(timer);
  }, [title, detail]);
  return <div className="modal-shade saved-shade" onClick={() => close.current()}><section className="wizard saved-popup" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="wizard-content"><span className="saved-mark" aria-hidden><Check /></span><h2>{title}</h2><p>{detail}</p><Button variant="ledger" size="touch" onClick={() => close.current()}>ঠিক আছে</Button></div></section></div>;
}
