# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lurkollen — a Swedish school phone check-in system. Teachers mark students as having handed in / not handed in their phone each day. Built as a Vercel serverless app backed by Supabase (PostgreSQL, Stockholm region).

## Commands

```bash
# Local development (requires Vercel CLI)
vercel dev                        # runs API routes + static files on localhost:3000

# Deploy
vercel --prod                     # deploy local files directly (bypasses GitHub if webhook is broken)
git push                          # normal deploy via GitHub → Vercel auto-deploy

# Check what's committed
git log --oneline -5
git ls-files js/auth.js           # verify a file is tracked
```

No build step. No bundler. No test suite. Static HTML/CSS/JS served directly.

## Architecture

### Two separate runtimes

**Backend** — `api/*.js` — Node.js serverless functions on Vercel. Each file is one endpoint. They use the Supabase **service role** key (never exposed to browser) and communicate with Supabase directly.

**Frontend** — `index.html` + `js/*.js` + `css/*.js` — plain browser JS, no framework, no bundler. All scripts loaded with `defer` in document order. Execution order matters — see script load order below.

### Frontend script load order (defer, sequential)
```
supabase.min.js (CDN, in <head>)
i18n.js       → TRANSLATIONS object, t(), setLanguage(), applyI18n()
config.js     → JS feature flags (currently just re-exports)
state.js      → all global mutable state variables
storage.js    → localStorage read/write helpers (phc_* keys)
api.js        → authFetch(), all serverGet/serverSet/fetch* functions
auth.js       → initAuth(), signInWithGoogle(), signOut(), getAuthToken()
              → also contains exemptClass(), checkEndOfDay(), createBackup()
students.js   → student CRUD helpers
logs.js       → day-log helpers (getDayLogs, setDayLog)
extra.js      → per-student extra data (slot, note, flags)
guardians.js  → guardian upload + guardianBlock() renderer
import-export.js → CSV/XML/JSON import pipeline
components/toast.js, date-nav.js, modals.js
views/dashboard.js, trends.js, students.js, report.js
settings.js   → settings fetch, save, and full settings UI render
app.js        → startup IIFE (auth gate → parallel data fetch → renderDash)
```

### The critical pattern: `t()` fallback behaviour
`t('some.key')` returns the **key string itself** if the key is missing — NOT null/undefined. This means `t('key') || 'fallback'` **never works**. Always add missing keys to both `sv` and `en` dictionaries in `i18n.js`.

### Auth flow
1. `app.js` calls `await initAuth()` as first thing in startup IIFE
2. `initAuth()` fetches `/api/config` (public Supabase URL + anon key), creates Supabase browser client, calls `getSession()`
3. No session → `showLoginOverlay()` → user clicks Google button → OAuth redirect → page reloads → session found → continue
4. All API calls go through `authFetch()` (defined in `api.js`) which injects `Authorization: Bearer <token>`
5. Every API endpoint calls `requireAuth(req, res)` from `api/_lib/auth.js` which verifies the JWT via Supabase service role

### Data flow
- **Write path**: user action → update localStorage → call `authFetch(API/...)` fire-and-forget
- **Read path on load**: `Promise.all([fetchSettings, fetchStudents, fetchExtra, loadFlags, serverGet(date)])` in parallel
- **Polling**: `setInterval(pollServer, 15000)` — polls `/api/status?date=X` every 15s for live status sync
- **Extra data** has a 10-second dirty lock (`_extraDirtyUntil`) to prevent server overwrites after local changes

### Supabase tables
All tables have a `school_id` column. Every query filters by `SCHOOL_ID` (from env var — **this is the next major change**, see below).

| Table | Key columns |
|---|---|
| `students` | `school_id, id, data (jsonb)` |
| `status_logs` | `school_id, date, student_id, status` |
| `extra` | `school_id, student_id, data (jsonb)` |
| `guardians` | `school_id, student_id, data (jsonb)` |
| `flags` | `school_id, date, data (jsonb)` |
| `settings` | `school_id, data (jsonb)` |
| `backups` | `school_id, name, data (jsonb), created_at` |

### Environment variables (Vercel)
| Var | Where used | Notes |
|---|---|---|
| `SUPABASE_URL` | All API files | Public, also served via `/api/config` |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/_lib/supabase.js` | Never in browser |
| `SUPABASE_ANON_KEY` | `/api/config` endpoint | Safe to expose — used by browser Supabase client |
| `SCHOOL_ID` | `api/_lib/supabase.js` | Single-tenant; will be replaced by per-user lookup |
| `ALLOWED_EMAILS` | `api/_lib/auth.js` | Comma-separated allowlist (value hidden in Vercel UI — it's sensitive) |
| `ALLOWED_DOMAIN` | `api/_lib/auth.js` | e.g. `skola.se` — whole domain allowlist |

### Pending major work: multi-tenancy
`SCHOOL_ID` is currently a hardcoded env var (single school per deployment). The planned replacement is:
- `schools` table + `school_users` table in Supabase
- `api/_lib/supabase.js` resolves `school_id` from the authenticated user's JWT via a `school_users` lookup instead of env var
- Invite code system for onboarding teachers to schools
- `ALLOWED_EMAILS` / `ALLOWED_DOMAIN` env vars become obsolete once this is built

### Vercel deployment quirk
Vercel's GitHub auto-deploy webhook sometimes gets stuck serving an old commit even after new pushes. If `vercel --prod` (CLI deploy) and GitHub auto-deploy disagree, use `vercel --prod` to force the correct code. Check the Source tab on any Vercel deployment to confirm which commit is actually running.

### Cache headers
JS and CSS are cached for 30 seconds (`max-age=30, stale-while-revalidate=60`) — set in `vercel.json`. Bump this up before going to production at scale.
