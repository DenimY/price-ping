create extension if not exists "pgcrypto";

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    nickname,
    phone_number,
    privacy_consent,
    privacy_consent_at
  )
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone_number'), ''),
    coalesce((new.raw_user_meta_data ->> 'privacy_consent')::boolean, false),
    nullif(new.raw_user_meta_data ->> 'privacy_consent_at', '')::timestamptz
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        nickname = coalesce(public.profiles.nickname, excluded.nickname),
        phone_number = coalesce(public.profiles.phone_number, excluded.phone_number),
        privacy_consent = public.profiles.privacy_consent or excluded.privacy_consent,
        privacy_consent_at = coalesce(
          public.profiles.privacy_consent_at,
          excluded.privacy_consent_at
        );

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  nickname text,
  phone_number text,
  privacy_consent boolean not null default false,
  privacy_consent_at timestamptz,
  role text not null default 'user' check (role in ('user', 'admin')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create table if not exists public.products (
  id bigint generated always as identity primary key,
  url text not null unique,
  mall text not null default 'naver_store',
  title text,
  image_url text,
  currency text not null default 'KRW',
  last_price bigint,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  memo text,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  price bigint not null,
  checked_at timestamptz not null default now()
);

create index if not exists idx_price_history_product_time
  on public.price_history (product_id, checked_at desc);

create table if not exists public.alert_rules (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  type text not null default 'target_price',
  target_price bigint,
  baseline_price bigint,
  change_percentage numeric,
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, type)
);

create index if not exists idx_alert_rules_active
  on public.alert_rules (active, product_id);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  alert_rule_id bigint references public.alert_rules(id) on delete set null,
  channel text not null,
  title text,
  message text,
  sent_at timestamptz,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_time
  on public.notifications (user_id, created_at desc);

create table if not exists public.push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create table if not exists public.kakao_links (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kakao_user_id text not null unique,
  created_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.alert_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.kakao_links enable row level security;

create policy "read_own_or_admin_profile"
on public.profiles
for select
using (id = auth.uid() or public.is_admin());

create policy "update_own_or_admin_profile"
on public.profiles
for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "read_own_favorites"
on public.favorites
for select
using (user_id = auth.uid());

create policy "insert_own_favorites"
on public.favorites
for insert
with check (user_id = auth.uid());

create policy "update_own_favorites"
on public.favorites
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "delete_own_favorites"
on public.favorites
for delete
using (user_id = auth.uid());

create policy "read_own_alert_rules"
on public.alert_rules
for select
using (user_id = auth.uid());

create policy "insert_own_alert_rules"
on public.alert_rules
for insert
with check (user_id = auth.uid());

create policy "update_own_alert_rules"
on public.alert_rules
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "delete_own_alert_rules"
on public.alert_rules
for delete
using (user_id = auth.uid());

create policy "read_own_notifications"
on public.notifications
for select
using (user_id = auth.uid());

create policy "read_own_push_tokens"
on public.push_tokens
for select
using (user_id = auth.uid());

create policy "insert_own_push_tokens"
on public.push_tokens
for insert
with check (user_id = auth.uid());

create policy "update_own_push_tokens"
on public.push_tokens
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "delete_own_push_tokens"
on public.push_tokens
for delete
using (user_id = auth.uid());

create policy "read_own_kakao_links"
on public.kakao_links
for select
using (user_id = auth.uid());

create policy "insert_own_kakao_links"
on public.kakao_links
for insert
with check (user_id = auth.uid());

create policy "update_own_kakao_links"
on public.kakao_links
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "delete_own_kakao_links"
on public.kakao_links
for delete
using (user_id = auth.uid());

comment on column public.profiles.role is 'user 또는 admin 역할';

