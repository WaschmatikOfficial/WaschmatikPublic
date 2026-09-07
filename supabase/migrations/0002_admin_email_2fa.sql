-- WASCHMATIK: server-side email approval as second factor for admin access
alter table public.profiles
  add column if not exists admin_verified_until timestamptz;

create table if not exists public.admin_login_requests(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text unique not null,
  status text not null default 'pending' check (status in ('pending','approved','expired','revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  consumed_at timestamptz
);
create index if not exists admin_login_requests_user_idx on public.admin_login_requests(user_id, created_at desc);
create index if not exists admin_login_requests_hash_idx on public.admin_login_requests(token_hash);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.user_roles ur
    join public.profiles p on p.id=ur.user_id
    where ur.user_id=auth.uid()
      and ur.role='admin'
      and p.admin_verified_until is not null
      and p.admin_verified_until > now()
  );
$$;

create or replace function public.has_admin_access()
returns boolean
language sql stable security definer set search_path=public as $$
  select public.is_admin();
$$;

alter table public.admin_login_requests enable row level security;

create policy admin_login_requests_own_select
on public.admin_login_requests for select
using (user_id=auth.uid());

create policy admin_login_requests_admin_all
on public.admin_login_requests for all
using (public.is_admin()) with check (public.is_admin());

grant execute on function public.has_admin_access() to authenticated;
revoke insert, update, delete on public.admin_login_requests from anon, authenticated;

-- Never expose private partner contact fields to unauthenticated clients.
drop policy if exists businesses_public_active on public.businesses;
revoke select on public.businesses from anon;
grant execute on function public.search_businesses(text) to anon, authenticated;
