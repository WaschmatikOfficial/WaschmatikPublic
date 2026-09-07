# WASCHMATIK STEP 2 – Einrichtung

Nach dem Einspielen der Migrationen müssen in Supabase die Edge Functions deployed und diese serverseitigen Secrets gesetzt werden:

- `SUPABASE_URL` (wird bei Supabase bereitgestellt)
- `SUPABASE_SERVICE_ROLE_KEY` oder die aktuelle Secret-Key-Variante
- `EMAIL_PROVIDER=RESEND`
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM`
- `PUBLIC_SITE_URL`
- `ADMIN_LOGIN_EMAIL`
- `ADMIN_APPROVAL_EMAIL`
- `ADMIN_SITE_URL`
- `INTERNAL_FUNCTION_SECRET` (langes zufälliges Secret)

Frontend-Dateien dürfen keine Service-Role-/Secret-Keys enthalten.

Für die erste echte Einrichtung:
1. Admin-User in Supabase Auth anlegen.
2. Den User in `public.user_roles` mit `role='admin'` eintragen.
3. Die Admin-Mailadresse muss mit `ADMIN_LOGIN_EMAIL` übereinstimmen.
4. Partner-User erhalten `role='partner'` und eine passende `business_id`.
5. Echte PLZ-Geodaten in `public.postal_codes` importieren.
6. Einen Scheduler für `send-customer-followups` täglich einrichten.
7. Einen Scheduler für `select public.mark_overdue_invoices()` einrichten.
8. Vor Livegang echte Impressums-, Datenschutz- und Partnertexte einsetzen und rechtlich prüfen.

Keine Secrets in GitHub oder in den Chat hochladen.
