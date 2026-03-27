-- ══════════════════════════════════════════════════════════════
--  QuizBlast — Row Level Security (RLS) Policies
--  Run this AFTER 01_schema.sql
-- ══════════════════════════════════════════════════════════════


-- ── PROFILES ──────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read all profiles (for leaderboard username/avatar)
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only update their OWN profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger handles INSERT (no manual insert needed from client)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ── LEADERBOARD ───────────────────────────────────────────────
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Anyone can read leaderboard
CREATE POLICY "lb_select_all"
  ON public.leaderboard FOR SELECT
  USING (true);

-- Logged-in users can insert their own scores
CREATE POLICY "lb_insert_own"
  ON public.leaderboard FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own scores
CREATE POLICY "lb_update_own"
  ON public.leaderboard FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own entries (optional, for score reset)
CREATE POLICY "lb_delete_own"
  ON public.leaderboard FOR DELETE
  USING (auth.uid() = user_id);


-- ── DAILY CHALLENGE ───────────────────────────────────────────
ALTER TABLE public.daily_challenge ENABLE ROW LEVEL SECURITY;

-- Everyone can read today's challenge
CREATE POLICY "daily_select_all"
  ON public.daily_challenge FOR SELECT
  USING (true);

-- Only admins can insert/update/delete challenges
CREATE POLICY "daily_insert_admin"
  ON public.daily_challenge FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "daily_update_admin"
  ON public.daily_challenge FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "daily_delete_admin"
  ON public.daily_challenge FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );


-- ── CUSTOM QUESTIONS ──────────────────────────────────────────
ALTER TABLE public.custom_questions ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved questions
CREATE POLICY "cq_select_approved"
  ON public.custom_questions FOR SELECT
  USING (approved = TRUE);

-- Logged-in users can submit questions (pending approval)
CREATE POLICY "cq_insert_loggedin"
  ON public.custom_questions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins can approve/update/delete
CREATE POLICY "cq_update_admin"
  ON public.custom_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "cq_delete_admin"
  ON public.custom_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can also see unapproved questions
CREATE POLICY "cq_select_admin_all"
  ON public.custom_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );


-- ── COIN GIFTS ────────────────────────────────────────────────
ALTER TABLE public.coin_gifts ENABLE ROW LEVEL SECURITY;

-- All logged-in users can read gifts (for notifications)
CREATE POLICY "gifts_select_loggedin"
  ON public.coin_gifts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can create gifts
CREATE POLICY "gifts_insert_admin"
  ON public.coin_gifts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
