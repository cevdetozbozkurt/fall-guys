-- Tumble Club: proposed Supabase migration, 2026-09-10.
-- Review and apply as the database owner. This is NOT a live deployment.
-- No pgcrypto dependency: PostgreSQL core gen_random_uuid() supplies randomness.
-- Supabase owns auth.users/auth.uid(); never deploy the test harness auth stubs.
-- Only public is exposed through PostgREST. Do not expose tumble_private.
-- All client writes go through bounded RPCs; RLS additionally protects reads.
begin;
create schema if not exists tumble_private;
revoke all on schema tumble_private from public, anon, authenticated;

create function tumble_private.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := auth.uid();
begin
  if v_id is null or not exists (
    select 1 from auth.users u where u.id = v_id
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false)
  ) then raise exception 'A verified account is required' using errcode = '42501'; end if;
  return v_id;
end $$;

create function tumble_private.valid_recipe(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare s jsonb;
begin
  if v is null or jsonb_typeof(v) <> 'object' or octet_length(v::text) > 8192
    or (select count(*) from jsonb_object_keys(v)) <> 3
    or v->'version' <> '1'::jsonb or not (v ?& array['version','name','segments'])
    or jsonb_typeof(v->'name') <> 'string'
    or length(v->>'name') not between 1 and 36
    or btrim(v->>'name') <> v->>'name' or v->>'name' ~ '[<>[:cntrl:]]'
    or jsonb_typeof(v->'segments') <> 'array'
  then return false; end if;
  if jsonb_array_length(v->'segments') not between 3 and 10 then return false; end if;
  for s in select value from jsonb_array_elements(v->'segments') loop
    if jsonb_typeof(s) <> 'object' or not (s ?& array['type','difficulty'])
      or (select count(*) from jsonb_object_keys(s)) <> 2
      or jsonb_typeof(s->'type') <> 'string'
      or s->>'type' not in ('open','spin','climb','jump','hammer','falling','slide','drop','belt','crumble','left','right','fork','slalom')
      or s->'difficulty' not in ('1'::jsonb,'2'::jsonb,'3'::jsonb)
    then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

-- Root must align these bounded cosmetic enums with the client before integration.
create function tumble_private.valid_cosmetics(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; val jsonb;
begin
  if v is null or jsonb_typeof(v) <> 'object' or octet_length(v::text) > 512 then return false; end if;
  for k, val in select key,value from jsonb_each(v) loop
    if jsonb_typeof(val) <> 'string' then return false; end if;
    if k = 'color' and lower(val #>> '{}') in ('#ff8755','#b28aff','#37e4cf','#ffe16b','#ff64be','#61c5ff') then continue; end if;
    if k = 'body' and val #>> '{}' in ('bean','round','tall') then continue; end if;
    if k = 'head' and val #>> '{}' in ('none','cap','crown','mohawk') then continue; end if;
    if k = 'eyes' and val #>> '{}' in ('visor','glasses','shades') then continue; end if;
    return false;
  end loop;
  return true;
exception when others then return false;
end $$;

create table public.tc_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  cosmetics jsonb not null default '{}' check (tumble_private.valid_cosmetics(cosmetics)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index tc_username_unique on public.tc_profiles(lower(username));
alter table public.tc_profiles enable row level security;
create policy tc_profile_self on public.tc_profiles for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.tc_profiles from public, anon, authenticated;
grant select on public.tc_profiles to authenticated;

create table tumble_private.roles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('owner','designer')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
create unique index tc_only_one_owner on tumble_private.roles((true)) where role = 'owner';
alter table tumble_private.roles enable row level security;
create table tumble_private.audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  subject_id uuid,
  created_at timestamptz not null default now()
);
alter table tumble_private.audit enable row level security;

create function tumble_private.is_designer(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from tumble_private.roles where user_id = p_user and role in ('owner','designer'));
$$;
create function tumble_private.require_owner() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid := tumble_private.require_user();
begin
  if not exists (select 1 from tumble_private.roles where user_id=v_id and role='owner')
    then raise exception 'Owner permission required' using errcode='42501'; end if;
  return v_id;
end $$;

create table public.tc_saved_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipe jsonb not null check (tumble_private.valid_recipe(recipe)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tc_saved_by_owner on public.tc_saved_recipes(owner_id, updated_at desc);
alter table public.tc_saved_recipes enable row level security;
create policy tc_saved_self on public.tc_saved_recipes for select to authenticated using (owner_id=(select auth.uid()));
revoke all on public.tc_saved_recipes from public, anon, authenticated;
grant select on public.tc_saved_recipes to authenticated;

create table public.tc_published_levels (
  id uuid primary key default gen_random_uuid(),
  recipe jsonb not null check (tumble_private.valid_recipe(recipe)),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  revision integer not null default 1 check (revision>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz
);
create index tc_published_active on public.tc_published_levels(updated_at desc) where retired_at is null;
alter table public.tc_published_levels enable row level security;
create policy tc_catalog_read on public.tc_published_levels for select to anon, authenticated using (retired_at is null);
revoke all on public.tc_published_levels from public, anon, authenticated;
grant select on public.tc_published_levels to anon, authenticated;

create function public.tc_profile_save(p_username text, p_cosmetics jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user(); v_row public.tc_profiles;
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,24}$' or not tumble_private.valid_cosmetics(p_cosmetics)
    then raise exception 'Invalid username or cosmetics' using errcode='22023'; end if;
  insert into public.tc_profiles(user_id,username,cosmetics) values(v_id,p_username,p_cosmetics)
    on conflict(user_id) do update set username=excluded.username,cosmetics=excluded.cosmetics,updated_at=now()
    returning * into v_row;
  return to_jsonb(v_row);
end $$;
create function public.tc_account() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user();
begin
  return jsonb_build_object('user_id',v_id,
    'profile',(select to_jsonb(p) from public.tc_profiles p where p.user_id=v_id),
    'role',coalesce((select role from tumble_private.roles where user_id=v_id),'player'));
end $$;

create function public.tc_recipe_save(p_recipe jsonb, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user(); v_row public.tc_saved_recipes;
begin
  if not tumble_private.valid_recipe(p_recipe) then raise exception 'Invalid course recipe' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id::text,719));
  if p_id is null then
    if (select count(*) from public.tc_saved_recipes where owner_id=v_id)>=16
      then raise exception 'Saved course limit reached' using errcode='22023'; end if;
    insert into public.tc_saved_recipes(owner_id,recipe) values(v_id,p_recipe) returning * into v_row;
  else
    update public.tc_saved_recipes set recipe=p_recipe,updated_at=now() where id=p_id and owner_id=v_id returning * into v_row;
    if not found then raise exception 'Saved course unavailable' using errcode='42501'; end if;
  end if;
  return to_jsonb(v_row);
end $$;
create function public.tc_recipe_delete(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user();
begin delete from public.tc_saved_recipes where id=p_id and owner_id=v_id; end $$;

create function public.tc_level_publish(p_recipe jsonb, p_id uuid default null, p_expected_revision integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user(); v_row public.tc_published_levels;
begin
  if not tumble_private.is_designer(v_id) then raise exception 'Designer permission required' using errcode='42501'; end if;
  if not tumble_private.valid_recipe(p_recipe) then raise exception 'Invalid course recipe' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(78291340);
  if p_id is null then
    if (select count(*) from public.tc_published_levels where retired_at is null)>=1000
      then raise exception 'Catalog limit reached; retire a course first' using errcode='22023'; end if;
    insert into public.tc_published_levels(recipe,created_by,updated_by) values(p_recipe,v_id,v_id) returning * into v_row;
  else
    update public.tc_published_levels set recipe=p_recipe,updated_by=v_id,updated_at=now(),revision=revision+1
      where id=p_id and revision=p_expected_revision and retired_at is null returning * into v_row;
    if not found then raise exception 'Course changed or retired; refresh the catalog' using errcode='40001'; end if;
  end if;
  insert into tumble_private.audit(actor_id,action,subject_id) values(v_id,'level.publish',v_row.id);
  return to_jsonb(v_row);
end $$;
create function public.tc_level_retire(p_id uuid, p_expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user();
begin
  if not tumble_private.is_designer(v_id) then raise exception 'Designer permission required' using errcode='42501'; end if;
  update public.tc_published_levels set retired_at=now(),updated_at=now(),updated_by=v_id,revision=revision+1
    where id=p_id and revision=p_expected_revision and retired_at is null;
  if not found then raise exception 'Course changed or retired; refresh the catalog' using errcode='40001'; end if;
  insert into tumble_private.audit(actor_id,action,subject_id) values(v_id,'level.retire',p_id);
end $$;
create function public.tc_staff_catalog() returns setof public.tc_published_levels
language plpgsql stable security definer set search_path='' as $$
begin
  if not tumble_private.is_designer(tumble_private.require_user()) then raise exception 'Designer permission required' using errcode='42501'; end if;
  return query select * from public.tc_published_levels order by updated_at desc limit 1000;
end $$;

-- Owner-only exact email match OR literal case-insensitive username prefix.
-- This is the only app API exposing account email addresses.
create function public.tc_staff_search(p_query text) returns table(user_id uuid,username text,email text,role text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform tumble_private.require_owner();
  if p_query is null or length(btrim(p_query)) not between 3 and 128 then raise exception 'Search needs 3 to 128 characters' using errcode='22023'; end if;
  return query select u.id,p.username,u.email::text,coalesce(r.role,'player')
    from auth.users u left join public.tc_profiles p on p.user_id=u.id
    left join tumble_private.roles r on r.user_id=u.id
    where u.email_confirmed_at is not null and (lower(u.email)=lower(btrim(p_query))
      or left(lower(p.username),length(btrim(p_query)))=lower(btrim(p_query)))
    order by p.username nulls last limit 20;
end $$;
create function public.tc_staff_set_designer(p_user_id uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_owner uuid := tumble_private.require_owner();
begin
  if p_user_id is null or p_enabled is null then raise exception 'User and permission are required' using errcode='22023'; end if;
  if p_user_id=v_owner then raise exception 'The owner role cannot be changed by this operation' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null)
    then raise exception 'Verified user unavailable' using errcode='22023'; end if;
  if p_enabled then
    insert into tumble_private.roles(user_id,role,granted_by) values(p_user_id,'designer',v_owner)
      on conflict(user_id) do update set role='designer',granted_by=v_owner,granted_at=now()
      where tumble_private.roles.role<>'owner';
  else delete from tumble_private.roles where user_id=p_user_id and role='designer'; end if;
  insert into tumble_private.audit(actor_id,action,subject_id)
    values(v_owner,case when p_enabled then 'designer.grant' else 'designer.revoke' end,p_user_id);
end $$;

create table tumble_private.queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  peer_id text not null check(peer_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index tc_queue_order on tumble_private.queue(joined_at,user_id);
alter table tumble_private.queue enable row level security;
create table tumble_private.matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique default upper(left(replace(gen_random_uuid()::text,'-',''),12)),
  host_id uuid not null references auth.users(id) on delete cascade,
  host_peer_id text not null,
  phase text not null default 'connecting' check(phase in ('connecting','playing','closed')),
  created_at timestamptz not null default now(),
  host_seen timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text
);
create index tc_live_matches on tumble_private.matches(host_seen) where phase<>'closed';
alter table tumble_private.matches enable row level security;
create table tumble_private.match_members (
  match_id uuid not null references tumble_private.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check(slot between 0 and 4),
  peer_id text not null,
  join_ticket uuid not null default gen_random_uuid(),
  active boolean not null default true,
  accepted_at timestamptz,
  last_seen timestamptz not null default now(),
  primary key(match_id,user_id),
  unique(match_id,slot)
);
create unique index tc_one_active_match on tumble_private.match_members(user_id) where active;
alter table tumble_private.match_members enable row level security;

-- Every queue/match mutator takes the same transaction lock before touching state.
-- This serializes groups-of-five allocation, cancellation, and recovery.
create function tumble_private.close_match(p_id uuid,p_reason text,p_requeue boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_host uuid;
begin
  update tumble_private.matches set phase='closed',closed_at=now(),close_reason=p_reason
    where id=p_id and phase<>'closed' returning host_id into v_host;
  if not found then return; end if;
  if p_requeue then
    insert into tumble_private.queue(user_id,peer_id,joined_at,last_seen)
      select user_id,peer_id,now(),last_seen from tumble_private.match_members
      where match_id=p_id and active and user_id<>v_host and last_seen>now()-interval '30 seconds'
      on conflict(user_id) do nothing;
  end if;
  update tumble_private.match_members set active=false,join_ticket=gen_random_uuid() where match_id=p_id;
end $$;
create function tumble_private.recover_matches() returns void
language plpgsql security definer set search_path='' as $$
declare v_stale record;
begin
  -- Called only while the caller holds the global matchmaking transaction lock.
  for v_stale in select id from tumble_private.matches where phase<>'closed' and
    (host_seen<now()-interval '30 seconds' or (phase='connecting' and created_at<now()-interval '45 seconds')) loop
    perform tumble_private.close_match(v_stale.id,'host_unavailable',true);
  end loop;
  update tumble_private.match_members mm set active=false,join_ticket=gen_random_uuid()
    from tumble_private.matches m where mm.match_id=m.id and m.phase='playing' and mm.user_id<>m.host_id
      and mm.active and mm.last_seen<now()-interval '30 seconds';
  delete from tumble_private.queue where last_seen<now()-interval '20 seconds';
  delete from tumble_private.matches where phase='closed' and closed_at<now()-interval '1 day';
end $$;

create function tumble_private.status(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_m tumble_private.matches; v_me tumble_private.match_members;
begin
  select * into v_me from tumble_private.match_members where user_id=p_user and active;
  if found then
    select * into v_m from tumble_private.matches where id=v_me.match_id;
    return jsonb_build_object('state','matched','match_id',v_m.id,'room_code',v_m.room_code,
      'host_id',v_m.host_id,'host_peer_id',v_m.host_peer_id,'phase',v_m.phase,
      'user_id',p_user,'slot',v_me.slot,'join_ticket',v_me.join_ticket,
      'expires_at',v_m.host_seen+interval '30 seconds',
      'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',mm.user_id,'slot',mm.slot,
        'username',p.username,'cosmetics',p.cosmetics,'accepted',mm.accepted_at is not null) order by mm.slot)
        from tumble_private.match_members mm join public.tc_profiles p on p.user_id=mm.user_id
        where mm.match_id=v_m.id and mm.active),'[]'::jsonb));
  end if;
  if exists(select 1 from tumble_private.queue where user_id=p_user) then
    return jsonb_build_object('state','searching','players',least(5,(select count(*) from tumble_private.queue)),
      'target',5,'retry_ms',3000);
  end if;
  return jsonb_build_object('state','idle','target',5);
end $$;

create function public.tc_queue_tick(p_peer_id text,p_join boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user(); v_match uuid; v_host uuid; v_peer text;
  v_group uuid[]; v_member record; v_slot smallint := 0;
begin
  if p_peer_id is null or p_peer_id !~ '^[A-Za-z0-9_-]{1,100}$' or p_join is null
    then raise exception 'Invalid network identity' using errcode='22023'; end if;
  if not exists(select 1 from public.tc_profiles where user_id=v_id)
    then raise exception 'Choose a username before matchmaking' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(78291341);
  perform tumble_private.recover_matches();
  select match_id into v_match from tumble_private.match_members where user_id=v_id and active;
  if found then
    -- A tab cannot take over another tab's active network session by changing peer_id.
    if not exists(select 1 from tumble_private.match_members where user_id=v_id and active and peer_id=p_peer_id)
      then raise exception 'This account already has an active game' using errcode='22023'; end if;
    update tumble_private.match_members set last_seen=now() where match_id=v_match and user_id=v_id;
    update tumble_private.matches set host_seen=now() where id=v_match and host_id=v_id;
    return tumble_private.status(v_id);
  end if;
  if p_join then
    insert into tumble_private.queue(user_id,peer_id) values(v_id,p_peer_id)
      on conflict(user_id) do update set peer_id=excluded.peer_id,last_seen=now();
  else update tumble_private.queue set last_seen=now() where user_id=v_id and peer_id=p_peer_id; end if;
  -- A heartbeat from an unqueued account must not create a queue entry.
  select array_agg(user_id order by joined_at,user_id) into v_group from (
    select user_id,joined_at from tumble_private.queue order by joined_at,user_id limit 5
  ) chosen;
  if cardinality(v_group)=5 then
    v_host := v_group[1];
    select peer_id into v_peer from tumble_private.queue where user_id=v_host;
    insert into tumble_private.matches(host_id,host_peer_id) values(v_host,v_peer) returning id into v_match;
    for v_member in select user_id,peer_id from tumble_private.queue where user_id=any(v_group)
      order by joined_at,user_id loop
      insert into tumble_private.match_members(match_id,user_id,slot,peer_id,accepted_at)
        values(v_match,v_member.user_id,v_slot,v_member.peer_id,case when v_slot=0 then now() else null end);
      v_slot:=v_slot+1;
    end loop;
    delete from tumble_private.queue where user_id=any(v_group);
  end if;
  return tumble_private.status(v_id);
end $$;

-- Cancel only cancels searching. If allocation won the race, return matched and
-- let the UI call tc_match_leave explicitly; never silently strand the other four.
create function public.tc_queue_cancel() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user();
begin
  perform pg_advisory_xact_lock(78291341);
  perform tumble_private.recover_matches();
  delete from tumble_private.queue where user_id=v_id;
  return tumble_private.status(v_id);
end $$;

-- Only the authenticated assigned host may validate tickets. The ticket is
-- never returned for another player. Bind it to the actual PeerJS connection ID.
create function public.tc_match_validate_join(p_match_id uuid,p_user_id uuid,p_ticket uuid,p_peer_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user(); v_slot smallint; v_phase text;
begin
  perform pg_advisory_xact_lock(78291341);
  perform tumble_private.recover_matches();
  select phase into v_phase from tumble_private.matches where id=p_match_id and host_id=v_id and phase<>'closed';
  if not found then raise exception 'Active match host permission required' using errcode='42501'; end if;
  update tumble_private.match_members set accepted_at=coalesce(accepted_at,now())
    where match_id=p_match_id and user_id=p_user_id and active and join_ticket=p_ticket and peer_id=p_peer_id
      and last_seen>now()-interval '30 seconds' and (v_phase='connecting' or accepted_at is not null)
    returning slot into v_slot;
  if not found then return jsonb_build_object('accepted',false); end if;
  return jsonb_build_object('accepted',true,'user_id',p_user_id,'slot',v_slot);
end $$;

-- Initial five-player admission only. Repeated courses remain within this match
-- and do not call start again. Guest departure never closes a playing room.
create function public.tc_match_start(p_match_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user(); v_phase text;
begin
  perform pg_advisory_xact_lock(78291341);
  perform tumble_private.recover_matches();
  select phase into v_phase from tumble_private.matches where id=p_match_id and host_id=v_id and phase<>'closed';
  if not found then raise exception 'Active match host permission required' using errcode='42501'; end if;
  if v_phase='connecting' then
    if (select count(*) from tumble_private.match_members where match_id=p_match_id and active
      and accepted_at is not null and last_seen>now()-interval '30 seconds')<>5
      then raise exception 'Waiting for all five players' using errcode='22023'; end if;
    update tumble_private.matches set phase='playing',host_seen=now() where id=p_match_id;
  end if;
  return tumble_private.status(v_id);
end $$;

create function public.tc_match_leave(p_match_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid := tumble_private.require_user(); v_host uuid; v_phase text;
begin
  perform pg_advisory_xact_lock(78291341);
  perform tumble_private.recover_matches();
  if not exists(select 1 from tumble_private.match_members where match_id=p_match_id and user_id=v_id and active)
    then return tumble_private.status(v_id); end if;
  select host_id,phase into v_host,v_phase from tumble_private.matches where id=p_match_id;
  if v_host=v_id then
    perform tumble_private.close_match(p_match_id,'host_left',true);
  elsif v_phase='connecting' then
    -- A group that loses a member before starting cannot remain stuck at 4/5.
    update tumble_private.match_members set active=false,join_ticket=gen_random_uuid() where match_id=p_match_id and user_id=v_id;
    perform tumble_private.close_match(p_match_id,'admission_cancelled',true);
    -- Unlike host failure, a live original host should also return to searching.
    insert into tumble_private.queue(user_id,peer_id)
      select mm.user_id,mm.peer_id from tumble_private.match_members mm where mm.match_id=p_match_id
        and mm.user_id=v_host and mm.last_seen>now()-interval '30 seconds'
      on conflict(user_id) do nothing;
  else
    update tumble_private.match_members set active=false,join_ticket=gen_random_uuid() where match_id=p_match_id and user_id=v_id;
  end if;
  return tumble_private.status(v_id);
end $$;

-- Default function EXECUTE privileges are unsafe for definer functions.
-- Restrict only this migration's prefixed functions, preserving other app APIs.
revoke all on all tables in schema tumble_private from public, anon, authenticated;
revoke all on all sequences in schema tumble_private from public, anon, authenticated;
revoke all on all functions in schema tumble_private from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'tc\_%' escape '\'
  loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
commit;

-- OWNER BOOTSTRAP: execute separately as the database owner AFTER the intended
-- admin signs in and confirms email. Substitute a VERIFIED UUID, never an email
-- supplied by an untrusted browser. Exactly one owner is enforced by the index.
-- insert into tumble_private.roles(user_id,role)
-- select id,'owner' from auth.users where id='<verified-admin-uuid>'::uuid
--   and email_confirmed_at is not null and not coalesce(is_anonymous,false);
-- Confirm one inserted row. There is intentionally no public bootstrap RPC.
