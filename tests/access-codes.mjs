import {PGlite} from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema league_private;create schema extensions;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('session_id',current_setting('test.sid',true))$$;
create function league_private.current_access() returns jsonb language sql as $$select jsonb_build_object('role',current_setting('test.role',true))$$;
-- Crypto stubs are for authorization/rotation tests only; production uses pgcrypto.
create function extensions.gen_random_bytes(n int) returns bytea language sql volatile as $$select decode(left(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),n*2),'hex')$$;
create function extensions.digest(value text,algorithm text) returns bytea language sql immutable as $$select decode(md5(value),'hex')$$;
create table league_private.access_codes(slot int primary key,team_name text,code_hash text unique,version int default 1,commissioner_user uuid,changed_at timestamptz default now());
create table league_private.session_access(session_id uuid primary key,user_id uuid,slot int,code_version int,granted_at timestamptz default now());
create table league_private.access_audit(actor uuid,action text,slot int);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
insert into league_private.access_codes(slot,code_hash) select n,'old-'||n from generate_series(0,12)n;
`);
const file=fs.readdirSync('supabase/migrations').find(p=>p.endsWith('ssl_short_permission_codes.sql'));
await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
const user='11111111-1111-4111-8111-111111111111', sid='22222222-2222-4222-8222-222222222222', other='33333333-3333-4333-8333-333333333333';
await db.query("select set_config('test.uid',$1,false),set_config('test.sid',$2,false),set_config('test.role','commissioner',false)",[user,sid]);
await db.query('insert into auth.sessions values($1,$2,null)',[sid,user]);
await db.query('update league_private.access_codes set commissioner_user=$1 where slot=0',[user]);
await db.query('insert into league_private.session_access values($1,$2,0,1,now()),($3,$2,0,1,now())',[sid,user,other]);
const short=async()=> (await db.query("select league_private.short_access_code('COMM') c")).rows[0].c;
assert.match(await short(),/^COMM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
const result=(await db.query('select public.regenerate_commissioner_code() r')).rows[0].r;
assert.match(result.code,/^COMM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
const c=(await db.query('select * from league_private.access_codes where slot=0')).rows[0];assert.equal(c.commissioner_user,user);assert.equal(c.version,2);
assert.equal((await db.query('select count(*) n from league_private.session_access where slot=0')).rows[0].n,1);assert.equal((await db.query('select code_version from league_private.session_access where session_id=$1',[sid])).rows[0].code_version,2);
assert.equal((await db.query('select count(*) n from league_private.access_codes where slot>0 and version=1')).rows[0].n,12);
const gm=(await db.query("select league_private.regenerate_code(12,'Team Twelve') r")).rows[0].r;assert.match(gm.code,/^GM-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
await db.query("select set_config('test.role','gm',false)");let denied=false;try{await db.query('select public.regenerate_commissioner_code()')}catch{denied=true}assert(denied);
await db.exec('set role anon');denied=false;try{await db.query('select public.regenerate_commissioner_code()')}catch{denied=true}assert(denied);
await db.close();console.log('PASS: short codes, commissioner ownership preserved, rotation/version revocation, current session retained, GM codes unchanged until regenerated, and unauthorized resets rejected.');
