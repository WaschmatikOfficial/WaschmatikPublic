create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','partner');
create type public.application_status as enum ('pending','approved','rejected','active','inactive');
create type public.inquiry_status as enum ('new','contacted','accepted','completed','cancelled');
create type public.email_status as enum ('pending','sent','failed');
create type public.invoice_status as enum ('offen','bezahlt','überfällig','storniert');

create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
create table public.user_roles(
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.user_role not null,
  business_id uuid,
  created_at timestamptz not null default now()
);

create table public.businesses(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text not null,
  phone text,
  street text,
  house_number text,
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  city text not null,
  latitude double precision,
  longitude double precision,
  website text,
  google_maps_url text,
  image text,
  rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5)),
  review_count integer not null default 0 check (review_count >= 0),
  services text,
  service_area text[] not null default '{}',
  description text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_roles add constraint user_roles_business_fk foreign key (business_id) references public.businesses(id);

create table public.postal_codes(
  postal_code text primary key check (postal_code ~ '^[0-9]{5}$'),
  city text,
  latitude double precision not null,
  longitude double precision not null,
  source text,
  created_at timestamptz not null default now()
);

create table public.partner_applications(
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_person text not null,
  email text not null,
  phone text not null,
  street text not null,
  house_number text not null,
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  city text not null,
  website text,
  google_maps_url text,
  services text not null,
  service_area text not null,
  description text,
  image text,
  status public.application_status not null default 'pending',
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.inquiry_seq;
create sequence if not exists public.invoice_seq;

create table public.inquiries(
  id uuid primary key default gen_random_uuid(),
  inquiry_id text unique not null,
  business_id uuid not null references public.businesses(id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  customer_postal_code text not null check (customer_postal_code ~ '^[0-9]{5}$'),
  customer_city text not null,
  problem text not null,
  problem_description text not null,
  preferred_contact text not null,
  status public.inquiry_status not null default 'new',
  email_status public.email_status not null default 'pending',
  email_sent_at timestamptz,
  order_value numeric(12,2) not null default 0 check (order_value >= 0),
  commission_percentage numeric(5,2) not null default 5,
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices(
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  business_id uuid not null references public.businesses(id),
  inquiry_id uuid not null unique references public.inquiries(id),
  order_value numeric(12,2) not null,
  commission_percentage numeric(5,2) not null,
  commission_amount numeric(12,2) not null,
  status public.invoice_status not null default 'offen',
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs(
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index businesses_active_idx on public.businesses(active);
create index businesses_city_idx on public.businesses(city);
create index inquiries_business_idx on public.inquiries(business_id, created_at desc);
create index invoices_business_idx on public.invoices(business_id, created_at desc);
create index applications_status_idx on public.partner_applications(status, created_at desc);
create index audit_created_idx on public.audit_logs(created_at desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin');
$$;
create or replace function public.my_business_id()
returns uuid language sql stable security definer set search_path=public as $$
  select business_id from public.user_roles where user_id=auth.uid() and role='partner' limit 1;
$$;

create or replace function public.next_inquiry_id()
returns text language plpgsql security definer set search_path=public as $$
declare n bigint; begin n=nextval('public.inquiry_seq'); return 'WM-'||to_char(current_date,'YYYY')||'-'||lpad(n::text,6,'0'); end $$;
create or replace function public.next_invoice_number()
returns text language plpgsql security definer set search_path=public as $$
declare n bigint; begin n=nextval('public.invoice_seq'); return 'WM-RG-'||to_char(current_date,'YYYY')||'-'||lpad(n::text,6,'0'); end $$;

create or replace function public.search_businesses(p_postal_code text)
returns table(
  id uuid,name text,contact_person text,email text,phone text,street text,house_number text,postal_code text,city text,
  latitude double precision,longitude double precision,website text,google_maps_url text,image text,rating numeric,
  review_count integer,services text,service_area text[],description text,active boolean,created_at timestamptz,updated_at timestamptz,
  distance_km numeric
)
language sql stable security definer set search_path=public as $$
  with target as (select latitude, longitude, lower(city) city from public.postal_codes where postal_code=p_postal_code limit 1)
  select b.id,b.name,b.contact_person,b.email,b.phone,b.street,b.house_number,b.postal_code,b.city,b.latitude,b.longitude,b.website,b.google_maps_url,b.image,b.rating,b.review_count,b.services,b.service_area,b.description,b.active,b.created_at,b.updated_at,
    case when b.latitude is not null and b.longitude is not null then round((6371*2*atan2(sqrt(sin(radians(b.latitude-t.latitude)/2)^2+cos(radians(t.latitude))*cos(radians(b.latitude))*sin(radians(b.longitude-t.longitude)/2)^2),sqrt(1-(sin(radians(b.latitude-t.latitude)/2)^2+cos(radians(t.latitude))*cos(radians(b.latitude))*sin(radians(b.longitude-t.longitude)/2)^2))))::numeric,1) else null end as distance_km
  from public.businesses b cross join target t
  where b.active=true
  order by
    case when p_postal_code=any(b.service_area) then 0
         when lower(t.city)=any(b.service_area) then 0
         when left(p_postal_code,2)=any(b.service_area) then 0
         else 1 end,
    case when b.latitude is not null and b.longitude is not null then 6371*2*atan2(sqrt(sin(radians(b.latitude-t.latitude)/2)^2+cos(radians(t.latitude))*cos(radians(b.latitude))*sin(radians(b.longitude-t.longitude)/2)^2),sqrt(1-(sin(radians(b.latitude-t.latitude)/2)^2+cos(radians(t.latitude))*cos(radians(b.latitude))*sin(radians(b.longitude-t.longitude)/2)^2))) else 999999 end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,email) values(new.id,new.email) on conflict do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.businesses enable row level security;
alter table public.postal_codes enable row level security;
alter table public.partner_applications enable row level security;
alter table public.inquiries enable row level security;
alter table public.invoices enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy roles_self on public.user_roles for select using (user_id=auth.uid() or public.is_admin());
create policy businesses_public_active on public.businesses for select using (active=true);
create policy businesses_partner_own on public.businesses for select using (id=public.my_business_id());
create policy businesses_admin_all on public.businesses for all using (public.is_admin()) with check (public.is_admin());
create policy partner_apps_public_insert on public.partner_applications for insert with check (status='pending' and terms_accepted_at is not null);
create policy partner_apps_admin_all on public.partner_applications for all using (public.is_admin()) with check (public.is_admin());
create policy inquiries_partner_own on public.inquiries for select using (business_id=public.my_business_id());
create policy inquiries_admin_all on public.inquiries for all using (public.is_admin()) with check (public.is_admin());
create policy invoices_partner_own on public.invoices for select using (business_id=public.my_business_id());
create policy invoices_admin_all on public.invoices for all using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_only on public.audit_logs for select using (public.is_admin());
create policy postal_public_read on public.postal_codes for select using (true);

revoke all on public.inquiries from anon, authenticated;
revoke all on public.invoices from anon, authenticated;
-- Inquiries are created by the secure Edge Function, not direct browser inserts.
grant select on public.businesses to anon, authenticated;
grant select on public.postal_codes to anon, authenticated;
grant insert on public.partner_applications to anon, authenticated;
grant select on public.partner_applications to authenticated;
grant select on public.profiles, public.user_roles to authenticated;
