// Isolated real PostgreSQL checks with synthetic fixtures only. No Supabase call.
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

const execute = promisify(execFile);
const container = `dm66-private-test-${randomUUID().slice(0, 8)}`;
const dockerEnvironment = { ...process.env };
for (const name of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnvironment[name];
const dockerOptions = { env: dockerEnvironment, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] };
const dockerArgs = ['--host=unix:///var/run/docker.sock'];
const digest = value => createHash('sha256').update(value).digest('hex');
const tokenA = digest('synthetic-session-a');
const tokenB = digest('synthetic-session-b');
const rotatedB = digest('synthetic-rotated-session-b');
function docker(args, options = {}) { return execFileSync('docker', [...dockerArgs, ...args], { ...dockerOptions, ...options }); }
function sql(input, database = 'postgres') { return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt'], { input }); }
async function ready() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); return; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  throw new Error('Local PostgreSQL did not start');
}
try {
  docker(['info', '--format', '{{.ServerVersion}}']);
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']);
  await ready();
  sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;`);
  const migration = readFileSync(new URL('../supabase/migrations/202610180001_private_recipient_wishes.sql', import.meta.url), 'utf8');
  sql(migration);
  sql(migration); // Reapplying the migration preserves data and grants.
  sql(`set role service_role;
    do $$ declare v_counts jsonb; begin
      v_counts := public.dm66_import_workbook(
        '[{"id":"synthetic-a","full_name":"Nguyễn Đặng An","normalized_name":"nguyen dang an","student_code":"SYNTHETIC-A001","display_name":"An A","image":"/images/portrait-placeholder.svg","introduction":"Synthetic profile A","personality":"","memory":""},
          {"id":"synthetic-b","full_name":"Nguyễn Đặng An","normalized_name":"nguyen dang an","student_code":"SYNTHETIC-B001","display_name":"An B","image":"/images/portrait-placeholder.svg","introduction":"Synthetic profile B","personality":"","memory":""}]'::jsonb,
        '[{"id":"wish-a1","recipient_id":"synthetic-a","title":"Lời thứ nhất","sender_name":"Người gửi mẫu","message":"SYNTHETIC PRIVATE WISH A1","sort_order":2},
          {"id":"wish-a2","recipient_id":"synthetic-a","title":"Lời thứ hai","sender_name":"Người gửi mẫu","message":"SYNTHETIC PRIVATE WISH A2","sort_order":1},
          {"id":"wish-b1","recipient_id":"synthetic-b","title":"Lời dành cho B","sender_name":"Người gửi mẫu","message":"SYNTHETIC PRIVATE WISH B1","sort_order":0}]'::jsonb);
      if v_counts <> '{"recipients":2,"wishes":3}'::jsonb then raise exception 'Import counts incorrect'; end if;
      if public.dm66_recipient_login('nguyen dang an','SYNTHETIC-A001',repeat('1',64),'${tokenA}',null) <> '{"authenticated":true}'::jsonb then raise exception 'Correct login failed'; end if;
      if public.dm66_recipient_login('nguyen dang an','SYNTHETIC-B001',repeat('1',64),'${tokenB}',null) <> '{"authenticated":true}'::jsonb then raise exception 'Same-name disambiguation failed'; end if;
      if public.dm66_recipient_login('unknown name','SYNTHETIC-A001',repeat('1',64),repeat('3',64),null) <> '{"authenticated":false}'::jsonb then raise exception 'Name bypass allowed'; end if;
      if public.dm66_recipient_login('nguyen dang an','WRONG-CODE',repeat('1',64),repeat('4',64),null) <> '{"authenticated":false}'::jsonb then raise exception 'Code bypass allowed'; end if;
    end $$;
    do $$ declare a jsonb; b jsonb; begin
      a := public.dm66_recipient_session('${tokenA}'); b := public.dm66_recipient_session('${tokenB}');
      if a->'recipient'->>'id' <> 'synthetic-a' or jsonb_array_length(a->'wishes') <> 2 then raise exception 'Recipient A projection incorrect'; end if;
      if a->'wishes'->0->>'id' <> 'wish-a2' then raise exception 'Wish ordering incorrect'; end if;
      if b->'recipient'->>'id' <> 'synthetic-b' or jsonb_array_length(b->'wishes') <> 1 then raise exception 'Recipient B projection incorrect'; end if;
      if a::text like '%WISH B%' or b::text like '%WISH A%' then raise exception 'Cross-user wish leakage'; end if;
      if a::text ~ 'student_code|token_hash|normalized_name|SYNTHETIC-A001|\\$2[aby]\\$' then raise exception 'Secret projection leak'; end if;
      if public.dm66_recipient_session(repeat('0',64)) is not null or public.dm66_recipient_session('synthetic-b') is not null then raise exception 'Guessed session allowed'; end if;
    end $$;`);
  // Failed batch imports must roll back profiles as well as wishes.
  sql(`set role service_role;
    do $$ begin
      begin
        perform public.dm66_import_workbook(
          '[{"id":"must-rollback","full_name":"Synthetic rollback","normalized_name":"synthetic rollback","student_code":"SYNTHETIC-ROLLBACK","display_name":"Synthetic","image":"/images/portrait-placeholder.svg"}]',
          '[{"id":"bad-owner","recipient_id":"missing-owner","title":"Test","sender_name":"Synthetic","message":"Synthetic","sort_order":0}]');
        raise exception 'Invalid workbook accepted';
      exception when foreign_key_violation then null; end;
      begin
        perform public.dm66_import_recipient('duplicate-pair','Synthetic name','nguyen dang an','SYNTHETIC-A001','Synthetic','/images/portrait-placeholder.svg','','','');
        raise exception 'Duplicate credentials accepted';
      exception when invalid_parameter_value then
        if sqlerrm <> 'DM66_DUPLICATE_RECIPIENT_CREDENTIALS' then raise; end if;
      end;
    end $$;
    reset role;
    do $$ begin
      if exists (select 1 from public.dm66_recipients where id = 'must-rollback') then raise exception 'Import was not atomic'; end if;
      if (select count(*) from public.dm66_recipient_sessions) <> 2 then raise exception 'Failed logins created sessions'; end if;
      if exists (select 1 from public.dm66_recipients where student_code_hash = 'SYNTHETIC-A001') then raise exception 'Code stored in plaintext'; end if;
      if exists (select 1 from public.dm66_recipient_sessions where token_hash in ('synthetic-session-a','synthetic-session-b')) then raise exception 'Raw session persisted'; end if;
      if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
        and p.proname in ('dm66_recipient_login','dm66_recipient_session','dm66_recipient_logout','dm66_import_recipient','dm66_import_wish','dm66_import_workbook')
        and not (p.prosecdef and p.proconfig @> array['search_path=""'])) then raise exception 'Unsafe RPC search path'; end if;
    end $$;`);
  // Reuse the same code on a different name to verify independent random salts.
  sql(`set role service_role;
    select public.dm66_import_recipient('synthetic-c','Synthetic C','synthetic c','SYNTHETIC-A001','C','/images/portrait-placeholder.svg','','','');
    reset role;
    do $$ begin
      if (select count(distinct student_code_hash) from public.dm66_recipients where id in ('synthetic-a','synthetic-c')) <> 2 then raise exception 'Missing random salts'; end if;
    end $$;`);
  // Restart the actual database, then verify sessions and rate counters persist.
  docker(['restart', container]); await ready();
  sql(`set role service_role;
    do $$ begin
      if public.dm66_recipient_session('${tokenB}')->'recipient'->>'id' <> 'synthetic-b' then raise exception 'Session lost after database restart'; end if;
      for i in 1..10 loop
        if coalesce((public.dm66_recipient_login('rate name','WRONG-CODE',lpad(i::text,64,'0'),repeat('8',64),null)->>'limited')::boolean,false) then raise exception 'Name limit too early'; end if;
      end loop;
      if (public.dm66_recipient_login('rate name','WRONG-CODE',repeat('5',64),repeat('8',64),null)->>'limited')::boolean is not true then raise exception 'Name limit absent across IPs'; end if;
      for i in 1..60 loop
        if coalesce((public.dm66_recipient_login('rate ip ' || i,'WRONG-CODE',repeat('6',64),repeat('8',64),null)->>'limited')::boolean,false) then raise exception 'IP limit too early'; end if;
      end loop;
      if (public.dm66_recipient_login('rate ip 61','WRONG-CODE',repeat('6',64),repeat('8',64),null)->>'limited')::boolean is not true then raise exception 'IP limit absent across names'; end if;
      if public.dm66_recipient_login('nguyen dang an','SYNTHETIC-B001',repeat('1',64),'${rotatedB}','${tokenB}') <> '{"authenticated":true}'::jsonb then raise exception 'Session rotation failed'; end if;
      if public.dm66_recipient_session('${tokenB}') is not null then raise exception 'Old session survived rotation'; end if;
      perform public.dm66_recipient_logout('${rotatedB}');
      if public.dm66_recipient_session('${rotatedB}') is not null then raise exception 'Revoked session survived logout'; end if;
    end $$;
    reset role;
    update public.dm66_recipient_sessions set expires_at = now() - interval '1 second' where token_hash = '${tokenA}';
    set role service_role;
    do $$ begin
      if public.dm66_recipient_session('${tokenA}') is not null then raise exception 'Expired session accepted'; end if;
    end $$;`);
  // Concurrent attempts cannot bypass the name counter on separate instances.
  await Promise.all(Array.from({ length: 20 }, (_, i) => execute('docker', [...dockerArgs, 'exec', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c',
    `set role service_role; select public.dm66_recipient_login('concurrent rate','WRONG-CODE','${digest(`synthetic-ip-${i}`)}','${digest(`synthetic-attempt-${i}`)}',null);`], { env: dockerEnvironment })));
  sql(`do $$ begin
    if (select sum(attempts) from public.dm66_recipient_attempts where scope='name' and key_hash=encode(sha256(convert_to('concurrent rate','UTF8')),'hex')) <> 20 then raise exception 'Concurrent attempts lost'; end if;
    if not exists (select 1 from public.dm66_recipient_sessions where token_hash='${rotatedB}' and revoked_at is not null) then raise exception 'Logout did not persist revocation'; end if;
    end $$;`);
  // No browser role can read tables, verify passwords, import, or mint sessions.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    sql(`set role ${role}; do $$ begin
      begin perform count(*) from public.dm66_recipients; raise exception 'Direct recipient SELECT allowed'; exception when insufficient_privilege then null; end;
      begin perform count(*) from public.dm66_recipient_wishes; raise exception 'Direct wish SELECT allowed'; exception when insufficient_privilege then null; end;
      begin perform count(*) from public.dm66_recipient_sessions; raise exception 'Direct session SELECT allowed'; exception when insufficient_privilege then null; end;
      begin perform count(*) from public.dm66_recipient_attempts; raise exception 'Direct attempt SELECT allowed'; exception when insufficient_privilege then null; end;
    end $$;`);
    if (role !== 'service_role') {
      sql(`set role ${role}; do $$ begin
        begin perform public.dm66_recipient_login('nguyen dang an','SYNTHETIC-A001',repeat('a',64),repeat('b',64),null); raise exception 'Browser login RPC allowed'; exception when insufficient_privilege then null; end;
        begin perform public.dm66_recipient_session('${tokenA}'); raise exception 'Browser session RPC allowed'; exception when insufficient_privilege then null; end;
        begin perform public.dm66_recipient_logout('${tokenA}'); raise exception 'Browser logout RPC allowed'; exception when insufficient_privilege then null; end;
        begin perform public.dm66_import_workbook('[]','[]'); raise exception 'Browser import RPC allowed'; exception when insufficient_privilege then null; end;
      end $$;`);
    }
  }
  sql('create database alternate_pgcrypto;');
  sql('create extension pgcrypto with schema public; grant usage on schema public to service_role;', 'alternate_pgcrypto');
  sql(migration, 'alternate_pgcrypto');
  sql(`set role service_role;
    select public.dm66_import_recipient('alternate','Synthetic Alternate','synthetic alternate','SYNTHETIC-ALT','Synthetic','/images/portrait-placeholder.svg','','','');
    do $$ begin
      if public.dm66_recipient_login('synthetic alternate','SYNTHETIC-ALT',repeat('1',64),repeat('a',64),null) <> '{"authenticated":true}'::jsonb then raise exception 'Existing pgcrypto schema was not supported'; end if;
    end $$;`, 'alternate_pgcrypto');
  console.log('Private-recipient PostgreSQL checks passed: atomic import rollback, salted hashes, credentials, same-name recipients, secret-free projections, private multiple wishes, guessed IDs, session restart/rotation/expiry/revocation, persistent and concurrent name/IP rate limits, RLS and RPC grants.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Private-recipient PostgreSQL verification failed');
  if (error && typeof error === 'object' && 'stderr' in error) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  try { docker(['rm', '-f', container]); } catch { /* Already removed. */ }
}
