-- ══════════════════════════════════════════════════════════════
--  QuizBlast — Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
--  Order: Run this file FIRST
-- ══════════════════════════════════════════════════════════════


-- ── 1. PROFILES ────────────────────────────────────────────────
-- Auto-created for every signed-up user via trigger (see 03_triggers.sql)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username          TEXT         NOT NULL DEFAULT 'Player',
  avatar            TEXT         NOT NULL DEFAULT '🐉',

  -- Currency & XP
  coins             INTEGER      NOT NULL DEFAULT 100,
  xp                INTEGER      NOT NULL DEFAULT 0,
  level             INTEGER      NOT NULL DEFAULT 1,
  total_xp          INTEGER      NOT NULL DEFAULT 0,

  -- Game stats
  total_games       INTEGER      NOT NULL DEFAULT 0,
  best_accuracy     INTEGER      NOT NULL DEFAULT 0,
  max_streak        INTEGER      NOT NULL DEFAULT 0,
  day_streak        INTEGER      NOT NULL DEFAULT 0,
  boss_wins         INTEGER      NOT NULL DEFAULT 0,
  pvp_wins          INTEGER      NOT NULL DEFAULT 0,
  pvp_losses        INTEGER      NOT NULL DEFAULT 0,

  -- Arrays & JSON
  unlocked_badges   TEXT[]       NOT NULL DEFAULT '{}',
  unlocked_avatars  TEXT[]       NOT NULL DEFAULT '{}',
  subject_stats     JSONB        NOT NULL DEFAULT '{}',
  weekly_scores     INTEGER[]    NOT NULL DEFAULT '{0,0,0,0,0,0,0}',
  study_dates       TEXT[]       NOT NULL DEFAULT '{}',

  -- Date tracking
  last_study_date   TEXT         NOT NULL DEFAULT '',
  daily_last_date   TEXT         NOT NULL DEFAULT '',

  -- Admin flag
  is_admin          BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Timestamps
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);


-- ── 2. LEADERBOARD ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT         NOT NULL DEFAULT 'Player',
  avatar      TEXT         NOT NULL DEFAULT '🐉',
  score       INTEGER      NOT NULL DEFAULT 0,
  accuracy    INTEGER      NOT NULL DEFAULT 0,
  subject     TEXT         NOT NULL DEFAULT 'gk',
  class       INTEGER      NOT NULL DEFAULT 6,
  mode        TEXT         NOT NULL DEFAULT 'freeplay',
  coins       INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_lb_score   ON public.leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_lb_subject ON public.leaderboard(subject);
CREATE INDEX IF NOT EXISTS idx_lb_user    ON public.leaderboard(user_id);


-- ── 3. DAILY CHALLENGE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_challenge (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  active_date DATE         NOT NULL UNIQUE,    -- Only one challenge per day
  cls         INTEGER      NOT NULL DEFAULT 6,
  subject     TEXT         NOT NULL DEFAULT 'gk',
  message     TEXT         NOT NULL DEFAULT '',
  reward      INTEGER      NOT NULL DEFAULT 200,
  set_by      UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_date ON public.daily_challenge(active_date DESC);


-- ── 4. CUSTOM QUESTIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_questions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cls         INTEGER      NOT NULL,
  subject     TEXT         NOT NULL,
  question    TEXT         NOT NULL,
  options     TEXT[]       NOT NULL,            -- Array of 4 options
  answer      INTEGER      NOT NULL DEFAULT 0,  -- Index of correct option (0-3)
  hint        TEXT         NOT NULL DEFAULT '',
  approved    BOOLEAN      NOT NULL DEFAULT FALSE,
  added_by    UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cq_cls_subject  ON public.custom_questions(cls, subject);
CREATE INDEX IF NOT EXISTS idx_cq_approved     ON public.custom_questions(approved);


-- ── 5. COIN GIFTS ──────────────────────────────────────────────
-- Admin broadcasts coin gifts to all players
CREATE TABLE IF NOT EXISTS public.coin_gifts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_amount  INTEGER      NOT NULL DEFAULT 0,
  message      TEXT         NOT NULL DEFAULT 'Admin ki taraf se tohfa!',
  gifted_by    UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  gifted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gifts_time ON public.coin_gifts(gifted_at DESC);
