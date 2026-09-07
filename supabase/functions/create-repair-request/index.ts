import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const secret = (() => {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // Fall back to the legacy environment variable below.
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
})();

if (!supabaseUrl || !secret) {
  throw new Error('Supabase server credentials are not configured.');
}

const db = createClient(supabaseUrl, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const allowedProblems = new Set([
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
]);

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function response(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return response({ message: 'Nur POST ist erlaubt.' }, 405);

  try {
    const body = await req.json();

    const firstName = text(body.first_name, 80);
    const lastName = text(body.last_name, 80);
    const email = text(body.email, 254).toLowerCase();
    const phone = text(body.phone, 40);
    const street = text(body.street, 120);
    const houseNumber = text(body.house_number, 30);
    const postalCode = text(body.postal_code, 5);
    const city = text(body.city, 120);
    const brand = text(body.brand, 120);
    const model = text(body.model, 120);
    const problem = text(body.problem, 120);
    const description = text(body.description, 4000);
    const problemDescription = text(body.problem_description, 4200) || `${problem} – ${description}`;
    const preferredDate = text(body.preferred_date, 10) || null;
    const preferredTime = text(body.preferred_time, 80) || null;
    const partnerId = text(body.partner_id, 80) || null;

    if (body.terms_accepted !== true && body.terms !== true) {
      return response({ message: 'Bitte den Datenschutzhinweis und die Vermittlung bestätigen.' }, 400);
    }

    if ([firstName, lastName, email, phone, street, houseNumber, postalCode, city, problemDescription].some((v) => !v)) {
      return response({ message: 'Bitte alle Pflichtfelder ausfüllen.' }, 400);
    }

    if (firstName.length < 2 || lastName.length < 2 || phone.length < 5 || !/^\d{5}$/.test(postalCode)) {
      return response({ message: 'Ungültige Angaben.' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response({ message: 'Bitte eine gültige E-Mail-Adresse eingeben.' }, 400);
    }

    if (problem && !allowedProblems.has(problem)) {
      return response({ message: 'Ungültige Problemauswahl.' }, 400);
    }

    if (preferredDate && !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return response({ message: 'Ungültiger Wunschtermin.' }, 400);
    }

    const ip = req.headers.get('cf-connecting-ip')
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? 'unknown';
    const keyHash = await sha256(`${email}|${ip}`);

    const { data: allowed, error: rateError } = await db.rpc('check_repair_request_rate_limit', {
      p_key_hash: keyHash,
      p_limit: 5,
      p_window_seconds: 600,
    });
    if (rateError) throw rateError;
    if (!allowed) {
      return response(
        { message: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
        429,
        { 'Retry-After': '600' },
      );
    }

    const rpcName = partnerId ? 'create_repair_request_for_partner' : 'create_repair_request';
    const rpcArgs = partnerId ? {
      p_partner_id: partnerId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_phone: phone,
      p_street: street,
      p_house_number: houseNumber,
      p_postal_code: postalCode,
      p_city: city,
      p_brand: brand || null,
      p_model: model || null,
      p_problem_description: problemDescription,
      p_preferred_date: preferredDate,
      p_preferred_time: preferredTime,
    } : {
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_phone: phone,
      p_street: street,
      p_house_number: houseNumber,
      p_postal_code: postalCode,
      p_city: city,
      p_brand: brand || null,
      p_model: model || null,
      p_problem_description: problemDescription,
      p_preferred_date: preferredDate,
      p_preferred_time: preferredTime,
    };
    const { data: requestId, error } = await db.rpc(rpcName, rpcArgs);

    if (error) throw error;

    return response({ request_id: requestId });
  } catch (error) {
    console.error(error);
    return response({ message: 'Anfrage konnte nicht verarbeitet werden.' }, 500);
  }
});
