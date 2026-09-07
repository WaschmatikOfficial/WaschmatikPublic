# WASCHMATIK – STEP 2

Aufbau auf `STEP1-CLEAN`.

Enthalten:
- Supabase Workflow für Anfragen und Aufträge
- sichere Partner-Aktionen per einmaligem, gehashtem Token
- Partner-Annahme/Ablehnung
- Abschluss einer Reparatur + finaler Rechnungsbetrag
- serverseitige 5-%-Provision
- automatische Rechnungserstellung nach Abschluss
- Abrechnungs-E-Mail
- Kunden-Follow-up nach 2 Tagen (Edge Function; Scheduler muss in Supabase eingerichtet werden)
- Kundenbestätigung und Kunden-Rechnungsbetrag
- Abgleichsmöglichkeit im Adminbereich
- Admin-/Partner-Berechtigungen und Audit-Log
- PLZ-/Servicegebietsprüfung gegen Manipulation
- Rate-Limit und Deduplizierung öffentlicher Anfragen
- überfällige Rechnungen per Helper-Funktion
- sicherere Token-/RLS-Struktur

Nicht automatisch erledigt:
- Verbindung zu deinem echten Supabase-/Vercel-/GitHub-Konto
- Setzen deiner echten Secrets
- Import echter PLZ-Geodaten
- produktiver Scheduler
- echte Impressums-/Datenschutz-/Partnertexte

Diese Punkte brauchen deine Account-Zugänge bzw. echte Unternehmensdaten und dürfen nicht erfunden werden.
