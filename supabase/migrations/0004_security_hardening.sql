-- WASCHMATIK security hardening v4
-- Corrects public data exposure, makes sensitive admin operations atomic,
-- adds server-side rate limiting and centralizes financial status transitions.

-- Public search must never expose private partner contact/address data.
create or replace function public.search_businesses(p_postal_code text)
returns table(
  id uuid,
  name text,
  city text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  website text,
  google_maps_url text,
  image text,
  rating numeric,
  review_count integer,
  services text,
  service_area text[],
  description text,
  active boolean,
  distance_km numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select pc.latitude, pc.longitude, lower(pc.city) as city
    from public.postal_codes pc
    where pc.postal_code = regexp_replace(coalesce(p_postal_code,''), '[^0-9]', '', 'g')
    limit 1
  )
  select
    b.id, b.name, b.city, b.postal_code, b.latitude, b.longitude,
    b.website, b.google_maps_url, b.image, b.rating, b.review_count,
    b.services, b.service_area, b.description, b.active,
    case
      when b.latitude is not null and b.longitude is not null and t.latitude is not null and t.longitude is not null
      then round((6371 * 2 * atan2(
        sqrt(
          sin(radians(b.latitude - t.latitude)/2)^2 +
          cos(radians(t.latitude))*cos(radians(b.latitude))*sin(radians(b.longitude - t.longitude)/2)^2
        ),
        sqrt(1 - (
          sin(radians(b.latitude - t.latitude)/2)^2 +
          cos(radians(t.latitude))*cos(radians(b.latitude))*sin(radians(b.longitude - t.longitude)/2)^2
        ))
      ))::numeric, 1)
      else null
    end as distance_km
  from public.businesses b
  cross join target t
  where b.active = true
    and (
      regexp_replace(coalesce(p_postal_code,''), '[^0-9]', '', 'g') = any(coalesce(b.service_area, '{}'::text[]))
      or lower(coalesce(t.city,'')) = any(coalesce(b.service_area, '{}'::text[]))
      or left(regexp_replace(coalesce(p_postal_code,''), '[^0-9]', '', 'g'), 2) = any(coalesce(b.service_area, '{}'::text[]))
      or b.postal_code = regexp_replace(coalesce(p_postal_code,''), '[^0-9]', '', 'g')
    )
  order by
    case
      when regexp_replace(coalesce(p_postal_code,''), '[^0-9]', '', 'g') = any(coalesce(b.service_area, '{}'::text[])) then 0
      when lower(coalesce(t.city,'')) = any(coalesce(b.service_area, '{}'::text[])) then 0
      when left(regexp_replace(coalesce(p_postal_code,''), '[^0-9]', '', 'g'), 2) = any(coalesce(b.service_area, '{}'::text[])) then 0
      else 1
    end,
    coalesce(distance_km, 999999);
$$;

-- SECURITY DEFINER functions use an empty search_path and explicit schemas.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
      and p.admin_verified_until is not null
      and p.admin_verified_until > now()
  );
$$;
create or replace function public.my_business_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select business_id from public.user_roles where user_id = auth.uid() and role = 'partner' limit 1;
$$;
create or replace function public.next_inquiry_id()
returns text language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  n := nextval('public.inquiry_seq');
  return 'WM-' || to_char(current_date,'YYYY') || '-' || lpad(n::text,6,'0');
end $$;
create or replace function public.next_invoice_number()
returns text language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  n := nextval('public.invoice_seq');
  return 'WM-RG-' || to_char(current_date,'YYYY') || '-' || lpad(n::text,6,'0');
end $$;

-- Do not expose the whole businesses table to anonymous users. Public discovery uses the RPC above.
drop policy if exists businesses_public_active on public.businesses;
revoke select on public.businesses from anon;
revoke select on public.businesses from authenticated;
grant select on public.businesses to authenticated;
-- Authenticated users only see their own business; admins see all.

-- Partner application terms must be accepted explicitly; timestamp/version are server generated.
alter table public.partner_applications
  add column if not exists terms_accepted boolean not null default false;

create or replace function public.normalize_partner_application()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.terms_accepted is not true then
    raise exception 'Partnerbedingungen müssen akzeptiert werden';
  end if;
  new.status := 'pending';
  new.terms_version := '1.0';
  new.terms_accepted_at := now();
  return new;
end $$;
drop trigger if exists normalize_partner_application on public.partner_applications;
create trigger normalize_partner_application
before insert on public.partner_applications
for each row execute function public.normalize_partner_application();

drop policy if exists partner_apps_public_insert on public.partner_applications;
create policy partner_apps_public_insert
on public.partner_applications for insert to anon, authenticated
with check (terms_accepted = true and status = 'pending');

grant insert on public.partner_applications to anon, authenticated;
grant select on public.partner_applications to authenticated;
revoke update, delete on public.partner_applications from anon, authenticated;

-- Atomic one-time admin approval token consumption. Only service_role may call it.
create or replace function public.consume_admin_login_token(p_token_hash text)
returns table(user_id uuid, request_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.admin_login_requests r
  set status = 'approved', approved_at = now(), consumed_at = now()
  where r.token_hash = p_token_hash
    and r.status = 'pending'
    and r.expires_at > now()
  returning r.user_id, r.id;
end $$;
revoke execute on function public.consume_admin_login_token(text) from public, anon, authenticated;
grant execute on function public.consume_admin_login_token(text) to service_role;

-- Centralized admin status transition: commission is always recalculated server-side.
create or replace function public.admin_set_inquiry_status(p_inquiry_id uuid, p_status public.inquiry_status)
returns public.inquiries
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  old_row public.inquiries;
  new_row public.inquiries;
begin
  if actor is null or not public.is_admin() then raise exception 'Nicht autorisiert'; end if;
  if not exists(select 1 from public.profiles where id = actor and admin_verified_until > now()) then
    raise exception 'Admin-Freigabe fehlt oder ist abgelaufen';
  end if;
  select * into old_row from public.inquiries where id = p_inquiry_id for update;
  if not found then raise exception 'Anfrage nicht gefunden'; end if;
  update public.inquiries
    set status = p_status,
        commission_amount = case when p_status = 'completed' then round(order_value * commission_percentage / 100, 2) else 0 end,
        updated_at = now()
    where id = p_inquiry_id
    returning * into new_row;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values(actor, 'inquiry_status_changed', 'inquiry', new_row.id::text, to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end $$;
revoke execute on function public.admin_set_inquiry_status(uuid, public.inquiry_status) from public, anon;
grant execute on function public.admin_set_inquiry_status(uuid, public.inquiry_status) to authenticated;

-- Centralized invoice status changes with audit trail.
create or replace function public.admin_set_invoice_status(p_invoice_id uuid, p_status public.invoice_status)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); old_row public.invoices; new_row public.invoices;
begin
  if actor is null or not public.is_admin() then raise exception 'Nicht autorisiert'; end if;
  if not exists(select 1 from public.profiles where id = actor and admin_verified_until > now()) then raise exception 'Admin-Freigabe fehlt oder ist abgelaufen'; end if;
  select * into old_row from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Rechnung nicht gefunden'; end if;
  update public.invoices set status = p_status, paid_at = case when p_status = 'bezahlt' then coalesce(paid_at, now()) else null end, updated_at = now() where id = p_invoice_id returning * into new_row;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, old_value, new_value)
  values(actor, 'invoice_status_changed', 'invoice', new_row.id::text, to_jsonb(old_row), to_jsonb(new_row));
  return new_row;
end $$;
revoke execute on function public.admin_set_invoice_status(uuid, public.invoice_status) from public, anon;
grant execute on function public.admin_set_invoice_status(uuid, public.invoice_status) to authenticated;

-- Hash-based rate-limit bucket for public inquiry creation (5 per key / 15 minutes).
create table if not exists public.inquiry_rate_limits(
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check(request_count >= 0)
);
revoke all on public.inquiry_rate_limits from public, anon, authenticated;

create or replace function public.consume_inquiry_rate_limit(p_bucket_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare c integer;
begin
  insert into public.inquiry_rate_limits(bucket_key, window_started_at, request_count)
  values(p_bucket_key, now(), 1)
  on conflict(bucket_key) do update
    set request_count = case when public.inquiry_rate_limits.window_started_at < now() - interval '15 minutes' then 1 else public.inquiry_rate_limits.request_count + 1 end,
        window_started_at = case when public.inquiry_rate_limits.window_started_at < now() - interval '15 minutes' then now() else public.inquiry_rate_limits.window_started_at end
  returning request_count into c;
  return c <= 5;
end $$;
revoke execute on function public.consume_inquiry_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_inquiry_rate_limit(text) to service_role;

-- Tighter input constraints.
alter table public.inquiries drop constraint if exists inquiries_customer_postal_code_check;
alter table public.inquiries add constraint inquiries_customer_postal_code_check check (customer_postal_code ~ '^[0-9]{5}$');
alter table public.inquiries add constraint inquiries_customer_name_len check (char_length(customer_name) between 2 and 120);
alter table public.inquiries add constraint inquiries_customer_email_len check (char_length(customer_email) between 3 and 254);
alter table public.inquiries add constraint inquiries_problem_len check (char_length(problem_description) between 2 and 4000);

-- Prevent accidental public access to sensitive logs.
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

-- Remove direct anonymous table access where RPC/edge functions are intended.
revoke select on public.profiles from anon;
revoke select on public.user_roles from anon;

-- Clean up expired rate-limit buckets occasionally.
create index if not exists inquiry_rate_limits_window_idx on public.inquiry_rate_limits(window_started_at);
