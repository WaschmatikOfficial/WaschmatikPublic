-- WASCHMATIK: one-time admin entry hardening
-- The frontend must never rely on a hidden route/code. Every admin entry starts a fresh auth+approval cycle.

alter table public.admin_login_requests
  add column if not exists revoked_at timestamptz;

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

revoke all on public.admin_login_requests from anon;
revoke insert, update, delete on public.admin_login_requests from authenticated;

drop policy if exists admin_login_requests_own_select on public.admin_login_requests;
create policy admin_login_requests_own_select
on public.admin_login_requests for select
using (user_id=auth.uid());

create index if not exists admin_login_requests_active_idx
on public.admin_login_requests(user_id,status,expires_at desc);
