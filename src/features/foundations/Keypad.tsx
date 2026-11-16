import { Delete, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { number, normalizeDigits, type Digits } from './money';
export function Keypad({ value, onChange, pin = false, digits = 'bn' }: { value: string; onChange: (value: string) => void; pin?: boolean; digits?: Digits }) {
  const append = (key: string) => { if (value.length < (pin ? 4 : 10)) onChange(normalizeDigits(value + key)); };
  return <div className="keypad">
    {!pin && <div className="quick-add">{[100, 500, 1000, 5000].map(n => <Button key={n} variant="outline" size="touch" onClick={() => onChange(String(Math.min(9999999999, Number(value || 0) + n)))}><Plus />{number(n, digits)}</Button>)}</div>}
    <div className="keypad-grid">{[1,2,3,4,5,6,7,8,9].map(n => <Button key={n} variant="keypad" size="touch" onClick={() => append(String(n))}>{number(n, digits)}</Button>)}
      <Button variant="keypad" size="touch" aria-label="সব মুছুন" onClick={() => onChange('')}>C</Button>
      <Button variant="keypad" size="touch" onClick={() => append('0')}>{number(0, digits)}</Button>
      <Button variant="keypad" size="touch" aria-label="একটি মুছুন" onClick={() => onChange(value.slice(0, -1))}><Delete /></Button>
    </div>
  </div>;
}
