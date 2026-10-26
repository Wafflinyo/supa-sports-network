-- Acknowledgements are per authenticated GM, not per browser or franchise.
-- The badge's actual earned state continues to be computed from official
-- released league data: this table NEVER grants an achievement.
create table if not exists public.ssl_gm_achievement_notices (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null check (char_length(badge_id) between 1 and 100),
  acknowledged_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.ssl_gm_achievement_notices enable row level security;

create policy "GM achievement acknowledgements visible to their owner"
on public.ssl_gm_achievement_notices for select to authenticated
using ((select auth.uid()) = user_id);

create policy "GM achievement acknowledgements inserted by their owner"
on public.ssl_gm_achievement_notices for insert to authenticated
with check ((select auth.uid()) = user_id);

grant select, insert on public.ssl_gm_achievement_notices to authenticated;
revoke all on public.ssl_gm_achievement_notices from anon;
