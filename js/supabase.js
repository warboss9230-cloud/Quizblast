/* ============================================================
   QuizBlast – Supabase Integration  (v3 — with Security)
   ============================================================ */

const SUPA_URL  = "https://uyudyvdlfufdjjbbvtcj.supabase.co";
const SUPA_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5dWR5dmRsZnVmZGpqYmJ2dGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MzU1MjcsImV4cCI6MjA5MTIxMTUyN30.XjdrNzsg2pYrPudpAtrQ-MeOgA8ldt5X3Wj_RhgyfyI";

const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

/* ============================================================
   SECURITY — Rate Limiting + Input Sanitization + Encryption
   ============================================================ */
const Security = {
  _attempts: {}, // { key: { count, firstTime } }

  // ── Rate Limiter ──────────────────────────────────────────
  // maxAttempts attempts allowed per windowMs milliseconds
  rateLimit(key, maxAttempts = 5, windowMs = 60000) {
    const now = Date.now();
    if (!this._attempts[key]) {
      this._attempts[key] = { count: 1, firstTime: now };
      return true;
    }
    const entry = this._attempts[key];
    if (now - entry.firstTime > windowMs) {
      // Window expired — reset
      this._attempts[key] = { count: 1, firstTime: now };
      return true;
    }
    if (entry.count >= maxAttempts) {
      const waitSecs = Math.ceil((windowMs - (now - entry.firstTime)) / 1000);
      throw new Error(`Too many attempts. Please wait ${waitSecs} seconds.`);
    }
    entry.count++;
    return true;
  },

  // ── SQL Injection & XSS Protection ───────────────────────
  sanitize(input) {
    if (typeof input !== "string") return input;
    return input
      .replace(/[<>]/g, "")           // XSS: remove angle brackets
      .replace(/['";\\]/g, "")        // SQL: remove quotes and backslash
      .replace(/--/g, "")             // SQL: remove comment operator
      .replace(/\/\*/g, "")           // SQL: remove block comment start
      .replace(/\*\//g, "")           // SQL: remove block comment end
      .trim();
  },

  // Sanitize an object's string fields
  sanitizeObj(obj) {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = typeof v === "string" ? this.sanitize(v) : v;
    }
    return clean;
  },

  // ── Data Encryption (Base64 — lightweight obfuscation) ───
  encrypt(text) {
    if (!text) return text;
    try {
      return btoa(unescape(encodeURIComponent(String(text))));
    } catch(e) {
      return text;
    }
  },

  decrypt(encoded) {
    if (!encoded) return encoded;
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch(e) {
      return encoded; // Return as-is if not encrypted
    }
  },

  // ── Console Protection ────────────────────────────────────
  lockConsole() {
    if (typeof window === "undefined") return;
    const noop = () => {};
    ["log","warn","info","debug","table","dir"].forEach(m => {
      try { console[m] = noop; } catch(e) {}
    });
    // Detect DevTools open
    let devToolsOpen = false;
    setInterval(() => {
      const before = Date.now();
      // eslint-disable-next-line no-debugger
      debugger;
      if (Date.now() - before > 100 && !devToolsOpen) {
        devToolsOpen = true;
        document.body.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;
            height:100vh;background:#0f172a;color:#fff;flex-direction:column;font-family:sans-serif">
            <h1 style="font-size:2rem">🔒 Access Denied</h1>
            <p style="color:#94a3b8">Developer tools are not allowed.</p>
          </div>`;
      }
    }, 1000);
  },
};

/* ============================================================
   AUTH
   ============================================================ */
const Auth = {
  _currentUser: null,
  _tab: "login",

  switchTab(tab) {
    this._tab = tab;
    document.getElementById("auth-login-form").style.display  = tab === "login"  ? "block" : "none";
    document.getElementById("auth-signup-form").style.display = tab === "signup" ? "block" : "none";
    document.getElementById("auth-tab-login").classList.toggle("active",  tab === "login");
    document.getElementById("auth-tab-signup").classList.toggle("active", tab === "signup");
    this._clearErrors();
  },

  async login() {
    const email    = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    if (!email || !password) { this._err("login", "Fill in all fields."); return; }

    // Rate limit: max 5 login attempts per minute
    try {
      Security.rateLimit("login_" + email, 5, 60000);
    } catch(e) {
      this._err("login", e.message); return;
    }

    this._setLoading("login", true);
    try {
      const { data, error } = await supa.auth.signInWithPassword({ email, password });
      if (error) throw error;
      this._currentUser = data.user;
      await this._onLoggedIn(data.user);
    } catch(e) {
      this._err("login", e.message);
    } finally {
      this._setLoading("login", false);
    }
  },

  async signup() {
    let username = document.getElementById("auth-signup-username").value.trim();
    const email    = document.getElementById("auth-signup-email").value.trim();
    const password = document.getElementById("auth-signup-password").value;

    // Sanitize inputs
    username = Security.sanitize(username);

    if (username.length < 3) { this._err("signup", "Username must be at least 3 characters."); return; }
    if (!email)               { this._err("signup", "Enter a valid email."); return; }
    if (password.length < 6)  { this._err("signup", "Password must be at least 6 characters."); return; }

    // Rate limit: max 3 signups per 5 minutes
    try {
      Security.rateLimit("signup_" + email, 3, 300000);
    } catch(e) {
      this._err("signup", e.message); return;
    }

    // Check username uniqueness
    const { data: existing } = await supa.from("profiles").select("username").eq("username", username).single();
    if (existing) { this._err("signup", "Username already taken. Try another."); return; }

    this._setLoading("signup", true);
    try {
      const { data, error } = await supa.auth.signUp({ email, password });
      if (error) throw error;

      // Create profile
      const friendCode = username.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4).padEnd(4,"X")
        + Math.floor(1000 + Math.random() * 9000);

      // Encrypt email before storing
      const encryptedEmail = Security.encrypt(email);

      await supa.from("profiles").insert({
        auth_id:     data.user.id,
        username,
        email:       encryptedEmail,
        friend_code: friendCode,
        avatar:      "🤖",
        xp: 0, coins: 0, level: 1, streak: 0,
      });

      this._currentUser = data.user;
      if (typeof App !== "undefined") {
        App.state.username    = username;
        App.state.friendCode  = friendCode;
        App.save();
      }
      await this._onLoggedIn(data.user, username);
    } catch(e) {
      this._err("signup", e.message);
    } finally {
      this._setLoading("signup", false);
    }
  },

  async continueAsGuest() {
    document.getElementById("auth-modal").style.display = "none";
    if (typeof Visitors !== "undefined") Visitors.track();
    if (typeof App !== "undefined" && App.state.username === "Player") {
      document.getElementById("welcome-modal").style.display = "flex";
    }
  },

  async _onLoggedIn(user, usernameOverride) {
    const { data: profile } = await supa
      .from("profiles")
      .select("*")
      .eq("auth_id", user.id)
      .single();

    if (profile && typeof App !== "undefined") {
      App.state.username    = usernameOverride || profile.username;
      App.state.avatar      = profile.avatar      || App.state.avatar;
      App.state.xp          = profile.xp    || 0;
      App.state.coins       = profile.coins  || 0;
      App.state.level       = profile.level  || 1;
      App.state.streak      = profile.streak || 0;
      App.state.friendCode  = profile.friend_code || App.state.friendCode;
      App.state.authId      = user.id;
      App.save();
    }

    document.getElementById("auth-modal").style.display = "none";

    if (typeof HomeScreen !== "undefined") HomeScreen.refresh();
    if (typeof Visitors !== "undefined")   Visitors.track();

    setTimeout(() => {
      if (typeof SupaLeaderboard !== "undefined") SupaLeaderboard.push(App.state);
    }, 500);

    setTimeout(() => {
      if (typeof GiftNotifier !== "undefined") GiftNotifier.check();
    }, 1500);
  },

  async logout() {
    await supa.auth.signOut();
    this._currentUser = null;
    if (typeof App !== "undefined") {
      App.state.authId = null;
      App.save();
    }
    document.getElementById("auth-modal").style.display = "flex";
  },

  async checkSession() {
    const { data: { session } } = await supa.auth.getSession();
    if (session?.user) {
      this._currentUser = session.user;
      await this._onLoggedIn(session.user);
      return true;
    }
    return false;
  },

  isLoggedIn() {
    return !!this._currentUser;
  },

  _err(form, msg) {
    const id = form === "login" ? "auth-error" : "auth-signup-error";
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = "⚠️ " + msg;
    el.style.display = "block";
  },

  _clearErrors() {
    ["auth-error","auth-signup-error"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  },

  _setLoading(form, loading) {
    const btns = document.querySelectorAll(`#auth-${form}-form .btn-primary`);
    btns.forEach(b => {
      b.disabled = loading;
      b.textContent = loading ? "⏳ Please wait..." : (form === "login" ? "🚀 Login" : "🎮 Create Account");
    });
  },
};

/* ============================================================
   VISITORS
   ============================================================ */
const Visitors = {
  _realtimeChannel: null,

  async track() {
    const sessionKey = "qb_visited";
    this.startRealtime();
    if (sessionStorage.getItem(sessionKey)) {
      this.display(); return;
    }
    // Rate limit visitor tracking: max 10 per minute per session
    try {
      Security.rateLimit("visitor_track", 10, 60000);
    } catch(e) {
      this.display(); return;
    }
    try {
      const { data, error } = await supa.rpc("increment_visitors");
      if (error) throw error;
      sessionStorage.setItem(sessionKey, "1");
      this._update(data);
    } catch(e) {
      this.display();
    }
  },

  async display() {
    try {
      const { data } = await supa.from("visitors").select("count").single();
      this._update(data?.count || 0);
    } catch(e) {
      this._update("—");
    }
  },

  startRealtime() {
    if (this._realtimeChannel) return;
    this._realtimeChannel = supa
      .channel("visitors-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "visitors",
      }, () => {
        this.display();
        this._refreshAdminVisitors();
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "profiles",
      }, () => {
        this._refreshAdminVisitors();
      })
      .subscribe();
  },

  _refreshAdminVisitors() {
    this.display();
    if (typeof Admin !== "undefined") Admin.loadStats();
    const vc = document.getElementById("admin-visitor-count");
    if (vc) {
      supa.from("visitors").select("count").single().then(({ data }) => {
        if (data?.count !== undefined) vc.textContent = Number(data.count).toLocaleString();
      });
    }
  },

  _update(count) {
    const el = document.getElementById("visitor-count");
    if (!el) return;
    if (typeof count === "number") {
      this._animateCount(el, count);
    } else {
      el.textContent = count;
    }
    const vc = document.getElementById("admin-visitor-count");
    if (vc && typeof count === "number") vc.textContent = count.toLocaleString();
  },

  _animateCount(el, target) {
    const duration = 800, start = Date.now();
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(target * ease).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  },
};

/* ============================================================
   PROFILES
   ============================================================ */
const SupaProfile = {
  async save(state) {
    if (!state?.username || state.username === "Player") return;
    const authId = state.authId;
    if (!authId) return;
    try {
      // Sanitize all string fields before saving
      const payload = Security.sanitizeObj({
        auth_id:        authId,
        username:       state.username,
        avatar:         state.avatar        || "🤖",
        xp:             state.xp            || 0,
        coins:          state.coins         || 0,
        level:          state.level         || 1,
        streak:         state.streak        || 0,
        best_streak:    state.bestStreak    || 0,
        quizzes_played: state.quizzesPlayed || 0,
        total_correct:  state.totalCorrect  || 0,
        last_played:    state.lastPlayed    || null,
        friend_code:    state.friendCode    || null,
      });
      const { error } = await supa
        .from("profiles")
        .upsert(payload, { onConflict: "auth_id" });
      if (error) throw error;
    } catch(e) {
      // Silent fail — no console in production
    }
  },
};

/* ============================================================
   LEADERBOARD
   ============================================================ */
const SupaLeaderboard = {
  async push(state) {
    if (!state?.username || state.username === "Player") return;
    const authId = state.authId || state.username;

    // Rate limit leaderboard pushes: max 10 per minute
    try {
      Security.rateLimit("lb_push_" + authId, 10, 60000);
    } catch(e) {
      return;
    }

    try {
      const weeklyXP = Object.entries(state.xpHistory || {})
        .filter(([d]) => (new Date() - new Date(d)) <= 7 * 86400000)
        .reduce((sum, [, v]) => sum + v, 0);

      const payload = Security.sanitizeObj({
        auth_id:     authId,
        username:    state.username,
        avatar:      state.avatar || "🤖",
        xp:          state.xp    || 0,
        weekly_xp:   weeklyXP,
        level:       state.level  || 1,
        streak:      state.streak || 0,
        last_played: new Date().toISOString(),
      });

      const { error } = await supa.from("leaderboard").upsert(payload, { onConflict: "auth_id" });
      if (error) throw error;
    } catch(e) {
      // Silent fail
    }
  },

  async fetch(type = "global") {
    try {
      const orderCol = type === "weekly" ? "weekly_xp" : "xp";
      const { data, error } = await supa
        .from("leaderboard")
        .select("username, avatar, xp, weekly_xp, level, streak, last_played")
        .order(orderCol, { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    } catch(e) {
      return [];
    }
  },
};

/* ============================================================
   FRIENDS
   ============================================================ */
const SupaFriends = {
  async findByCode(code) {
    // Sanitize friend code input
    const cleanCode = Security.sanitize(code);
    try {
      const { data } = await supa
        .from("profiles")
        .select("username, avatar, xp, level, streak, friend_code")
        .eq("friend_code", cleanCode)
        .single();
      return data || null;
    } catch(e) {
      return null;
    }
  },
};

/* ============================================================
   COIN GIFTS
   ============================================================ */
const SupaGifts = {
  async check(username) {
    try {
      const { data } = await supa
        .from("coin_gifts")
        .select("*")
        .eq("to_username", username)
        .eq("claimed", false);
      return data || [];
    } catch(e) {
      return [];
    }
  },

  async claim(giftId) {
    try {
      const { error } = await supa.from("coin_gifts").update({ claimed: true }).eq("id", giftId);
      return !error;
    } catch(e) {
      return false;
    }
  },

  async send(toUsername, amount, message = "") {
    // Sanitize inputs
    const cleanUsername = Security.sanitize(toUsername);
    const cleanMessage  = Security.sanitize(message);

    // Rate limit gift sending: max 5 per minute
    try {
      Security.rateLimit("gift_send", 5, 60000);
    } catch(e) {
      return false;
    }

    try {
      const { error } = await supa.from("coin_gifts")
        .insert({ to_username: cleanUsername, amount, message: cleanMessage });
      return !error;
    } catch(e) {
      return false;
    }
  },
};

/* ============================================================
   DAILY CHALLENGE
   ============================================================ */
const SupaDaily = {
  async get() {
    const today = new Date().toISOString().split("T")[0];
    try {
      const { data } = await supa
        .from("daily_challenge")
        .select("question_ids")
        .eq("challenge_date", today)
        .single();
      return data?.question_ids || null;
    } catch(e) {
      return null;
    }
  },
};

/* ============================================================
   ANTI-CHEAT — Score validation
   ============================================================ */
const AntiCheat = {
  validate(score, total, timeSeconds, xpEarned) {
    if (score > total || score < 0)  return false;
    if (xpEarned > 500)              return false;
    if (timeSeconds < total * 3)     return false;
    return true;
  },

  async validateServer(score, total, timeSeconds, xpEarned) {
    // Rate limit score submissions: max 20 per minute
    try {
      Security.rateLimit("score_submit", 20, 60000);
    } catch(e) {
      return false;
    }
    try {
      const { data } = await supa.rpc("validate_score", {
        p_score:        score,
        p_total:        total,
        p_time_seconds: timeSeconds,
        p_xp_earned:    xpEarned,
      });
      return data === true;
    } catch(e) {
      return this.validate(score, total, timeSeconds, xpEarned);
    }
  },
};

/* ============================================================
   AUTO-INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  // Enable console protection in production
  if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    Security.lockConsole();
  }

  // Check existing session first
  const hasSession = await Auth.checkSession();
  if (!hasSession) {
    document.getElementById("auth-modal").style.display = "flex";
  }
  // Track visitor
  Visitors.track();
});
