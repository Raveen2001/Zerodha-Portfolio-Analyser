-- Portfolio snapshots (one row per upload per user)
create table if not exists portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  holdings jsonb not null default '{}'
);

create index if not exists portfolio_snapshots_user_id on portfolio_snapshots(user_id);
create index if not exists portfolio_snapshots_uploaded_at on portfolio_snapshots(user_id, uploaded_at desc);

alter table portfolio_snapshots enable row level security;

create policy "Users can read own portfolio_snapshots"
  on portfolio_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own portfolio_snapshots"
  on portfolio_snapshots for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own portfolio_snapshots"
  on portfolio_snapshots for delete
  using (auth.uid() = user_id);

-- Sets (user-defined stock sets)
create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  symbols jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists sets_user_id on sets(user_id);

alter table sets enable row level security;

create policy "Users can read own sets"
  on sets for select
  using (auth.uid() = user_id);

create policy "Users can insert own sets"
  on sets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sets"
  on sets for update
  using (auth.uid() = user_id);

create policy "Users can delete own sets"
  on sets for delete
  using (auth.uid() = user_id);
