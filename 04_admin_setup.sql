-- ══════════════════════════════════════════════════════════════
--  QuizBlast — Admin Setup
--  Run this AFTER 03_triggers.sql
--  Ek baar karo — apna pehla admin user set karne ke liye
-- ══════════════════════════════════════════════════════════════


-- ── APNA ADMIN USER BANAO ─────────────────────────────────────
-- Step 1: Pehle game kholkar apna account banao (autoLogin ya signup)
-- Step 2: Supabase Dashboard → Authentication → Users → apna email/id dhundho
-- Step 3: Neeche wali query mein apna user_id paste karo


-- Option A — User ID se (recommended)
-- Yahan apna actual user UUID paste karo:
/*
UPDATE public.profiles
SET is_admin = TRUE
WHERE id = 'YOUR-USER-UUID-HERE';
*/


-- Option B — Username se (agar username pata hai)
/*
UPDATE public.profiles
SET is_admin = TRUE
WHERE username = 'YourUsername';
*/


-- ── VERIFY ADMIN ──────────────────────────────────────────────
-- Confirm karo ke admin set hua:
-- SELECT id, username, is_admin FROM public.profiles WHERE is_admin = TRUE;


-- ── ADMIN PERMISSIONS SUMMARY ─────────────────────────────────
-- is_admin = TRUE wala user ye kar sakta hai:
--   ✅ daily_challenge set/update/delete karna
--   ✅ custom_questions approve/delete karna
--   ✅ coin_gifts bhejni (sab players ke coins auto update honge)
--   ✅ Saare unapproved questions dekhna


-- ── OPTIONAL: SEED DAILY CHALLENGE ───────────────────────────
-- Test ke liye aaj ka challenge set karo (admin user ID chahiye)
/*
INSERT INTO public.daily_challenge (active_date, cls, subject, message, reward)
VALUES (
  CURRENT_DATE,
  6,
  'science',
  'Aaj ka challenge: Science Quiz! 🔬',
  200
)
ON CONFLICT (active_date) DO UPDATE
  SET cls = EXCLUDED.cls,
      subject = EXCLUDED.subject,
      message = EXCLUDED.message,
      reward  = EXCLUDED.reward;
*/


-- ── OPTIONAL: TEST COIN GIFT ──────────────────────────────────
-- Saare players ko coins do (trigger automatically apply karega)
-- SIRF admin user se chalao ya SQL editor se:
/*
INSERT INTO public.coin_gifts (gift_amount, message)
VALUES (50, 'Welcome bonus! QuizBlast khelo aur seekho 🎉');
*/
