# LAVA ACORD Training Simulator

Training app for virtual assistants (VAs) who fill out commercial insurance ACORD forms (125, 126, 127, 130, 140).
For each form a trainee watches the training video, passes a 15-question Knowledge Check (80%), then fills out the real
fillable ACORD PDF for a scenario, and the server grades it (pass 80%, max 3 attempts).

Live: https://lava-acord-training.vercel.app (admin sign-in at `/admin`). The owner is not a developer: explain changes
and any manual steps in plain English.

## Stack and commands
- React 18 + Vite + TypeScript + Tailwind (`src/`, alias `@` = `src/`). Supabase (Postgres, Auth, Storage). Vercel hosting.
- `api/chat.ts` is a Vercel serverless function (ACORD Assistant chatbot, Claude API). `npm run dev` also serves it locally via the plugin in `vite.config.ts`.
- `npm run typecheck`, `npm run lint`, `npm run build` must all pass before committing (no test suite exists).
  `build` type-checks `api/` first: a syntax error there once took the chatbot down in production.

## Deploying: pushing to `main` deploys to production
Vercel auto-deploys every push to `main`. Treat a push as going live.

## Secrets
- `.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable). It is gitignored; never commit it.
- `ANTHROPIC_API_KEY` and `CHAT_ACCESS` (`admin` | `staff` | `everyone`, default `admin`) are server-only: never prefix them with `VITE_` (that would ship them to the browser).

## Database changes (Supabase)
- Migrations in `supabase/migrations/` are **not applied automatically**. The owner pastes each file into the Supabase SQL Editor.
  When you add or change one, tell the owner exactly which file(s) to run and in what order.
- Make every migration safe to re-run (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`), and add a new timestamped file rather than editing an old one that may already be applied.
- Security model: RLS on every table; roles `student` / `trainer` / `admin` in `profiles` (`is_staff()`, `is_admin()`).
  Answer keys, scenario facts and grading details are staff-only, and grading runs server-side (`submit_assessment`, `lava_private.grade_values`).
  Never move expected answers or grading into the browser. `SECURITY DEFINER` functions must set `search_path`.
- Trainees have no password: the start screen (`src/pages/TraineeStart.tsx`) creates a Supabase anonymous session, and the new-user trigger stores name, agency and trainer. Anonymous users must never become admin.

## Generated files: edit the source, then regenerate
| Generated file | Source | Command |
|---|---|---|
| `supabase/migrations/20261111120000_auto_answer_keys.sql` | `supabase/answer-keys/rules.mjs` | `node supabase/answer-keys/build.mjs` |
| `supabase/migrations/20261112090000_knowledge_checks.sql` | `supabase/knowledge-checks/questions.mjs` | `node supabase/knowledge-checks/build.mjs` |
| `api/_acord-knowledge.ts` | `supabase/knowledge-checks/transcripts/*.txt` | `node supabase/knowledge-checks/build-chat-knowledge.mjs` |

- Answer-key rules find PDF fields by AcroForm name or tooltip. The expected values must match the scenarios in `src/data/modules.ts`; change both together.
  To check which fields a rule picks for a field dump, run `node supabase/answer-keys/build.mjs --check MOD=fields.tsv`.
- Knowledge Check questions **must come from what the training video actually says** (owner requirement), each with an `at: 'mm:ss'` timestamp from the transcript.
  Use the transcripts, not general insurance knowledge.

## Content notes
- Use the fillable PDFs `Acord-130-2019.pdf` and `Acord-140.pdf`. Other copies of the 130/140 PDFs are flat (no form fields) and can't be graded.
- Supabase Free plan caps uploads at 50 MB, so videos must be smaller than that.
- The ACORD 130 video is third-party (Elevated Success).

## ACORD Assistant (`api/chat.ts`)
Claude `claude-opus-5-5` with the video transcripts in a cached system prompt. Admin-only by default (enforced on the server and hidden in the UI).
It coaches instead of giving quiz or assessment answers, and it must never receive answer keys or the assessment scenarios.

`DEVELOPMENT_SUMMARY.md` is an older build log: where it disagrees with this file, this file is current.
