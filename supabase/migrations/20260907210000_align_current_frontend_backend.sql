-- WASCHMATIK current-schema alignment for the Vercel frontend.
-- This migration is additive and targets the already-deployed current schema.

alter table public.orders
  add column if not exists invoice_number text,
  add column if not exists invoice_status text default 'offen',
  add column if not exists invoice_due_at timestamptz,
  add column if not exists invoice_paid_at timestamptz;

update public.orders
set invoice_status = coalesce(invoice_status, 'offen')
where invoice_status is null;

create index if not exists orders_invoice_status_idx on public.orders(invoice_status, invoice_due_at);

alter table public.orders
  drop constraint if exists orders_invoice_status_check;
alter table public.orders
  add constraint orders_invoice_status_check
  check (invoice_status in ('offen','bezahlt','überfällig','storniert'));

-- Partner can see only their own profile, assignments, requests and orders.
drop policy if exists partners_partner_own_select on public.partners;
create policy partners_partner_own_select on public.partners
for select to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid())
    and ur.role = 'partner'
    and ur.business_id = partners.id
));

drop policy if exists partner_service_areas_partner_own_select on public.partner_service_areas;
create policy partner_service_areas_partner_own_select on public.partner_service_areas
for select to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid())
    and ur.role = 'partner'
    and ur.business_id = partner_service_areas.partner_id
));

drop policy if exists request_assignments_partner_own_select on public.request_assignments;
create policy request_assignments_partner_own_select on public.request_assignments
for select to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid())
    and ur.role = 'partner'
    and ur.business_id = request_assignments.partner_id
));

drop policy if exists repair_requests_partner_own_select on public.repair_requests;
create policy repair_requests_partner_own_select on public.repair_requests
for select to authenticated
using (exists (
  select 1 from public.request_assignments ra
  join public.user_roles ur on ur.business_id = ra.partner_id
  where ra.request_id = repair_requests.id
    and ur.user_id = (select auth.uid())
    and ur.role = 'partner'
));

drop policy if exists repair_requests_partner_own_update on public.repair_requests;
create policy repair_requests_partner_own_update on public.repair_requests
for update to authenticated
using (exists (
  select 1 from public.request_assignments ra
  join public.user_roles ur on ur.business_id = ra.partner_id
  where ra.request_id = repair_requests.id
    and ur.user_id = (select auth.uid())
    and ur.role = 'partner'
))
with check (exists (
  select 1 from public.request_assignments ra
  join public.user_roles ur on ur.business_id = ra.partner_id
  where ra.request_id = repair_requests.id
    and ur.user_id = (select auth.uid())
    and ur.role = 'partner'
));

drop policy if exists customers_partner_own_select on public.customers;
create policy customers_partner_own_select on public.customers
for select to authenticated
using (exists (
  select 1
  from public.repair_requests rr
  join public.request_assignments ra on ra.request_id = rr.id
  join public.user_roles ur on ur.business_id = ra.partner_id
  where rr.customer_id = customers.id
    and ur.user_id = (select auth.uid())
    and ur.role = 'partner'
));

drop policy if exists orders_partner_own_select on public.orders;
create policy orders_partner_own_select on public.orders
for select to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid())
    and ur.role = 'partner'
    and ur.business_id = orders.partner_id
));

drop policy if exists orders_partner_own_update on public.orders;
create policy orders_partner_own_update on public.orders
for update to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid())
    and ur.role = 'partner'
    and ur.business_id = orders.partner_id
))
with check (exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid())
    and ur.role = 'partner'
    and ur.business_id = orders.partner_id
));

-- Secure application intake: public users can create a pending partner via RPC only.
create or replace function public.submit_partner_application(
  p_business_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_street text,
  p_house_number text,
  p_postal_code text,
  p_city text,
  p_website text,
  p_description text,
  p_service_postal_codes text[]
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_partner_id uuid; v_code text;
begin
  if nullif(trim(p_business_name),'') is null
     or nullif(trim(p_contact_name),'') is null
     or nullif(trim(p_email),'') is null
     or nullif(trim(p_phone),'') is null
     or nullif(trim(p_postal_code),'') is null
     or nullif(trim(p_city),'') is null then
    raise exception 'Pflichtfelder fehlen';
  end if;
  if trim(p_postal_code) !~ '^[0-9]{5}$' then raise exception 'Ungültige PLZ'; end if;
  if lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Ungültige E-Mail'; end if;

  insert into public.partners(business_name,contact_name,email,phone,street,house_number,postal_code,city,website,description,status)
  values(trim(p_business_name),trim(p_contact_name),lower(trim(p_email)),trim(p_phone),nullif(trim(p_street),''),nullif(trim(p_house_number),''),trim(p_postal_code),trim(p_city),nullif(trim(p_website),''),nullif(trim(p_description),''),'pending')
  returning id into v_partner_id;

  foreach v_code in array coalesce(p_service_postal_codes, array[]::text[]) loop
    if v_code ~ '^[0-9]{5}$' then
      insert into public.partner_service_areas(partner_id,postal_code)
      values(v_partner_id,v_code)
      on conflict do nothing;
    end if;
  end loop;

  return v_partner_id;
end;
$$;
revoke all on function public.submit_partner_application(text,text,text,text,text,text,text,text,text,text,text[]) from public, authenticated;
grant execute on function public.submit_partner_application(text,text,text,text,text,text,text,text,text,text,text[]) to anon;

create or replace function public.partner_complete_order(
  p_request_id uuid,
  p_value numeric
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_partner_id uuid; v_order_id uuid;
begin
  if p_value is null or p_value < 0 then raise exception 'Ungültiger Auftragswert'; end if;
  select ra.partner_id into v_partner_id
  from public.request_assignments ra
  join public.user_roles ur on ur.business_id = ra.partner_id
  where ra.request_id = p_request_id and ur.user_id = auth.uid() and ur.role = 'partner'
  order by ra.is_primary desc, ra.assigned_at asc limit 1;
  if v_partner_id is null then raise exception 'Kein Zugriff auf diese Anfrage'; end if;

  insert into public.orders(request_id,partner_id,status,job_value,commission_percent,completed_at,invoice_number,invoice_status,invoice_due_at)
  values(p_request_id,v_partner_id,'completed',round(p_value,2),coalesce((select commission_percent from public.partners where id=v_partner_id),5),now(),
         'WM-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(p_request_id::text,'-',''),1,8)),
         'offen',now()+interval '14 days')
  on conflict (request_id, partner_id) do update
    set job_value = excluded.job_value,
        status = 'completed',
        completed_at = now(),
        invoice_number = coalesce(public.orders.invoice_number, excluded.invoice_number),
        invoice_status = coalesce(public.orders.invoice_status,'offen'),
        invoice_due_at = coalesce(public.orders.invoice_due_at, excluded.invoice_due_at),
        updated_at = now()
  returning id into v_order_id;

  update public.repair_requests set status='completed', updated_at=now() where id=p_request_id;
  update public.request_assignments set completed_at=now() where request_id=p_request_id and partner_id=v_partner_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_value)
  values(auth.uid(),'partner_order_completed','repair_request',p_request_id::text,jsonb_build_object('job_value',round(p_value,2),'partner_id',v_partner_id));
  return v_order_id;
end;
$$;
revoke all on function public.partner_complete_order(uuid,numeric) from public;
grant execute on function public.partner_complete_order(uuid,numeric) to authenticated;

create or replace function public.admin_set_request_status(
  p_request_id uuid,
  p_status repair_request_status
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.is_admin() then raise exception 'Nicht autorisiert'; end if;
  update public.repair_requests set status=p_status, updated_at=now() where id=p_request_id;
  if p_status='contacted' then update public.request_assignments set contacted_at=now() where request_id=p_request_id; end if;
  if p_status='completed' then update public.request_assignments set completed_at=now() where request_id=p_request_id; end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_value)
  values(auth.uid(),'request_status_changed','repair_request',p_request_id::text,jsonb_build_object('status',p_status));
end;
$$;
revoke all on function public.admin_set_request_status(uuid,repair_request_status) from public,anon;
grant execute on function public.admin_set_request_status(uuid,repair_request_status) to authenticated;

create or replace function public.admin_set_order_value(
  p_request_id uuid,
  p_value numeric,
  p_reason text default 'Admin-Korrektur'
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_partner_id uuid; v_order_id uuid;
begin
  if not private.is_admin() then raise exception 'Nicht autorisiert'; end if;
  if p_value is null or p_value < 0 then raise exception 'Ungültiger Auftragswert'; end if;
  select ra.partner_id into v_partner_id from public.request_assignments ra where ra.request_id=p_request_id and ra.is_primary=true limit 1;
  if v_partner_id is null then select partner_id into v_partner_id from public.request_assignments where request_id=p_request_id order by assigned_at asc limit 1; end if;
  if v_partner_id is null then raise exception 'Kein Partner zugeordnet'; end if;
  insert into public.orders(request_id,partner_id,status,job_value,commission_percent,invoice_number,invoice_status,invoice_due_at)
  values(p_request_id,v_partner_id,'open',round(p_value,2),coalesce((select commission_percent from public.partners where id=v_partner_id),5),
         'WM-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(p_request_id::text,'-',''),1,8)),'offen',now()+interval '14 days')
  on conflict (request_id, partner_id) do update set job_value=excluded.job_value, updated_at=now()
  returning id into v_order_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_value)
  values(auth.uid(),'admin_order_value_changed','order',v_order_id::text,jsonb_build_object('job_value',round(p_value,2),'reason',coalesce(p_reason,'Admin-Korrektur')));
  return v_order_id;
end;
$$;
revoke all on function public.admin_set_order_value(uuid,numeric,text) from public,anon;
grant execute on function public.admin_set_order_value(uuid,numeric,text) to authenticated;
