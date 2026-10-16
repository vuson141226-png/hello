// Real local PostgreSQL verification, not an in-memory substitute. Requires Docker.
// This isolated database has synthetic Auth roles/users and never contacts Supabase.
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const execute = promisify(execFile);
const container = `dm66-sql-test-${randomUUID().slice(0, 8)}`;
function sql(input) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}
try {
  execFileSync('docker', ['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'], { stdio: 'pipe' });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { execFileSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'pipe' }); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  if (!ready) throw new Error('Local PostgreSQL did not start');
  sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    grant usage on schema public to anon, authenticated, service_role;`);
  sql(readFileSync(new URL('../supabase/migrations/202610160001_dm66_letters.sql', import.meta.url), 'utf8'));
  sql(`set role service_role;
    select * from public.dm66_submit_letter('11111111-1111-4111-8111-111111111111', 'Bạn thử thứ nhất', 'Cảm ơn các cậu đã chuẩn bị món quà!', repeat('a',64));
    select * from public.dm66_submit_letter('22222222-2222-4222-8222-222222222222', '', 'Chúc cả lớp có thật nhiều kỷ niệm đẹp 💗', repeat('a',64));
    do $$ begin
      if not (select replayed from public.dm66_submit_letter('11111111-1111-4111-8111-111111111111', 'Bạn thử thứ nhất', 'Cảm ơn các cậu đã chuẩn bị món quà!', repeat('a',64))) then raise exception 'Retry not idempotent'; end if;
      if (select count(*) from public.dm66_letters) <> 2 then raise exception 'Duplicate letter'; end if;
    end $$;`);
  execFileSync('docker', ['restart', container], { stdio: 'pipe' });
  for (let attempt = 0; attempt < 60; attempt++) {
    try { execFileSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'pipe' }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  sql(`do $$ begin
    if (select count(*) from public.dm66_letters) <> 2 then raise exception 'Lost data after database restart'; end if;
    if (select sender_name from public.dm66_letters where submission_id='22222222-2222-4222-8222-222222222222') <> 'Một cô gái DM66D' then raise exception 'Anonymous name mismatch'; end if;
    begin
      perform public.dm66_submit_letter('11111111-1111-4111-8111-111111111111','Different name','Different content',repeat('a',64));
      raise exception 'ID conflict accepted';
    exception when invalid_parameter_value then
      if sqlerrm <> 'DM66_SUBMISSION_CONFLICT' then raise; end if;
    end;
    begin
      perform public.dm66_submit_letter(gen_random_uuid(),'Test','1234',repeat('a',64));
      raise exception 'Invalid short message accepted';
    exception when invalid_parameter_value then null; end;
    for i in 1..30 loop
      perform public.dm66_submit_letter(gen_random_uuid(),'Rate test','Synthetic rate limit test',repeat('b',64));
    end loop;
    begin
      perform public.dm66_submit_letter(gen_random_uuid(),'Rate test','Synthetic rate limit test',repeat('b',64));
      raise exception 'Rate limit failed';
    exception when raise_exception then
      if sqlerrm <> 'DM66_RATE_LIMIT' then raise; end if;
    end;
    if (select count(*) from public.dm66_letters) <> 32 then raise exception 'Rate-limited letter was persisted'; end if;
    for i in 1..10 loop
      if not public.dm66_check_login_limit(repeat('c',64)) then raise exception 'Login limit too early'; end if;
    end loop;
    if public.dm66_check_login_limit(repeat('c',64)) then raise exception 'Login limit missing'; end if;
  end $$;
  set role anon;
  do $$ begin
    begin perform count(*) from public.dm66_letters; raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
    begin perform public.dm66_submit_letter(gen_random_uuid(),'Test','Synthetic test',repeat('d',64)); raise exception 'Anonymous RPC allowed'; exception when insufficient_privilege then null; end;
  end $$;
  reset role;
  set role authenticated;
  do $$ begin
    begin perform count(*) from public.dm66_letters; raise exception 'Authenticated read allowed'; exception when insufficient_privilege then null; end;
    begin perform public.dm66_check_login_limit(repeat('d',64)); raise exception 'Authenticated RPC allowed'; exception when insufficient_privilege then null; end;
  end $$;`);
  const concurrentId = randomUUID();
  const concurrentSql = `set role service_role; select * from public.dm66_submit_letter('${concurrentId}', 'Concurrent test', 'Same letter sent concurrently', repeat('e',64));`;
  await Promise.all([1, 2, 3].map(() => execute('docker', ['exec', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', concurrentSql])));
  if (sql(`select count(*) from public.dm66_letters where submission_id='${concurrentId}'`).trim() !== '1') throw new Error('Concurrent duplicate persisted');
  console.log('PostgreSQL integration passed: migration, two saved letters, database restart durability, anonymous name, retries, concurrent idempotency, validation, persistent submit/login rate limits, and role permissions.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PostgreSQL verification failed');
  if (error && typeof error === 'object' && 'stderr' in error) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  try { execFileSync('docker', ['rm', '-f', container], { stdio: 'pipe' }); } catch { /* Already removed. */ }
}
