-- Main course releases and editable obstacle layouts. Apply after 001–003.
begin;
create or replace function tumble_private.valid_recipe(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare s jsonb; o jsonb;
begin
 if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>32768
 or (select count(*) from jsonb_object_keys(v))<>3 or v->'version'<>'1'::jsonb
 or not(v ?& array['version','name','segments']) or jsonb_typeof(v->'name')<>'string'
 or length(v->>'name') not between 1 and 36 or btrim(v->>'name')<>v->>'name'
 or v->>'name' ~ '[<>[:cntrl:]]' or jsonb_typeof(v->'segments')<>'array' then return false; end if;
 if jsonb_array_length(v->'segments') not between 3 and 10 then return false; end if;
 for s in select value from jsonb_array_elements(v->'segments') loop
  if jsonb_typeof(s)<>'object' or not(s ?& array['type','difficulty']) or (s - array['type','difficulty','obstacles'])<>'{}'::jsonb
  or jsonb_typeof(s->'type')<>'string' or s->>'type' not in ('open','spin','climb','jump','hammer','falling','slide','drop','belt','crumble','left','right','fork','slalom')
  or s->'difficulty' not in ('1'::jsonb,'2'::jsonb,'3'::jsonb) then return false; end if;
  if s ? 'obstacles' then
   if jsonb_typeof(s->'obstacles')<>'array' or jsonb_array_length(s->'obstacles')>16 then return false; end if;
   for o in select value from jsonb_array_elements(s->'obstacles') loop
    if jsonb_typeof(o)<>'object' or not(o ?& array['type','lane','at','offset']) or (select count(*) from jsonb_object_keys(o))<>4
    or jsonb_typeof(o->'type')<>'string' or jsonb_typeof(o->'lane')<>'string' or o->>'type' not in ('bar','hurdle','hammer','falling','bumper','pendulum','pusher')
    or not(case when s->>'type'='fork' then o->>'lane' in ('risk','cruise') else o->>'lane'='main' end)
    or jsonb_typeof(o->'at')<>'number' or (o->>'at')::numeric not between 5 and 95
    or jsonb_typeof(o->'offset')<>'number' or (o->>'offset')::numeric not between -1 and 1 then return false; end if;
   end loop;
  end if;
 end loop;
 return true;
exception when others then return false;
end $$;

create function tumble_private.valid_sentence(v text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(length(btrim(v)) between 12 and 1200 and btrim(v) ~ '[.!?…]["''”’)]?$' and v ~ '[[:alpha:]]+([^[:alpha:]]+[[:alpha:]]+){2}',false);
$$;
alter table public.tc_published_levels add column course_number integer unique check(course_number between 51 and 10000);
alter table public.tc_published_levels add column release_version text not null default 'v0.0.0';
alter table public.tc_published_levels add column description text not null default '';
alter table public.tc_published_levels add column source_id uuid references public.tc_saved_recipes(id) on delete set null;
with numbered as (select id,50+row_number() over(order by created_at,id) as n from public.tc_published_levels where retired_at is null)
update public.tc_published_levels p set course_number=n.n from numbered n where n.id=p.id;
update public.tc_published_levels p set source_id=(select s.id from public.tc_saved_recipes s where s.owner_id=p.created_by and s.recipe=p.recipe order by s.updated_at desc limit 1);
-- Reconnect a uniquely named saved draft to legacy publications even if its layout was edited.
update public.tc_published_levels p set source_id=(select s.id from public.tc_saved_recipes s where s.owner_id=p.created_by and s.recipe->>'name'=p.recipe->>'name' limit 1)
where p.source_id is null and p.retired_at is null and (select count(*) from public.tc_saved_recipes s where s.owner_id=p.created_by and s.recipe->>'name'=p.recipe->>'name')=1;
create unique index tc_published_source on public.tc_published_levels(source_id) where retired_at is null and source_id is not null;

create table tumble_private.course_releases (
 number integer primary key check(number>0), request_id uuid not null unique, actor_id uuid references auth.users(id) on delete set null,
 comment text not null check(tumble_private.valid_sentence(comment)), entries jsonb not null, response jsonb not null,
 created_at timestamptz not null default now()
);
alter table tumble_private.course_releases enable row level security;
revoke all on tumble_private.course_releases from public,anon,authenticated;
alter table tumble_private.course_targets drop constraint course_targets_id_check;
alter table tumble_private.course_targets add constraint course_targets_id_check check(id between 1 and 10000);
create function tumble_private.recipe_gold(v jsonb) returns integer language sql immutable set search_path='' as $$
 select ceil((16+sum(case s->>'type' when 'fork' then 76 when 'slalom' then 54 when 'left' then 38 when 'right' then 38 else 40 end))/10.0 + sum(case when s->>'type'='climb' then 4 else 0 end))::integer from jsonb_array_elements(v->'segments') s;
$$;
insert into tumble_private.course_targets(id,gold,silver,target)
select course_number,tumble_private.recipe_gold(recipe),tumble_private.recipe_gold(recipe)+15,greatest(50,tumble_private.recipe_gold(recipe)+30) from public.tc_published_levels where course_number is not null;

create function public.tc_release_publish(p_comment text,p_entries jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=tumble_private.require_user(); e jsonb; v_row public.tc_published_levels; v_source public.tc_saved_recipes;
 v_number integer; v_version text; v_response jsonb; v_existing tumble_private.course_releases; v_rows jsonb:='[]'; v_gold integer; v_id uuid; v_source_id uuid;
begin
 if not tumble_private.is_designer(v_user) then raise exception 'Designer permission required' using errcode='42501'; end if;
 if p_request_id is null or not tumble_private.valid_sentence(p_comment) or p_entries is null or jsonb_typeof(p_entries)<>'array' or octet_length(p_entries::text)>540000
 then raise exception 'Write a release comment and a sentence for each course' using errcode='22023'; end if;
 if jsonb_array_length(p_entries) not between 1 and 16 then raise exception 'Select 1 to 16 saved courses' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(78291340);
 select * into v_existing from tumble_private.course_releases where request_id=p_request_id;
 if found then
  if v_existing.actor_id<>v_user or v_existing.comment<>btrim(p_comment) or v_existing.entries<>p_entries then raise exception 'Release request changed; retry with a new request' using errcode='22023'; end if;
  return v_existing.response;
 end if;
 select coalesce(max(number),0)+1 into v_number from tumble_private.course_releases;
 v_version:='v0.0.'||v_number;
 for e in select value from jsonb_array_elements(p_entries) loop
  if not tumble_private.valid_recipe(e->'recipe') or not tumble_private.valid_sentence(e->>'description') then raise exception 'Each course needs a valid design and a complete description' using errcode='22023'; end if;
  v_id:=(e->>'id')::uuid; v_source_id:=(e->>'source_id')::uuid;
  if v_source_id is not null and v_id is null then
   select * into v_source from public.tc_saved_recipes where id=v_source_id and owner_id=v_user;
   if not found then raise exception 'Choose a course saved in your account' using errcode='42501'; end if;
   if v_id is null and v_source.recipe<>e->'recipe' then raise exception 'Saved design changed; reload before publishing' using errcode='40001'; end if;
  end if;
  if v_id is null then
   if v_source_id is null then raise exception 'Save a new course before publishing it' using errcode='22023'; end if;
   insert into public.tc_published_levels(recipe,created_by,updated_by,course_number,release_version,description,source_id)
   select e->'recipe',v_user,v_user,greatest(50,coalesce(max(course_number),50))+1,v_version,btrim(e->>'description'),v_source_id from public.tc_published_levels returning * into v_row;
  else
   update public.tc_published_levels set recipe=e->'recipe',updated_by=v_user,updated_at=now(),revision=revision+1,release_version=v_version,description=btrim(e->>'description')
   where id=v_id and revision=(e->>'revision')::integer and retired_at is null returning * into v_row;
   if not found then raise exception 'Course changed or retired; reload before publishing' using errcode='40001'; end if;
   -- Keep the account copy in step with a published edit.
   update public.tc_saved_recipes set recipe=e->'recipe',updated_at=now() where id=v_row.source_id and owner_id=v_user;
  end if;
  v_gold:=tumble_private.recipe_gold(v_row.recipe);
  insert into tumble_private.course_targets(id,gold,silver,target) values(v_row.course_number,v_gold,v_gold+15,greatest(50,v_gold+30)) on conflict(id) do nothing;
  v_rows:=v_rows||jsonb_build_array(to_jsonb(v_row));
  insert into tumble_private.audit(actor_id,action,subject_id) values(v_user,'release.publish',v_row.id);
 end loop;
 v_response:=jsonb_build_object('version',v_version,'levels',v_rows);
 insert into tumble_private.course_releases(number,request_id,actor_id,comment,entries,response) values(v_number,p_request_id,v_user,btrim(p_comment),p_entries,v_response);
 return v_response;
end $$;
-- Old clients cannot bypass release notes or accidentally publish the default draft.
revoke all on function public.tc_level_publish(jsonb,uuid,integer) from public,anon,authenticated;
revoke all on function public.tc_release_publish(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.tc_release_publish(text,jsonb,uuid) to authenticated;
create function public.tc_course_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('levels',coalesce((select jsonb_agg(to_jsonb(p) order by p.course_number) from public.tc_published_levels p where retired_at is null),'[]'::jsonb),
 'targets',(select jsonb_agg(jsonb_build_object('id',t.id,'gold',t.gold,'silver',t.silver,'target',t.target)) from tumble_private.course_targets t),
 'version','v0.0.'||(select coalesce(max(number),0) from tumble_private.course_releases));
$$;
revoke all on function public.tc_course_catalog() from public;
grant execute on function public.tc_course_catalog() to anon,authenticated;
create or replace function public.tc_course_finish(p_course integer,p_time double precision) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=tumble_private.require_user();
begin
 if p_course is null or p_time is null or not(p_time>0 and p_time<=150) or not exists(select 1 from tumble_private.course_targets where id=p_course)
 or (p_course>50 and not exists(select 1 from public.tc_published_levels where course_number=p_course and retired_at is null)) then raise exception 'Invalid course result' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,773));
 if exists(select 1 from tumble_private.course_targets t where t.id<p_course and (t.id<=50 or exists(select 1 from public.tc_published_levels p where p.course_number=t.id and retired_at is null)) and not exists(select 1 from tumble_private.course_best b where b.user_id=v_user and b.course_id=t.id)) then raise exception 'Finish the earlier courses first' using errcode='22023'; end if;
 insert into tumble_private.course_best(user_id,course_id,seconds) values(v_user,p_course,p_time) on conflict(user_id,course_id) do update set seconds=least(tumble_private.course_best.seconds,excluded.seconds);
 return tumble_private.progress_snapshot(v_user);
end $$;
revoke all on function tumble_private.valid_sentence(text),tumble_private.recipe_gold(jsonb) from public,anon,authenticated;
-- Calibrated thresholds preserve all previously earned stars.
update tumble_private.course_targets t set gold=greatest(t.gold,v.gold),silver=greatest(t.silver,v.silver),target=greatest(t.target,v.target) from (values
(1,54,64,72),
(2,54,69,80),
(3,54,65,73),
(4,49,61,70),
(5,48,58,66),
(6,48,63,74),
(7,60,71,79),
(8,60,70,78),
(9,57,77,93),
(10,57,74,87),
(11,48,59,67),
(12,45,60,72),
(13,49,60,68),
(14,56,75,90),
(15,55,66,74),
(16,56,68,79),
(17,45,63,77),
(18,49,59,67),
(19,47,58,66),
(20,52,71,86),
(21,53,64,73),
(22,55,65,73),
(23,60,70,83),
(24,48,58,66),
(25,47,62,74),
(26,60,74,84),
(27,49,60,69),
(28,58,70,79),
(29,55,65,73),
(30,48,60,69),
(31,62,73,84),
(32,51,65,75),
(33,52,68,80),
(34,51,61,69),
(35,60,75,86),
(36,55,72,86),
(37,61,72,80),
(38,64,74,82),
(39,51,61,69),
(40,51,61,69),
(41,55,68,81),
(42,63,74,83),
(43,60,70,78),
(44,59,69,80),
(45,72,82,90),
(46,52,62,70),
(47,49,59,68),
(48,60,75,87),
(49,57,70,81),
(50,54,64,72)
) as v(id,gold,silver,target) where t.id=v.id;
notify pgrst,'reload schema';
commit;
