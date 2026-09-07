# WASCHMATIK Schritt 2 – Automationen

Die Funktion `send-customer-followups` ist für einen zeitgesteuerten Aufruf vorbereitet.
Sie soll regelmäßig (z. B. täglich) ausgeführt werden, damit nach abgeschlossenen Reparaturen automatisch die Kunden-Rückfrage versendet wird.

Die Funktion `mark_overdue_invoices()` kann ebenfalls regelmäßig aufgerufen werden, um offene Rechnungen nach Fälligkeit als `überfällig` zu markieren.

Für Produktion muss der Scheduler in Supabase bzw. über einen vertrauenswürdigen externen Cron eingerichtet werden. Die Secrets bleiben ausschließlich serverseitig.
