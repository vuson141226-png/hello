-- Run once in the Supabase SQL editor (or `supabase db push`).
-- These tables and RPCs are deliberately unavailable to browser/anonymous roles.
create table if not exists public.dm66_letters (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  sender_name text not null default 'Một cô gái DM66D'
    check (char_length(sender_name) between 1 and 100),
  message text not null check (char_length(btrim(message)) between 5 and 2000),
  created_at timestamptz not null default now(),
  status text not null default 'saved' check (status = 'saved')
);
create index if not exists dm66_letters_created_at_idx on public.dm66_letters(created_at, id);

create table if not exists public.dm66_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.dm66_rate_limits (
  scope text not null,
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  bucket timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (scope, key_hash, bucket)
);
create index if not exists dm66_rate_limits_bucket_idx on public.dm66_rate_limits(bucket);

alter table public.dm66_letters enable row level security;
alter table public.dm66_admins enable row level security;
alter table public.dm66_rate_limits enable row level security;
-- No public policies: regular authenticated users cannot read other people's letters.
revoke all on public.dm66_letters, public.dm66_admins, public.dm66_rate_limits from public, anon, authenticated, service_role;
grant select on public.dm66_letters, public.dm66_admins to service_role;

create or replace function public.dm66_submit_letter(
  p_submission_id uuid,
  p_sender_name text,
  p_message text,
  p_ip_hash text
) returns table(id uuid, sender_name text, message text, created_at timestamptz, status text, replayed boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_existing public.dm66_letters%rowtype;
  v_name text := coalesce(nullif(btrim(p_sender_name), ''), 'Một cô gái DM66D');
  v_message text := btrim(p_message);
  v_count integer;
begin
  if p_submission_id is null or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or char_length(v_name) not between 1 and 100
     or v_name ~ '[[:cntrl:]]'
     or v_message is null or char_length(v_message) not between 5 and 2000 then
    raise exception 'DM66_INVALID_INPUT' using errcode = '22023';
  end if;

  -- Serialize matching retry IDs. Retrying after a lost response cannot create two letters.
  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text, 0));
  select l.* into v_existing from public.dm66_letters l where l.submission_id = p_submission_id;
  if found then
    if v_existing.sender_name <> v_name or v_existing.message <> v_message then
      raise exception 'DM66_SUBMISSION_CONFLICT' using errcode = '22023';
    end if;
    return query select v_existing.id, v_existing.sender_name, v_existing.message, v_existing.created_at, v_existing.status, true;
    return;
  end if;

  -- Atomic across concurrent Vercel instances; permits a class sharing one Wi-Fi.
  insert into public.dm66_rate_limits as limits(scope, key_hash, bucket, attempts)
    values ('letter', p_ip_hash, date_trunc('minute', now()), 1)
    on conflict (scope, key_hash, bucket) do update set attempts = limits.attempts + 1
    returning attempts into v_count;
  if v_count > 30 then
    raise exception 'DM66_RATE_LIMIT' using errcode = 'P0001';
  end if;
  delete from public.dm66_rate_limits limits where limits.bucket < now() - interval '2 days';

  insert into public.dm66_letters(submission_id, sender_name, message)
    values(p_submission_id, v_name, v_message) returning * into v_existing;
  return query select v_existing.id, v_existing.sender_name, v_existing.message, v_existing.created_at, v_existing.status, false;
end;
$$;

create or replace function public.dm66_check_login_limit(p_ip_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
  v_bucket timestamptz := date_trunc('hour', now()) + floor(extract(minute from now()) / 10) * interval '10 minutes';
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'DM66_INVALID_INPUT' using errcode = '22023';
  end if;
  insert into public.dm66_rate_limits as limits(scope, key_hash, bucket, attempts)
    values ('login', p_ip_hash, v_bucket, 1)
    on conflict (scope, key_hash, bucket) do update set attempts = limits.attempts + 1
    returning attempts into v_count;
  delete from public.dm66_rate_limits limits where limits.bucket < now() - interval '2 days';
  return v_count <= 10;
end;
$$;

revoke all on function public.dm66_submit_letter(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.dm66_check_login_limit(text) from public, anon, authenticated;
grant execute on function public.dm66_submit_letter(uuid, text, text, text) to service_role;
grant execute on function public.dm66_check_login_limit(text) to service_role;
