# Kostenloser Render-Test

Diese Version ist vorbereitet, aber noch nicht veröffentlicht. Zunächst GitHub-, Render- und Supabase-Konto erstellen. Nur kostenlose Tarife wählen. Wenn eine Karte oder ein kostenpflichtiges Upgrade verlangt wird, den Vorgang anhalten. Die App verwendet weiterhin lokal JSON-Dateien, solange keine Supabase-Zugangsdaten gesetzt sind.

## 1. Programmcode bei GitHub

Ein privates Repository `war-imperium` erstellen. Die vorbereiteten Dateien aus dem separaten Ordner `render-upload` hochladen. **Nicht den bisherigen Projektordner samt Daten hochladen. `.env`, `data/`, Schlüssel und Abmeldungen gehören nicht ins Repository.** Die Upload-Dateien müssen direkt im Stamm des Repositorys liegen, sodass `package.json` dort sichtbar ist.

## 2. Dauerhafter Speicher

Bei https://supabase.com/dashboard ein Free-Projekt erstellen (Anmeldung mit GitHub möglich). Ein sicheres Datenbankpasswort selbst festlegen. Im SQL Editor den Inhalt von `setup-database.sql` ausführen. Das erzeugt die Tabelle `war_imperium_state`, ohne öffentlichen Lese- oder Schreibzugriff. Data API im Projekt aktiv lassen; public-Schema muss darüber erreichbar sein.

Die Projekt-URL und einen **Secret-Key** (`sb_secret_…`, alternativ Legacy-`service_role`) aus den Projekteinstellungen später nur in Render hinterlegen. Kein Publishable-/anon-Key: dieser hat bewusst keinen Tabellenzugriff. Diese Geheimnisse nie ins Repository oder in den Chat schreiben. Die App braucht das Datenbankpasswort nicht.

## 3. Lokale Daten übernehmen – vor dem ersten Online-API-Abruf

Lokalen Server beenden und den bisherigen `data`-Ordner sichern. In der lokalen `.env` vorübergehend ergänzen:

```text
SUPABASE_URL=https://dein-projekt.supabase.co
SUPABASE_SECRET_KEY=dein_geheimer_schluessel
```

Im bisherigen Projektordner PowerShell öffnen und ausführen:

```powershell
node --env-file=.env migrate.mjs
```

Der Import liest die vorhandenen lokalen Dateien und überträgt sie in die leere Datenbank. Vorhandene Online-Einträge werden nicht überschrieben. Bei Fehlern stoppen und die Meldung ohne Schlüssel weitergeben. Nach Erfolg die beiden Supabase-Zeilen wieder aus der lokalen `.env` entfernen, damit lokale Tests weiterhin die lokalen Dateien verwenden. Die ursprünglichen Dateien bleiben unverändert. Ein bereits teilweise erfolgter Import kann manuell geprüft werden; nicht blind erneut importieren oder Tabellen löschen.

## 4. Render Web Service

New → Web Service, eigenes privates GitHub-Repository verbinden (nur Zugriff auf dieses Repository erteilen). Einstellungen:

| Einstellung | Wert |
|---|---|
| Runtime | Node |
| Region | Frankfurt, falls verfügbar |
| Root Directory | leer, wenn package.json im Stamm liegt |
| Build Command | `npm install --ignore-scripts` |
| Start Command | `npm start` |
| Instance Type | **Free** |
| Health Check Path | `/health` |

Unter Environment folgende Variablen setzen:

| Name | Wert |
|---|---|
| NODE_VERSION | `22` |
| APP_USER | selbst gewählter Benutzername, z. B. `admin` |
| APP_PASSWORD | selbst gewähltes starkes Passwort, mindestens 16 Zeichen |
| SUPABASE_URL | Supabase-Projekt-URL |
| SUPABASE_SECRET_KEY | Supabase-Secret-Key |
| CLASH_API_KEY | eigener API-Token für die Render-Ausgangs-IP(s) |

Render setzt `PORT`, `RENDER` und `RENDER_EXTERNAL_URL` automatisch. Kein lokales `PORT=3000` und keine `.env` hochladen. Alternativ beschreibt `render.yaml` dieselbe Konfiguration für Blueprints; für den Einstieg reicht der manuelle Web Service. Ohne Datenbank oder Passwort startet die App auf Render bewusst nicht. `/health` zeigt nur Betriebsbereitschaft des Prozesses, nicht die Erreichbarkeit der Datenbank oder Clash-API.

## 5. Clash-Royale-IP-Freigabe prüfen

Am Render-Service Connect → Outbound öffnen. Render liefert geteilte ausgehende **IP-Bereiche**, keine garantierte einzelne IP im kostenlosen Tarif. Im offiziellen Clash-Royale-Portal einen separaten Schlüssel für diesen Server erstellen. Zunächst prüfen, ob die angezeigten Bereiche dort akzeptiert werden. Keine unbeschränkte Freigabe setzen und nicht davon ausgehen, dass eine einmal beobachtete Einzel-IP dauerhaft reicht. Falls das Portal die benötigten Bereiche nicht unterstützt, ist die kostenlose direkte Verbindung so noch nicht gesichert; dann vor einem weiteren Umbau gemeinsam eine Alternative prüfen. Render bietet feste dedizierte Ausgangs-IPs kostenpflichtig an; diese nicht für unseren kostenlosen Test buchen.

Falls erforderlich zunächst einen nicht geheimen Platzhalter für CLASH_API_KEY setzen, um den Service und dessen Outbound-Angaben zu sehen. Ohne gültigen Schlüssel funktionieren die gespeicherten Daten, neue API-Abrufe werden aber abgewiesen. Anschließend den richtigen Schlüssel ausschließlich unter Render Environment ersetzen.

## 6. Funktion prüfen

Die HTTPS-Adresse öffnen. Der Browser fragt nach APP_USER und APP_PASSWORD. Vor der Weitergabe an andere bedenken: Dieser gemeinsame Zugang erlaubt auch das Ändern von Abmeldungen. Zugang nur an berechtigte Clanleitung weitergeben.

Prüfen: altes Archiv sichtbar, API-Abruf erfolgreich, eine Abmeldung setzen und nach Neuladen sowie Render-Neustart noch vorhanden, PDF-Vorschau öffnen, Zugriff vom Handy bei ausgeschaltetem PC. Den bestehenden lokalen Datenordner bis zum Abschluss als Sicherung behalten.

## Grenzen des kostenlosen Tests

- Render schläft nach 15 Minuten ohne Zugriff ein. Beim nächsten Öffnen kann der Start etwa eine Minute dauern.
- Es gibt **keinen garantierten Hintergrundabruf bei geschlossener Webseite**. Die App ruft beim Öffnen und bei offenem Browser stündlich ab. Kein künstliches Dauer-Pinging zum Verhindern des Schlafmodus einrichten. Einen echten geplanten Wochenabruf können wir als getrennten nächsten Schritt einrichten, wenn die API-Freigabe funktioniert.
- Supabase Free kann bei geringer Aktivität pausiert werden. Dann im Dashboard fortsetzen. Regelmäßig zusätzlich Daten sichern; kostenlose Tarife garantieren keine dauerhafte Verfügbarkeit.
- Nur eine Instanz betreiben. Der kleine JSON-Speicher in der Datenbank ist für diese einzelne Clan-App gedacht; mehrere Instanzen benötigen atomare, normalisierte Datensatzänderungen.
- Lokale und Online-Abmeldungen sind nach dem Import getrennt. Fortan echte Abmeldungen online pflegen. Programmupdates erfolgen über GitHub/Render und überschreiben die Datenbank nicht.

Quellen: https://render.com/docs/free · https://render.com/docs/outbound-ip-addresses · https://render.com/docs/web-services · https://supabase.com/pricing
