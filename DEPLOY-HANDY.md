# WASCHMATIK – Online stellen (Handy-freundlich)

## Architektur
- `waschmatik.de` → öffentliches Frontend (Vercel)
- `admin.waschmatik.de` → separates Admin-Frontend (eigene Vercel-Deployment)
- Supabase → PostgreSQL + Auth + Row-Level Security + Edge Functions
- Resend → Versand der Kunden- und Admin-Freigabe-E-Mails

## Wichtig
Eine echte Online-Schaltung kann erst abgeschlossen werden, wenn dein Vercel-/Supabase-Konto verbunden ist und die Domain `waschmatik.de` auf Vercel zeigt. Passwörter, Secret Keys und Mail-API-Keys gehören nie in diesen Ordner oder ins Frontend. Supabase stellt Secret Keys für Edge Functions serverseitig bereit; diese dürfen nicht im Browser landen.

## 1. Supabase
Im Supabase Dashboard ein Projekt erstellen. Danach SQL aus `supabase/migrations/0001_waschmatik.sql`, `0002_admin_email_2fa.sql` und `0003_admin_one_time_access.sql` ausführen. Die Edge Functions unter `supabase/functions/` veröffentlichen. Supabase dokumentiert die Dashboard- und CLI-Deployment-Wege offiziell.

Setze serverseitig: `EMAIL_PROVIDER`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`, `ADMIN_LOGIN_EMAIL`, `ADMIN_APPROVAL_EMAIL`, `PUBLIC_SITE_URL` und `INTERNAL_FUNCTION_SECRET`.

## 2. Admin
In Supabase Auth den Admin-Benutzer mit `waschmatik@gmail.com` anlegen und in `public.user_roles` die Rolle `admin` setzen. Kein öffentliches Admin-Registrierungsformular verwenden.

## 3. Vercel – öffentlich
Dieses Projekt als eigenes Vercel-Projekt importieren. Build: `npm run build`. Frontend-Variable setzen: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_MODE=public`. Domain: `waschmatik.de` und ggf. `www.waschmatik.de`. Die Datei `vercel-public.json` als `vercel.json` verwenden.

## 4. Vercel – Admin
Dasselbe Git-Projekt ein zweites Mal als Vercel-Projekt importieren. Frontend-Variable setzen: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_MODE=admin`. Die Datei `vercel-admin.json` als `vercel.json` verwenden. Domain: `admin.waschmatik.de`.

## 5. DNS
Bei deinem Domainanbieter für `admin.waschmatik.de` den von Vercel angezeigten DNS-Eintrag setzen. Für `waschmatik.de` ebenfalls die von Vercel angezeigten Domain-Einträge verwenden. Vercel erzeugt nach erfolgreicher DNS-Zuordnung das HTTPS-Zertifikat.

## 6. E-Mail
Für die Admin-Freigabe und Partner-Anfragen Resend als Mail-Anbieter verwenden und eine Absender-Domain verifizieren. Danach `EMAIL_FROM` auf eine echte Adresse deiner WASCHMATIK-Domain setzen.

## 7. PLZ
Vor dem Livegang echte deutsche PLZ-Koordinaten in `public.postal_codes` importieren. Keine Demo-Koordinaten für den Echtbetrieb verwenden.

## 8. Noch nicht enthalten
Echte Unternehmensdaten, Impressum, Datenschutz und rechtlich geprüfte Partnerbedingungen müssen vor dem öffentlichen Livegang eingesetzt werden.
