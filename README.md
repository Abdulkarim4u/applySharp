# ApplySharp

NHS supporting statements that hit every essential criterion and read naturally. Paste the job advert, paste your CV, answer a few targeted STAR questions, get a personalised statement.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind 4
- **Supabase** — Postgres, auth (magic link), Row Level Security
- **Anthropic Claude** (Sonnet 4.6) — criteria extraction, gap analysis, streaming generation
- **Vercel** — hosting

## First-time setup

You'll need three things:

1. A Supabase project
2. An Anthropic API key
3. A Vercel account (only needed when you deploy)

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, run it. This creates the `profiles` and `statements` tables with Row Level Security and the user-creation trigger.
3. Open **Authentication → Providers** and confirm **Email** is enabled.
4. Open **Authentication → URL Configuration** and add `http://localhost:3000/auth/callback` (and your Vercel URL when you deploy) to the allowed redirect URLs.
5. From **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Anthropic

1. Go to [console.anthropic.com](https://console.anthropic.com).
2. Top up ~£10 of credits (lasts weeks of testing).
3. Create an API key → `ANTHROPIC_API_KEY`.

### 3. Local env

```bash
cp .env.local.example .env.local
# fill in the three keys above + leave NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run

```bash
npm install   # already done if you ran the build
npm run dev
```

Open `http://localhost:3000`, sign in with your email, you should land in `/app`.

## Project layout

```
src/
├── app/
│   ├── page.tsx                    Landing
│   ├── login/                      Magic-link sign in
│   ├── auth/callback/              Supabase OAuth callback
│   ├── app/                        Authenticated dashboard
│   │   ├── page.tsx                Statement list
│   │   ├── new/                    Creates a statement and redirects
│   │   └── statement/[id]/         Wizard (the main UX)
│   └── api/                        Route handlers
│       ├── extract-criteria/       Job advert → person spec JSON
│       ├── gap-analysis/           Person spec + CV → STAR questions
│       ├── generate-statement/     Streams the final statement
│       └── statements/             CRUD for saved statements
├── components/
│   ├── ui/                         button, input, textarea, card, label
│   ├── logo.tsx
│   └── user-menu.tsx
├── lib/
│   ├── supabase/                   client, server, middleware helpers
│   ├── prompts/                    The Claude prompts (most important code in the repo)
│   ├── anthropic.ts                SDK client
│   ├── anthropic-json.ts           JSON-mode helper for non-streaming calls
│   ├── api.ts                      requireUser + error helpers
│   ├── types.ts                    Domain types
│   └── utils.ts                    cn(), wordCount()
├── proxy.ts                        Auth-gating "middleware" (renamed in Next 16.2)
supabase/
└── schema.sql                      DB migration
```

## How the wizard works

Five steps, persisted to the `statements` row at every transition so users can resume.

1. **Job advert** — user pastes the NHS advert. Server calls `/api/extract-criteria` → Claude returns a JSON `PersonSpec` of essential/desirable criteria.
2. **Review criteria** — user can edit/add/remove criteria, change essential↔desirable. Persisted to `person_spec`.
3. **CV** — user pastes their CV. Server calls `/api/gap-analysis` → Claude compares CV against criteria, returns 3-6 targeted STAR questions for thin criteria.
4. **Fill gaps** — user answers the STAR questions. Persisted to `gap_fills`.
5. **Generate** — server calls `/api/generate-statement`, streams the output to the client, persists to `final_text` when complete.

## Prompt engineering

The prompts live in `src/lib/prompts/`. The `generate-statement` system prompt is the heart of the product — tuned to:

- Address every essential criterion with a STARR mini-story
- British English, first person, varied sentence rhythm
- Banned phrases: "passionate about", "leverage", "robust", "delve", "navigate the complexities", "Throughout my career", "I am writing to express my interest", etc.
- No semicolons or em-dashes in body prose
- Weave NHS values through actions, never as labelled sections

Iterate on the prompt against real NHS job adverts. Regenerate side-by-side, A/B test the output.

## Deployment

```bash
# Push to GitHub (after creating a repo)
git remote add origin <your-repo>
git push -u origin main

# In Vercel:
# 1. Import the repo
# 2. Add env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#    ANTHROPIC_API_KEY, NEXT_PUBLIC_SITE_URL=https://your-domain
# 3. Deploy
# 4. Copy the Vercel URL into Supabase → Authentication → URL Configuration → Redirect URLs
```

## Security notes

- All queries are scoped via Supabase RLS — users physically cannot read each other's statements even if a query is wrong.
- The `proxy.ts` middleware redirects unauthenticated requests to `/login` before they hit any `/app/*` page.
- The Anthropic key only lives server-side. It never reaches the browser.
- API routes validate input with Zod and verify statement ownership before generation (so users can't burn each other's tokens).

## What's not yet built

- Civil Service / local council / teaching / HSC NI flows (only NHS for v1)
- Stripe / paywall (free during beta)
- PDF/Word export (copy-paste works for now)
- Critique-and-revise pass for higher-quality output
- Rate limiting beyond per-user RLS (consider Upstash for production)
