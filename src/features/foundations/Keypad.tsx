import type { PointerEvent } from 'react';
import { Delete, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { number, normalizeDigits, type Digits } from './money';
export function Keypad({ value, onChange, pin = false, digits = 'bn' }: { value: string; onChange: (value: string) => void; pin?: boolean; digits?: Digits }) {
  const append = (key: string) => { if (value.length < (pin ? 4 : 10)) onChange(normalizeDigits(value + key)); };
  const press = (event: PointerEvent<HTMLButtonElement>, next: () => void) => { event.preventDefault(); next(); };
  return <div className="keypad">
    {!pin && <div className="quick-add">{[100, 500, 1000, 5000].map(n => <Button key={n} type="button" variant="outline" size="touch" onPointerDown={(event) => press(event, () => onChange(String(Math.min(9999999999, Number(value || 0) + n))))}><Plus />{number(n, digits)}</Button>)}</div>}
    <div className="keypad-grid">{[1,2,3,4,5,6,7,8,9].map(n => <Button key={n} type="button" variant="keypad" size="touch" onPointerDown={(event) => press(event, () => append(String(n)))}>{number(n, digits)}</Button>)}
      <Button type="button" variant="keypad" size="touch" aria-label="সব মুছুন" onPointerDown={(event) => press(event, () => onChange(''))}>C</Button>
      <Button type="button" variant="keypad" size="touch" onPointerDown={(event) => press(event, () => append('0'))}>{number(0, digits)}</Button>
      <Button type="button" variant="keypad" size="touch" aria-label="একটি মুছুন" onPointerDown={(event) => press(event, () => onChange(value.slice(0, -1)))}><Delete /></Button>
    </div>
  </div>;
}
