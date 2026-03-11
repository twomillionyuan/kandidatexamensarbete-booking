create extension if not exists "pgcrypto";

create table if not exists public.time_slots (
  id uuid primary key default gen_random_uuid(),
  start_time timestamptz not null,
  end_time timestamptz not null,
  capacity integer not null check (capacity > 0),
  booked_count integer not null default 0 check (booked_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint time_slots_time_range check (end_time > start_time),
  constraint time_slots_booked_capacity check (booked_count <= capacity)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.time_slots (id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  email text not null,
  created_at timestamptz not null default now(),
  constraint unique_booking_per_email_per_slot unique (slot_id, email)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.handle_booking_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_row public.time_slots;
begin
  select *
  into slot_row
  from public.time_slots
  where id = new.slot_id
  for update;

  if slot_row.id is null then
    raise exception 'Selected slot does not exist';
  end if;

  if not slot_row.is_active then
    raise exception 'This slot is no longer available';
  end if;

  if slot_row.booked_count >= slot_row.capacity then
    raise exception 'This slot is already full';
  end if;

  update public.time_slots
  set booked_count = booked_count + 1
  where id = new.slot_id;

  return new;
end;
$$;

create or replace function public.handle_booking_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.time_slots
  set booked_count = greatest(booked_count - 1, 0)
  where id = old.slot_id;

  return old;
end;
$$;

drop trigger if exists trg_booking_before_insert on public.bookings;
create trigger trg_booking_before_insert
before insert on public.bookings
for each row
execute function public.handle_booking_before_insert();

drop trigger if exists trg_booking_before_delete on public.bookings;
create trigger trg_booking_before_delete
before delete on public.bookings
for each row
execute function public.handle_booking_before_delete();

alter table public.time_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.admin_users enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.time_slots to anon, authenticated;
grant insert on public.bookings to anon, authenticated;
grant select, insert, update on public.time_slots to authenticated;
grant select, delete on public.bookings to authenticated;
grant select on public.admin_users to authenticated;

drop policy if exists "public can read active slots" on public.time_slots;
create policy "public can read active slots"
on public.time_slots
for select
using (is_active = true);

drop policy if exists "admin can read all slots" on public.time_slots;
create policy "admin can read all slots"
on public.time_slots
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  )
);

drop policy if exists "admin can edit slots" on public.time_slots;
create policy "admin can edit slots"
on public.time_slots
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  )
);

drop policy if exists "anyone can create booking" on public.bookings;
create policy "anyone can create booking"
on public.bookings
for insert
with check (true);

drop policy if exists "admin can read bookings" on public.bookings;
create policy "admin can read bookings"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  )
);

drop policy if exists "admin can delete bookings" on public.bookings;
create policy "admin can delete bookings"
on public.bookings
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  )
);

drop policy if exists "admins can read own admin mapping" on public.admin_users;
create policy "admins can read own admin mapping"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);
