# Disruption Forecast Agent

A web app and AI agent that estimates **what will break next** in an industry that serves the public (banks, hospitals, post offices, tax departments, utilities and so on). It learns from past cases, scores today's pressure, and gives **odds, a time window and written reasons**, along with who will likely be responsible, which regulator will end up with it, and what would make users trust it.

It is built on one observed pattern: **expansion, then an incident, then a protective layer, then a rule**. The gap from crisis to rule in banking shrank from 6 years (1907 to 1913) to 4 (1929 to 1933) to 2 (2008 to 2010).

> The odds are not predictions of certainty. Rare shocks such as pandemics or wars cannot be predicted from this pattern. Only public information about industries is used. Never enter personal or health information.

## What is in the box

| Part | Where |
|---|---|
| Six agent modules | `src/agent/` (industry-mapper, signal-collector, pressure-scorer, case-library, forecaster, challenger) plus feasibility and backtest |
| Scoring rubric | `docs/rubric.md` |
| Seed cases (banking, telephone, electricity, aviation safety) | `data/seed/*.json`, citations in `docs/sources.md` |
| Database tables and security rules | `supabase/migrations/` |
| Screens | Home, Forecast, Case library, Backtests |
| Health check | `/api/health` |

## Try it with no accounts at all

```bash
npm install
npm test
npm run backtest -- --industry banking --cutoff 1925
npm run dev        # open http://localhost:3000
```

The case library and backtest screens work straight away. Mapping industries, collecting evidence and saving forecasts need the database and an Anthropic key (below).

## Full setup, step by step

1. **GitHub.** Push this repository to your own GitHub account.
2. **Supabase (database and login).** Create a **new** Supabase project; do not reuse an existing one. In the SQL editor, run the files in `supabase/migrations/` in order: `0001_schema.sql`, `0002_rls.sql`, `0003_seed_cases.sql`. (`0003` is generated from the JSON by `npm run gen:seed-sql`.) Under Authentication, choose how sign-up should work (email confirmation on or off).
3. **Environment variables.** Copy `.env.example` to `.env.local` and fill it in:
   * `ANTHROPIC_API_KEY`: from console.anthropic.com
   * `ANTHROPIC_MODEL`: leave as `claude-sonnet-5-5` unless you want another model
   * `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: from Supabase, Project Settings, API. The service-role key bypasses the security rules: keep it on the server only and never commit it.
   * `ENABLE_WEB_SEARCH=true` (optional): lets the evidence collector use Anthropic web search, which is billed per search. It is off by default; without it, upload or paste documents instead.
4. **Run locally:** `npm run dev`. Visit `/api/health`; it should say `"status":"OK"`.
5. **Vercel.** Import the GitHub repo as a **new** project. Add the same environment variables in Project Settings. Then, so a failing test can block a deploy, turn off Vercel's "deploy on every push" under Settings, Git, and instead add three repository secrets in GitHub (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). The workflow in `.github/workflows/ci.yml` then deploys only after lint, type check, tests and the banking backtest pass.
6. **Check the live site:** open `https://<your-site>/api/health`. It must return OK.

## How to read a forecast

* **Heatmap:** darker means more pressure; rows are jobs, columns are the six drivers.
* **Stage:** where the industry is in the usual pattern.
* **Odds and window:** with the number of past cases relied on. Fewer than 5 means "low evidence" and a wider window.
* **Challenger:** a second pass that argues against the forecast, with missing information and weak spots.
* **Backtest link:** every forecast links to the latest backtest score for its industry, or says "Not yet backtested".

## Backtesting

```bash
npm run backtest -- --industry banking --cutoff 1925
```

Runs the forecaster with **only cases before the cutoff**, then compares with what actually happened next. It reports hit or miss, the **Brier score** (lower is better, 0 is perfect; equal odds for the four stages scores 0.75), whether the real event fell inside the time window, and a calibration table. With around ten to fifteen cases per industry these numbers are rough checks, not proof. Also available as `POST /api/backtest` with `{ "industry": "banking", "cutoff": 1925 }`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start locally |
| `npm test` | Unit tests |
| `npm run lint` / `npm run typecheck` | Style and type checks |
| `npm run backtest -- --industry <name> --cutoff <year>` | Backtest |
| `npm run gen:seed-sql` | Rebuild `0003_seed_cases.sql` from `data/seed/` |
