alter table public.nk_accounts add column email_user_id uuid unique references auth.users(id) on delete set null;
