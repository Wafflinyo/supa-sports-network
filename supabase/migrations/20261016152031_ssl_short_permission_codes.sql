-- Short, random permission codes. Existing hashes and GM sessions remain valid until rotated.
create function league_private.short_access_code(prefix text) returns text language plpgsql volatile security invoker set search_path='' as $$
declare alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';raw bytea;body text;fresh text;i integer;begin
 if prefix not in ('GM','COMM') then raise exception 'Unknown code type';end if;
 loop
  raw:=extensions.gen_random_bytes(8);body:='';
  for i in 0..7 loop body:=body||substr(alphabet,get_byte(raw,i)%32+1,1);end loop;
  fresh:=prefix||'-'||left(body,4)||'-'||right(body,4);
  if not exists(select 1 from league_private.access_codes where code_hash=encode(extensions.digest(fresh,'sha256'),'hex')) then return fresh;end if;
 end loop;
end$$;
revoke all on function league_private.short_access_code(text) from public,anon,authenticated;
create or replace function league_private.regenerate_code(target_slot integer,team_label text) returns jsonb language plpgsql security definer set search_path='' as $$
declare fresh text;begin
 if auth.uid() is null or league_private.current_access()->>'role' is distinct from 'commissioner' then raise exception 'Commissioner access required';end if;
 if target_slot is null or target_slot not between 1 and 12 then raise exception 'Choose a GM slot from 1 to 12';end if;
 if char_length(trim(coalesce(team_label,''))) not between 2 and 80 then raise exception 'Enter a team name or temporary slot label';end if;
 perform 1 from league_private.access_codes where slot=target_slot for update;if not found then raise exception 'Unknown GM slot';end if;
 fresh:=league_private.short_access_code('GM');
 update league_private.access_codes set team_name=trim(team_label),code_hash=encode(extensions.digest(fresh,'sha256'),'hex'),version=version+1,changed_at=now() where slot=target_slot;
 delete from league_private.session_access where slot=target_slot;
 insert into league_private.access_audit(actor,action,slot) values(auth.uid(),'regenerate_gm_code',target_slot);
 return jsonb_build_object('slot',target_slot,'team',trim(team_label),'code',fresh);
end$$;
create function league_private.regenerate_commissioner_code() returns jsonb language plpgsql security definer set search_path='' as $$
declare fresh text;v integer;sid uuid;begin
 if auth.uid() is null or league_private.current_access()->>'role' is distinct from 'commissioner' then raise exception 'Commissioner access required';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 perform 1 from auth.sessions where id=sid and user_id=auth.uid() and (not_after is null or not_after>now());if not found then raise exception 'Sign in again';end if;
 perform 1 from league_private.access_codes where slot=0 for update;
 fresh:=league_private.short_access_code('COMM');
 update league_private.access_codes set code_hash=encode(extensions.digest(fresh,'sha256'),'hex'),version=version+1,changed_at=now() where slot=0 returning version into v;
 if v is null then raise exception 'Commissioner code is not configured';end if;
 delete from league_private.session_access where slot=0;
 insert into league_private.session_access(session_id,user_id,slot,code_version) values(sid,auth.uid(),0,v);
 insert into league_private.access_audit(actor,action,slot) values(auth.uid(),'regenerate_commissioner_code',0);
 return jsonb_build_object('slot',0,'team','Commissioner','code',fresh);
end$$;
revoke all on function league_private.regenerate_commissioner_code() from public,anon,authenticated;
grant execute on function league_private.regenerate_commissioner_code() to authenticated;
create function public.regenerate_commissioner_code() returns jsonb language sql security invoker set search_path='' as $$select league_private.regenerate_commissioner_code()$$;
revoke all on function public.regenerate_commissioner_code() from public,anon,authenticated;
grant execute on function public.regenerate_commissioner_code() to authenticated;
