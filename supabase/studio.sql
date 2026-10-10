-- Aangan Studio phone agent: one document per call.
create table if not exists studio_calls (
  id text primary key,
  started_at timestamptz not null,
  data jsonb not null
);
create index if not exists studio_calls_started_at on studio_calls (started_at desc);
-- Same model as the rest of the app: only the server's secret key touches this table.
alter table studio_calls enable row level security;
