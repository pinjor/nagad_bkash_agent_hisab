import type { MouseEvent, PointerEvent } from 'react';
import { Delete, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { number, normalizeDigits, type Digits } from './money';
export function Keypad({ value, onChange, pin = false, digits = 'bn', max }: { value: string; onChange: (value: string) => void; pin?: boolean; digits?: Digits; max?: number }) {
  const limit = max ?? (pin ? 4 : 10);
  const append = (key: string) => { if (value.length < limit) onChange(normalizeDigits(value + key)); };
  const press = (event: PointerEvent<HTMLButtonElement>, next: () => void) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== event.currentTarget) active.blur();
    event.preventDefault();
    event.currentTarget.dataset.pinPress = '1';
    next();
  };
  const click = (event: MouseEvent<HTMLButtonElement>, next: () => void) => {
    if (event.currentTarget.dataset.pinPress === '1') { delete event.currentTarget.dataset.pinPress; return; }
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== event.currentTarget) active.blur();
    next();
  };
  return <div className="keypad">
    {!pin && <div className="quick-add">{[100, 500, 1000, 5000].map(n => <Button key={n} type="button" variant="outline" size="touch" onPointerDown={(event) => press(event, () => onChange(String(Math.min(9999999999, Number(value || 0) + n))))} onClick={(event) => click(event, () => onChange(String(Math.min(9999999999, Number(value || 0) + n))))}><Plus />{number(n, digits)}</Button>)}</div>}
    <div className="keypad-grid">{[1,2,3,4,5,6,7,8,9].map(n => <Button key={n} type="button" variant="keypad" size="touch" onPointerDown={(event) => press(event, () => append(String(n)))} onClick={(event) => click(event, () => append(String(n)))}>{number(n, digits)}</Button>)}
      <Button type="button" variant="keypad" size="touch" aria-label="সব মুছুন" onPointerDown={(event) => press(event, () => onChange(''))} onClick={(event) => click(event, () => onChange(''))}>C</Button>
      <Button type="button" variant="keypad" size="touch" onPointerDown={(event) => press(event, () => append('0'))} onClick={(event) => click(event, () => append('0'))}>{number(0, digits)}</Button>
      <Button type="button" variant="keypad" size="touch" aria-label="একটি মুছুন" onPointerDown={(event) => press(event, () => onChange(value.slice(0, -1)))} onClick={(event) => click(event, () => onChange(value.slice(0, -1)))}><Delete /></Button>
    </div>
  </div>;
}
