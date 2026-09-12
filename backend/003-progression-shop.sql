-- Tumble Club progression v2: longer courses, single-award stars and cosmetic ownership.
-- Apply after 001-platform.sql and 002-status-snapshot.sql. No private credentials.
begin;
create table tumble_private.course_targets(id integer primary key check(id between 1 and 50), gold integer not null, silver integer not null, target integer not null, check(gold<silver and silver<target and target<=150));
insert into tumble_private.course_targets values
(1,52,63,72),
(2,54,69,80),
(3,54,65,73),
(4,49,61,70),
(5,48,58,66),
(6,48,63,74),
(7,60,71,79),
(8,54,64,72),
(9,57,77,93),
(10,57,74,87),
(11,48,59,67),
(12,45,60,72),
(13,49,60,68),
(14,56,75,90),
(15,55,66,74),
(16,54,68,79),
(17,44,63,77),
(18,49,59,67),
(19,47,58,66),
(20,49,63,73),
(21,53,64,73),
(22,52,63,72),
(23,60,70,78),
(24,47,57,65),
(25,47,62,74),
(26,60,74,84),
(27,49,60,69),
(28,58,70,79),
(29,55,65,73),
(30,48,60,69),
(31,62,72,80),
(32,51,65,75),
(33,49,60,68),
(34,51,61,69),
(35,56,67,76),
(36,54,72,86),
(37,61,72,80),
(38,55,65,73),
(39,46,56,64),
(40,48,58,66),
(41,50,68,81),
(42,63,74,83),
(43,55,65,73),
(44,54,69,80),
(45,72,82,90),
(46,47,57,65),
(47,48,59,68),
(48,50,71,87),
(49,56,70,81),
(50,51,62,71);
create table tumble_private.shop_items(id text primary key, slot text not null, value text not null, price integer not null check(price between 0 and 3));
insert into tumble_private.shop_items values
('body:bean','body','bean',0),
('body:round','body','round',0),
('body:tall','body','tall',0),
('body:robot','body','robot',3),
('body:pear','body','pear',2),
('body:diamond','body','diamond',2),
('body:astronaut','body','astronaut',3),
('body:pill','body','pill',2),
('body:marshmallow','body','marshmallow',2),
('body:starborn','body','starborn',3),
('head:none','head','none',0),
('head:cap','head','cap',0),
('head:crown','head','crown',0),
('head:mohawk','head','mohawk',0),
('head:beanie','head','beanie',2),
('head:top_hat','head','top_hat',2),
('head:wizard','head','wizard',3),
('head:pirate','head','pirate',2),
('head:viking','head','viking',2),
('head:bunny','head','bunny',3),
('head:cat','head','cat',2),
('head:antennae','head','antennae',2),
('head:halo','head','halo',3),
('head:flower','head','flower',2),
('head:chef','head','chef',2),
('head:headphones','head','headphones',3),
('head:afro','head','afro',2),
('head:ponytail','head','ponytail',2),
('head:spikes','head','spikes',3),
('head:propeller','head','propeller',2),
('eyes:visor','eyes','visor',0),
('eyes:glasses','eyes','glasses',0),
('eyes:shades','eyes','shades',0),
('eyes:round_specs','eyes','round_specs',3),
('eyes:star_specs','eyes','star_specs',2),
('eyes:heart_specs','eyes','heart_specs',2),
('eyes:monocle','eyes','monocle',3),
('eyes:goggles','eyes','goggles',2),
('eyes:vr','eyes','vr',2),
('eyes:cyclops','eyes','cyclops',3),
('eyes:ski','eyes','ski',2),
('eyes:aviator','eyes','aviator',2),
('eyes:mask','eyes','mask',3),
('eyes:eyepatch','eyes','eyepatch',2),
('eyes:hex_specs','eyes','hex_specs',2),
('eyes:neon_band','eyes','neon_band',3),
('back:none','back','none',0),
('back:jetpack','back','jetpack',2),
('back:angel','back','angel',2),
('back:bat','back','bat',3),
('back:rocket','back','rocket',2),
('back:satchel','back','satchel',2),
('back:cape','back','cape',3),
('back:turtle','back','turtle',2),
('back:crystal','back','crystal',2),
('back:boombox','back','boombox',3),
('back:life_ring','back','life_ring',2),
('back:planet','back','planet',2);
create table tumble_private.shop_bundles(id text primary key, items text[] not null);
insert into tumble_private.shop_bundles values
('space-cadet',array['body:astronaut','head:antennae','eyes:vr','back:jetpack']::text[]),
('moon-mage',array['body:pear','head:wizard','eyes:star_specs','back:crystal']::text[]),
('sky-bunny',array['body:marshmallow','head:bunny','eyes:heart_specs','back:angel']::text[]);
create table tumble_private.course_best(user_id uuid references auth.users(id) on delete cascade, course_id integer references tumble_private.course_targets(id), seconds double precision not null check(seconds>0 and seconds<=150), primary key(user_id,course_id));
create table tumble_private.wallets(user_id uuid primary key references auth.users(id) on delete cascade, spent integer not null default 0 check(spent>=0));
create table tumble_private.owned_items(user_id uuid references auth.users(id) on delete cascade, item_id text references tumble_private.shop_items(id), primary key(user_id,item_id));
alter table tumble_private.course_best enable row level security;
alter table tumble_private.course_targets enable row level security;
alter table tumble_private.shop_items enable row level security;
alter table tumble_private.shop_bundles enable row level security;
alter table tumble_private.wallets enable row level security;
alter table tumble_private.owned_items enable row level security;
revoke all on all tables in schema tumble_private from public,anon,authenticated;

create function tumble_private.earned_stars(p_user uuid) returns integer language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when b.seconds<=t.gold then 3 when b.seconds<=t.silver then 2 else 1 end),0)::integer from tumble_private.course_best b join tumble_private.course_targets t on t.id=b.course_id where b.user_id=p_user;
$$;
create function tumble_private.progress_snapshot(p_user uuid) returns jsonb language sql volatile security definer set search_path='' as $$
 select jsonb_build_object('version',2,
  'best',coalesce((select jsonb_object_agg(course_id::text,seconds) from tumble_private.course_best where user_id=p_user),'{}'::jsonb),
  'owned',coalesce((select jsonb_agg(i.id order by i.id) from tumble_private.shop_items i where i.price=0 or exists(select 1 from tumble_private.owned_items o where o.user_id=p_user and o.item_id=i.id)),'[]'::jsonb),
  'spent',coalesce((select spent from tumble_private.wallets where user_id=p_user),0));
$$;
create function public.tc_progress() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=tumble_private.require_user();
begin return tumble_private.progress_snapshot(v_user); end $$;
create function public.tc_course_finish(p_course integer,p_time double precision) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=tumble_private.require_user();
begin
 if p_course is null or p_course not between 1 and 50 or p_time is null or not(p_time>0 and p_time<=150) then raise exception 'Invalid course result' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,773));
 if (select count(*) from tumble_private.course_best where user_id=v_user and course_id<p_course)<>p_course-1 then raise exception 'Finish the earlier courses first' using errcode='22023'; end if;
 insert into tumble_private.course_best(user_id,course_id,seconds) values(v_user,p_course,p_time)
 on conflict(user_id,course_id) do update set seconds=least(tumble_private.course_best.seconds,excluded.seconds);
 return tumble_private.progress_snapshot(v_user);
end $$;
create function public.tc_shop_buy(p_item text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=tumble_private.require_user(); v_items text[]; v_cost integer; v_spent integer;
begin
 select items into v_items from tumble_private.shop_bundles where id=p_item;
 if v_items is null then
  if not exists(select 1 from tumble_private.shop_items where id=p_item) then raise exception 'Item unavailable' using errcode='22023'; end if;
  v_items:=array[p_item];
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,773));
 insert into tumble_private.wallets(user_id) values(v_user) on conflict do nothing;
 select spent into v_spent from tumble_private.wallets where user_id=v_user for update;
 select coalesce(sum(i.price),0) into v_cost from tumble_private.shop_items i where i.id=any(v_items) and not exists(select 1 from tumble_private.owned_items o where o.user_id=v_user and o.item_id=i.id);
 if v_cost>tumble_private.earned_stars(v_user)-v_spent then raise exception 'Earn more course stars to unlock this item' using errcode='22023'; end if;
 insert into tumble_private.owned_items(user_id,item_id) select v_user,unnest(v_items) on conflict do nothing;
 update tumble_private.wallets set spent=spent+v_cost where user_id=v_user;
 return tumble_private.progress_snapshot(v_user);
end $$;
create or replace function tumble_private.valid_cosmetics(v jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare k text; val jsonb;
begin
 if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>512 then return false; end if;
 for k,val in select key,value from jsonb_each(v) loop
  if jsonb_typeof(val)<>'string' then return false; end if;
  if k='color' and lower(val#>>'{}')=any(array['#ff8755','#b28aff','#37e4cf','#ffe16b','#ff64be','#61c5ff']::text[]) then continue; end if;
  if exists(select 1 from tumble_private.shop_items where slot=k and value=val#>>'{}') then continue; end if;
  return false;
 end loop;
 return true;
exception when others then return false;
end $$;
create or replace function public.tc_profile_save(p_username text,p_cosmetics jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=tumble_private.require_user(); v_row public.tc_profiles;
begin
 if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,24}$' or not tumble_private.valid_cosmetics(p_cosmetics) then raise exception 'Invalid username or cosmetics' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each_text(p_cosmetics) e join tumble_private.shop_items i on i.slot=e.key and i.value=e.value where i.price>0 and not exists(select 1 from tumble_private.owned_items o where o.user_id=v_user and o.item_id=i.id)) then raise exception 'Unlock this outfit in your account star shop first' using errcode='42501'; end if;
 insert into public.tc_profiles(user_id,username,cosmetics) values(v_user,p_username,p_cosmetics) on conflict(user_id) do update set username=excluded.username,cosmetics=excluded.cosmetics,updated_at=now() returning * into v_row;
 return to_jsonb(v_row);
end $$;
revoke all on function tumble_private.earned_stars(uuid),tumble_private.progress_snapshot(uuid),tumble_private.valid_cosmetics(jsonb) from public,anon,authenticated;
revoke all on function public.tc_progress(),public.tc_course_finish(integer,double precision),public.tc_shop_buy(text) from public,anon,authenticated;
grant execute on function public.tc_progress(),public.tc_course_finish(integer,double precision),public.tc_shop_buy(text) to authenticated;
notify pgrst,'reload schema';
commit;
