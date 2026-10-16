-- DEKPI 週報更新：在原專案 Supabase SQL Editor 執行一次。
-- 使用既有 get_my_profile() 角色來源；不修改月度資料。
begin;
create table if not exists public.weekly_reports (
 week text not null check (week ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'),
 center text not null check (center in ('台北','新北','桃園','台中','台南','高雄')),
 payload jsonb not null default '{}'::jsonb,
 status text not null default 'draft' check (status in ('draft','submitted')),
 submitted_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key (week,center)
);
create table if not exists public.marketing_events (
 id uuid primary key default gen_random_uuid(),
 type text not null,
 name text not null check(length(trim(name))>0),
 start date not null,
 "end" date,
 scope text not null check(scope in ('全市場','台北','新北','桃園','台中','台南','高雄')),
 check("end" is null or "end">=start)
);
create or replace function public.dekpi_weekly_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='UPDATE' and NEW.updated_at is distinct from OLD.updated_at then
   raise exception '週報已由其他裝置更新，請重新整理後確認內容再儲存';
 end if;
 if NEW.status='submitted' and (coalesce(jsonb_array_length(NEW.payload->'rows'),0)=0 or coalesce(trim(NEW.payload->>'notes'),'')='') then
   raise exception '正式提交需要KPI及發現與行動';
 end if;
 NEW.updated_at=clock_timestamp();
 NEW.submitted_at=case when NEW.status='submitted' then NEW.updated_at else null end;
 return NEW;
end $$;
drop trigger if exists dekpi_weekly_stamp on public.weekly_reports;
create trigger dekpi_weekly_stamp before insert or update on public.weekly_reports for each row execute function public.dekpi_weekly_guard();
-- upsert先執行INSERT trigger，因此另以RPC做更新版本檢查，前端使用此RPC儲存。
create or replace function public.save_dekpi_weekly(p_week text,p_center text,p_payload jsonb,p_status text,p_expected timestamptz default null)
returns setof public.weekly_reports language plpgsql security invoker set search_path=public as $$
begin
 if exists(select 1 from public.weekly_reports where week=p_week and center=p_center) then
   return query update public.weekly_reports set payload=p_payload,status=p_status
    where week=p_week and center=p_center and updated_at=p_expected returning *;
   if not found then raise exception '週報已更新，請重新整理後再儲存';end if;
 else
   return query insert into public.weekly_reports(week,center,payload,status) values(p_week,p_center,p_payload,p_status) returning *;
 end if;
end $$;
alter table public.weekly_reports enable row level security;
alter table public.marketing_events enable row level security;
drop policy if exists dekpi_weekly_access on public.weekly_reports;
create policy dekpi_weekly_access on public.weekly_reports for all to authenticated
 using (exists(select 1 from public.get_my_profile() p where p.role::text='op' or replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北')=weekly_reports.center))
 with check (exists(select 1 from public.get_my_profile() p where p.role::text='op' or replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北')=weekly_reports.center));
drop policy if exists dekpi_marketing_read on public.marketing_events;
create policy dekpi_marketing_read on public.marketing_events for select to authenticated
 using(exists(select 1 from public.get_my_profile() p where p.role::text='op' or scope='全市場' or scope=replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北')));
drop policy if exists dekpi_marketing_write on public.marketing_events;
create policy dekpi_marketing_write on public.marketing_events for all to authenticated
 using(exists(select 1 from public.get_my_profile() p where p.role::text='op' or scope=replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北')))
 with check(exists(select 1 from public.get_my_profile() p where p.role::text='op' or scope=replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北')));
grant select,insert,update,delete on public.weekly_reports,public.marketing_events to authenticated;
revoke all on public.weekly_reports,public.marketing_events from anon;
revoke execute on function public.save_dekpi_weekly(text,text,jsonb,text,timestamptz) from public,anon;
grant execute on function public.save_dekpi_weekly(text,text,jsonb,text,timestamptz) to authenticated;
commit;

-- 第二輪更新：Group中文名稱及中心新增全市場活動
begin;
alter table public.marketing_events add column if not exists created_by uuid default auth.uid();
create table if not exists public.weekly_group_names (
 center text not null check(center in ('台北','新北','桃園','台中','台南','高雄')),
 group_code text not null check(length(trim(group_code))>0 and position('|' in group_code)=0),
 name text not null default '',
 primary key(center,group_code)
);
alter table public.weekly_group_names enable row level security;
drop policy if exists dekpi_group_names_access on public.weekly_group_names;
create policy dekpi_group_names_access on public.weekly_group_names for all to authenticated
 using(exists(select 1 from public.get_my_profile() p where p.role::text='op' or replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北')=weekly_group_names.center))
 with check(exists(select 1 from public.get_my_profile() p where p.role::text='op' or replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北')=weekly_group_names.center));
grant select,insert,update,delete on public.weekly_group_names to authenticated;
revoke all on public.weekly_group_names from anon;
-- 移除上一版all policy，避免它與細分權限以OR合併。
drop policy if exists dekpi_marketing_write on public.marketing_events;
drop policy if exists dekpi_marketing_insert on public.marketing_events;
create policy dekpi_marketing_insert on public.marketing_events for insert to authenticated
 with check(created_by=auth.uid() and exists(select 1 from public.get_my_profile() p where p.role::text='op' or (p.center::text is not null and (scope='全市場' or scope=replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北')))));
drop policy if exists dekpi_marketing_update on public.marketing_events;
create policy dekpi_marketing_update on public.marketing_events for update to authenticated
 using(exists(select 1 from public.get_my_profile() p where p.role::text='op' or scope=replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北') or (scope='全市場' and created_by=auth.uid())))
 with check(exists(select 1 from public.get_my_profile() p where p.role::text='op' or scope=replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北') or (scope='全市場' and created_by=auth.uid())));
drop policy if exists dekpi_marketing_delete on public.marketing_events;
create policy dekpi_marketing_delete on public.marketing_events for delete to authenticated
 using(exists(select 1 from public.get_my_profile() p where p.role::text='op' or scope=replace(replace(p.center::text,'外送中心',''),'外送共享中心','新北') or (scope='全市場' and created_by=auth.uid())));
create or replace function public.dekpi_keep_event_owner() returns trigger language plpgsql set search_path=public as $$
begin NEW.created_by=OLD.created_by;return NEW;end $$;
drop trigger if exists dekpi_keep_event_owner on public.marketing_events;
create trigger dekpi_keep_event_owner before update on public.marketing_events for each row execute function public.dekpi_keep_event_owner();
commit;
