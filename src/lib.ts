import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export const PROBLEMS = [
  'Waschmaschine startet nicht',
  'Waschmaschine pumpt nicht ab',
  'Waschmaschine läuft aus',
  'Waschmaschine schleudert nicht',
  'Waschmaschine macht ungewöhnliche Geräusche',
  'Waschmaschine wird nicht warm',
  'Waschmaschine zeigt einen Fehlercode',
  'Tür lässt sich nicht öffnen',
  'Waschmaschine vibriert stark',
  'Sonstiges Problem',
] as const;

export function money(value: number | null | undefined) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value) || 0);
}

export function cls(...values: Array<string | false | undefined | null>) {
  return values.filter(Boolean).join(' ');
}

export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const R = 6371;
  const p1 = a.latitude * Math.PI / 180;
  const p2 = b.latitude * Math.PI / 180;
  const dp = (b.latitude - a.latitude) * Math.PI / 180;
  const dl = (b.longitude - a.longitude) * Math.PI / 180;
  const q = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return +(R * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q))).toFixed(1);
}
