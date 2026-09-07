# WASCHMATIK – Full-Stack

Echte Produktionsgrundlage für die WASCHMATIK-Vermittlungsplattform.

## Admin-Sicherheit
Der Adminbereich hat keinen versteckten Code, keine Sonder-PLZ und keinen Frontend-Trick. Der Ablauf lautet:

1. Supabase Auth: E-Mail + Passwort. Für den Adminbereich ist ausschließlich `waschmatik@gmail.com` zugelassen.
2. Server prüft, ob das Konto in `user_roles` wirklich die Rolle `admin` besitzt.
3. Eine kurzlebige, einmalige Freigabe-Mail wird an `ADMIN_APPROVAL_EMAIL` gesendet.
4. Die E-Mail enthält einen einmaligen Freigabelink.
5. Erst die serverseitige Bestätigung setzt `profiles.admin_verified_until`.
6. RLS-Policies verwenden diese serverseitige Prüfung. Ohne aktive Freigabe können Admin-Daten nicht gelesen oder verändert werden.

Jede Öffnung des Adminbereichs startet eine neue Anmeldung. Die Freigabe-Mail ist 5 Minuten gültig. Nach dem Verlassen/Abmelden wird die serverseitige Adminfreigabe widerrufen; eine frühere Freigabe wird nicht wiederverwendet.

## Lokal
1. `npm install`
2. `.env.example` nach `.env` kopieren und die VITE-Werte setzen.
3. SQL-Migrationen in Supabase ausführen/deployen.
4. Edge Functions deployen und Secrets setzen.
5. `npm run dev`

## Produktion
`npm run build` erzeugt `dist/`. Dieses Frontend kann auf Vercel, Netlify oder einem vergleichbaren statischen Host veröffentlicht werden. Datenbank, Auth und Edge Functions bleiben bei Supabase.

## Admin-Bootstrap
Den ersten Admin ausschließlich kontrolliert in Supabase Auth anlegen und in `public.user_roles` mit `role='admin'` versehen. Es gibt kein öffentliches Admin-Registrierungsformular.

## PLZ-Geodaten
`public.postal_codes` erwartet echte, rechtmäßig nutzbare deutsche PLZ-Koordinaten. Es werden bewusst keine erfundenen Koordinaten mitgeliefert.

## Rechtliches
Impressum, Datenschutz und Partnerbedingungen sind mit den aktuell vorliegenden Betreiberangaben befüllt; vor dem tatsächlichen Geschäftsstart sollte die rechtliche Fassung individuell geprüft werden.
