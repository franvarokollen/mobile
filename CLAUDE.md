# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lurkollen — a Swedish school phone check-in system. Teachers mark students as having handed in / not handed in their phone each day. Built as a Vercel serverless app backed by Supabase (PostgreSQL, Stockholm region).

## Commands

```bash
# Local development (requires Vercel CLI)
vercel dev                        # runs API routes + static files on localhost:3000

# Deploy
git push                          # normal deploy via GitHub → Vercel auto-deploy
vercel --prod                     # FALLBACK: force deploy if GitHub webhook is stuck (see below)

# Check what's committed
git log --oneline -5
git ls-files js/auth.js           # verify a file is tracked
```

No build step. No bundler. No test suite. Static HTML/CSS/JS served directly.

## ⚠️ Deployment checklist — do this after every push

After `git push`, if the user reports changes aren't visible:

1. **Check Vercel** — go to vercel.com → lurkollen → Deployments. Confirm the latest deployment shows the correct commit hash (matches `git log --oneline -1`). If it shows an old commit, the GitHub webhook is stuck.
2. **Force redeploy** — run `vercel --prod` in the project directory. This bypasses GitHub and deploys local files directly. Takes ~30 seconds.
3. **HTML is now no-cache** — `vercel.json` sets `max-age=0, must-revalidate` on all HTML files, so browser/CDN cache is no longer a problem for HTML. JS/CSS still have 30s cache so a hard refresh (Ctrl+Shift+R) handles those.

The GitHub webhook getting stuck has happened multiple times. **Always run `vercel --prod` when in doubt** — it's safe and fast.

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
All tables have a `school_id` column (UUID FK to `schools.id`). Every query filters by the authenticated user's school, resolved at request time via `school_users`.

| Table | Key columns |
|---|---|
| `schools` | `id (uuid), name, slug, meta (jsonb), created_at` |
| `school_users` | `school_id, user_id, role ('admin'\|'teacher'), created_at` |
| `invites` | `school_id, code, email, expires_at, used_by, used_at, email_sent_at` |
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
| `ADMIN_TOKEN` | `api/admin/*.js` | Secret token for the super-admin dashboard at `/admin` |

`SCHOOL_ID`, `ALLOWED_EMAILS`, and `ALLOWED_DOMAIN` are obsolete — remove them from Vercel if still present.

### Auth helpers (`api/_lib/auth.js`)
- `requireAuth(req, res)` — verifies JWT + looks up `school_users`, returns `{ user, schoolId, role }`. Used by all regular endpoints.
- `requireAuthBasic(req, res)` — verifies JWT only, returns `user`. Used by `/api/me` and `/api/invite-redeem` (no school required yet).

### Cache headers (`vercel.json`)
- HTML files (`/`, `/*.html`, `/admin`, `/view`): `max-age=0, must-revalidate` — always fresh
- JS/CSS: `max-age=30, stale-while-revalidate=60` — 30-second cache for active development. Increase before scaling.
