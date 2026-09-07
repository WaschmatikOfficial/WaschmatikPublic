-- WASCHMATIK STEP 2: complete inquiry -> order -> confirmation -> commission workflow
-- Adds secure one-time workflow tokens, customer confirmations, orders,
-- immutable commission calculation and partner/customer action support.

create type public.order_status as enum ('accepted','in_progress','completed','cancelled');
create type public.confirmation_status as enum ('pending','completed','not_completed','disputed','expired');

create table if not exists public.orders(
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null unique references public.inquiries(id) on delete cascade,
  business_id uuid not null references public.businesses(id),
  status public.order_status not null default 'accepted',
  order_value numeric(12,2) not null default 0 check(order_value >= 0),
  customer_reported_value numeric(12,2) check(customer_reported_value is null or customer_reported_value >= 0),
  customer_confirmation_status public.confirmation_status not null default 'pending',
  accepted_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inquiries add column if not exists partner_response_at timestamptz;
alter table public.inquiries add column if not exists completed_at timestamptz;
alter table public.inquiries add column if not exists customer_confirmation_status public.confirmation_status default 'pending';
alter table public.inquiries add column if not exists customer_confirmation_at timestamptz;
alter table public.inquiries add column if not exists customer_invoice_amount numeric(12,2);
alter table public.inquiries add constraint inquiries_customer_invoice_amount_check check(customer_invoice_amount is null or customer_invoice_amount >= 0);

create table if not exists public.workflow_tokens(
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  kind text not null check(kind in ('partner','customer')),
  action text not null check(action in ('accept','reject','repair_done','repair_not_done','set_invoice_amount')),
  token_hash text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists workflow_tokens_lookup_idx on public.workflow_tokens(token_hash,kind,action);
alter table public.workflow_tokens enable row level security;
revoke all on public.workflow_tokens from public, anon, authenticated;

alter table public.orders enable row level security;
create policy orders_admin_all on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy orders_partner_own on public.orders for select using (business_id=public.my_business_id());

-- Fix partner role integrity: a role may only point at a business.
alter table public.user_roles drop constraint if exists user_roles_business_role_check;
alter table public.user_roles add constraint user_roles_business_role_check
  check ((role='partner' and business_id is not null) or (role='admin' and business_id is null));

-- Server-side function to create an order exactly once.
create or replace function public.ensure_order_for_inquiry(p_inquiry_id uuid)
returns public.orders
language plpgsql
security definer
set search_path=''
as $$
declare i public.inquiries; o public.orders;
begin
  select * into i from public.inquiries where id=p_inquiry_id for update;
  if not found then raise exception 'Anfrage nicht gefunden'; end if;
  insert into public.orders(inquiry_id,business_id,status,order_value)
  values(i.id,i.business_id,'accepted',coalesce(i.order_value,0))
  on conflict(inquiry_id) do update
    set business_id=excluded.business_id, order_value=public.orders.order_value
  returning * into o;
  update public.inquiries
    set status='accepted',partner_response_at=now(),updated_at=now()
    where id=i.id;
  return o;
end $$;
revoke execute on function public.ensure_order_for_inquiry(uuid) from public,anon,authenticated;

-- Atomic status/value changes for the admin/partner workflow.
create or replace function public.partner_set_order_value(p_inquiry_id uuid,p_value numeric)
returns public.orders
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid(); o public.orders;
begin
  if actor is null or public.my_business_id() is null then raise exception 'Nicht autorisiert'; end if;
  if p_value is null or p_value < 0 or p_value > 100000 then raise exception 'Ungültiger Rechnungsbetrag'; end if;
  update public.orders
    set order_value=round(p_value,2),updated_at=now()
    where inquiry_id=p_inquiry_id and business_id=public.my_business_id() and status <> 'cancelled'
    returning * into o;
  if not found then raise exception 'Auftrag nicht gefunden'; end if;
  update public.inquiries
    set order_value=o.order_value,
        commission_amount=case when o.status='completed' then round(o.order_value*commission_percentage/100,2) else 0 end,
        updated_at=now()
    where id=p_inquiry_id;
  return o;
end $$;
grant execute on function public.partner_set_order_value(uuid,numeric) to authenticated;

create or replace function public.complete_order(p_inquiry_id uuid,p_value numeric)
returns public.orders
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid(); o public.orders;
begin
  if actor is null or public.my_business_id() is null then raise exception 'Nicht autorisiert'; end if;
  if p_value is null or p_value < 0 or p_value > 100000 then raise exception 'Ungültiger Rechnungsbetrag'; end if;
  update public.orders
    set status='completed',order_value=round(p_value,2),completed_at=now(),updated_at=now()
    where inquiry_id=p_inquiry_id and business_id=public.my_business_id() and status in ('accepted','in_progress')
    returning * into o;
  if not found then raise exception 'Auftrag kann nicht abgeschlossen werden'; end if;
  update public.inquiries
    set status='completed', order_value=o.order_value, commission_amount=round(o.order_value*commission_percentage/100,2), completed_at=now(), updated_at=now()
    where id=p_inquiry_id;
  return o;
end $$;
grant execute on function public.complete_order(uuid,numeric) to authenticated;

-- Secure public business matching, including exact/city/prefix service areas.
create or replace function public.business_serves_postal(p_business_id uuid,p_postal text)
returns boolean
language sql stable security definer set search_path=''
as $$
  with pc as (
    select lower(city) as city from public.postal_codes
    where postal_code=regexp_replace(coalesce(p_postal,''),'[^0-9]','','g') limit 1
  )
  select exists(
    select 1 from public.businesses b
    cross join pc
    where b.id=p_business_id and b.active=true
      and (
        regexp_replace(coalesce(p_postal,''),'[^0-9]','','g') = any(coalesce(b.service_area,'{}'::text[]))
        or lower(pc.city)=any(coalesce(b.service_area,'{}'::text[]))
        or left(regexp_replace(coalesce(p_postal,''),'[^0-9]','','g'),2)=any(coalesce(b.service_area,'{}'::text[]))
        or b.postal_code=regexp_replace(coalesce(p_postal,''),'[^0-9]','','g')
      )
  ) or exists(
    select 1 from public.businesses b where b.id=p_business_id and b.active=true and b.service_area='{}'::text[]
  );
$$;
grant execute on function public.business_serves_postal(uuid,text) to anon,authenticated;

-- Better auditability for commission changes.
create or replace function public.admin_set_inquiry_status(p_inquiry_id uuid, p_status public.inquiry_status)
returns public.inquiries
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old_row public.inquiries; new_row public.inquiries;
begin
  if actor is null or not public.is_admin() then raise exception 'Nicht autorisiert'; end if;
  select * into old_row from public.inquiries where id=p_inquiry_id for update;
  if not found then raise exception 'Anfrage nicht gefunden'; end if;
  if p_status='completed' and coalesce(old_row.order_value,0)<=0 then raise exception 'Auftragswert muss vor Abschluss größer als 0 sein'; end if;
  update public.inquiries
    set status=p_status,
      commission_amount=case when p_status='completed' then round(order_value*commission_percentage/100,2) else commission_amount end,
      completed_at=case when p_status='completed' then now() else completed_at end,
      updated_at=now()
    where id=p_inquiry_id
    returning * into new_row;
  if p_status='accepted' then
    insert into public.orders(inquiry_id,business_id,status,order_value)
    values(new_row.id,new_row.business_id,'accepted',new_row.order_value)
    on conflict(inquiry_id) do update set order_value=public.orders.order_value;
  end if;
  if p_status='completed' then
    insert into public.orders(inquiry_id,business_id,status,order_value,completed_at)
    values(new_row.id,new_row.business_id,'completed',new_row.order_value,now())
    on conflict(inquiry_id) do update set status='completed',order_value=new_row.order_value,completed_at=now(),updated_at=now();
  elsif p_status='cancelled' then
    update public.orders set status='cancelled',updated_at=now() where inquiry_id=new_row.id and status <> 'completed';
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_value,new_value)
  values(actor,'inquiry_status_changed','inquiry',new_row.id::text,to_jsonb(old_row),to_jsonb(new_row));
  return new_row;
end $$;

-- Automated overdue status helper; payment remains controlled by admin.
create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql security definer set search_path=''
as $$
declare n integer;
begin
  update public.invoices set status='überfällig',updated_at=now()
  where status='offen' and due_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_overdue_invoices() from public,anon,authenticated;



-- More tolerant public matching: service-area values are case-insensitive.
create or replace function public.search_businesses(p_postal_code text)
returns table(
  id uuid,name text,city text,postal_code text,latitude double precision,longitude double precision,
  website text,google_maps_url text,image text,rating numeric,review_count integer,
  services text,service_area text[],description text,active boolean,distance_km numeric
)
language sql stable security definer set search_path=''
as $$
  with cleaned as (
    select regexp_replace(coalesce(p_postal_code,''),'[^0-9]','','g') as postal
  ),
  target as (
    select c.postal, lower(pc.city) as city, pc.latitude, pc.longitude
    from cleaned c left join public.postal_codes pc on pc.postal_code=c.postal
  )
  select
    b.id,b.name,b.city,b.postal_code,b.latitude,b.longitude,b.website,b.google_maps_url,b.image,
    b.rating,b.review_count,b.services,b.service_area,b.description,b.active,
    case when b.latitude is not null and b.longitude is not null and t.latitude is not null and t.longitude is not null
      then round((6371*2*atan2(
        sqrt(sin(radians(b.latitude-t.latitude)/2)^2+cos(radians(t.latitude))*cos(radians(b.latitude))*sin(radians(b.longitude-t.longitude)/2)^2),
        sqrt(1-(sin(radians(b.latitude-t.latitude)/2)^2+cos(radians(t.latitude))*cos(radians(b.latitude))*sin(radians(b.longitude-t.longitude)/2)^2))
      ))::numeric,1) else null end as distance_km
  from public.businesses b cross join target t
  where b.active=true and (
    lower(coalesce(b.postal_code,''))=t.postal
    or exists(select 1 from unnest(coalesce(b.service_area,'{}'::text[])) s where lower(s)=t.postal)
    or exists(select 1 from unnest(coalesce(b.service_area,'{}'::text[])) s where lower(s)=t.city)
    or exists(select 1 from unnest(coalesce(b.service_area,'{}'::text[])) s where lower(s)=left(t.postal,2))
    or cardinality(coalesce(b.service_area,'{}'::text[]))=0
  )
  order by
    case when exists(select 1 from unnest(coalesce(b.service_area,'{}'::text[])) s where lower(s)=t.postal) then 0
         when exists(select 1 from unnest(coalesce(b.service_area,'{}'::text[])) s where lower(s)=t.city) then 1
         when exists(select 1 from unnest(coalesce(b.service_area,'{}'::text[])) s where lower(s)=left(t.postal,2)) then 2
         else 3 end,
    coalesce(distance_km,999999);
$$;
grant execute on function public.search_businesses(text) to anon,authenticated;

create or replace function public.business_serves_postal(p_business_id uuid,p_postal text)
returns boolean
language sql stable security definer set search_path=''
as $$
  with cleaned as (
    select regexp_replace(coalesce(p_postal,''),'[^0-9]','','g') as postal
  ),
  target as (
    select c.postal, lower(pc.city) as city
    from cleaned c left join public.postal_codes pc on pc.postal_code=c.postal
  )
  select exists(
    select 1 from public.businesses b cross join target t
    where b.id=p_business_id and b.active=true and (
      lower(coalesce(b.postal_code,''))=t.postal
      or exists(select 1 from unnest(coalesce(b.service_area,'{}'::text[])) s where lower(s)=t.postal)
      or exists(select 1 from unnest(coalesce(b.service_area,'{}'::text[])) s where lower(s)=t.city and t.city is not null)
      or exists(select 1 from unnest(coalesce(b.service_area,'{}'::text[])) s where lower(s)=left(t.postal,2))
      or cardinality(coalesce(b.service_area,'{}'::text[]))=0
    )
  );
$$;

-- Completing an order automatically creates its commission invoice exactly once.
create or replace function public.complete_order(p_inquiry_id uuid,p_value numeric)
returns public.orders
language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); o public.orders; i public.inquiries; invoice_no text;
begin
  if actor is null or public.my_business_id() is null then raise exception 'Nicht autorisiert'; end if;
  if p_value is null or p_value < 0 or p_value > 100000 then raise exception 'Ungültiger Rechnungsbetrag'; end if;

  update public.orders
    set status='completed',order_value=round(p_value,2),completed_at=now(),updated_at=now()
    where inquiry_id=p_inquiry_id and business_id=public.my_business_id()
      and status in ('accepted','in_progress')
    returning * into o;
  if not found then raise exception 'Auftrag kann nicht abgeschlossen werden'; end if;

  select * into i from public.inquiries where id=p_inquiry_id;
  update public.inquiries
    set status='completed',order_value=o.order_value,
        commission_amount=round(o.order_value*commission_percentage/100,2),
        completed_at=now(),updated_at=now()
    where id=p_inquiry_id;

  if not exists(select 1 from public.invoices where inquiry_id=p_inquiry_id) then
    invoice_no:=public.next_invoice_number();
    insert into public.invoices(
      invoice_number,inquiry_id,business_id,order_value,commission_percentage,commission_amount,status,due_at
    ) values(
      invoice_no,p_inquiry_id,i.business_id,o.order_value,i.commission_percentage,
      round(o.order_value*i.commission_percentage/100,2),'offen',now()+interval '14 days'
    );
  end if;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_value)
  values(actor,'order_completed','order',o.id::text,jsonb_build_object(
    'inquiry_id',p_inquiry_id,'order_value',o.order_value,
    'commission',round(o.order_value*i.commission_percentage/100,2)
  ));
  return o;
end $$;
grant execute on function public.complete_order(uuid,numeric) to authenticated;
