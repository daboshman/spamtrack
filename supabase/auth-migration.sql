-- ─── STEP 1: Add user_id column ─────────────────────────────────────────────
alter table cases
  add column if not exists user_id uuid references auth.users(id);

-- ─── STEP 2: Drop the old open policy ────────────────────────────────────────
drop policy if exists "allow_all" on cases;

-- ─── STEP 3: New RLS policies — authenticated user owns their rows ────────────
create policy "select_own"
  on cases for select
  using (auth.uid() = user_id);

create policy "insert_own"
  on cases for insert
  with check (auth.uid() = user_id);

create policy "update_own"
  on cases for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete_own"
  on cases for delete
  using (auth.uid() = user_id);

-- ─── STEP 4: Claim existing rows ─────────────────────────────────────────────
-- After running this migration, go to Supabase Dashboard →
-- Authentication → Users, copy your user UUID, then run:
--
--   UPDATE cases SET user_id = 'YOUR-USER-UUID-HERE' WHERE user_id IS NULL;
--
-- This assigns all pre-existing cases to your account.
