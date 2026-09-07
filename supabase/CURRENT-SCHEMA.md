# WASCHMATIK – aktuelles Supabase-Backend

Diese Version ist auf das bereits eingerichtete WASCHMATIK-Supabase-Projekt ausgerichtet.

Die aktive Datenstruktur verwendet `partners`, `partner_service_areas`, `customers`, `repair_requests`, `request_assignments`, `orders`, `admins`, `profiles`, `user_roles` und `audit_logs`.

Die alten Dateien unter `supabase/migrations/0001_*` bis `0005_*` und die nicht mehr vom Frontend verwendeten Legacy-Edge-Functions stammen aus einer früheren Projektphase. Sie bleiben zur Nachvollziehbarkeit im Archiv, werden aber von der aktuellen Vercel-Website nicht aufgerufen.

Die aktuelle Frontend-Backend-Ausrichtung befindet sich in `20260907210000_align_current_frontend_backend.sql`.

Für Vercel benötigt das Frontend nur:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- beim Admin-Projekt `VITE_SITE_MODE=admin`
- beim öffentlichen Projekt `VITE_SITE_MODE=public`

Keine Service-Role-Keys ins Frontend eintragen.
