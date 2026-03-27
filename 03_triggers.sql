-- ══════════════════════════════════════════════════════════════
--  QuizBlast — Triggers & Functions
--  Run this AFTER 02_rls_policies.sql
-- ══════════════════════════════════════════════════════════════


-- ── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────────
-- Jab bhi koi new user sign up kare, automatically unka profile
-- table mein entry ban jaye

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- Runs as DB owner, bypasses RLS
SET search_path = public
AS $$
DECLARE
  _username TEXT;
BEGIN
  -- raw_user_meta_data se username nikalo (signUp options.data se aata hai)
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'Player' || floor(random() * 9000 + 1000)::TEXT
  );

  INSERT INTO public.profiles (id, username, avatar, coins)
  VALUES (
    NEW.id,
    _username,
    '🐉',
    100
  )
  ON CONFLICT (id) DO NOTHING;   -- Already exists toh skip

  RETURN NEW;
END;
$$;

-- Trigger: auth.users mein new row aate hi fire ho
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ── AUTO-UPDATE updated_at TIMESTAMP ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ── COIN GIFT — AUTO APPLY TO ALL PROFILES ────────────────────
-- Jab admin coin_gifts mein insert kare, sab players ke coins
-- automatically update ho jayein

CREATE OR REPLACE FUNCTION public.apply_coin_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Saare profiles ke coins mein gift_amount add karo
  UPDATE public.profiles
  SET
    coins      = coins + NEW.gift_amount,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_coin_gift_insert ON public.coin_gifts;
CREATE TRIGGER on_coin_gift_insert
  AFTER INSERT ON public.coin_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_coin_gift();


-- ── LEADERBOARD — AUTO SYNC USERNAME/AVATAR ───────────────────
-- Profile update hone par leaderboard entries bhi sync ho jayein

CREATE OR REPLACE FUNCTION public.sync_leaderboard_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Username ya avatar change hua toh leaderboard update karo
  IF OLD.username IS DISTINCT FROM NEW.username
     OR OLD.avatar IS DISTINCT FROM NEW.avatar THEN
    UPDATE public.leaderboard
    SET
      username = NEW.username,
      avatar   = NEW.avatar
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_leaderboard ON public.profiles;
CREATE TRIGGER profiles_sync_leaderboard
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_leaderboard_profile();
