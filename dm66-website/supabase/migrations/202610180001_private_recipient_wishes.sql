-- Private recipient authentication and wishes. Apply to the Preview database.
-- No student codes or private wishes are seeded by this migration.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists dm66_private;
revoke all on schema dm66_private from public, anon, authenticated, service_role;

-- Supabase normally installs pgcrypto in extensions; other PostgreSQL projects
-- may already have it elsewhere. Use its catalog-recorded schema without moving
-- an existing extension or trusting the caller's search_path.
create or replace function dm66_private.code_hash(p_code text, p_existing_hash text default null)
returns text language plpgsql set search_path = '' as $$
declare v_schema text; v_result text;
begin
  select n.nspname into strict v_schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';
  if p_existing_hash is null then
    execute format('select %I.crypt($1, %I.gen_salt(''bf'', 10))', v_schema, v_schema) into v_result using p_code;
  else
    execute format('select %I.crypt($1, $2)', v_schema) into v_result using p_code, p_existing_hash;
  end if;
  return v_result;
end;
$$;
revoke all on function dm66_private.code_hash(text,text) from public, anon, authenticated, service_role;

create table if not exists public.dm66_recipients (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120 and full_name !~ '[[:cntrl:]]'),
  normalized_name text not null check (char_length(normalized_name) between 1 and 200),
  student_code_hash text not null check (student_code_hash ~ '^\$2[aby]\$10\$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120 and display_name !~ '[[:cntrl:]]'),
  image text not null default '/images/portrait-placeholder.svg'
    check (char_length(image) <= 500 and image !~ '[[:cntrl:]]' and (image ~ '^/[^/]' or image ~ '^https://[^/[:space:]]+')),
  introduction text not null default '' check (char_length(introduction) <= 5000),
  personality text not null default '' check (char_length(personality) <= 5000),
  memory text check (char_length(memory) <= 5000),
  updated_at timestamptz not null default now()
);
create index if not exists dm66_recipients_name_idx on public.dm66_recipients(normalized_name);

create table if not exists public.dm66_recipient_wishes (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,80}$'),
  recipient_id text not null references public.dm66_recipients(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  sender_name text not null check (char_length(btrim(sender_name)) between 1 and 120),
  message text not null check (char_length(btrim(message)) between 1 and 10000),
  sort_order integer not null default 0 check (sort_order >= 0)
);
create index if not exists dm66_recipient_wishes_owner_idx on public.dm66_recipient_wishes(recipient_id, sort_order, id);

create table if not exists public.dm66_recipient_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  recipient_id text not null references public.dm66_recipients(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours'),
  revoked_at timestamptz
);
create index if not exists dm66_recipient_sessions_expiry_idx on public.dm66_recipient_sessions(expires_at);
create index if not exists dm66_recipient_sessions_owner_idx on public.dm66_recipient_sessions(recipient_id);

create table if not exists public.dm66_recipient_attempts (
  scope text not null check (scope in ('ip', 'name')),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  bucket timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (scope, key_hash, bucket)
);

alter table public.dm66_recipients enable row level security;
alter table public.dm66_recipient_wishes enable row level security;
alter table public.dm66_recipient_sessions enable row level security;
alter table public.dm66_recipient_attempts enable row level security;
-- Browser roles have neither table access nor any policies. Even service_role
-- uses only the narrowly scoped RPCs below; no direct SELECT is required.
revoke all on public.dm66_recipients, public.dm66_recipient_wishes, public.dm66_recipient_sessions, public.dm66_recipient_attempts from public, anon, authenticated, service_role;

create or replace function public.dm66_import_recipient(
  p_id text, p_full_name text, p_normalized_name text, p_student_code text,
  p_display_name text, p_image text, p_introduction text, p_personality text, p_memory text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_student_code));
begin
  if v_code is null or v_code !~ '^[A-Z0-9._-]{3,64}$'
     or p_normalized_name is null or char_length(p_normalized_name) not between 1 and 200 then
    raise exception 'DM66_INVALID_RECIPIENT' using errcode = '22023';
  end if;
  -- A shared name is valid, but the same name/code pair must identify one person.
  perform pg_advisory_xact_lock(hashtextextended(p_normalized_name, 19092026));
  if exists (select 1 from public.dm66_recipients r where r.normalized_name = p_normalized_name and r.id <> p_id
             and r.student_code_hash = dm66_private.code_hash(v_code, r.student_code_hash)) then
    raise exception 'DM66_DUPLICATE_RECIPIENT_CREDENTIALS' using errcode = '22023';
  end if;
  insert into public.dm66_recipients(id, full_name, normalized_name, student_code_hash, display_name, image, introduction, personality, memory)
    values (p_id, btrim(p_full_name), p_normalized_name, dm66_private.code_hash(v_code), btrim(p_display_name),
      coalesce(nullif(p_image, ''), '/images/portrait-placeholder.svg'), coalesce(p_introduction, ''), coalesce(p_personality, ''), p_memory)
    on conflict (id) do update set full_name = excluded.full_name, normalized_name = excluded.normalized_name,
      student_code_hash = excluded.student_code_hash, display_name = excluded.display_name, image = excluded.image,
      introduction = excluded.introduction, personality = excluded.personality, memory = excluded.memory, updated_at = now();
  -- Reimporting a recipient resets credentials and revokes earlier sessions.
  update public.dm66_recipient_sessions set revoked_at = now() where recipient_id = p_id and revoked_at is null;
end;
$$;

create or replace function public.dm66_import_wish(
  p_id text, p_recipient_id text, p_title text, p_sender_name text, p_message text, p_sort_order integer
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.dm66_recipient_wishes(id, recipient_id, title, sender_name, message, sort_order)
    values (p_id, p_recipient_id, btrim(p_title), btrim(p_sender_name), btrim(p_message), p_sort_order)
    on conflict (id) do update set recipient_id = excluded.recipient_id, title = excluded.title,
      sender_name = excluded.sender_name, message = excluded.message, sort_order = excluded.sort_order;
end;
$$;

create or replace function public.dm66_import_workbook(p_recipients jsonb, p_wishes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row jsonb;
begin
  if jsonb_typeof(p_recipients) is distinct from 'array' or jsonb_typeof(p_wishes) is distinct from 'array'
     or jsonb_array_length(p_recipients) > 10000 or jsonb_array_length(p_wishes) > 50000 then
    raise exception 'DM66_INVALID_WORKBOOK' using errcode = '22023';
  end if;
  for v_row in select value from jsonb_array_elements(p_recipients) loop
    perform public.dm66_import_recipient(v_row->>'id', v_row->>'full_name', v_row->>'normalized_name', v_row->>'student_code',
      v_row->>'display_name', v_row->>'image', v_row->>'introduction', v_row->>'personality', v_row->>'memory');
  end loop;
  for v_row in select value from jsonb_array_elements(p_wishes) loop
    perform public.dm66_import_wish(v_row->>'id', v_row->>'recipient_id', v_row->>'title', v_row->>'sender_name', v_row->>'message', (v_row->>'sort_order')::integer);
  end loop;
  return jsonb_build_object('recipients', jsonb_array_length(p_recipients), 'wishes', jsonb_array_length(p_wishes));
end;
$$;

create or replace function public.dm66_recipient_login(
  p_normalized_name text, p_student_code text, p_ip_hash text, p_session_hash text, p_previous_session_hash text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_bucket timestamptz := date_trunc('hour', now()) + floor(extract(minute from now()) / 15) * interval '15 minutes';
  v_name_hash text := encode(sha256(convert_to(coalesce(p_normalized_name, ''), 'UTF8')), 'hex');
  v_ip_count integer;
  v_name_count integer;
  v_recipient_id text;
  v_row record;
  v_matched_name boolean := false;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' or p_session_hash is null or p_session_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'DM66_INVALID_LOGIN' using errcode = '22023';
  end if;
  insert into public.dm66_recipient_attempts as limits(scope, key_hash, bucket, attempts) values ('ip', p_ip_hash, v_bucket, 1)
    on conflict (scope, key_hash, bucket) do update set attempts = least(limits.attempts + 1, 1000000) returning attempts into v_ip_count;
  insert into public.dm66_recipient_attempts as limits(scope, key_hash, bucket, attempts) values ('name', v_name_hash, v_bucket, 1)
    on conflict (scope, key_hash, bucket) do update set attempts = least(limits.attempts + 1, 1000000) returning attempts into v_name_count;
  delete from public.dm66_recipient_attempts where bucket < now() - interval '2 days';
  delete from public.dm66_recipient_sessions where expires_at < now() - interval '2 days';
  if v_ip_count > 60 or v_name_count > 10 then
    return jsonb_build_object('authenticated', false, 'limited', true);
  end if;
  if p_normalized_name is null or char_length(p_normalized_name) not between 1 and 200
     or p_student_code is null or p_student_code !~ '^[A-Z0-9._-]{3,64}$' then
    return jsonb_build_object('authenticated', false);
  end if;
  for v_row in select id, student_code_hash from public.dm66_recipients where normalized_name = p_normalized_name for share loop
    v_matched_name := true;
    if v_row.student_code_hash = dm66_private.code_hash(p_student_code, v_row.student_code_hash) then v_recipient_id := v_row.id; end if;
  end loop;
  if not v_matched_name then
    -- Pay the password-hash cost for unknown names too. Responses never reveal
    -- whether the name or code was incorrect.
    perform dm66_private.code_hash(p_student_code);
  end if;
  if v_recipient_id is null then return jsonb_build_object('authenticated', false); end if;
  if p_previous_session_hash ~ '^[0-9a-f]{64}$' then
    update public.dm66_recipient_sessions set revoked_at = now() where token_hash = p_previous_session_hash and revoked_at is null;
  end if;
  insert into public.dm66_recipient_sessions(token_hash, recipient_id) values (p_session_hash, v_recipient_id);
  return jsonb_build_object('authenticated', true);
end;
$$;

create or replace function public.dm66_recipient_session(p_session_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_recipient_id text; v_result jsonb;
begin
  select s.recipient_id into v_recipient_id from public.dm66_recipient_sessions s
    where s.token_hash = p_session_hash and s.revoked_at is null and s.expires_at > now();
  if v_recipient_id is null then return null; end if;
  select jsonb_build_object('recipient', jsonb_build_object('id', r.id, 'fullName', r.full_name, 'displayName', r.display_name,
    'image', r.image, 'introduction', r.introduction, 'personality', r.personality, 'memory', r.memory),
    'wishes', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'senderName', w.sender_name, 'message', w.message)
      order by w.sort_order, w.id) from public.dm66_recipient_wishes w where w.recipient_id = r.id), '[]'::jsonb))
    into v_result from public.dm66_recipients r where r.id = v_recipient_id;
  return v_result;
end;
$$;

create or replace function public.dm66_recipient_logout(p_session_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.dm66_recipient_sessions set revoked_at = now() where token_hash = p_session_hash and revoked_at is null;
end;
$$;

revoke all on function public.dm66_import_recipient(text,text,text,text,text,text,text,text,text),
  public.dm66_import_wish(text,text,text,text,text,integer), public.dm66_import_workbook(jsonb,jsonb),
  public.dm66_recipient_login(text,text,text,text,text), public.dm66_recipient_session(text), public.dm66_recipient_logout(text)
  from public, anon, authenticated, service_role;
grant execute on function public.dm66_import_recipient(text,text,text,text,text,text,text,text,text),
  public.dm66_import_wish(text,text,text,text,text,integer), public.dm66_import_workbook(jsonb,jsonb),
  public.dm66_recipient_login(text,text,text,text,text), public.dm66_recipient_session(text), public.dm66_recipient_logout(text)
  to service_role;
