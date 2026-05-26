# Mobilekollen Online

School phone check-in system — online version.  
Built for Vercel + Supabase. Same UI as the local version, cloud-backed.

---

## Setup (5 minutes)

### 1. Create a Supabase project
1. Go to [app.supabase.com](https://app.supabase.com) → New project
2. Open **SQL Editor** → New query
3. Paste the contents of `supabase/schema.sql` → Run

### 2. Get your API keys
In your Supabase project → **Settings → API**:
- Copy **Project URL** → `SUPABASE_URL`
- Copy **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Local development
```bash
npm install -g vercel          # install Vercel CLI once
cp .env.example .env           # fill in your keys
vercel dev                     # starts at http://localhost:3000
```

### 4. Deploy to Vercel
```bash
vercel                         # first deploy — follow prompts
```
Or connect the GitHub repo in the Vercel dashboard — every push auto-deploys.

**Add environment variables in Vercel:**  
Project → Settings → Environment Variables → add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCHOOL_ID`

---

## Adding SSO later (Google / Microsoft)

When you're ready:
1. Enable **Google** and/or **Azure** OAuth providers in Supabase → Authentication → Providers
2. Add `@supabase/auth-helpers-js` to the frontend
3. Replace the PIN screen with a proper login button
4. Update the RLS policies in Supabase to be per-user instead of open

The `SCHOOL_ID` in the API functions will come from the user's JWT claims rather than an env var.

---

## Project structure

```
├── index.html          HTML shell (same as local version)
├── css/                Styles
├── js/                 Frontend modules (same as local version)
│   ├── api.js          ← adapted: calls /api/* instead of local server
│   └── state.js        ← adapted: SERVER=true (always online)
├── api/                Vercel serverless functions
│   ├── _lib/
│   │   └── supabase.js Supabase client
│   ├── status.js       Daily check-in logs
│   ├── students.js     Student roster CRUD
│   ├── students-bulk.js Bulk import
│   ├── guardians.js    Guardian contacts
│   ├── extra.js        Per-student flags
│   ├── flags.js        Explained/unreported absence flags
│   ├── backup.js       Backup + restore
│   └── ping.js         Health check
├── supabase/
│   └── schema.sql      Run this once in Supabase SQL Editor
├── vercel.json         Routing config
├── package.json
└── .env.example        Copy → .env, fill in keys
```
