-- Disruption Forecast Agent: schema. Public information about industries only; no personal or health data.
create extension if not exists "pgcrypto";

create type driver as enum ('growth','security','government','stability','technology','trust');
create type stage as enum ('expansion','incident','protective_layer','rule');

create table industries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,  -- null for seeded industries
  name text not null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  check (is_seed or owner_id is not null)
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references industries(id) on delete cascade,
  name text not null,
  description text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  industry text not null,
  year int not null,                       -- negative = BC
  job text not null,
  main_driver driver not null,
  supporting_drivers driver[] not null default '{}',
  stage stage not null,
  what_created text not null,
  source text not null check (length(trim(source)) > 0),
  source_url text,
  approximate boolean not null default false,
  created_at timestamptz not null default now(),
  unique (industry, year, job, stage, what_created)
);
create index cases_industry_year on cases (industry, year);

create table signals (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references industries(id) on delete cascade,
  job text not null,
  driver driver not null,
  description text not null,
  strength int not null check (strength between 1 and 5),
  source_url text,
  unsourced boolean generated always as (source_url is null or length(trim(source_url)) = 0) stored,
  observed_on date not null,
  origin text not null default 'web' check (origin in ('web','upload','manual')),
  created_at timestamptz not null default now()
);
create index signals_industry on signals (industry_id);

create table backtests (
  id uuid primary key default gen_random_uuid(),
  industry text not null,
  cutoff_year int not null,
  predicted_layer stage,
  actual_layer stage,
  hit boolean,
  brier numeric,
  baseline_brier numeric,
  calibration jsonb not null default '[]',
  cases_used int not null,
  low_evidence boolean not null default false,
  model_version text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index backtests_industry on backtests (industry, created_at desc);

create table forecasts (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references industries(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  stage stage not null,
  next_layer stage not null,
  probability numeric not null check (probability between 0 and 1),
  distribution jsonb not null default '{}',
  window_start date not null,
  window_end date not null,
  reasons jsonb not null default '[]',
  cases_used int not null,
  low_evidence boolean not null default false,
  pressure_scores jsonb not null default '{}',
  feasibility jsonb,
  challenger_notes jsonb,
  backtest_id uuid references backtests(id),
  model_version text not null,
  created_at timestamptz not null default now()
);
create index forecasts_industry on forecasts (industry_id, created_at desc);
