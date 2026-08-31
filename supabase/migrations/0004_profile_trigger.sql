-- Auto-provisions a `profiles` row (default role VIEWER) whenever a new
-- user signs up via Supabase Auth. Without this, getCurrentUser() falls
-- back to an in-memory VIEWER profile instead of a real row — harmless,
-- but it means nobody can ever reach ADMIN without this trigger (or a
-- manual insert).

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'VIEWER')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
