# WASCHMATIK – Veröffentlichung

## 1. Frontend
Auf einem Rechner im Projektordner:

```bash
npm install
npm run build
```

Danach den Ordner `dist/` auf Vercel, Netlify, Cloudflare Pages oder einen vergleichbaren statischen Host veröffentlichen.

## 2. Supabase
Im Supabase-Projekt die Migrationen in dieser Reihenfolge ausführen:

- `supabase/migrations/0001_waschmatik.sql`
- `supabase/migrations/0002_admin_email_2fa.sql`
- `supabase/migrations/0003_admin_one_time_access.sql`

Danach die Edge Functions deployen:

- `create-inquiry`
- `send-inquiry-email`
- `retry-inquiry-email`
- `approve-partner`
- `admin-set-order-value`
- `create-invoice`
- `request-admin-approval`
- `approve-admin-login`
- `revoke-admin-access`

## 3. Secrets in Supabase
Nur serverseitig setzen:

```text
EMAIL_PROVIDER=RESEND
EMAIL_PROVIDER_API_KEY=...
EMAIL_FROM=WASCHMATIK <noreply@deine-domain.de>
ADMIN_LOGIN_EMAIL=waschmatik@gmail.com
ADMIN_APPROVAL_EMAIL=waschmatik@gmail.com
PUBLIC_SITE_URL=https://waschmatik.de
ADMIN_SITE_URL=https://admin.waschmatik.de
INTERNAL_FUNCTION_SECRET=...
```

`VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` gehören in die Frontend-Umgebung des Hosts.

## 4. Erster Admin
1. Den Admin in Supabase Auth kontrolliert anlegen.
2. In `public.user_roles` genau für diesen User `role='admin'` setzen.
3. Niemals ein öffentliches Admin-Registrierungsformular dafür verwenden.

## 5. Admin-Login
Der produktive Ablauf ist:

E-Mail `waschmatik@gmail.com` + Passwort → Server prüft Adminrolle → alte Freigaben werden sofort widerrufen → neue Freigabe-Mail an WASCHMATIK → einmaliger Link wird bestätigt → Admin-Daten werden für diese aktuelle Anmeldung freigegeben. Beim Verlassen/Abmelden wird die Freigabe serverseitig widerrufen. Beim nächsten Aufruf ist wieder eine neue Anmeldung und neue E-Mail-Freigabe erforderlich.

Wichtig: Das Passwort wird nicht im Frontend und nicht in einer Quellcodedatei gespeichert. Es gehört ausschließlich zum Supabase-Auth-Konto.

## 6. Betriebe
Im Adminbereich können Betriebe:

- hinzugefügt
- bearbeitet
- aktiviert
- deaktiviert
- gelöscht

werden. Historische Anfragen/Rechnungen werden nicht blind gelöscht.

## 7. Öffentliche Partnersuche
Die öffentliche Suche verwendet die WASCHMATIK-Datenbank. Die private Partner-E-Mail und Telefonnummer werden nicht als öffentliche Suchfelder ausgegeben. PLZ-Koordinaten müssen vor dem Livegang aus einer verlässlich nutzbaren Datenquelle importiert werden.

## 8. Rechtliches
Vor Livegang müssen echte Unternehmensdaten sowie final geprüfte Texte für Impressum, Datenschutz und Partnerbedingungen eingesetzt werden.
