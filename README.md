# QuizBlast — Supabase Setup Guide 🚀

## Folder Structure (Ye files Supabase ke liye hain)

```
QuizBlast-Supabase-Setup/
│
├── 01_schema.sql          ← Tables banao (PEHLE RUN KARO)
├── 02_rls_policies.sql    ← Security policies (DOOSRA)
├── 03_triggers.sql        ← Auto-functions (TEESRA)
├── 04_admin_setup.sql     ← Admin user banao (CHAUTHA)
│
├── js/
│   └── supabase.js        ← Game mein use hone wali file
│
└── README.md              ← Ye file
```

---

## Step-by-Step Setup

### Step 1 — Supabase Project Banao

1. https://supabase.com pe jao
2. "Start your project" → New project banao
3. **Project name**: QuizBlast (ya kuch bhi)
4. **Database password**: strong password rakho (yaad rakhna)
5. **Region**: ap-south-1 (Mumbai) — India ke liye best
6. Create project → ~2 minute wait karo

---

### Step 2 — SQL Files Run Karo

Supabase Dashboard mein:
**Left sidebar → SQL Editor → New Query**

**Order ZAROORI hai — ek ek karke chalao:**

#### 2a. Tables banao
`01_schema.sql` ka pura content copy karo → Paste karo → **Run**
✅ "Success" message aana chahiye

#### 2b. Security policies lagao
`02_rls_policies.sql` ka pura content copy karo → Paste karo → **Run**
✅ "Success" message aana chahiye

#### 2c. Triggers set karo
`03_triggers.sql` ka pura content copy karo → Paste karo → **Run**
✅ "Success" message aana chahiye

---

### Step 3 — API Keys Copy Karo

Supabase Dashboard mein:
**Left sidebar → Settings → API**

Yahan milega:
- **Project URL** → `https://xxxxx.supabase.co`
- **anon / public key** → `eyJhbGci...` (lamba string)

---

### Step 4 — supabase.js Update Karo

`js/supabase.js` file kholo (is folder wali):

```javascript
// YAHAN APNI VALUES DAALO:
const SUPABASE_URL      = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY-HERE';
```

In dono lines ko apni actual values se replace karo.

Phir is updated `js/supabase.js` ko apne **original QuizBlast project** ke `js/` folder mein copy karo (purani file replace karo).

---

### Step 5 — Admin User Banao

1. Pehle game kholo aur ek account banao (sign up karo)
2. Supabase Dashboard → **Authentication → Users**
3. Apna user dhundho → UUID copy karo
4. SQL Editor mein jao, `04_admin_setup.sql` se ye part uncomment karke chalao:

```sql
UPDATE public.profiles
SET is_admin = TRUE
WHERE id = 'APNA-UUID-YAHAN-PASTE-KARO';
```

---

### Step 6 — Supabase Auth Settings

Supabase Dashboard → **Authentication → Settings**:

- **Email confirmations**: OFF karo (game mein fake email use hoti hai)
- **Minimum password length**: 6
- **Site URL**: Apni website ka URL daalo (deploy ke baad)

---

## Tables Ka Summary

| Table | Kaam |
|-------|------|
| `profiles` | Har player ka data (coins, XP, level, stats) |
| `leaderboard` | Global high scores |
| `daily_challenge` | Admin ka daily quiz challenge |
| `custom_questions` | Admin/users ke custom questions |
| `coin_gifts` | Admin sab players ko coins bhej sakta hai |

---

## Kuch Important Baatein

- **Email confirmation OFF rakho** — game fake emails use karta hai sign up ke liye
- **Coin gift bhejne par** — trigger automatically sab players ke coins update kar deta hai
- **Leaderboard** — har player ka har subject mein sirf best score store hota hai
- **is_admin = TRUE** wala user hi daily challenge set kar sakta hai aur questions approve kar sakta hai

---

## Kuch Kaam Na Kare Toh?

**"Supabase not configured" dikhe:**
→ `js/supabase.js` mein URL aur KEY check karo

**Profile create na ho:**
→ Triggers dobara run karo (03_triggers.sql)

**Admin features kaam na karein:**
→ 04_admin_setup.sql se `is_admin = TRUE` set karo

**CORS error aaye:**
→ Supabase → Settings → API → Allowed URLs mein apna domain add karo
