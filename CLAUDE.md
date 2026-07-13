# CLAUDE.md — Project handover notes for Nazaq CRM

Read this file first in any new conversation. It contains everything needed to continue development.
The owner (Enas) is non-technical: explain steps simply, give copy-paste SQL when DB changes are needed,
and always test before deploying.

## What this is
Bilingual (Hebrew UI, RTL; Arabic public form) CRM for "מרכז הناصرة للتأهيل" (Nazareth Rehabilitation Center).
Manages: student leads + calls + semesters + meetings calendar, a separate Doctor Training Course feature
(courses/doctors/payments), and a public WhatsApp lead-capture form.

## Architecture
- **GitHub**: `Enasb1/Nazaq-CRM-New`, branch `main`. Owner provides a GitHub token in chat (in parts) for push access.
  - git config: user.email "enasb1@github.com", user.name "Enasb1"
  - push: `git remote set-url origin https://Enasb1:<TOKEN>@github.com/Enasb1/Nazaq-CRM-New.git && git push origin main`
- **Railway**: auto-deploys from GitHub `main` (~1 min). Root directory = `backend`. Domains: `nazaq.org` and
  `nazaq-crm-new-production.up.railway.app`. Env vars live in Railway → Variables
  (SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, ENCRYPTION_KEY, NODE_ENV, ALLOWED_ORIGINS).
- **Supabase** (Postgres): project `zafwyompcdvolngkrvyb`. Free tier — **pauses after ~1 week idle**, causing
  Cloudflare 521 errors on login; fix = owner clicks Restore in Supabase dashboard (~5 min).
- **Frontend**: single file `backend/public/index.html` (vanilla JS, all pages/modals/logic inline).
  Public Arabic lead form: `backend/public/welcome.html` served at `/welcome` (301 from `/lead`).
- **Backend**: Node 20 / Express in `backend/src` — routes: auth.js, students.js, calls.js, doctors.js,
  other.js (semesters/users/config/audit), public.js (no-auth lead endpoint, rate-limited + honeypot).

## Critical rules
- **NEVER rotate/change ENCRYPTION_KEY** — existing encrypted data (ID numbers) becomes unreadable.
- Recurring bug pattern: empty string `""` sent to UUID/DATE columns → Postgres 500. Routes sanitize
  empty→null (see `clean()` in routes). Keep doing this for new fields.
- New student/call fields need BOTH: frontend field def + a real column in Supabase (give owner ALTER TABLE SQL).
- `students.status` has a CHECK constraint — adding a status value requires dropping/recreating the constraint.
- Login checks the Supabase `users` table (bcrypt), NOT env vars. Current users: `admin` (role admin),
  `jaber` (role agent — no Settings access).
- Copyright/product notes aside, keep all UI text Hebrew (public form Arabic).

## Local test workflow (before every deploy)
1. `cp backend/test/mock-supabase.js` over `backend/src/config/supabase.js` (BACK UP the real one first).
2. Optionally seed data: append `tables.X.push({...})` lines before `module.exports` in the mock copy.
3. Start server in same bash call:
   `SUPABASE_URL=mock SUPABASE_SERVICE_KEY=mock JWT_SECRET=testsecret ENCRYPTION_KEY=12345678901234567890123456789012 ALLOWED_ORIGINS="*" PORT=30XX node src/index.js &`
4. Test with Playwright (chromium) — login is `admin` / `test1234` (mock-seeded).
5. **ALWAYS restore the real supabase.js** and verify: `grep -c createClient src/config/supabase.js` must be 2.
6. Deploy = commit + push to main.

## Database schema state (migrations the owner already ran)
- students: + birthdate DATE, bagrut TEXT, lead_date TIMESTAMPTZ DEFAULT NOW(), source TEXT,
  appointment_at TIMESTAMPTZ; status CHECK includes ('new','contacted','callback','notinterested','registered','invited')
- calls: + followup_done BOOLEAN DEFAULT false
- doctor tables: doctor_courses, doctors, doctor_payments (see backend/doctor-schema.sql), RLS enabled with
  no policies (service_role bypasses).

## Feature map (all deployed through commit da3c5b2)
- **Students**: collapsible semester groups; multi-select status filter; sortable columns; column
  "תאריך שיחה אחרונה" = last call date; birthdate→auto age; lead_date auto-set; WhatsApp leads get green 💬
  badge + sort to top; Israeli phone + email validation (live borders + save block); status "הוזמן" shows
  appointment picker (date + 30-min time slots).
- **Calls**: grouped one row per student; history popup with collapsible new-call form (can update student
  status + appointment); inline ✏️ edit of past calls; follow-up completion flow ("✓ ביצעתי שיחה חוזרת" →
  callback record + followup_done); orphan calls marked "(תלמיד נמחק)".
- **Meetings (פגישות)**: week calendar, Sun-Sat columns, hour rows 9:00–17:00 (+conditional ‹9:00 / 18:00+
  rows), today ⭐ highlighted, week nav.
- **Doctors course (קורס הכשרת רופאים)**: Dashboard 1 = courses w/ collapsible doctor tables (3 visible:
  latest done/current/next), filters + search, Excel import (SheetJS; splits parent column, fixes sci-notation
  phones); Dashboard 2 = payments (masked password gate "1234", asks every time): reg fee + up to 10 payments,
  auto status: green=paid full, orange=partial, red=reg only, grey=no reg. נותר = price − (reg fee + payments).
  **Blue status exists but its meaning is UNDEFINED — ask owner.**
- **Public lead form** `/welcome`: Arabic RTL, name+phone required, Israeli phone + email format validation,
  creates student status='new', source='whatsapp'; rate limit 5/15min/IP + honeypot field "website".
- **Security**: login rate limit 10/15min; JWT 12h; 15-min inactivity auto-logout; bcrypt; helmet CSP
  (allows inline scripts + cdn.jsdelivr.net — needed, do not remove).

## OPEN ITEMS (next conversation should start here)
1. **Run welcome_stats SQL** — analytics code is deployed but the table must be created by the owner
   (SQL was provided in chat; also below). Until then, event logging fails silently and the dashboard
   card shows "לא ניתן לטעון נתונים". SQL:
   ```sql
   CREATE TABLE welcome_stats (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     event TEXT NOT NULL CHECK (event IN ('visit','success','invalid','blocked')),
     detail TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE welcome_stats ENABLE ROW LEVEL SECURITY;
   ```
2. **Go-live checklist** (owner deferred): set strong passwords (regenerate fresh hashes when needed),
   rotate Supabase service key + GitHub token, optionally rotate JWT_SECRET (NEVER ENCRYPTION_KEY),
   decide if payments API should be admin-only (currently agents can reach it via API).
3. **Blue doctor status** — meaning undefined, ask owner.

## DONE (July 2026 session)
- Session expiry fix: JWT 12h→24h; inactivity auto-logout skipped while any modal is open;
  clear Hebrew message shown on 401 (and login-endpoint 401s now show the real error, not "Session expired").
- Login placeholder "admin" removed.
- Follow-up displays exclude completed callbacks (`!c.followup_done`) in: dashboard reminder list,
  pendingCount badge, student-detail call history, calls history popup.
- /welcome analytics: `welcome_stats` event log (visit/success/invalid/blocked incl. honeypot + rate-limit),
  fire-and-forget logger `src/utils/welcomeStats.js`, admin-only GET /api/welcome-stats (aggregates total + 7-day),
  admin-only dashboard card. Mock DB updated with the table.

## WhatsApp context (no code involved)
Owner uses WhatsApp Business app on iPhone. Greeting message only fires on first contact / after 14 days;
the reliable "reply to everyone" is **Away message with "Always send"**. The app CANNOT auto-extract chats or
send emails — full in-chat bots require WhatsApp Business API via a BSP (discussed, deferred). The auto-reply
text (Arabic) links to https://nazaq.org/welcome.
