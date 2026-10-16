-- Waypack no longer creates rows for every sign-up in the shared project: auth.users is one pool for
-- every HEJI app, so the trigger gave every Wee Hours user a Waypack profile and entitlement.
-- Nothing needs those rows to exist: a missing entitlement reads as the free plan (planFor), Stripe
-- upserts one on first purchase, and profiles has no readers. Existing rows stay.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
