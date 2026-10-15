-- Row-level security. Service role bypasses RLS and is the only writer of cases and backtests.
alter table industries enable row level security;
alter table jobs       enable row level security;
alter table cases      enable row level security;
alter table signals    enable row level security;
alter table forecasts  enable row level security;
alter table backtests  enable row level security;

-- Industries: own rows, plus seeded rows readable by everyone (seeded rows are read-only).
create policy industries_read   on industries for select using (is_seed or owner_id = auth.uid());
create policy industries_insert on industries for insert with check (owner_id = auth.uid() and not is_seed);
create policy industries_update on industries for update using (owner_id = auth.uid() and not is_seed) with check (owner_id = auth.uid() and not is_seed);
create policy industries_delete on industries for delete using (owner_id = auth.uid() and not is_seed);

-- Jobs follow their industry.
create policy jobs_read on jobs for select using (
  exists (select 1 from industries i where i.id = jobs.industry_id and (i.is_seed or i.owner_id = auth.uid())));
create policy jobs_write on jobs for all
  using (exists (select 1 from industries i where i.id = jobs.industry_id and i.owner_id = auth.uid() and not i.is_seed))
  with check (exists (select 1 from industries i where i.id = jobs.industry_id and i.owner_id = auth.uid() and not i.is_seed));

-- Signals: owner of the industry only.
create policy signals_all on signals for all
  using (exists (select 1 from industries i where i.id = signals.industry_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from industries i where i.id = signals.industry_id and i.owner_id = auth.uid()));

-- Forecasts: owner only.
create policy forecasts_all on forecasts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Cases and backtests: readable by everyone, no write policies (service role only).
create policy cases_read     on cases     for select using (true);
create policy backtests_read on backtests for select using (true);
