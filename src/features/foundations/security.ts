export const BACKGROUND_LOCK_MS = 120_000;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_WAIT_MS = 30_000;
export const UNDO_MS = 10_000;
export function pinFailure(attempts: number, now: number) {
  const next = attempts + 1;
  return { failed_attempts: next >= MAX_PIN_ATTEMPTS ? 0 : next, blocked_until: next >= MAX_PIN_ATTEMPTS ? now + PIN_WAIT_MS : 0 };
}
export async function hashPin(pin: string, salt?: string) {
  const saltValue = salt ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(saltValue), iterations: 100_000, hash: 'SHA-256' }, key, 256);
  return { hash: Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''), salt: saltValue };
}