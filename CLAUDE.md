# ApplySharp — context for Claude Code

## What this is
NHS supporting statement generator. Sister project, replacing a £120 Custom GPT that someone sells UK applicants. Core thesis: the win isn't "evading AI detection" (NHS Employers explicitly say no reliable detection exists) — it's writing statements that actually score against the person specification.

## Architecture in one paragraph
Next.js 16 App Router, Supabase (Postgres + magic-link auth + RLS), Claude Sonnet 4.6 for three jobs (criteria extraction, gap analysis, generation). All AI calls go through `src/lib/prompts/` — that's where the product value lives. UI is a 5-step wizard at `/app/statement/[id]`.

## Important conventions
- All sensitive operations check `requireUser()` from `src/lib/api.ts`.
- Statement ownership is verified before generation (anti-token-burning).
- Person spec lives in `statements.person_spec` jsonb. Gap fills in `gap_fills` jsonb (each row has criterionId + answer + denormalised criterionText/question/hint for fast render without re-fetching).
- The wizard persists progress to the row on every step transition so users can resume.
- `proxy.ts` not `middleware.ts` — Next 16.2 renamed the convention.

## Where to start when iterating
- Output quality issues → `src/lib/prompts/generate-statement.ts` (the system prompt is the lever)
- Criteria wrong → `src/lib/prompts/extract-criteria.ts`
- Wrong/too many gap questions → `src/lib/prompts/gap-analysis.ts`
- UX issues → `src/app/app/statement/[id]/StatementWizard.tsx`

## Don't yet
- Add other sectors (Civil Service, councils, teaching) until NHS flow is rock-solid with real users
- Add Stripe — free during beta, validate quality first
- Refactor for "scale" — single tenant per request, no hot path

## Test approach
There are no tests yet. Validate by running real NHS Trac job adverts through the wizard end-to-end and reading the output. Iterate on the prompts.
