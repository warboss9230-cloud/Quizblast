"use strict";
/* ============================================================
   QuizBlast v3 – js/script.js
   Fixes: locked-avatar visible · settings screen · bell 50%
          mobile back-button · 10 subjects · theme in settings
   ============================================================ */

/* ============================================================
   STORAGE
   ============================================================ */
const Store = {
  KEY: "quizblast_v3",
  defaults() {
    return {
      username:"Player", avatar:"🤖", xp:0, coins:150, nameSet:false,
      level:1, streak:0, bestStreak:0, lastPlayed:null,
      quizzesPlayed:0, totalCorrect:0, bossBeaten:0,
      hasPerfect:false, speedBadge:false,
      reviewDone:0, challengesDone:0,
      suddenSurvived:0, shopBought:0,
      unlockedAvatars:[0,1,2,3,4],
      unlockedThemes:["cyber"],
      activeTheme:"cyber",
      soundEnabled:true,
      powerups:{ fifty:1, time:1, skip:1, shield:1 },
      achievements:[],
      wrongQuestions:[],
      quizHistory:[],
      xpHistory:{},
      customQuestions:[],
      dailyQuests:null,
      dailyQuestDate:null,
      dailyQuestProgress:{},
      challengeHistory:[],
      bookmarks:[],
      friends:[],
      friendCode:null,
      hapticEnabled:true,
      lightMode:false,
      authId:null,
    };
  },
  load() {
    try {
      const r = localStorage.getItem(this.KEY);
      return r ? { ...this.defaults(), ...JSON.parse(r) } : this.defaults();
    } catch { return this.defaults(); }
  },
  save(d) { try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch {} },
  reset()  { localStorage.removeItem(this.KEY); return this.defaults(); },
};

/* ============================================================
   SOUND ENGINE
   ============================================================ */
const Sound = (() => {
  let ctx = null;
  const init = () => {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  };
  const beep = (freq, type, dur, gain = 0.3) => {
    if (!App?.state?.soundEnabled) return;
    if (!ctx) init(); if (!ctx) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch {}
  };
  const chord = (freqs, type = "sine", dur = 0.15) =>
    freqs.forEach((f, i) => setTimeout(() => beep(f, type, dur), i * 30));
  return {
    click:   () => beep(440, "square", 0.05, 0.12),
    correct: () => chord([523, 659, 784], "sine", 0.18),
    wrong:   () => chord([200, 180], "sawtooth", 0.25),
    timer:   () => beep(880, "square", 0.06, 0.08),
    levelup: () => chord([523, 659, 784, 1047], "sine", 0.3),
    boss:    () => chord([150, 200, 160], "sawtooth", 0.4),
    start:   () => chord([440, 550, 660], "triangle", 0.2),
    shop:    () => chord([660, 880], "sine", 0.2),
    achieve: () => chord([523, 784, 1047], "sine", 0.25),
    init,
  };
})();

/* ============================================================
   CONFETTI
   ============================================================ */
const Confetti = {
  canvas: null, ctx: null, particles: [], running: false,
  init() {
    this.canvas = document.getElementById("confetti-canvas");
    this.ctx    = this.canvas.getContext("2d");
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },
  burst() {
    if (!this.canvas) this.init();
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.particles = [];
    const colors = ["#00f5c4","#ffe600","#ff3366","#00b4ff","#7c3aed","#ff7a00"];
    for (let i = 0; i < 120; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width, y: -10,
        vx: (Math.random() - 0.5) * 6, vy: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 3,
        rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 10,
        life: 1,
      });
    }
    if (!this.running) { this.running = true; this.draw(); }
    setTimeout(() => {
      this.running = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }, 3000);
  },
  draw() {
    if (!this.running) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed; p.vy += 0.1; p.life -= 0.008;
      if (p.y > this.canvas.height) p.y = -10;
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.fillStyle   = p.color;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation * Math.PI / 180);
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      this.ctx.restore();
    });
    this.particles = this.particles.filter(p => p.life > 0);
    if (this.particles.length > 0) requestAnimationFrame(() => this.draw());
    else { this.running = false; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  },
};

/* ============================================================
   THEME SWITCHER
   ============================================================ */
const ThemeSwitcher = {
  apply(themeId) {
    const th = THEMES.find(t => t.id === themeId);
    if (!th) return;
    document.body.setAttribute("data-theme", themeId);
    document.documentElement.style.setProperty("--c-neon",  th.neon);
    document.documentElement.style.setProperty("--c-neon2", th.neon2);
    document.documentElement.style.setProperty("--c-bg",    th.bg);
    if (App.state) { App.state.activeTheme = themeId; App.save(); }
    if (document.getElementById("screen-settings")?.classList.contains("active")) {
      Settings.render();
    }
  },
  preview(themeId) {
    const th = THEMES.find(t => t.id === themeId);
    if (!th) return;
    document.documentElement.style.setProperty("--c-neon",  th.neon);
    document.documentElement.style.setProperty("--c-neon2", th.neon2);
  },
  cancelPreview() {
    const active = App.state?.activeTheme || "cyber";
    const th = THEMES.find(t => t.id === active);
    if (th) {
      document.documentElement.style.setProperty("--c-neon",  th.neon);
      document.documentElement.style.setProperty("--c-neon2", th.neon2);
    }
  },
  load() { this.apply(App.state.activeTheme || "cyber"); },
};

/* ============================================================
   APP – Navigation & helpers
   ============================================================ */
const App = {
  state: null,
  currentMode: "classic",
  currentDiff: "easy",

  init() {
    this.state = Store.load();
    this.checkStreak();
    DailyQuests.refresh();
    ThemeSwitcher.load();
    Settings.applyLight(this.state.lightMode);
    this.spawnParticles();
    history.replaceState({ screen: "home" }, "", "#home");
    this._activateScreen("home");
    Admin.populateCategorySelects();
    document.body.addEventListener("click", () => Sound.init(), { once: true });

    // Mobile back button
    window.addEventListener("popstate", e => {
      const screen = e.state?.screen || "home";
      if (document.getElementById("screen-quiz")?.classList.contains("active")) {
        history.pushState({ screen: "quiz" }, "", "#quiz");
        App.confirmExit();
      } else {
        this._activateScreen(screen);
      }
    });

    // Challenge auto-join
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("ch")) Challenge.autoJoin(urlParams.get("ch"));

    // Auth handles new user setup — only show WelcomeSetup for guests
    // supabase.js DOMContentLoaded handles auth modal display
  },

  /* Core nav – updates browser history */
  nav(screen) {
    Sound.click();
    history.pushState({ screen }, "", `#${screen}`);
    this._activateScreen(screen);
  },

  /* Activate screen without touching history (used by popstate) */
  _activateScreen(screen) {
    const next = document.getElementById(`screen-${screen}`);
    if (!next) return;

    // Remove active + any stale animation classes from ALL screens first
    document.querySelectorAll(".screen").forEach(s => {
      s.classList.remove("active", "slide-in-left", "slide-in-right", "slide-out-left", "slide-out-right");
    });

    // Activate the target screen with slide-in animation
    const homeScreens = ["home"];
    const goingHome = homeScreens.includes(screen);
    next.classList.add("active", goingHome ? "slide-in-left" : "slide-in-right");
    next.addEventListener("animationend", () => {
      next.classList.remove("slide-in-left", "slide-in-right");
    }, { once: true });

    // Scroll to top
    next.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    switch (screen) {
      case "home":        HomeScreen.refresh();  break;
      case "leaderboard": LB.show("global");     break;
      case "profile":     Profile.refresh();     break;
      case "shop":        Shop.tab("powerups");  break;
      case "stats":       Stats.render();        break;
      case "quests":      DailyQuests.render();  break;
      case "challenge":   PvP.renderLobby();     break;
      case "pvp-wait":    /* handled by PvP */   break;
      case "pvp-result":  /* handled by PvP */   break;
      case "review":      ReviewMode.render();   break;
      case "bookmarks":   Bookmark.render();     break;
      case "settings":    Settings.render();     break;
    }
  },

  startQuiz(catId) {
    try { Sound.start(); } catch(e) {}
    // Small timeout ensures any modal close animation finishes first
    setTimeout(() => {
      Quiz.start(catId, this.currentMode, this.currentDiff);
    }, 50);
  },

  confirmExit()  { document.getElementById("exit-modal").style.display = "flex"; },
  exitToHome()   { clearInterval(Quiz.timerInterval); this.closeModal("exit-modal"); this.nav("home"); },
  closeModal(id = "exit-modal") { document.getElementById(id).style.display = "none"; },
  save() {
    Store.save(this.state);
    // Sync to Supabase in background (non-blocking)
    if (typeof SupaProfile !== "undefined") {
      SupaProfile.save(this.state);
    }
  },

  addXP(amt) {
    this.state.xp += amt;
    const today = new Date().toDateString();
    this.state.xpHistory = this.state.xpHistory || {};
    this.state.xpHistory[today] = (this.state.xpHistory[today] || 0) + amt;
    const nl     = this.calcLevel(this.state.xp);
    const leveled = nl > this.state.level;
    if (leveled) { this.state.level = nl; Sound.levelup(); Haptic.levelup(); }
    this.save();
    return leveled;
  },

  addCoins(amt) {
    this.state.coins = Math.max(0, this.state.coins + amt);
    this.save();
  },

  calcLevel(xp) {
    const L = [0,100,250,500,900,1400,2000,2800,3800,5000,7000];
    let lv = 1;
    for (let i = 0; i < L.length; i++) if (xp >= L[i]) lv = i + 1;
    return Math.min(lv, L.length);
  },

  levelProgress(xp, level) {
    const L = [0,100,250,500,900,1400,2000,2800,3800,5000,7000];
    const cur  = L[level - 1] || 0;
    const next = L[level]     || L[L.length - 1];
    return Math.min(((xp - cur) / (next - cur)) * 100, 100);
  },

  getTitle(level) {
    const T = ["Novice Blaster","Quiz Padawan","Knowledge Seeker","Brain Master",
               "Wisdom Guardian","Elite Scholar","Quiz Legend","Grandmaster","Quiz God","Omniscient","⚡ LEGEND ⚡"];
    return T[Math.min(level - 1, T.length - 1)];
  },

  checkStreak() {
    const today = new Date().toDateString();
    const last  = this.state.lastPlayed;
    if (last && last !== today) {
      const diff = (new Date(today) - new Date(last)) / 86400000;
      if (diff > 1) this.state.streak = 0;
    }
    this.save();
  },

  markPlayed(catId, score, total) {
    const today = new Date().toDateString();
    if (this.state.lastPlayed !== today) {
      this.state.streak = (this.state.streak || 0) + 1;
      if (this.state.streak > this.state.bestStreak) this.state.bestStreak = this.state.streak;
      this.state.lastPlayed = today;
    }
    this.state.quizzesPlayed = (this.state.quizzesPlayed || 0) + 1;
    this.state.quizHistory   = this.state.quizHistory || [];
    this.state.quizHistory.unshift({ cat: catId, score, total, date: today });
    if (this.state.quizHistory.length > 20) this.state.quizHistory.pop();
    this.save();
    DailyQuests.trackEvent("play", catId, score, total);
  },

  showXPToast(msg) {
    const el = document.getElementById("xp-toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  },

  flashAnswer(ok) {
    const el = document.getElementById("answer-flash");
    el.className = "answer-flash " + (ok ? "correct-flash" : "wrong-flash");
    setTimeout(() => { el.className = "answer-flash"; }, 600);
  },

  spawnParticles() {
    for (let i = 0; i < 10; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.left              = Math.random() * 100 + "vw";
      p.style.animationDuration = (6 + Math.random() * 10) + "s";
      p.style.animationDelay   = (Math.random() * 8) + "s";
      p.style.opacity           = (0.15 + Math.random() * 0.3).toString();
      document.body.appendChild(p);
    }
  },
};

/* ============================================================
   HOME SCREEN
   ============================================================ */
const HomeScreen = {
  refresh() {
    const s = App.state;
    document.getElementById("home-avatar").textContent   = s.avatar;
    document.getElementById("home-username").textContent = s.username;
    document.getElementById("home-xp").textContent       = s.xp;
    document.getElementById("home-coins").textContent    = s.coins;
    document.getElementById("home-streak").textContent   = s.streak;
    document.getElementById("home-level").textContent    = s.level;
    const pct = App.levelProgress(s.xp, s.level);
    document.getElementById("home-level-fill").style.width = Math.min(pct, 100) + "%";

    // Category grid
    const grid = document.getElementById("cat-grid");
    grid.innerHTML = "";
    CATEGORIES.forEach(cat => {
      const base   = (QUESTION_BANK[cat.id] || []).length;
      const custom = (s.customQuestions || []).filter(q => q.category === cat.id).length;
      const card   = document.createElement("div");
      card.className = "cat-card";
      card.style.setProperty("--cat-color", cat.color);
      card.innerHTML = `
        <div class="cat-emoji">${cat.emoji}</div>
        <div class="cat-name">${cat.name}</div>
        <div class="cat-count">${base + custom} Qs</div>`;
      card.onclick = () => App.startQuiz(cat.id);
      grid.appendChild(card);
    });

    DailyQuests.updateStrip();

    // Bookmark count
    const bmCount = document.getElementById("home-bookmark-count");
    if (bmCount) {
      const n = (s.bookmarks || []).length;
      bmCount.textContent = n + (n === 1 ? " saved question" : " saved questions");
    }
  },
};

/* ============================================================
   UI HELPERS
   ============================================================ */
const UI = {
  setMode(mode, el) {
    Sound.click();
    App.currentMode = mode;
    document.querySelectorAll(".mode-pill").forEach(p => p.classList.remove("active"));
    el.classList.add("active");
    if (mode === "challenge") { App.nav("challenge"); return; }
    if (mode === "review")    { App.nav("review");    return; }
  },
  setDiff(diff, el) {
    Sound.click();
    App.currentDiff = diff;
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
    el.classList.add("active");
  },
};

/* ============================================================
   SETTINGS SCREEN
   ============================================================ */
const Settings = {
  render() {
    const s    = App.state;
    const wrap = document.getElementById("settings-wrap");
    if (!wrap) return;

    const lvlPct = Math.round(App.levelProgress(s.xp, s.level));

    wrap.innerHTML = `
      <!-- ── PLAYER PROFILE CARD ── -->
      <div class="settings-profile-card">
        <div class="spc-avatar" id="spc-avatar">${s.avatar}</div>
        <div class="spc-info">
          <div class="spc-name" id="spc-name">${s.username}</div>
          <div class="spc-title">${App.getTitle(s.level)}</div>
          <div class="spc-level-wrap">
            <span class="spc-lvl">LVL ${s.level}</span>
            <div class="spc-lvl-track"><div class="spc-lvl-fill" style="width:${lvlPct}%"></div></div>
            <span class="spc-xp">${s.xp} XP</span>
          </div>
        </div>
        <button class="spc-edit-btn" onclick="Profile.editName()">✏️</button>
      </div>

      <!-- ── MINI STATS ── -->
      <div class="settings-mini-stats">
        <div class="sms-item"><span class="sms-val">${s.coins}</span><span class="sms-lbl">🪙 Coins</span></div>
        <div class="sms-item"><span class="sms-val">${s.streak}</span><span class="sms-lbl">🔥 Streak</span></div>
        <div class="sms-item"><span class="sms-val">${s.totalCorrect||0}</span><span class="sms-lbl">✅ Correct</span></div>
        <div class="sms-item"><span class="sms-val">${s.quizzesPlayed||0}</span><span class="sms-lbl">🎮 Played</span></div>
      </div>

      <!-- ── AVATAR QUICK PICK ── -->
      <div class="settings-section">
        <div class="settings-section-title">👾 Avatar</div>
        <div class="settings-avatar-row" id="settings-avatar-row"></div>
      </div>

      <!-- ── THEME ── -->
      <div class="settings-section">
        <div class="settings-section-title">🎨 Theme</div>
        <div class="settings-theme-grid" id="settings-theme-grid"></div>
      </div>

      <!-- ── SOUND ── -->
      <div class="settings-section">
        <div class="settings-section-title">🔊 Sound</div>
        <div class="settings-row">
          <div class="settings-row-label"><span class="sr-icon">🔊</span><span>Sound Effects</span></div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-sound" ${s.soundEnabled !== false ? "checked" : ""}
              onchange="Settings.toggleSound(this)"/>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-row-label"><span class="sr-icon">📳</span><span>Haptic Feedback</span></div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-haptic" ${s.hapticEnabled !== false ? "checked" : ""}
              onchange="Settings.toggleHaptic(this)"/>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- ── DISPLAY ── -->
      <div class="settings-section">
        <div class="settings-section-title">🌓 Display</div>
        <div class="settings-row">
          <div class="settings-row-label"><span class="sr-icon">🌓</span><span>Light Mode</span></div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-light" ${s.lightMode ? "checked" : ""}
              onchange="Settings.toggleLight(this)"/>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- ── NAVIGATION ── -->
      <div class="settings-section">
        <div class="settings-section-title">🔗 Quick Links</div>
        <div class="settings-row tappable" onclick="App.nav('profile')">
          <div class="settings-row-label"><span class="sr-icon">👤</span><span>Full Profile & Badges</span></div>
          <span class="sr-arrow">›</span>
        </div>
        <div class="settings-row tappable" onclick="App.nav('stats')">
          <div class="settings-row-label"><span class="sr-icon">📊</span><span>Detailed Stats</span></div>
          <span class="sr-arrow">›</span>
        </div>
        <div class="settings-row tappable" onclick="App.nav('shop')">
          <div class="settings-row-label"><span class="sr-icon">🛒</span><span>Shop</span></div>
          <span class="sr-arrow">›</span>
        </div>
      </div>

      <!-- ── DANGER ── -->
      <div class="settings-section">
        <div class="settings-section-title">⚠️ Danger Zone</div>
        <div class="settings-row tappable" onclick="Auth.logout?.()">
          <div class="settings-row-label"><span class="sr-icon">🚪</span><span>Logout</span></div>
          <span class="sr-arrow" style="color:var(--c-yellow)">›</span>
        </div>
        <div class="settings-row tappable danger-row" onclick="Profile.reset()">
          <div class="settings-row-label"><span class="sr-icon">🗑️</span><span>Reset All Progress</span></div>
          <span class="sr-arrow" style="color:var(--c-red)">›</span>
        </div>
      </div>

      <!-- ── ABOUT ── -->
      <div class="settings-section">
        <div class="settings-section-title">ℹ️ About</div>
        <div class="settings-row">
          <div class="settings-row-label"><span class="sr-icon">📦</span><span>Version</span></div>
          <span class="sr-value">v3.0</span>
        </div>
        <div class="settings-row">
          <div class="settings-row-label"><span class="sr-icon">⚡</span><span>QuizBlast by Harendra</span></div>
          <span class="sr-value"></span>
        </div>
      </div>
    `;

    // ── Security: Strip any ADMIN section from settings (covers all versions) ──
    wrap.querySelectorAll(".settings-section").forEach(sec => {
      const title = sec.querySelector(".settings-section-title");
      if (title && title.textContent.toLowerCase().includes("admin")) {
        sec.remove();
      }
    });
    wrap.querySelectorAll(".settings-row").forEach(row => {
      const label = row.querySelector(".settings-row-label");
      if (label && label.textContent.toLowerCase().includes("admin")) {
        row.remove();
      }
    });

    // ── Avatar quick row (first 10 free + unlocked) ──
    const avRow = document.getElementById("settings-avatar-row");
    ALL_AVATARS.forEach((av, i) => {
      const unlocked = (s.unlockedAvatars || []).includes(i);
      if (!unlocked) return; // only show unlocked avatars here
      const btn = document.createElement("div");
      btn.className = "sav-btn" + (s.avatar === av ? " active" : "");
      btn.textContent = av;
      btn.onclick = () => {
        App.state.avatar = av; App.save();
        Settings.render(); // re-render to update
        HomeScreen.refresh();
      };
      avRow.appendChild(btn);
    });

    // ── Theme chips ──
    const tg = document.getElementById("settings-theme-grid");
    THEMES.forEach(th => {
      const unlocked = (s.unlockedThemes || []).includes(th.id);
      const active   = s.activeTheme === th.id;
      const chip     = document.createElement("div");
      chip.className = `settings-theme-chip${active ? " active" : ""}${unlocked ? "" : " locked"}`;
      chip.innerHTML = `
        <span class="th-dot" style="background:${th.neon}"></span>
        <span class="th-name">${th.name}</span>
        ${unlocked ? (active ? '<span class="th-check">✓</span>' : '') : '<span class="th-lock">🔒</span>'}`;
      chip.onclick = () => {
        if (unlocked) { ThemeSwitcher.apply(th.id); Settings.render(); }
        else App.showXPToast("🔒 Buy in Shop!");
      };
      // Live preview on hover (desktop) and long-press (mobile)
      chip.addEventListener("mouseenter", () => ThemeSwitcher.preview(th.id));
      chip.addEventListener("mouseleave", () => ThemeSwitcher.cancelPreview());
      tg.appendChild(chip);
    });
  },

  toggleSound(checkbox) {
    App.state.soundEnabled = checkbox.checked;
    App.save();
    if (checkbox.checked) Sound.click();
  },

  toggleHaptic(checkbox) {
    App.state.hapticEnabled = checkbox.checked;
    App.save();
    if (checkbox.checked) Haptic.light();
  },

  toggleLight(checkbox) {
    App.state.lightMode = checkbox.checked;
    App.save();
    this.applyLight(checkbox.checked);
  },

  applyLight(on) {
    document.body.classList.toggle("light-mode", !!on);
  },
};

/* ============================================================
   HAPTIC FEEDBACK
   ============================================================ */
const Haptic = {
  _vib(ms) {
    if (App?.state?.hapticEnabled === false) return;
    if (!navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch {}
  },
  light()   { this._vib(10); },
  success() { this._vib([15, 30, 15]); },
  error()   { this._vib([30, 20, 30]); },
  levelup() { this._vib([20, 40, 20, 40, 60]); },
};

/* ============================================================
/* ============================================================
   ADMIN LOCK — 7 taps on QUIZBLAST logo + password
   ============================================================ */
const AdminLock = {
  // Security constants
  MAX_ATTEMPTS:    5,        // lockout after 5 failed attempts
  LOCKOUT_MS:      15 * 60 * 1000,  // 15-minute lockout
  SESSION_MS:      30 * 60 * 1000,  // 30-minute admin session timeout
  // SHA-256 hash of "Harendra91"  (never store plain-text passwords in source)
  PW_HASH: "5192512cb1f9c737e8a3af331c89bd151df251769b2fc8adb1b9b38c3add3f30",

  _sessionTimer: null,

  // ── Lockout helpers ──────────────────────────────────────────────────────
  _isLockedOut() {
    const until = parseInt(localStorage.getItem("adminLockUntil") || "0", 10);
    return Date.now() < until;
  },
  _getLockRemaining() {
    const until = parseInt(localStorage.getItem("adminLockUntil") || "0", 10);
    return Math.max(0, Math.ceil((until - Date.now()) / 60000));
  },
  _getAttempts() {
    return parseInt(localStorage.getItem("adminAttempts") || "0", 10);
  },
  _incAttempts() {
    const n = this._getAttempts() + 1;
    localStorage.setItem("adminAttempts", n);
    if (n >= this.MAX_ATTEMPTS) {
      localStorage.setItem("adminLockUntil", Date.now() + this.LOCKOUT_MS);
      localStorage.setItem("adminAttempts", "0");
    }
  },
  _clearAttempts() {
    localStorage.removeItem("adminAttempts");
    localStorage.removeItem("adminLockUntil");
  },

  // ── SHA-256 hash via Web Crypto API ─────────────────────────────────────
  async _sha256(str) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(str)
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  },

  // ── 7-tap logo trigger ───────────────────────────────────────────────────
  taps: 0, _tapTimer: null,
  tap() {
    this.taps++;
    clearTimeout(this._tapTimer);
    this._tapTimer = setTimeout(() => { this.taps = 0; }, 3000);

    // Subtle visual feedback on logo
    const logo = document.getElementById("logo-tap");
    if (logo) {
      logo.style.opacity = "0.6";
      setTimeout(() => logo.style.opacity = "1", 150);
    }

    if (this.taps >= 7) {
      this.taps = 0;
      this.open();
    }
  },

  // ── Open password modal ──────────────────────────────────────────────────
  open() {
    if (this._isLockedOut()) {
      App.showXPToast(`🔒 Locked out for ${this._getLockRemaining()} min`);
      return;
    }
    document.getElementById("admin-pw").value = "";
    document.getElementById("admin-pw").placeholder = "Enter admin password...";
    document.getElementById("admin-lock-modal").style.display = "flex";
    setTimeout(() => document.getElementById("admin-pw").focus(), 100);
  },

  // ── Verify password ──────────────────────────────────────────────────────
  async verify() {
    if (this._isLockedOut()) {
      document.getElementById("admin-pw").placeholder =
        `🔒 Locked out — ${this._getLockRemaining()} min remaining`;
      document.getElementById("admin-pw").value = "";
      return;
    }

    const pw   = document.getElementById("admin-pw").value;
    const hash = await this._sha256(pw);
    document.getElementById("admin-pw").value = ""; // wipe field immediately

    if (hash === this.PW_HASH) {
      this._clearAttempts();
      App.closeModal("admin-lock-modal");
      App.nav("admin");
      // Start session timeout
      clearTimeout(this._sessionTimer);
      this._sessionTimer = setTimeout(() => {
        if (document.getElementById("screen-admin")?.classList.contains("active")) {
          App.nav("home");
          App.showXPToast("🔒 Admin session expired");
        }
      }, this.SESSION_MS);
    } else {
      this._incAttempts();
      const remaining = this.MAX_ATTEMPTS - this._getAttempts();
      if (this._isLockedOut()) {
        document.getElementById("admin-pw").placeholder =
          `🔒 Too many attempts — locked for ${this._getLockRemaining()} min`;
      } else {
        document.getElementById("admin-pw").placeholder =
          `❌ Wrong password (${remaining} attempt${remaining !== 1 ? "s" : ""} left)`;
      }
      setTimeout(() => {
        document.getElementById("admin-pw").placeholder = "Enter admin password...";
      }, 2000);
    }
  },

  // ── Logout admin session ─────────────────────────────────────────────────
  logout() {
    clearTimeout(this._sessionTimer);
    App.nav("home");
  },
};

/* ============================================================
   POWER-UP SYSTEM
   ============================================================ */
const PowerUp = {
  use(type) {
    const s = App.state;
    const costs = { fifty: 20, time: 15, skip: 10, shield: 25 };
    const cost  = costs[type] || 0;
    if (s.coins < cost) { App.showXPToast("Not enough coins! 🪙"); return; }
    if (Quiz.answered)   { App.showXPToast("Answer first!"); return; }
    App.addCoins(-cost);
    Sound.shop();
    switch (type) {
      case "fifty": {
        const q    = Quiz.questions[Quiz.current];
        const btns = [...document.querySelectorAll(".opt-btn")];
        let removed = 0;
        btns.forEach((b, i) => {
          if (i !== q.ans && removed < 2) { b.style.opacity = "0.18"; b.disabled = true; removed++; }
        });
        App.showXPToast("⚡ 50/50 used!");
        break;
      }
      case "time":
        Quiz.timerVal = Math.min(Quiz.timerVal + 5, 30);
        App.showXPToast("⏳ +5 seconds!");
        break;
      case "skip":
        Quiz.timeOut(true);
        App.showXPToast("⏭️ Skipped!");
        break;
      case "shield":
        Quiz.shieldActive = true;
        App.showXPToast("🛡️ Shield ready!");
        break;
    }
    this.updateUI();
  },
  updateUI() {
    const s = App.state;
    const costs = { fifty: 20, time: 15, skip: 10, shield: 25 };
    Object.keys(costs).forEach(k => {
      const btn = document.getElementById(`pu-${k === "fifty" ? "5050" : k}`);
      if (btn) btn.disabled = s.coins < costs[k];
    });
  },
};

/* ============================================================
   QUIZ ENGINE
   ============================================================ */
const Quiz = {
  questions: [], current: 0, score: 0, lives: 3, combo: 0,
  catId: "", diff: "easy", mode: "classic",
  timerVal: 15, timerInterval: null,
  hintUsed: false, answered: false, timeBonus: 0,
  results: [], bossTriggered: false, consecutiveCorrect: 0,
  shieldActive: false, hintUsedQuiz: false,

  DIFF_TIME: { easy: 20, medium: 15, hard: 10 },
  DIFF_XP:   { easy: 1,  medium: 1.5, hard: 2 },

  start(catId, mode = "classic", diff = "easy") {
    this.catId = catId; this.mode = mode; this.diff = diff;
    this.questions = this.buildQuestions(catId, diff);
    this.current = 0; this.score = 0;
    this.lives = mode === "sudden" ? 1 : 3;
    this.combo = 0; this.timeBonus = 0; this.results = [];
    this.bossTriggered = false; this.consecutiveCorrect = 0;
    this.shieldActive = false; this.hintUsedQuiz = false;
    this._startTime = Date.now();

    this.countdown(() => {
      // Push quiz to browser history so back button shows confirm
      history.pushState({ screen: "quiz" }, "", "#quiz");
      App._activateScreen("quiz");
      document.getElementById("sudden-banner").style.display = mode === "sudden" ? "block" : "none";
      // Daily badge
      const dailyBadge = document.getElementById("q-daily-badge");
      if (dailyBadge) dailyBadge.style.display = catId === "daily" ? "inline-flex" : "none";
      this.renderQuestion();
    });
  },

  buildQuestions(catId, diff) {
    let pool;
    if (catId === "daily") {
      const all    = Object.values(QUESTION_BANK).flat();
      const custom = App.state.customQuestions || [];
      pool = [...all, ...custom];
    } else {
      const base   = QUESTION_BANK[catId] || [];
      const custom = (App.state.customQuestions || []).filter(q => q.category === catId);
      pool = [...base, ...custom];
    }
    if (diff && diff !== "all" && catId !== "daily") {
      const filtered = pool.filter(q => q.diff === diff);
      if (filtered.length >= 5) pool = filtered;
    }
    return this.shuffle([...pool]).slice(0, this._questionCount || 10);
  },

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  countdown(cb) {
    const overlay = document.getElementById("countdown-overlay");
    const num     = document.getElementById("countdown-num");
    overlay.classList.add("active");
    let c = 3; num.textContent = c;
    const t = setInterval(() => {
      c--;
      if (c === 0) {
        num.textContent = "GO! ⚡";
        setTimeout(() => { overlay.classList.remove("active"); clearInterval(t); cb(); }, 700);
      } else { num.textContent = c; }
    }, 1000);
  },

  renderQuestion() {
    App.closeModal();
    const q = this.questions[this.current];
    if (!q) { this.end(); return; }
    this.answered = false; this.hintUsed = false;

    const cat = CATEGORIES.find(c => c.id === this.catId);
    document.getElementById("q-category").textContent =
      cat ? cat.name : "Mixed";
    document.getElementById("q-counter").textContent = `Q ${this.current + 1}/${this.questions.length}`;
    document.getElementById("q-number").textContent  = String(this.current + 1).padStart(2, "0");
    document.getElementById("q-text").textContent    = q.q;
    document.getElementById("q-lives").textContent   = "❤️".repeat(Math.max(0, this.lives));

    const diffMap = { easy:"🟢 Easy", medium:"🟡 Medium", hard:"🔴 Hard" };
    document.getElementById("q-diff-badge").textContent = diffMap[q.diff || this.diff] || "🟢 Easy";

    const pct = (this.current / this.questions.length) * 100;
    document.getElementById("progress-fill").style.width = pct + "%";
    document.getElementById("hint-btn").disabled = false;

    const grid  = document.getElementById("options-grid");
    grid.innerHTML = "";
    const L = ["A","B","C","D"];
    q.opts.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "opt-btn";
      btn.innerHTML = `<span class="opt-letter">${L[i]}</span>${opt}`;
      btn.onclick   = () => this.answer(i, btn);
      grid.appendChild(btn);
    });

    this.renderComboDots();
    PowerUp.updateUI();
    Bookmark.updateBtn();
    this.startTimer();
  },

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerVal = this.DIFF_TIME[this.diff] || 15;
    this.updateTimerUI(this.timerVal);
    this.timerInterval = setInterval(() => {
      this.timerVal--;
      this.updateTimerUI(this.timerVal);
      if (this.timerVal <= 5) Sound.timer();
      if (this.timerVal <= 0) { clearInterval(this.timerInterval); if (!this.answered) this.timeOut(); }
    }, 1000);
  },

  updateTimerUI(val) {
    const ring  = document.getElementById("timer-ring");
    const num   = document.getElementById("timer-num");
    const maxT  = this.DIFF_TIME[this.diff] || 15;
    const max   = 276.46;
    ring.style.strokeDashoffset = max - (val / maxT) * max;
    num.textContent = val;
    ring.classList.remove("warning","danger");
    if (val <= 3)      ring.classList.add("danger");
    else if (val <= 6) ring.classList.add("warning");
  },

  answer(idx, btn) {
    if (this.answered) return;
    this.answered = true;
    clearInterval(this.timerInterval);

    const q       = this.questions[this.current];
    const correct = idx === q.ans;
    const allBtns = document.querySelectorAll(".opt-btn");
    allBtns.forEach(b => b.disabled = true);
    allBtns[q.ans].classList.add("correct");
    if (!correct) btn.classList.add("wrong");

    if (correct) {
      Sound.correct(); Haptic.success(); App.flashAnswer(true);
      this.score++; this.combo++; this.consecutiveCorrect++;
      const bonus = this.timerVal >= 10 ? 2 : this.timerVal >= 5 ? 1 : 0;
      this.timeBonus += bonus;
      this.results.push({ q: q.q, correct: true, answer: q.opts[q.ans] });
      if (this.consecutiveCorrect >= 5 && this.timerVal >= (this.DIFF_TIME[this.diff] - 5))
        App.state.speedBadge = true;
    } else {
      Sound.wrong(); Haptic.error(); App.flashAnswer(false);
      this.combo = 0; this.consecutiveCorrect = 0;
      if (this.shieldActive) {
        this.shieldActive = false;
        App.showXPToast("🛡️ Shield blocked!");
      } else {
        this.lives--;
        App.state.wrongQuestions = App.state.wrongQuestions || [];
        if (!App.state.wrongQuestions.find(wq => wq.q === q.q)) {
          App.state.wrongQuestions.push({ ...q });
          if (App.state.wrongQuestions.length > 50) App.state.wrongQuestions.shift();
          App.save();
        }
      }
      this.results.push({ q: q.q, correct: false, answer: q.opts[q.ans], chosen: q.opts[idx] });
      document.getElementById("q-card").classList.add("shake");
      setTimeout(() => document.getElementById("q-card").classList.remove("shake"), 400);
      if (this.mode === "sudden") { setTimeout(() => this.end(), 1000); return; }
    }

    this.renderComboDots();

    if (this.lives <= 0) {
      setTimeout(() => this.end(), 1000);
    } else {
      setTimeout(() => this.nextQuestion(), 1200);
    }
  },

  timeOut(skip = false) {
    if (this.answered) return;
    this.answered = true;
    clearInterval(this.timerInterval);
    this.combo = 0; this.consecutiveCorrect = 0;
    const q       = this.questions[this.current];
    const allBtns = document.querySelectorAll(".opt-btn");
    allBtns.forEach(b => b.disabled = true);
    allBtns[q.ans].classList.add("correct");
    this.results.push({ q: q.q, correct: false, answer: q.opts[q.ans], skipped: true });
    if (!skip) { this.lives--; Sound.wrong(); }
    this.renderComboDots();
    if (this.lives <= 0 && !skip) setTimeout(() => this.end(), 1000);
    else setTimeout(() => this.nextQuestion(), skip ? 0 : 1200);
  },

  nextQuestion() {
    this.current++;
    if (this.current >= this.questions.length) this.end();
    else this.renderQuestion();
  },

  useHint() {
    if (this.hintUsed) return;
    if (App.state.coins < 5) { this.showHint("Not enough coins! 🪙"); return; }
    App.addCoins(-5);
    this.hintUsed = true; this.hintUsedQuiz = true;
    document.getElementById("hint-btn").disabled = true;
    const q = this.questions[this.current];
    this.showHint("💡 " + (q.hint || "No hint available."));
  },

  showHint(msg) {
    const el = document.getElementById("hint-toast");
    el.textContent = msg; el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3000);
  },

  renderComboDots() {
    document.getElementById("combo-count").textContent = this.combo || 1;
    const dots = document.getElementById("combo-dots");
    dots.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const d = document.createElement("div");
      d.className = "combo-dot" + (i < this.combo ? " active" : "");
      dots.appendChild(d);
    }
    if (this.combo >= 3) DailyQuests.trackEvent("combo");
  },

  end() {
    clearInterval(this.timerInterval);
    const diffMult = this.DIFF_XP[this.diff] || 1;
    const modeMult = this.mode === "sudden" ? 3 : 1;
    const xpEarned = Math.round(this.score * 20 * diffMult * modeMult + this.timeBonus * 3);
    const coinsEarned = this.score * 5 + (this.catId === "daily" ? this.score * 2 : 0);
    const isPerfect   = this.score === this.questions.length;

    App.state.totalCorrect = (App.state.totalCorrect || 0) + this.score;
    if (isPerfect) App.state.hasPerfect = true;
    if (this.mode === "sudden" && this.score > 0)
      App.state.suddenSurvived = (App.state.suddenSurvived || 0) + 1;
    if (!this.hintUsedQuiz && this.score >= 5) DailyQuests.trackEvent("noHint");
    if (this.score >= 8) DailyQuests.trackEvent("highScore");

    const leveled  = App.addXP(xpEarned);
    App.addCoins(coinsEarned);
    App.markPlayed(this.catId, this.score, this.questions.length);
    App.showXPToast(`+${xpEarned} XP ⚡`);
    if (isPerfect) Confetti.burst();

    // Push to Supabase leaderboard (with anti-cheat)
    if (typeof SupaLeaderboard !== "undefined") {
      const timeTaken = Math.floor((Date.now() - (this._startTime || Date.now())) / 1000);
      const valid = typeof AntiCheat !== "undefined"
        ? AntiCheat.validate(this.score, this.questions.length, timeTaken, xpEarned)
        : true;
      if (valid) {
        SupaLeaderboard.push(App.state);
      } else {
        console.warn("Anti-cheat: suspicious score rejected");
      }
    }

    // Submit PvP score if in a battle
    if (Quiz._pvpRoom) {
      const pvpRoom  = Quiz._pvpRoom;
      const pvpIsHost = Quiz._pvpIsHost;
      Quiz._pvpRoom  = null;
      Quiz._pvpIsHost = null;
      setTimeout(() => PvP.submitScore(pvpRoom, this.score, pvpIsHost), 500);
      return; // skip normal result screen — PvP has its own
    }

    const newAchs = Achievements.check();
    Result.show({
      score: this.score, total: this.questions.length,
      xp: xpEarned, coins: coinsEarned, timeBonus: this.timeBonus,
      leveled, newLevel: App.state.level,
      catId: this.catId, results: this.results, newAchs,
    });

    // Daily streak reward popup — shown after result screen
    if (this.catId === "daily") {
      setTimeout(() => DailyReward.show(xpEarned, coinsEarned), 400);
    }
  },

  retry() { this.start(this.catId || "gk", this.mode, this.diff); },
};

/* ============================================================
   BOSS BATTLE
   ============================================================ */
const Boss = {
  hp: { boss: 100, player: 100 }, questions: [], current: 0, onDone: null, MAX_Q: 3,

  start(cb) {
    Sound.boss(); this.onDone = cb;
    this.hp = { boss: 100, player: 100 }; this.current = 0;
    const all = Object.values(QUESTION_BANK).flat().filter(q => q.diff === "hard");
    this.questions = Quiz.shuffle([...all]).slice(0, this.MAX_Q);

    document.getElementById("boss-name").textContent      = "MEGA BRAIN";
    document.getElementById("player-name-boss").textContent = App.state.username.toUpperCase().slice(0, 10);
    document.getElementById("player-sprite-boss").textContent = App.state.avatar;

    App._activateScreen("boss");
    this.renderBossQ();
  },

  renderBossQ() {
    this.updateHP();
    if (this.current >= this.MAX_Q) { this.endBattle(true); return; }
    const q = this.questions[this.current];
    if (!q) { this.endBattle(false); return; }
    document.getElementById("boss-q-text").textContent = q.q;
    document.getElementById("boss-status").textContent = "";
    const grid = document.getElementById("boss-options-grid");
    grid.innerHTML = "";
    const L = ["A","B","C","D"];
    q.opts.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "opt-btn";
      btn.innerHTML = `<span class="opt-letter">${L[i]}</span>${opt}`;
      btn.onclick   = () => this.bossAnswer(i, btn);
      grid.appendChild(btn);
    });
  },

  bossAnswer(idx, btn) {
    const q   = this.questions[this.current];
    const ok  = idx === q.ans;
    const all = document.querySelectorAll("#boss-options-grid .opt-btn");
    all.forEach(b => b.disabled = true);
    all[q.ans].classList.add("correct");
    if (!ok) btn.classList.add("wrong");
    const st = document.getElementById("boss-status");
    if (ok) { Sound.correct(); this.hp.boss = Math.max(0, this.hp.boss - 35); st.textContent = "💥 Hit! -35 HP"; App.flashAnswer(true); }
    else    { Sound.wrong();   this.hp.player = Math.max(0, this.hp.player - 30); st.textContent = "😱 Boss hits! -30 HP"; App.flashAnswer(false); }
    this.updateHP(); this.current++;
    if (this.hp.player <= 0)   setTimeout(() => this.endBattle(false), 1200);
    else if (this.hp.boss <= 0) setTimeout(() => this.endBattle(true),  1200);
    else                        setTimeout(() => this.renderBossQ(),    1200);
  },

  updateHP() {
    document.getElementById("boss-hp-fill").style.width   = this.hp.boss   + "%";
    document.getElementById("player-hp-fill").style.width = this.hp.player + "%";
    document.getElementById("boss-hp-num").textContent    = this.hp.boss   + " HP";
    document.getElementById("player-hp-num").textContent  = this.hp.player + " HP";
  },

  endBattle(won) {
    const st = document.getElementById("boss-status");
    if (won) {
      Sound.levelup(); st.textContent = "🏆 BOSS DEFEATED! +80 XP +40🪙";
      App.addXP(80); App.addCoins(40);
      App.state.bossBeaten = (App.state.bossBeaten || 0) + 1;
      App.save(); Confetti.burst();
    } else { st.textContent = "💀 Defeated! Try again!"; }
    setTimeout(() => {
      App._activateScreen("quiz");
      Quiz.renderQuestion();
      if (this.onDone) this.onDone();
    }, 2000);
  },
};

/* ============================================================
   RESULT SCREEN
   ============================================================ */
const Result = {
  show(data) {
    App.nav("result");
    const pct = data.score / data.total;
    document.getElementById("result-trophy").textContent = pct >= 0.9 ? "🏆" : pct >= 0.6 ? "🥈" : "😅";
    document.getElementById("result-title").textContent  = pct >= 0.9 ? "PERFECT BLAST!" : pct >= 0.6 ? "GREAT JOB!" : "KEEP GOING!";
    document.getElementById("score-big").textContent    = data.score;
    document.getElementById("score-total").textContent  = data.total;
    document.getElementById("xp-earned").textContent    = "+" + data.xp;
    document.getElementById("coins-earned").textContent = "+" + data.coins;
    document.getElementById("time-bonus").textContent   = "+" + data.timeBonus;

    const lb = document.getElementById("levelup-banner");
    lb.style.display = data.leveled ? "block" : "none";
    if (data.leveled) document.getElementById("new-level").textContent = data.newLevel;

    setTimeout(() => {
      const arc = document.getElementById("score-ring-arc");
      arc.style.strokeDashoffset = 326.72 - (data.score / data.total) * 326.72;
      arc.style.stroke = pct >= 0.7 ? "var(--c-neon)" : pct >= 0.4 ? "var(--c-yellow)" : "var(--c-red)";
    }, 200);

    const na = document.getElementById("new-achievements");
    na.innerHTML = "";
    (data.newAchs || []).forEach(a => {
      const div = document.createElement("div");
      div.className = "ach-unlock-pill";
      div.innerHTML = `${a.emoji} <b>${a.label}</b> unlocked!`;
      na.appendChild(div);
    });

    const bd = document.getElementById("result-breakdown");
    bd.innerHTML = `<div class="bd-header">Question Breakdown</div>`;
    (data.results || []).forEach(r => {
      const div = document.createElement("div");
      div.className = "breakdown-item " + (r.correct ? "correct" : r.skipped ? "skipped" : "wrong");
      div.innerHTML = `
        <span class="bd-icon">${r.correct ? "✅" : r.skipped ? "⏱️" : "❌"}</span>
        <div class="bd-text">
          <div class="bd-q">${r.q.length > 55 ? r.q.slice(0, 52) + "..." : r.q}</div>
          <div class="bd-a">Ans: ${r.answer}</div>
        </div>`;
      bd.appendChild(div);
    });
  },
};

/* ============================================================
   LEADERBOARD
   Active players only (played within last 7 days).
   Mock players also have lastPlayed timestamps so they can
   be filtered the same way as the real player.
   ============================================================ */

// Helper: date string N days ago
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toDateString();
}

// Mock players — all have played within the last 7 days
const MOCK_PLAYERS = []; // Real players loaded from Supabase



const LB = {
  async show(type, el) {
    if (el) {
      document.querySelectorAll(".lb-tab").forEach(t => t.classList.remove("active"));
      el.classList.add("active");
    }

    const friendsPanel = document.getElementById("lb-friends-panel");
    if (friendsPanel) friendsPanel.style.display = type === "friends" ? "block" : "none";

    const s = App.state;
    if (!s.friendCode) { s.friendCode = this._genCode(s.username); App.save(); }
    const codeEl = document.getElementById("my-friend-code");
    if (codeEl) codeEl.textContent = s.friendCode;

    // Show loading
    const podium = document.getElementById("lb-podium");
    const list   = document.getElementById("lb-list");
    if (podium) podium.innerHTML = "<div class='lb-loading'>⏳ Loading...</div>";
    if (list)   list.innerHTML   = "";

    const me = {
      name: s.username, avatar: s.avatar, xp: s.xp,
      level: s.level, streak: s.streak,
      weeklyXP: Object.entries(s.xpHistory || {})
        .filter(([d]) => (new Date() - new Date(d)) <= 7 * 86400000)
        .reduce((sum, [, v]) => sum + v, 0),
      lastPlayed: s.lastPlayed || null,
      isYou: true,
    };

    let data = [];

    if (type === "friends") {
      data = await this._loadFriends(me);
    } else {
      try {
        if (typeof SupaLeaderboard !== "undefined") {
          const rows = await SupaLeaderboard.fetch(type);
          data = rows.map(r => ({
            name:      r.username,
            avatar:    r.avatar,
            xp:        r.xp,
            weeklyXP:  r.weekly_xp,
            level:     r.level,
            streak:    r.streak,
            lastPlayed:r.last_played,
            isYou:     r.username === s.username,
          }));
        }
      } catch(e) { console.warn("LB fetch:", e); }

      // Always include current user if not already in list
      if (!data.some(p => p.isYou)) {
        data.push(me);
      }

      if (type === "weekly") data.sort((a,b) => (b.weeklyXP||0) - (a.weeklyXP||0));
      else data.sort((a,b) => b.xp - a.xp);
    }

    this._render(type, data);
  },

  async _loadFriends(me) {
    const s = App.state;
    let data = [...(s.friends || []), me];
    if (typeof SupaLeaderboard !== "undefined" && (s.friends||[]).length) {
      try {
        const rows = await SupaLeaderboard.fetch("global");
        const liveMap = {};
        rows.forEach(r => liveMap[r.username] = r);
        data = data.map(f => {
          if (f.isYou) return f;
          const live = liveMap[f.name];
          if (!live) return f;
          return { ...f, xp: live.xp, level: live.level, streak: live.streak, weeklyXP: live.weekly_xp };
        });
      } catch(e) {}
    }
    data.sort((a,b) => b.xp - a.xp);
    return data;
  },

  _render(type, data) {
    const scoreField = type === "weekly" ? "weeklyXP" : "xp";
    const podium = document.getElementById("lb-podium");
    const list   = document.getElementById("lb-list");

    podium.innerHTML = "";
    list.innerHTML   = "";

    if (!data.length) {
      list.innerHTML = "<p class='text-muted' style='padding:16px;text-align:center'>No players yet! Be the first. 🚀</p>";
      return;
    }

    const order = [1, 0, 2], crowns = ["🥈","👑","🥉"];
    order.forEach(i => {
      const p = data[i]; if (!p) return;
      const score = p[scoreField] ?? p.xp;
      const c = document.createElement("div");
      c.className = `podium-card rank-${i+1}${p.isYou ? " is-you" : ""}`;
      c.innerHTML = `<div class="podium-crown">${crowns[i]}</div><div class="podium-avatar">${p.avatar}</div><div class="podium-name">${p.name}</div><div class="podium-xp">${score} XP</div><div class="podium-rank">#${i+1}</div>`;
      podium.appendChild(c);
    });

    const myRank = data.findIndex(p => p.isYou);

    data.slice(3).forEach((p, i) => {
      const score = p[scoreField] ?? p.xp;
      const row = document.createElement("div");
      row.className = "lb-row" + (p.isYou ? " is-you lb-row-you" : "");
      row.innerHTML = `<div class="lb-rank">#${i+4}</div><div class="lb-av">${p.avatar}</div><div class="lb-info"><div class="lb-name">${p.name}${p.isYou ? " <span class='you-tag'>YOU</span>" : ""}</div><div class="lb-sub">LVL ${p.level} · 🔥 ${p.streak}</div></div><div class="lb-score">${score} XP</div>`;
      list.appendChild(row);
      if (p.isYou) setTimeout(() => row.scrollIntoView({ behavior:"smooth", block:"center" }), 200);
    });

    if (myRank >= 0) {
      const banner = document.createElement("div");
      banner.className = "lb-your-rank-banner";
      banner.innerHTML = `🏅 Your Rank: <b>#${myRank+1}</b> of ${data.length}`;
      list.appendChild(banner);
    }

    if (type === "friends" && data.filter(p => !p.isYou).length === 0) {
      list.innerHTML = "<p class='text-muted' style='padding:16px;text-align:center'>No friends yet! Share your code above. 👆</p>";
    }
  },

  _genCode(username) {
    const base = (username || "PLAYER").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4).padEnd(4,"X");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return base + rand;
  },

  copyCode() {
    const code = App.state.friendCode;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => App.showXPToast("📋 Code copied!"))
      .catch(() => App.showXPToast("Code: " + code));
  },

  async addFriend() {
    const input = document.getElementById("friend-code-input");
    const code  = (input.value || "").trim().toUpperCase();
    if (code.length < 4) { App.showXPToast("⚠️ Enter a valid code!"); return; }
    if (code === App.state.friendCode) { App.showXPToast("That's your own code! 😅"); return; }

    const friends = App.state.friends || [];
    if (friends.some(f => f.friendCode === code)) { App.showXPToast("Already added!"); return; }

    App.showXPToast("🔍 Searching...");
    let newFriend = null;

    if (typeof SupaFriends !== "undefined") {
      const found = await SupaFriends.findByCode(code);
      if (found) {
        newFriend = { name: found.username, avatar: found.avatar,
          xp: found.xp, level: found.level, streak: found.streak,
          weeklyXP: 0, friendCode: found.friend_code };
      }
    }

    if (!newFriend) {
      const mock = MOCK_PLAYERS.find(p => p.friendCode === code);
      newFriend = mock || { name:"Friend_"+code.slice(0,4), avatar:"🙂",
        xp:0, level:1, streak:0, weeklyXP:0, friendCode:code };
    }

    friends.push(newFriend);
    App.state.friends = friends;
    App.save();
    input.value = "";
    App.showXPToast(`✅ ${newFriend.name} added!`);
    this.show("friends");
  },
};


/* ============================================================
   PROFILE
   ============================================================ */
const Profile = {
  refresh() {
    const s = App.state;
    document.getElementById("profile-name").textContent  = s.username;
    document.getElementById("profile-title").textContent = App.getTitle(s.level);
    ["xp","coins","level","streak"].forEach(k => {
      document.getElementById(`p-${k}`).textContent = s[k] || 0;
    });
    document.getElementById("p-correct").textContent = s.totalCorrect  || 0;
    document.getElementById("p-played").textContent  = s.quizzesPlayed || 0;

    /* ── Avatar picker ─────────────────────────────────────
       Show EVERY avatar (locked ones visible but dimmed)
       ─────────────────────────────────────────────────── */
    const picker = document.getElementById("avatar-picker");
    picker.innerHTML = "";
    ALL_AVATARS.forEach((av, i) => {
      const unlocked = (s.unlockedAvatars || []).includes(i);
      const selected = s.avatar === av;

      const wrap = document.createElement("div");
      wrap.className = "av-wrap" + (selected ? " selected" : "") + (unlocked ? "" : " av-locked");
      wrap.title = unlocked ? "Select avatar" : "🔒 Buy in Shop to unlock";

      wrap.innerHTML = `
        <div class="av-emoji">${av}</div>
        ${!unlocked ? '<div class="av-lock-badge">🔒</div>' : ""}
        ${selected  ? '<div class="av-selected-ring"></div>' : ""}`;

      wrap.onclick = () => {
        if (unlocked) {
          App.state.avatar = av;
          App.save();
          // Instantly update home screen avatar too
          const homeAv = document.getElementById("home-avatar");
          if (homeAv) homeAv.textContent = av;
          this.refresh();
        } else {
          App.showXPToast("🔒 Buy in Shop!");
        }
      };
      picker.appendChild(wrap);
    });

    /* ── Badges ── */
    const row = document.getElementById("badges-row");
    row.innerHTML = "";
    ACHIEVEMENTS.forEach(a => {
      const earned = (s.achievements || []).includes(a.id);
      const chip   = document.createElement("div");
      chip.className = "badge-chip" + (earned ? " earned" : "");
      chip.innerHTML = `${a.emoji} ${a.label}`;
      chip.title     = a.desc;
      row.appendChild(chip);
    });
  },

  editName() {
    Sound.click();
    document.getElementById("name-modal").style.display = "flex";
    document.getElementById("name-input").value         = App.state.username;
    setTimeout(() => document.getElementById("name-input").focus(), 100);
  },

  saveName() {
    const val = document.getElementById("name-input").value.trim();
    if (val) { App.state.username = val.slice(0, 20); App.save(); this.refresh(); }
    App.closeModal("name-modal");
  },

  reset() {
    if (confirm("Reset ALL progress? This cannot be undone.")) {
      App.state = Store.reset();
      ThemeSwitcher.load();
      this.refresh();
      App.nav("home");
    }
  },
};

/* ============================================================
   SHOP
   ============================================================ */
const Shop = {
  currentTab: "powerups",

  tab(name, el) {
    Sound.click();
    this.currentTab = name;
    document.querySelectorAll(".shop-tab").forEach(t => t.classList.remove("active"));
    if (el) el.classList.add("active");
    else {
      const idx = ["powerups","avatars","themes"].indexOf(name);
      document.querySelectorAll(".shop-tab")[idx]?.classList.add("active");
    }
    document.getElementById("shop-coins").textContent = App.state.coins;
    this.render(name);
  },

  render(tab) {
    const items   = SHOP_ITEMS[tab] || [];
    const content = document.getElementById("shop-content");
    content.innerHTML = "";
    const s = App.state;

    items.forEach(item => {
      let owned = false;
      if (item.type === "avatar") owned = (s.unlockedAvatars || []).includes(item.avIdx);
      if (item.type === "theme")  owned = (s.unlockedThemes  || []).includes(item.themeId);

      const canAfford = s.coins >= item.price;
      const card = document.createElement("div");
      card.className = "shop-card";
      card.innerHTML = `
        <div class="shop-item-icon">${item.emoji}</div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
        <button class="shop-buy-btn ${owned ? "owned" : ""} ${!canAfford && !owned ? "cant-afford" : ""}"
          onclick="Shop.buy('${item.id}')" ${owned ? "disabled" : ""}>
          ${owned ? "✅ Owned" : "🪙 " + item.price}
        </button>`;
      content.appendChild(card);
    });
  },

  buy(itemId) {
    const allItems = [...SHOP_ITEMS.powerups, ...SHOP_ITEMS.avatars, ...SHOP_ITEMS.themes];
    const item = allItems.find(i => i.id === itemId); if (!item) return;
    const s    = App.state;

    // Not enough coins — animated modal
    if (s.coins < item.price) {
      const needed = item.price - s.coins;
      document.getElementById("no-coins-detail").innerHTML =
        `<b>${item.emoji} ${item.name}</b> costs <b>🪙${item.price}</b><br>You need <b>🪙${needed}</b> more coins.`;
      const icon = document.getElementById("no-coins-icon");
      icon.classList.remove("no-coins-shake");
      void icon.offsetWidth;
      icon.classList.add("no-coins-shake");
      document.getElementById("no-coins-modal").style.display = "flex";
      return;
    }

    App.addCoins(-item.price);
    Sound.shop();
    s.shopBought = (s.shopBought || 0) + 1;

    if (item.type === "powerup") {
      s.powerups = s.powerups || {};
      s.powerups[item.key] = (s.powerups[item.key] || 0) + item.qty;
    } else if (item.type === "avatar") {
      s.unlockedAvatars = s.unlockedAvatars || [];
      if (!s.unlockedAvatars.includes(item.avIdx)) s.unlockedAvatars.push(item.avIdx);
    } else if (item.type === "theme") {
      s.unlockedThemes = s.unlockedThemes || [];
      if (!s.unlockedThemes.includes(item.themeId)) s.unlockedThemes.push(item.themeId);
      ThemeSwitcher.apply(item.themeId);
    } else if (item.type === "bundle") {
      ["fifty","time","skip","shield"].forEach(k => {
        s.powerups = s.powerups || {};
        s.powerups[k] = (s.powerups[k] || 0) + 5;
      });
    }

    App.save();
    Achievements.check();
    document.getElementById("shop-coins").textContent = s.coins;
    this.render(this.currentTab);

    // Purchase success modal
    document.getElementById("purchase-title").textContent  = item.name + " Purchased!";
    document.getElementById("purchase-detail").innerHTML   = `${item.emoji} <b>${item.name}</b> — ${item.desc}`;
    document.getElementById("purchase-coins-left").textContent = s.coins;
    const pIcon = document.getElementById("purchase-icon");
    pIcon.textContent = item.emoji;
    pIcon.classList.remove("purchase-burst");
    void pIcon.offsetWidth;
    pIcon.classList.add("purchase-burst");
    document.getElementById("purchase-modal").style.display = "flex";
    Confetti.burst();
  },
};

/* ============================================================
   ACHIEVEMENTS
   ============================================================ */
const Achievements = {
  check() {
    const s    = App.state;
    const newly = [];
    ACHIEVEMENTS.forEach(a => {
      if (!(s.achievements || []).includes(a.id) && a.cond(s)) {
        s.achievements = s.achievements || [];
        s.achievements.push(a.id);
        newly.push(a);
        this.popup(a);
      }
    });
    if (newly.length) App.save();
    return newly;
  },
  popup(a) {
    Sound.achieve();
    const pop = document.getElementById("achievement-popup");
    document.getElementById("ach-icon").textContent = a.emoji;
    document.getElementById("ach-name").textContent = a.label;
    pop.style.display = "flex";
    setTimeout(() => { pop.style.display = "none"; }, 3000);
  },
};

/* ============================================================
   STATS PAGE
   ============================================================ */
const Stats = {
  render() {
    const s       = App.state;
    const correct = s.totalCorrect || 0;
    const totalQ  = (s.quizHistory || []).reduce((a, h) => a + h.total, 0) || 1;
    const acc     = Math.round((correct / Math.max(totalQ, 1)) * 100);

    document.getElementById("st-accuracy").textContent    = acc + "%";
    document.getElementById("st-best-streak").textContent = s.bestStreak || 0;

    const cb = document.getElementById("cat-stats-bars");
    cb.innerHTML = "";
    CATEGORIES.forEach(cat => {
      const catQ = (s.quizHistory || []).filter(h => h.cat === cat.id);
      if (!catQ.length) return;
      const total  = catQ.reduce((a, h) => a + h.total, 0);
      const scored = catQ.reduce((a, h) => a + h.score, 0);
      const pct    = Math.round((scored / total) * 100);
      const div    = document.createElement("div");
      div.className = "cat-stat-row";
      div.innerHTML = `
        <div class="csr-label">${cat.emoji} ${cat.name}</div>
        <div class="csr-track"><div class="csr-fill" style="width:${pct}%;background:${cat.color}"></div></div>
        <div class="csr-pct">${pct}%</div>`;
      cb.appendChild(div);
    });

    const hl = document.getElementById("quiz-history-list");
    hl.innerHTML = "";
    (s.quizHistory || []).slice(0, 10).forEach(h => {
      const cat = CATEGORIES.find(c => c.id === h.cat) || { emoji:"🌟", name: h.cat };
      const div = document.createElement("div");
      div.className = "history-row";
      const pct = Math.round((h.score / h.total) * 100);
      div.innerHTML = `
        <span>${cat.emoji}</span>
        <span class="hr-cat">${cat.name}</span>
        <span class="hr-score">${h.score}/${h.total}</span>
        <div class="hr-bar-wrap"><div class="hr-bar" style="width:${pct}%;background:${pct>=70?"var(--c-neon)":pct>=40?"var(--c-yellow)":"var(--c-red)"}"></div></div>
        <span class="hr-date">${h.date}</span>`;
      hl.appendChild(div);
    });

    this.drawXPChart();
  },

  drawXPChart() {
    const canvas = document.getElementById("xp-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = canvas.offsetWidth  || 320;
    canvas.height = 160;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const today = new Date();
    const labels = [], vals = [];
    for (let i = 6; i >= 0; i--) {
      const d   = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toDateString();
      labels.push(d.toLocaleDateString("en", { weekday:"short" }));
      vals.push((App.state.xpHistory || {})[key] || 0);
    }
    const maxVal = Math.max(...vals, 50);
    const w = canvas.width, h = canvas.height;
    const pad = 28, bw = (w - pad * 2) / 7, barW = bw * 0.5;

    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = h - pad - (i / 4) * (h - pad * 1.5);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    }

    vals.forEach((v, i) => {
      const x    = pad + i * bw + bw * 0.25;
      const barH = ((v / maxVal) * (h - pad * 1.5));
      const y    = h - pad - barH;
      ctx.shadowColor = "var(--c-neon)"; ctx.shadowBlur = 8;
      const grad = ctx.createLinearGradient(0, y, 0, h - pad);
      grad.addColorStop(0, "rgba(0,245,196,0.9)");
      grad.addColorStop(1, "rgba(0,245,196,0.1)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, barH);
      ctx.shadowBlur = 0;
      ctx.fillStyle  = "rgba(255,255,255,0.5)";
      ctx.font       = "10px Exo 2,sans-serif";
      ctx.textAlign  = "center";
      ctx.fillText(labels[i], x + barW / 2, h - 8);
      if (v > 0) {
        ctx.fillStyle = "var(--c-neon)";
        ctx.fillText(v, x + barW / 2, y - 4);
      }
    });
  },
};

/* ============================================================
   DAILY QUESTS
   ============================================================ */
const DailyQuests = {
  refresh() {
    const s     = App.state;
    const today = new Date().toDateString();
    if (s.dailyQuestDate !== today) {
      const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 3);
      s.dailyQuests       = shuffled;
      s.dailyQuestDate    = today;
      s.dailyQuestProgress = {};
      App.save();
    }
  },
  render() {
    const s    = App.state;
    const wrap = document.getElementById("quests-wrap");
    wrap.innerHTML = "";
    (s.dailyQuests || []).forEach(q => {
      const prog = s.dailyQuestProgress[q.trackKey] || 0;
      const done = prog >= q.target;
      const pct  = Math.min((prog / q.target) * 100, 100);
      const div  = document.createElement("div");
      div.className = "quest-card" + (done ? " quest-done" : "");
      div.innerHTML = `
        <div class="quest-top">
          <span class="quest-icon">${q.icon}</span>
          <div class="quest-info">
            <div class="quest-label">${q.label}</div>
            <div class="quest-reward">${q.rewardType==="xp"?"⚡":"🪙"} ${q.reward} reward</div>
          </div>
          ${done ? '<span class="quest-check">✅</span>' : ""}
        </div>
        <div class="quest-prog-track"><div class="quest-prog-fill" style="width:${pct}%"></div></div>
        <div class="quest-prog-txt">${prog}/${q.target}</div>`;
      wrap.appendChild(div);
    });
  },
  updateStrip() {
    const s     = App.state;
    const total = (s.dailyQuests || []).length || 3;
    const done  = (s.dailyQuests || []).filter(q =>
      (s.dailyQuestProgress[q.trackKey] || 0) >= q.target).length;
    document.getElementById("quest-strip-sub").textContent = `${done}/${total} complete`;
    document.getElementById("quest-mini-fill").style.width = (done / total * 100) + "%";
  },
  trackEvent(type, catId, score, total) {
    const s     = App.state;
    const p     = s.dailyQuestProgress || {};
    const today = new Date().toDateString();
    if (s.dailyQuestDate !== today) return;

    if (type === "play") {
      p.quizzesPlayedToday = (p.quizzesPlayedToday || 0) + 1;
      if (catId === "science")  p.scienceToday  = (p.scienceToday  || 0) + 1;
      if (catId === "computer") p.computerToday = (p.computerToday || 0) + 1;
      if (catId === "gk")       p.gkToday       = (p.gkToday       || 0) + 1;
      if (catId === "animals")  p.animalsToday  = (p.animalsToday  || 0) + 1;
      if (catId === "evs")      p.evsToday      = (p.evsToday      || 0) + 1;
      if (score)  p.correctToday = (p.correctToday || 0) + score;
    }
    if (type === "noHint")    p.noHintToday   = (p.noHintToday   || 0) + 1;
    if (type === "highScore") p.highScoreToday = (p.highScoreToday || 0) + 1;
    if (type === "combo")     p.comboToday    = (p.comboToday    || 0) + 1;

    s.dailyQuestProgress = p; App.save();

    (s.dailyQuests || []).forEach(q => {
      if ((p[q.trackKey] || 0) === q.target) {
        if (q.rewardType === "coins") App.addCoins(q.reward);
        else App.addXP(q.reward);
        App.showXPToast(`Quest done! +${q.reward} ${q.rewardType === "coins" ? "🪙" : "⚡"}`);
      }
    });
    this.updateStrip();
  },
};

/* ============================================================
   CHALLENGE MODE
   ============================================================ */
/* ============================================================
   PvP BATTLE SYSTEM — Coin Bet + Real-time via Supabase
   ============================================================ */
const PvP = {
  currentBet: 100,
  currentRoom: null,
  pollTimer: null,
  isHost: false,

  // ── Lobby ──────────────────────────────────────────────
  renderLobby() {
    // Category select already populated by Admin.populateCategorySelects
    // Update coin display
    const cd = document.getElementById("pvp-coin-display");
    if (cd) cd.textContent = App.state.coins || 0;
    // Load online players
    this.loadOnlinePlayers();
    // Render history
    this._renderHistory();
    // Start polling for incoming challenges
    this._pollIncoming();
  },

  async loadOnlinePlayers() {
    const list = document.getElementById("pvp-online-list");
    if (!list) return;
    list.innerHTML = "<p class='text-muted' style='text-align:center;padding:12px'>⏳ Loading players...</p>";
    try {
      // Search from profiles table (all registered players) — more reliable than leaderboard
      const { data: profileData } = await supa
        .from("profiles")
        .select("username, avatar, xp, level, streak, last_played")
        .neq("username", App.state.username)
        .order("xp", { ascending: false })
        .limit(50);

      // Also try leaderboard as fallback for extra players
      const { data: lbData } = await supa
        .from("leaderboard")
        .select("username, avatar, xp, level, streak, last_played")
        .neq("username", App.state.username)
        .order("xp", { ascending: false })
        .limit(50);

      // Merge both sources, deduplicate by username
      const merged = [...(profileData || [])];
      const seen = new Set(merged.map(p => p.username));
      (lbData || []).forEach(p => { if (!seen.has(p.username)) { seen.add(p.username); merged.push(p); } });

      if (!merged.length) {
        list.innerHTML = "<p class='text-muted' style='text-align:center;padding:20px'>No other players yet. Invite friends! 🙂</p>";
        return;
      }

      // Sort: recently active first
      merged.sort((a, b) => {
        const ta = a.last_played ? new Date(a.last_played).getTime() : 0;
        const tb = b.last_played ? new Date(b.last_played).getTime() : 0;
        return tb - ta;
      });

      const now = Date.now();
      list.innerHTML = merged.slice(0, 30).map(p => {
        const lastMs   = p.last_played ? new Date(p.last_played).getTime() : 0;
        const diffMins = Math.floor((now - lastMs) / 60000);
        const diffHrs  = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHrs / 24);
        let activeLabel = "";
        if (!p.last_played)        activeLabel = "<span class='pvp-status pvp-status-new'>🆕 New</span>";
        else if (diffMins < 10)    activeLabel = "<span class='pvp-status pvp-status-online'>🟢 Online</span>";
        else if (diffMins < 60)    activeLabel = "<span class='pvp-status pvp-status-recent'>🟡 " + diffMins + "m ago</span>";
        else if (diffHrs  < 24)    activeLabel = "<span class='pvp-status pvp-status-away'>⚪ " + diffHrs + "h ago</span>";
        else                       activeLabel = "<span class='pvp-status pvp-status-away'>⚪ " + diffDays + "d ago</span>";
        return `
        <div class="pvp-player-row">
          <span class="pvp-pr-avatar">${p.avatar || "🤖"}</span>
          <div class="pvp-pr-info">
            <div class="pvp-pr-name">${p.username} ${activeLabel}</div>
            <div class="pvp-pr-sub">LVL ${p.level || 1} · ⚡${p.xp || 0} XP · 🔥${p.streak || 0}</div>
          </div>
          <button class="pvp-challenge-btn" onclick="PvP.challengePlayer('${p.username}','${p.avatar || "🤖"}')">⚔️</button>
        </div>`;
      }).join("");
    } catch(e) {
      list.innerHTML = "<p class='text-muted' style='text-align:center'>❌ Error loading players. Check connection.</p>";
      console.warn("loadOnlinePlayers error:", e);
    }
  },

  async challengePlayer(targetUsername, targetAvatar) {
    const bet    = this.currentBet;
    const cat    = document.getElementById("ch-category")?.value || "gk";
    const diff   = document.getElementById("ch-diff")?.value || "medium";
    const qcount = parseInt(document.getElementById("ch-qcount")?.value || "10");
    const timer  = parseInt(document.getElementById("ch-timer")?.value || "15");
    const mode   = document.getElementById("ch-mode")?.value || "classic";

    if (App.state.coins < bet) { App.showXPToast("Not enough coins! 🪙"); return; }

    const pool      = (QUESTION_BANK[cat] || []).filter(q => q.diff === diff);
    const questions = Quiz.shuffle([...pool]).slice(0, qcount);
    const qIds      = questions.map(q => q.q);
    const roomCode  = this._genCode();

    try {
      App.showXPToast("Sending challenge...");
      const { data, error } = await supa
        .from("pvp_challenges")
        .insert({
          room_code:      roomCode,
          host_username:  App.state.username,
          host_avatar:    App.state.avatar,
          guest_username: targetUsername,
          guest_avatar:   targetAvatar,
          bet_amount:     bet,
          category:       cat,
          difficulty:     diff,
          question_ids:   qIds,
          question_count: qcount,
          time_per_q:     timer,
          game_mode:      mode,
          status:         "invited",
        })
        .select().single();

      if (error) throw error;
      this.currentRoom = data;
      this.isHost = true;
      App.showXPToast(`⚔️ Challenge sent to ${targetUsername}!`);
      this._showWaitRoom(data);
      this._startPolling(data.room_code);
    } catch(e) {
      App.showXPToast("Error: " + e.message);
    }
  },

  // Poll for incoming challenges (someone challenged ME)
  _incomingTimer: null,
  _pollIncoming() {
    if (this._incomingTimer) clearInterval(this._incomingTimer);
    this._incomingTimer = setInterval(async () => {
      if (!App.state?.username) return;
      try {
        const { data } = await supa
          .from("pvp_challenges")
          .select("*")
          .eq("guest_username", App.state.username)
          .eq("status", "invited")
          .order("created_at", { ascending: false })
          .limit(1);

        if (data?.length) {
          const challenge = data[0];
          // Don't show if already seeing this one
          if (this._lastIncoming === challenge.id) return;
          this._lastIncoming = challenge.id;
          this._showIncoming(challenge);
        } else {
          document.getElementById("pvp-incoming").style.display = "none";
        }
      } catch(e) {}
    }, 3000);
  },

  _lastIncoming: null,

  _showIncoming(challenge) {
    const box = document.getElementById("pvp-incoming");
    if (!box) return;
    document.getElementById("pvp-incoming-from").textContent = `⚔️ ${challenge.host_username} challenged you!`;
    document.getElementById("pvp-incoming-bet").textContent  = `Bet: ${challenge.bet_amount} 🪙`;
    box.style.display = "block";
    this._pendingChallenge = challenge;
    Sound.boss?.();
    Haptic?.success?.();
  },

  _pendingChallenge: null,

  async acceptChallenge() {
    const challenge = this._pendingChallenge;
    if (!challenge) return;
    if (App.state.coins < challenge.bet_amount) {
      App.showXPToast(`Need ${challenge.bet_amount} 🪙 to accept!`);
      return;
    }
    try {
      await supa.from("pvp_challenges")
        .update({ status: "ready" })
        .eq("id", challenge.id);

      this.currentRoom = { ...challenge, status: "ready" };
      this.isHost = false;
      document.getElementById("pvp-incoming").style.display = "none";
      this._showWaitRoom(this.currentRoom);
      this._startPolling(challenge.room_code);
    } catch(e) {
      App.showXPToast("Error: " + e.message);
    }
  },

  async declineChallenge() {
    const challenge = this._pendingChallenge;
    if (challenge) {
      await supa.from("pvp_challenges").update({ status: "cancelled" }).eq("id", challenge.id);
    }
    this._pendingChallenge = null;
    document.getElementById("pvp-incoming").style.display = "none";
  },

  setBet(amount) {
    this.currentBet = amount;
    document.querySelectorAll(".pvp-bet-btn").forEach(b => b.classList.remove("active"));
    event?.target?.classList.add("active");
  },

  _getBet() { return this.currentBet; },

  _showWaitRoom(room) {
    document.getElementById("pvp-wait-code").textContent   = room.room_code;
    document.getElementById("pvp-host-avatar").textContent = room.host_avatar;
    document.getElementById("pvp-host-name").textContent   = room.host_username;
    document.getElementById("pvp-guest-avatar").textContent = room.guest_avatar || "❓";
    document.getElementById("pvp-guest-name").textContent   = room.guest_username || "Waiting...";
    document.getElementById("pvp-wait-bet").textContent    = room.bet_amount;

    const startWrap = document.getElementById("pvp-start-btn-wrap");
    const status    = document.getElementById("pvp-wait-status");

    if (room.status === "ready") {
      status.textContent = "✅ Opponent accepted! Ready to battle!";
      if (this.isHost) startWrap.style.display = "block";
    } else if (room.status === "invited") {
      status.textContent = this.isHost
        ? `⏳ Waiting for ${room.guest_username} to accept...`
        : "⚔️ Challenge received! Accept to play.";
      startWrap.style.display = "none";
    } else {
      status.textContent = "⏳ Waiting...";
      startWrap.style.display = "none";
    }

    App._activateScreen("pvp-wait");
  },

  copyWaitCode() {
    const code = document.getElementById("pvp-wait-code")?.textContent;
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => App.showXPToast("📋 Code copied!"))
      .catch(() => App.showXPToast("Code: " + code));
  },

  // ── Polling — check room status every 2s ────────────────
  _startPolling(roomCode) {
    this._stopPolling();
    this.pollTimer = setInterval(async () => {
      try {
        const { data } = await supa
          .from("pvp_challenges")
          .select("*")
          .eq("room_code", roomCode)
          .single();

        if (!data) { this._stopPolling(); return; }
        this.currentRoom = data;

        // Guest accepted (invited → ready)?
        if (data.status === "ready" && this.isHost) {
          document.getElementById("pvp-guest-avatar").textContent = data.guest_avatar || "🙂";
          document.getElementById("pvp-guest-name").textContent   = data.guest_username;
          document.getElementById("pvp-wait-status").textContent  = "✅ Opponent accepted! Ready to battle!";
          document.getElementById("pvp-start-btn-wrap").style.display = "block";
          Sound.achieve?.();
          Haptic?.success?.();
        }

        // Battle started by host?
        if (data.status === "playing" && !this.isHost) {
          this._stopPolling();
          this._startBattleAsGuest(data);
        }

        // Result ready?
        if (data.status === "finished") {
          this._stopPolling();
          this._showResult(data);
        }

      } catch(e) { console.warn("Poll error:", e); }
    }, 2000);
  },

  _stopPolling() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  },

  // ── Start Battle ─────────────────────────────────────────
  async startBattle() {
    if (!this.currentRoom) return;
    // Deduct bet from host
    App.addCoins(-this.currentRoom.bet_amount);
    App.save();

    await supa.from("pvp_challenges").update({ status: "playing" }).eq("room_code", this.currentRoom.room_code);
    this._stopPolling();
    this._launchQuiz(this.currentRoom);
  },

  async _startBattleAsGuest(room) {
    // Deduct bet from guest
    App.addCoins(-room.bet_amount);
    App.save();
    App.showXPToast("⚡ Battle starting!");

    // Always fetch fresh room data from Supabase so question_ids are present
    try {
      const { data: freshRoom } = await supa
        .from("pvp_challenges")
        .select("*")
        .eq("room_code", room.room_code)
        .single();
      const roomToUse = (freshRoom && freshRoom.question_ids?.length) ? freshRoom : room;
      setTimeout(() => this._launchQuiz(roomToUse), 1000);
    } catch(e) {
      // Fallback to passed room data
      setTimeout(() => this._launchQuiz(room), 1000);
    }
  },

  _launchQuiz(room) {
    const pool     = (QUESTION_BANK[room.category] || []).filter(q => q.diff === room.difficulty);
    const qcount   = room.question_count || 10;
    const timePerQ = room.time_per_q     || 15;
    const mode     = room.game_mode      || "classic";

    // Try to match stored question IDs — support both string and numeric IDs
    let questions = [];
    if (room.question_ids?.length) {
      const idSet = new Set(room.question_ids.map(id => String(id)));
      questions = pool.filter(q => idSet.has(String(q.q)) || idSet.has(String(q.id)));
    }
    // Fallback: if ID matching fails, pick random questions of same count
    if (questions.length < 3) {
      questions = Quiz.shuffle([...pool]).slice(0, qcount);
    }
    // Trim to requested count
    questions = questions.slice(0, qcount);

    Quiz.questions = questions;
    Quiz.current = 0; Quiz.score = 0; Quiz.lives = 3; Quiz.combo = 0;
    Quiz.timeBonus = 0; Quiz.results = []; Quiz.bossTriggered = false;
    Quiz.consecutiveCorrect = 0; Quiz.shieldActive = false; Quiz.hintUsedQuiz = false;
    Quiz.catId = room.category; Quiz.mode = mode; Quiz.diff = room.difficulty;
    Quiz._pvpRoom = room.room_code;
    Quiz._pvpIsHost = this.isHost;

    // Apply custom timer from room settings
    Quiz.DIFF_TIME = { ...Quiz.DIFF_TIME, [room.difficulty]: timePerQ };

    Quiz.countdown(() => { App._activateScreen("quiz"); Quiz.renderQuestion(); });
  },

  cancelRoom() {
    this._stopPolling();
    if (this.currentRoom) {
      supa.from("pvp_challenges").update({ status: "cancelled" }).eq("room_code", this.currentRoom.room_code);
      // Refund if already deducted
    }
    this.currentRoom = null;
    App.nav("challenge");
  },

  // ── Submit Score ─────────────────────────────────────────
  async submitScore(roomCode, score, isHost) {
    try {
      // Submit my score
      const field = isHost ? { host_score: score } : { guest_score: score };
      await supa.from("pvp_challenges").update(field).eq("room_code", roomCode);

      // Check if both scores are in
      const { data } = await supa.from("pvp_challenges").select("*").eq("room_code", roomCode).single();
      if (!data) throw new Error("Room not found");

      if (data.host_score !== null && data.guest_score !== null) {
        // Both done — determine winner
        const hostWon = data.host_score >= data.guest_score;
        const winner  = hostWon ? data.host_username : data.guest_username;

        // Try server-side settle first (secure), fallback to direct update
        const { error: rpcErr } = await supa.rpc("settle_pvp_battle", {
          p_room_code: roomCode, p_winner_username: winner,
        });
        if (rpcErr) {
          await supa.from("pvp_challenges")
            .update({ status: "finished", winner_username: winner })
            .eq("room_code", roomCode);
        }

        // Award coins to winner
        if (winner === App.state.username) {
          App.addCoins(data.bet_amount * 2);
          App.save();
          Confetti.burst();
        }
        this._showResult({ ...data, winner_username: winner, status: "finished" });

      } else {
        // Waiting for opponent
        App.showXPToast("⏳ Waiting for opponent...");
        App._activateScreen("pvp-wait");
        const st = document.getElementById("pvp-wait-status");
        if (st) st.textContent = "⏳ Waiting for opponent's result...";
        document.getElementById("pvp-start-btn-wrap").style.display = "none";
        this._pollForResult(roomCode);
      }
    } catch(e) {
      console.warn("Submit score error:", e);
      App.showXPToast("Score submit error. Coins refunded.");
      if (this.currentRoom) { App.addCoins(this.currentRoom.bet_amount); App.save(); }
      App.nav("home");
    }
  },

  _pollForResult(roomCode) {
    this._stopPolling();
    let attempts = 0;
    this.pollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        this._stopPolling();
        App.showXPToast("Opponent timed out. Bet refunded.");
        if (this.currentRoom) { App.addCoins(this.currentRoom.bet_amount); App.save(); }
        App.nav("home");
        return;
      }
      try {
        const { data } = await supa.from("pvp_challenges").select("*").eq("room_code", roomCode).single();
        if (data?.status === "finished") {
          this._stopPolling();
          if (data.winner_username === App.state.username) {
            App.addCoins(data.bet_amount * 2);
            App.save();
            Confetti.burst();
          }
          this._showResult(data);
        }
      } catch(e) {}
    }, 2000);
  },

  // ── Result Screen ────────────────────────────────────────
  _showResult(data) {
    this._stopPolling();
    const iWon = data.winner_username === App.state.username;
    const isDraw = data.host_score === data.guest_score;

    document.getElementById("pvp-result-trophy").textContent = iWon ? "🏆" : isDraw ? "🤝" : "💀";
    document.getElementById("pvp-result-title").textContent  = iWon ? "YOU WIN!" : isDraw ? "DRAW!" : "YOU LOSE!";
    document.getElementById("pvr-host-name").textContent  = data.host_username;
    document.getElementById("pvr-guest-name").textContent = data.guest_username || "Opponent";
    document.getElementById("pvr-host-score").textContent  = data.host_score  ?? "?";
    document.getElementById("pvr-guest-score").textContent = data.guest_score ?? "?";

    const coinResult = document.getElementById("pvp-coins-result");
    if (iWon) {
      coinResult.innerHTML = `<span style="color:var(--c-neon)">+${data.bet_amount} 🪙 coins won!</span>`;
    } else if (isDraw) {
      coinResult.innerHTML = `<span style="color:var(--c-yellow)">🤝 Coins returned</span>`;
      App.addCoins(data.bet_amount); App.save(); // refund draw
    } else {
      coinResult.innerHTML = `<span style="color:var(--c-red)">-${data.bet_amount} 🪙 coins lost</span>`;
    }

    // Save to history
    const history = App.state.challengeHistory || [];
    history.unshift({
      opponent: iWon ? (data.guest_username || data.host_username) : data.host_username,
      result:   iWon ? "win" : isDraw ? "draw" : "loss",
      bet:      data.bet_amount,
      myScore:  this.isHost ? data.host_score : data.guest_score,
      oppScore: this.isHost ? data.guest_score : data.host_score,
      date:     new Date().toLocaleDateString(),
    });
    App.state.challengeHistory = history.slice(0, 10);
    App.state.challengesDone = (App.state.challengesDone || 0) + 1;
    App.save();

    this.currentRoom = null;
    App._activateScreen("pvp-result");
  },

  _renderHistory() {
    const hist = document.getElementById("pvp-history");
    if (!hist) return;
    const ch = App.state.challengeHistory || [];
    if (!ch.length) {
      hist.innerHTML = "<p class='text-muted' style='padding:8px 0'>No battles yet. Challenge someone!</p>";
      return;
    }
    hist.innerHTML = ch.slice(0, 5).map(c => `
      <div class="pvp-hist-row">
        <span class="pvp-hist-result pvp-hist-${c.result}">${c.result === "win" ? "🏆 WIN" : c.result === "draw" ? "🤝 DRAW" : "💀 LOSS"}</span>
        <span class="pvp-hist-opp">vs ${c.opponent}</span>
        <span class="pvp-hist-score">${c.myScore ?? "?"}–${c.oppScore ?? "?"}</span>
        <span class="pvp-hist-bet">${c.result === "win" ? "+" : c.result === "draw" ? "±" : "-"}${c.bet}🪙</span>
      </div>`).join("");
  },

  _genCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  },
};

/* Legacy alias so old code doesn't break */
const Challenge = { render() { PvP.renderLobby(); }, generate() {}, join() {}, autoJoin() {} };



/* ============================================================
   REVIEW MODE
   ============================================================ */
const ReviewMode = {
  render() {
    const wrong = App.state.wrongQuestions || [];
    const list  = document.getElementById("review-list");
    const btn   = document.getElementById("review-start-btn");
    list.innerHTML = "";
    if (!wrong.length) {
      list.innerHTML = "<p class='text-muted' style='padding:16px'>No wrong answers yet! Play some quizzes first. 😊</p>";
      btn.disabled = true; return;
    }
    btn.disabled = false;
    wrong.slice(0, 10).forEach((q, i) => {
      const div = document.createElement("div");
      div.className = "review-item";
      div.innerHTML = `<div class="ri-num">${i + 1}</div><div class="ri-q">${q.q}<div class="ri-ans">✅ ${q.opts[q.ans]}</div></div>`;
      list.appendChild(div);
    });
  },
  start() {
    const wrong = App.state.wrongQuestions || [];
    if (!wrong.length) { App.showXPToast("No wrong answers to review!"); return; }
    App.state.reviewDone = (App.state.reviewDone || 0) + 1; App.save();
    Quiz.questions = Quiz.shuffle([...wrong]).slice(0, 10);
    Quiz.current = 0; Quiz.score = 0; Quiz.lives = 3; Quiz.combo = 0;
    Quiz.timeBonus = 0; Quiz.results = []; Quiz.bossTriggered = false;
    Quiz.consecutiveCorrect = 0; Quiz.shieldActive = false; Quiz.hintUsedQuiz = false;
    Quiz.catId = "review"; Quiz.mode = "classic"; Quiz.diff = "medium";
    Quiz.countdown(() => { App.nav("quiz"); Quiz.renderQuestion(); });
  },
};



/* ============================================================
   BOOKMARK SYSTEM
   ============================================================ */
const Bookmark = {
  toggle() {
    const q = Quiz.questions[Quiz.current];
    if (!q) return;
    const bookmarks = App.state.bookmarks || [];
    const key = q.q;
    const idx = bookmarks.findIndex(b => b.q === key);
    if (idx === -1) {
      bookmarks.push({ ...q });
      App.showXPToast("🔖 Bookmarked!");
    } else {
      bookmarks.splice(idx, 1);
      App.showXPToast("🔖 Removed!");
    }
    App.state.bookmarks = bookmarks;
    App.save();
    this.updateBtn();
  },

  updateBtn() {
    const btn = document.getElementById("bookmark-btn");
    if (!btn) return;
    const q = Quiz.questions[Quiz.current];
    if (!q) return;
    const bookmarks = App.state.bookmarks || [];
    const saved = bookmarks.some(b => b.q === q.q);
    btn.classList.toggle("bookmarked", saved);
    btn.title = saved ? "Remove Bookmark" : "Bookmark";
  },

  render() {
    const bookmarks = App.state.bookmarks || [];
    const list = document.getElementById("bookmarks-list");
    const btn  = document.getElementById("bookmark-quiz-btn");
    list.innerHTML = "";
    if (!bookmarks.length) {
      list.innerHTML = "<p class='text-muted' style='padding:16px'>No bookmarks yet! Tap 🔖 during a quiz to save questions.</p>";
      if (btn) btn.disabled = true;
      return;
    }
    if (btn) btn.disabled = false;
    bookmarks.forEach((q, i) => {
      const div = document.createElement("div");
      div.className = "review-item";
      div.innerHTML = `
        <div class="ri-num">${i + 1}</div>
        <div class="ri-q">
          ${q.q}
          <div class="ri-ans">✅ ${q.opts[q.ans]}</div>
        </div>
        <button class="bm-remove-btn" onclick="Bookmark.remove(${i})">✕</button>`;
      list.appendChild(div);
    });
  },

  remove(idx) {
    const bookmarks = App.state.bookmarks || [];
    bookmarks.splice(idx, 1);
    App.state.bookmarks = bookmarks;
    App.save();
    this.render();
  },

  clearAll() {
    if (!confirm("Clear all bookmarks?")) return;
    App.state.bookmarks = [];
    App.save();
    this.render();
  },

  startQuiz() {
    const bookmarks = App.state.bookmarks || [];
    if (!bookmarks.length) { App.showXPToast("No bookmarks yet!"); return; }
    Quiz.questions = Quiz.shuffle([...bookmarks]).slice(0, 10);
    Quiz.current = 0; Quiz.score = 0; Quiz.lives = 3; Quiz.combo = 0;
    Quiz.timeBonus = 0; Quiz.results = []; Quiz.bossTriggered = false;
    Quiz.consecutiveCorrect = 0; Quiz.shieldActive = false; Quiz.hintUsedQuiz = false;
    Quiz.catId = "bookmarks"; Quiz.mode = "classic"; Quiz.diff = "easy";
    Quiz.countdown(() => { App.nav("quiz"); Quiz.renderQuestion(); });
  },
};

/* ============================================================
   DAILY REWARD POPUP
   ============================================================ */
const DailyReward = {
  show(xp, coins) {
    const streak = App.state.streak || 1;
    document.getElementById("daily-reward-streak-num").textContent = streak;
    document.getElementById("daily-reward-xp").textContent    = "+" + xp;
    document.getElementById("daily-reward-coins").textContent  = "+" + coins;

    // Animated emoji based on streak
    const icon = document.getElementById("daily-reward-icon");
    if (streak >= 30)     icon.textContent = "🔥👑";
    else if (streak >= 7) icon.textContent = "🔥⚡";
    else                  icon.textContent = "🌟";

    const modal = document.getElementById("daily-reward-modal");
    modal.style.display = "flex";
    icon.classList.remove("daily-reward-burst");
    void icon.offsetWidth; // reflow to restart animation
    icon.classList.add("daily-reward-burst");
    Confetti.burst();
  },
};


/* ============================================================
   ADMIN PANEL
   ============================================================ */
const Admin = {
  tab(name, el) {
    Sound.click();
    ["admin-add","admin-visitors","admin-gifts","admin-ban","admin-broadcast","admin-maintenance","admin-graph","admin-cheaters","admin-csv"].forEach(id => {
      const el2 = document.getElementById(id);
      if (el2) el2.style.display = "none";
    });
    const panel = document.getElementById(`admin-${name}`);
    if (panel) panel.style.display = "block";
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
    if (el) el.classList.add("active");
    if (name === "manage")      this.renderManage();
    if (name === "visitors")    this.loadStats();
    if (name === "gifts")       this.loadGiftHistory();
    if (name === "ban")         this.loadBannedPlayers();
    if (name === "broadcast")   this.loadBroadcastHistory();
    if (name === "maintenance") this.loadMaintenanceStatus();
    if (name === "graph")       this.loadVisitorGraph();
    if (name === "cheaters")    this.loadCheaterDetection();
  },

  populateCategorySelects() {
    ["af-category","manage-filter","ch-category"].forEach(id => {
      const sel = document.getElementById(id); if (!sel) return;
      if (id === "manage-filter") sel.innerHTML = '<option value="all">All</option>';
      else sel.innerHTML = "";
      CATEGORIES.forEach(cat => {
        const o = document.createElement("option");
        o.value = cat.id; o.textContent = cat.emoji + " " + cat.name;
        sel.appendChild(o);
      });
    });
  },

  addQuestion() {
    const catId = document.getElementById("af-category").value;
    const diff  = document.getElementById("af-diff").value;
    const q     = document.getElementById("af-question").value.trim();
    const opts  = [0,1,2,3].map(i => document.getElementById(`af-opt${i}`).value.trim());
    const ans   = parseInt(document.getElementById("af-ans").value);
    const hint  = document.getElementById("af-hint").value.trim();
    if (!q || opts.some(o => !o)) { alert("Fill in question and all 4 options."); return; }
    App.state.customQuestions = App.state.customQuestions || [];
    App.state.customQuestions.push({ q, opts, ans, hint, diff, category: catId });
    App.save();
    ["af-question","af-opt0","af-opt1","af-opt2","af-opt3","af-hint"].forEach(id => {
      document.getElementById(id).value = "";
    });
    App.showXPToast("✅ Question added!");
    HomeScreen.refresh();
  },

  renderManage() {
    const filter   = document.getElementById("manage-filter").value;
    const custom   = App.state.customQuestions || [];
    const filtered = filter === "all" ? custom : custom.filter(q => q.category === filter);
    const list     = document.getElementById("manage-list");
    list.innerHTML = "";
    if (!filtered.length) {
      list.innerHTML = '<p style="color:var(--c-muted);text-align:center;padding:20px">No custom questions yet.</p>';
      return;
    }
    filtered.forEach(q => {
      const ri  = App.state.customQuestions.indexOf(q);
      const cat = CATEGORIES.find(c => c.id === q.category);
      const div = document.createElement("div");
      div.className = "manage-item";
      div.innerHTML = `
        <div class="manage-cat">${cat ? cat.emoji + " " + cat.name : q.category} · ${q.diff || "easy"}</div>
        <div class="manage-q">${q.q}</div>
        <div class="manage-actions"><button class="btn-delete" onclick="Admin.deleteQ(${ri})">🗑 Delete</button></div>`;
      list.appendChild(div);
    });
  },

  deleteQ(idx) {
    if (confirm("Delete this question?")) {
      App.state.customQuestions.splice(idx, 1); App.save();
      this.renderManage(); HomeScreen.refresh();
    }
  },

  // ── Visitors & Stats ──────────────────────────────────
  _statsChannel: null,
  _allPlayers: [],   // cache for client-side filter

  async loadStats() {
    try {
      // Visitor count
      const { data: vData } = await supa.from("visitors").select("count").single();
      const vc = document.getElementById("admin-visitor-count");
      if (vc) vc.textContent = (vData?.count || 0).toLocaleString();

      // Player count (profiles = registered players)
      const { count: pCount } = await supa.from("profiles").select("*", { count:"exact", head:true });
      const pc = document.getElementById("admin-player-count");
      if (pc) pc.textContent = (pCount || 0).toLocaleString();

      // Leaderboard count
      const { count: lCount } = await supa.from("leaderboard").select("*", { count:"exact", head:true });
      const lc = document.getElementById("admin-lb-count");
      if (lc) lc.textContent = (lCount || 0).toLocaleString();

      // Load full player list
      await this.loadOnlinePlayers();

      // Start realtime if not already
      this._startStatsRealtime();
    } catch(e) {
      App.showXPToast("Stats error: " + e.message);
    }
  },

  _startStatsRealtime() {
    if (this._statsChannel) return;
    this._statsChannel = supa
      .channel("admin-stats-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, () => {
        this.loadStats();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => {
        this.loadStats();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leaderboard" }, () => {
        this.loadStats();
      })
      .subscribe();
  },

  // ── Gift System ───────────────────────────────────────
  async sendGift() {
    const username = document.getElementById("gift-username").value.trim();
    const amount   = parseInt(document.getElementById("gift-amount").value);
    const message  = document.getElementById("gift-message").value.trim();
    if (!username) { App.showXPToast("Enter username!"); return; }
    if (!amount || amount < 1) { App.showXPToast("Enter valid amount!"); return; }

    try {
      const { error } = await supa.from("coin_gifts").insert({
        to_username: username,
        amount,
        message: message || "",
        from_admin: true,
        claimed: false,
      });

      if (error) {
        if (error.code === "42501") {
          App.showXPToast("⚠️ RLS Error — run SQL fix in Supabase!");
          console.error("Fix: DROP POLICY IF EXISTS \"gifts_insert\" ON coin_gifts; CREATE POLICY \"gifts_insert\" ON coin_gifts FOR INSERT WITH CHECK (true);");
        } else {
          App.showXPToast("Error: " + error.message);
        }
        return;
      }

      App.showXPToast(`🎁 Sent ${amount} 🪙 to ${username}!`);
      document.getElementById("gift-username").value = "";
      document.getElementById("gift-amount").value   = "";
      document.getElementById("gift-message").value  = "";
      this.loadGiftHistory();
    } catch(e) {
      App.showXPToast("Error: " + e.message);
    }
  },

  async loadGiftHistory() {
    const list = document.getElementById("admin-gift-history");
    if (!list) return;
    try {
      const { data } = await supa
        .from("coin_gifts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!data?.length) {
        list.innerHTML = "<p class='text-muted' style='padding:8px 0'>No gifts sent yet.</p>";
        return;
      }
      list.innerHTML = data.map(g => `
        <div class="admin-gift-row">
          <span class="agr-to">👤 ${g.to_username}</span>
          <span class="agr-amount">+${g.amount} 🪙</span>
          <span class="agr-status ${g.claimed ? "claimed" : "pending"}">${g.claimed ? "✅ Claimed" : "⏳ Pending"}</span>
          ${g.message ? `<span class="agr-msg">"${g.message}"</span>` : ""}
        </div>`).join("");
    } catch(e) {
      list.innerHTML = "<p class='text-muted'>Error loading gifts.</p>";
    }
  },

  // ── Online Players ────────────────────────────────────
  async loadOnlinePlayers() {
    const list = document.getElementById("admin-online-list");
    if (!list) return;
    list.innerHTML = "<p class='text-muted' style='text-align:center;padding:12px'>Loading…</p>";
    try {
      // Fetch all profiles (registered/gmail users)
      const { data: profiles } = await supa
        .from("profiles")
        .select("username, avatar, email, auth_provider, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      // Fetch leaderboard for xp/level/last_played
      const { data: lb } = await supa
        .from("leaderboard")
        .select("username, xp, level, streak, last_played")
        .order("last_played", { ascending: false })
        .limit(200);

      // Merge: leaderboard rows keyed by username
      const lbMap = {};
      (lb || []).forEach(r => { lbMap[r.username] = r; });

      // Build unified list
      const allProfiles = (profiles || []).map(p => ({
        username:     p.username || "Unknown",
        avatar:       p.avatar   || "🤖",
        email:        p.email    || null,
        type:         p.auth_provider === "google" ? "gmail" : (p.email ? "gmail" : "guest"),
        xp:           lbMap[p.username]?.xp      || 0,
        level:        lbMap[p.username]?.level    || 1,
        streak:       lbMap[p.username]?.streak   || 0,
        last_played:  lbMap[p.username]?.last_played || p.created_at,
      }));

      // Also pick up leaderboard-only entries (guests who never hit profiles)
      (lb || []).forEach(r => {
        if (!allProfiles.find(p => p.username === r.username)) {
          allProfiles.push({
            username:    r.username,
            avatar:      "👤",
            email:       null,
            type:        "guest",
            xp:          r.xp    || 0,
            level:       r.level || 1,
            streak:      r.streak|| 0,
            last_played: r.last_played,
          });
        }
      });

      this._allPlayers = allProfiles;
      this.filterVisitors();
    } catch(e) {
      list.innerHTML = "<p class='text-muted' style='text-align:center;padding:12px'>Error: " + e.message + "</p>";
    }
  },

  filterVisitors() {
    const list   = document.getElementById("admin-online-list");
    if (!list) return;
    const filter = document.getElementById("visitor-filter")?.value || "all";
    const data   = filter === "all"   ? this._allPlayers
                 : filter === "gmail" ? this._allPlayers.filter(p => p.type === "gmail")
                 :                      this._allPlayers.filter(p => p.type === "guest");

    if (!data.length) {
      list.innerHTML = "<p class='text-muted' style='text-align:center;padding:16px'>No players found.</p>";
      return;
    }
    list.innerHTML = data.map(p => `
      <div class="admin-player-row">
        <span class="apr-avatar">${p.avatar}</span>
        <div class="apr-info">
          <div class="apr-name">
            ${p.username}
            <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:5px;
              ${p.type==="gmail"
                ? "background:linear-gradient(135deg,#ea4335,#fbbc05);color:#fff"
                : "background:#334155;color:#94a3b8"}">
              ${p.type==="gmail" ? "GMAIL" : "GUEST"}
            </span>
          </div>
          <div class="apr-sub">${p.email ? "📧 "+p.email : "👤 No email"} · LVL ${p.level} · ⚡${p.xp} XP</div>
        </div>
        <div class="apr-meta">
          <span class="apr-time">${p.last_played ? this._timeAgo(p.last_played) : "—"}</span>
          <button onclick="Admin.banPlayer('${p.username}')"
            style="background:#ef4444;color:#fff;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:11px;margin-top:4px;display:block">
            🚫 Ban
          </button>
        </div>
      </div>`).join("");
  },


  // ══════════════════════════════════════════════════════
  // 📊 DAILY VISITORS GRAPH
  // ══════════════════════════════════════════════════════
  async loadVisitorGraph() {
    const canvas = document.getElementById("admin-visitor-graph");
    if (!canvas) return;

    try {
      // Fetch last 7 days of visitor logs
      const { data } = await supa
        .from("visitor_logs")
        .select("visited_date, count")
        .order("visited_date", { ascending: true })
        .limit(7);

      // Build last 7 days labels
      const today = new Date();
      const labels = [], vals = [];
      for (let i = 6; i >= 0; i--) {
        const d   = new Date(today); d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        labels.push(d.toLocaleDateString("en", { weekday: "short" }));
        const found = (data || []).find(r => r.visited_date === key);
        vals.push(found ? Number(found.count) : 0);
      }

      this._drawBarChart(canvas, labels, vals, "#00f5c4");
    } catch(e) {
      // Table not created yet — show setup message
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#64748b";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Run setup SQL to enable graph", canvas.width / 2, canvas.height / 2);
    }
  },

  _drawBarChart(canvas, labels, vals, color = "#00f5c4") {
    canvas.width  = canvas.offsetWidth || 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxVal = Math.max(...vals, 1);
    const w = canvas.width, h = canvas.height;
    const pad = 30, bw = (w - pad * 2) / labels.length, barW = bw * 0.55;

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = h - pad - (i / 4) * (h - pad * 1.5);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "9px sans-serif"; ctx.textAlign = "right";
      ctx.fillText(Math.round(maxVal * i / 4), pad - 4, y + 3);
    }

    // Bars
    vals.forEach((v, i) => {
      const x    = pad + i * bw + bw * 0.22;
      const barH = Math.max(2, (v / maxVal) * (h - pad * 1.5));
      const y    = h - pad - barH;
      const grad = ctx.createLinearGradient(0, y, 0, h - pad);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + "22");
      ctx.fillStyle = grad;
      ctx.shadowColor = color; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, barH, 4) : ctx.rect(x, y, barW, barH);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Labels
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(labels[i], x + barW / 2, h - 8);
      if (v > 0) {
        ctx.fillStyle = color;
        ctx.font = "bold 10px sans-serif";
        ctx.fillText(v, x + barW / 2, y - 5);
      }
    });
  },

  // ══════════════════════════════════════════════════════
  // 🚨 CHEATER DETECTION
  // ══════════════════════════════════════════════════════
  async loadCheaterDetection() {
    const list = document.getElementById("admin-cheater-list");
    if (!list) return;
    list.innerHTML = "<p class='text-muted' style='text-align:center;padding:12px'>Scanning...</p>";

    try {
      // Fetch leaderboard — high XP or coins players
      const { data: lb } = await supa
        .from("leaderboard")
        .select("username, xp, level, streak, last_played")
        .order("xp", { ascending: false })
        .limit(200);

      const { data: profiles } = await supa
        .from("profiles")
        .select("username, xp, coins, level, streak, quizzes_played, total_correct, created_at")
        .order("coins", { ascending: false })
        .limit(200);

      const suspects = [];

      (profiles || []).forEach(p => {
        const flags = [];
        const lbEntry = (lb || []).find(l => l.username === p.username);

        // Flag: XP too high for quizzes played
        if (p.quizzes_played > 0 && p.xp / p.quizzes_played > 200) flags.push("⚡ XP/quiz ratio too high");
        // Flag: Coins > 50,000
        if (p.coins > 50000) flags.push("🪙 Coins > 50,000");
        // Flag: XP > 100,000
        if (p.xp > 100000) flags.push("📈 XP > 100,000");
        // Flag: Perfect accuracy on many quizzes
        if (p.quizzes_played > 20 && p.total_correct === p.quizzes_played * 10) flags.push("🎯 Suspicious perfect score");
        // Flag: High streak
        if (p.streak > 365) flags.push("🔥 Streak > 365 days");
        // Flag: XP mismatch between profiles and leaderboard
        if (lbEntry && Math.abs(lbEntry.xp - p.xp) > 5000) flags.push("⚠️ XP mismatch (profile vs leaderboard)");

        if (flags.length > 0) {
          suspects.push({ ...p, flags });
        }
      });

      if (!suspects.length) {
        list.innerHTML = "<div style='text-align:center;padding:24px'><div style='font-size:2rem'>✅</div><p style='color:#22c55e;margin-top:8px'>No suspicious players found!</p></div>";
        return;
      }

      list.innerHTML = suspects.map(p => `
        <div style="background:#1e293b;border-radius:10px;padding:12px;margin-bottom:10px;border-left:3px solid #f59e0b">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-weight:700;color:#e2e8f0">${p.username}</div>
            <button onclick="Admin.banPlayer('${p.username}')"
              style="background:#ef4444;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700">
              🚫 Ban
            </button>
          </div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:6px">
            XP: ${(p.xp||0).toLocaleString()} · Coins: ${(p.coins||0).toLocaleString()} · Quizzes: ${p.quizzes_played||0}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${p.flags.map(f => `<span style="background:#f59e0b22;color:#f59e0b;padding:2px 8px;border-radius:20px;font-size:11px">${f}</span>`).join("")}
          </div>
        </div>`).join("");

    } catch(e) {
      list.innerHTML = "<p class='text-muted' style='text-align:center'>Error: " + e.message + "</p>";
    }
  },

  // ══════════════════════════════════════════════════════
  // 📥 BULK CSV QUESTION IMPORT
  // ══════════════════════════════════════════════════════
  handleCSVImport(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this._parseAndPreviewCSV(text);
    };
    reader.readAsText(file);
  },

  _parseAndPreviewCSV(text) {
    const preview = document.getElementById("csv-preview");
    const importBtn = document.getElementById("csv-import-btn");
    if (!preview) return;

    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      preview.innerHTML = "<p style='color:#ef4444'>❌ CSV is empty or invalid!</p>";
      return;
    }

    // Skip header row
    const rows = lines.slice(1);
    const questions = [];
    const errors = [];

    rows.forEach((line, idx) => {
      // Support comma-separated: category,difficulty,question,optA,optB,optC,optD,correct_index,hint
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 8) { errors.push(`Row ${idx+2}: Not enough columns`); return; }

      const [category, difficulty, question, optA, optB, optC, optD, correct, hint] = cols;
      const ansIdx = parseInt(correct);

      if (!question) { errors.push(`Row ${idx+2}: Missing question`); return; }
      if (isNaN(ansIdx) || ansIdx < 0 || ansIdx > 3) { errors.push(`Row ${idx+2}: correct_index must be 0-3`); return; }

      questions.push({
        category: category || "gk",
        diff:     difficulty || "medium",
        q:        question,
        opts:     [optA, optB, optC, optD],
        ans:      ansIdx,
        hint:     hint || "",
      });
    });

    this._pendingImport = questions;

    preview.innerHTML = `
      <div style="background:#0f172a;border-radius:8px;padding:12px;margin-top:12px">
        <div style="color:#22c55e;font-weight:700;margin-bottom:8px">✅ ${questions.length} questions ready to import</div>
        ${errors.length ? `<div style="color:#f59e0b;font-size:12px;margin-bottom:8px">⚠️ ${errors.length} rows skipped: ${errors.slice(0,3).join(", ")}</div>` : ""}
        <div style="max-height:150px;overflow-y:auto">
          ${questions.slice(0,5).map((q,i) => `
            <div style="font-size:11px;color:#94a3b8;padding:4px 0;border-bottom:1px solid #1e293b">
              ${i+1}. [${q.category}/${q.diff}] ${q.q.slice(0,60)}...
            </div>`).join("")}
          ${questions.length > 5 ? `<div style="font-size:11px;color:#475569;padding:4px 0">...and ${questions.length - 5} more</div>` : ""}
        </div>
      </div>`;

    if (importBtn) {
      importBtn.style.display = "block";
      importBtn.textContent = `📥 Import ${questions.length} Questions`;
    }
  },

  confirmCSVImport() {
    const questions = this._pendingImport;
    if (!questions?.length) { App.showXPToast("No questions to import!"); return; }

    App.state.customQuestions = App.state.customQuestions || [];
    App.state.customQuestions.push(...questions);
    App.save();

    App.showXPToast(`✅ ${questions.length} questions imported!`);
    this._pendingImport = [];
    document.getElementById("csv-preview").innerHTML = "";
    document.getElementById("csv-import-btn").style.display = "none";
    document.getElementById("csv-file-input").value = "";
    this.renderManage();
    HomeScreen.refresh();
  },


  downloadSampleCSV(e) {
    e.preventDefault();
    const csv = [
      "category,difficulty,question,optA,optB,optC,optD,correct_index,hint",
      "gk,easy,What is the capital of India?,Mumbai,Delhi,Chennai,Kolkata,1,It is in North India",
      "science,medium,What is H2O?,Carbon Dioxide,Oxygen,Water,Nitrogen,2,It is a liquid at room temp",
      "math,hard,What is the square root of 144?,10,11,12,13,2,Try multiplying 12 by 12",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "quizblast_sample.csv"; a.click();
    URL.revokeObjectURL(url);
  },

  _timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return "just now";
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    return `${Math.floor(hrs/24)}d ago`;
  },

  // ── Ban System ────────────────────────────────────────
  async banPlayer(username) {
    if (!confirm(`Ban player "${username}"? They will be blocked from the app.`)) return;
    try {
      const { error } = await supa.from("banned_players").insert({
        username,
        banned_at: new Date().toISOString(),
        banned_by: "admin",
      });
      if (error) throw error;
      App.showXPToast(`🚫 ${username} banned!`);
      await this.loadOnlinePlayers();
    } catch(e) {
      // Try to create table if not exists via RPC
      App.showXPToast("Run SQL to create banned_players table first!");
    }
  },

  async unbanPlayer(username) {
    if (!confirm(`Unban player "${username}"?`)) return;
    try {
      const { error } = await supa.from("banned_players").delete().eq("username", username);
      if (error) throw error;
      App.showXPToast(`✅ ${username} unbanned!`);
      await this.loadBannedPlayers();
    } catch(e) {
      App.showXPToast("Error: " + e.message);
    }
  },

  async loadBannedPlayers() {
    const list = document.getElementById("admin-banned-list");
    if (!list) return;
    try {
      const { data } = await supa
        .from("banned_players")
        .select("*")
        .order("banned_at", { ascending: false });
      if (!data?.length) {
        list.innerHTML = "<p class='text-muted' style='text-align:center;padding:16px'>No banned players.</p>";
        return;
      }
      list.innerHTML = data.map(p => `
        <div class="admin-player-row" style="border-left:3px solid #ef4444;">
          <span class="apr-avatar">🚫</span>
          <div class="apr-info">
            <div class="apr-name">${p.username}</div>
            <div class="apr-sub">Banned: ${new Date(p.banned_at).toLocaleDateString()}</div>
          </div>
          <button onclick="Admin.unbanPlayer('${p.username}')"
            style="background:#22c55e;color:#fff;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700">
            ✅ Unban
          </button>
        </div>`).join("");
    } catch(e) {
      list.innerHTML = "<p class='text-muted' style='text-align:center'>Run setup SQL first!</p>";
    }
  },

  // ── Maintenance Mode ──────────────────────────────────
  async toggleMaintenance() {
    try {
      const { data: current } = await supa
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single();

      const newVal = current?.value === "true" ? "false" : "true";
      await supa.from("app_settings").upsert({ key: "maintenance_mode", value: newVal });

      const isOn = newVal === "true";
      App.showXPToast(isOn ? "🔧 Maintenance Mode ON" : "✅ Maintenance Mode OFF");
      this._updateMaintenanceBtn(isOn);
    } catch(e) {
      App.showXPToast("Run setup SQL first!");
    }
  },

  async checkMaintenance() {
    try {
      const { data } = await supa
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single();
      return data?.value === "true";
    } catch(e) {
      return false;
    }
  },

  _updateMaintenanceBtn(isOn) {
    const btn = document.getElementById("maintenance-toggle-btn");
    if (!btn) return;
    btn.textContent  = isOn ? "🟢 Turn OFF Maintenance" : "🔧 Turn ON Maintenance";
    btn.style.background = isOn ? "#22c55e" : "#ef4444";
  },

  async loadMaintenanceStatus() {
    const isOn = await this.checkMaintenance();
    this._updateMaintenanceBtn(isOn);
    const status = document.getElementById("maintenance-status");
    if (status) {
      status.textContent = isOn ? "🔧 Maintenance is currently ON" : "✅ App is Live";
      status.style.color = isOn ? "#f59e0b" : "#22c55e";
    }
  },

  // ── Broadcast Notification ────────────────────────────
  async sendBroadcast() {
    const title   = document.getElementById("broadcast-title")?.value.trim();
    const message = document.getElementById("broadcast-message")?.value.trim();
    const emoji   = document.getElementById("broadcast-emoji")?.value || "📢";

    if (!title)   { App.showXPToast("Enter broadcast title!"); return; }
    if (!message) { App.showXPToast("Enter broadcast message!"); return; }

    try {
      const { error } = await supa.from("broadcasts").insert({
        title,
        message,
        emoji,
        sent_at: new Date().toISOString(),
        sent_by: "admin",
        active:  true,
      });
      if (error) throw error;
      App.showXPToast(`${emoji} Broadcast sent to all users!`);
      document.getElementById("broadcast-title").value   = "";
      document.getElementById("broadcast-message").value = "";
      await this.loadBroadcastHistory();
    } catch(e) {
      App.showXPToast("Run setup SQL first!");
    }
  },

  async loadBroadcastHistory() {
    const list = document.getElementById("broadcast-history");
    if (!list) return;
    try {
      const { data } = await supa
        .from("broadcasts")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(10);
      if (!data?.length) {
        list.innerHTML = "<p class='text-muted' style='text-align:center;padding:16px'>No broadcasts sent yet.</p>";
        return;
      }
      list.innerHTML = data.map(b => `
        <div class="admin-gift-row" style="border-left:3px solid #6366f1;">
          <div style="font-size:1.2rem">${b.emoji}</div>
          <div style="flex:1">
            <div style="font-weight:700;color:#e2e8f0">${b.title}</div>
            <div style="font-size:12px;color:#94a3b8">${b.message}</div>
            <div style="font-size:11px;color:#475569;margin-top:4px">${new Date(b.sent_at).toLocaleString()}</div>
          </div>
          <button onclick="Admin.deleteBroadcast('${b.id}')"
            style="background:#ef4444;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">
            🗑
          </button>
        </div>`).join("");
    } catch(e) {
      list.innerHTML = "<p class='text-muted' style='text-align:center'>Run setup SQL first!</p>";
    }
  },

  async deleteBroadcast(id) {
    if (!confirm("Delete this broadcast?")) return;
    await supa.from("broadcasts").delete().eq("id", id);
    await this.loadBroadcastHistory();
    App.showXPToast("Broadcast deleted!");
  },

};

/* ============================================================
   WELCOME SETUP – first-time name entry (min 3 chars)
   ============================================================ */
const WelcomeSetup = {
  show() {
    // Slight delay so home screen renders first
    setTimeout(() => {
      const modal = document.getElementById("welcome-modal");
      if (modal) {
        modal.style.display = "flex";
        setTimeout(() => {
          const inp = document.getElementById("welcome-name-input");
          if (inp) inp.focus();
        }, 300);
      }
    }, 400);
  },

  save() {
    const inp   = document.getElementById("welcome-name-input");
    const err   = document.getElementById("welcome-name-error");
    const raw   = (inp?.value || "").trim();

    // Validation: min 3 letters (ignore spaces/numbers for count)
    const letters = raw.replace(/[^a-zA-Zऀ-ॿ]/g, "");
    if (letters.length < 3) {
      if (err) err.style.display = "block";
      if (inp) {
        inp.classList.add("input-error");
        inp.focus();
        // Shake animation
        inp.style.animation = "none";
        requestAnimationFrame(() => { inp.style.animation = "inputShake 0.4s ease"; });
      }
      return;
    }

    // Save name
    App.state.username = raw.slice(0, 20);
    App.state.nameSet  = true;
    App.save();

    // Close modal
    const modal = document.getElementById("welcome-modal");
    if (modal) modal.style.display = "none";

    // Refresh home with new name
    HomeScreen.refresh();
    Sound.start();
    App.showXPToast("Welcome, " + App.state.username + "! 🎉");
  },
};

/* ============================================================
   BOOT
   ============================================================ */
/* ============================================================
   GIFT NOTIFIER — Check unclaimed coin gifts on load
   ============================================================ */
const GiftNotifier = {
  _checked: false,  // prevent duplicate calls in same session

  // localStorage key to track claimed gift IDs permanently
  _claimedKey: "qb_claimed_gifts",

  _getClaimed() {
    try { return JSON.parse(localStorage.getItem(this._claimedKey) || "[]"); }
    catch { return []; }
  },

  _markClaimed(id) {
    const claimed = this._getClaimed();
    if (!claimed.includes(id)) {
      claimed.push(id);
      // Keep only last 200 IDs to avoid unbounded growth
      if (claimed.length > 200) claimed.splice(0, claimed.length - 200);
      localStorage.setItem(this._claimedKey, JSON.stringify(claimed));
    }
  },

  async check() {
    if (this._checked) return;  // already ran this session
    this._checked = true;
    if (typeof SupaGifts === "undefined") return;
    const username = App.state?.username;
    if (!username || username === "Player") return;
    try {
      const gifts = await SupaGifts.check(username);
      if (!gifts.length) return;
      const alreadyClaimed = this._getClaimed();
      let anyNew = false;
      for (const gift of gifts) {
        // Skip if already claimed locally — guards against Supabase RLS issues
        if (alreadyClaimed.includes(gift.id)) continue;
        this._markClaimed(gift.id);  // mark locally BEFORE adding coins
        App.addCoins(gift.amount);
        await SupaGifts.claim(gift.id);  // also try server-side claim
        App.showXPToast(`🎁 Gift: +${gift.amount} 🪙${gift.message ? " — " + gift.message : ""}`);
        anyNew = true;
        await new Promise(r => setTimeout(r, 2000));
      }
      if (anyNew) { App.save(); HomeScreen.refresh(); }
    } catch(e) {
      console.warn("GiftNotifier error:", e);
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();

  // Close modals when tapping overlay (except welcome modal — must fill name)
  document.querySelectorAll(".modal-overlay").forEach(el => {
    if (el.id === "welcome-modal") return; // can't dismiss without name
    el.addEventListener("click", e => { if (e.target === el) el.style.display = "none"; });
  });

  // Enter key on welcome name input
  const welcomeInput = document.getElementById("welcome-name-input");
  if (welcomeInput) {
    welcomeInput.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); WelcomeSetup.save(); }
      // Hide error on typing
      const err = document.getElementById("welcome-name-error");
      if (err) err.style.display = "none";
      welcomeInput.classList.remove("input-error");
    });
  }

  // Enter key on regular name input (profile edit)
  const nameInput = document.getElementById("name-input");
  if (nameInput) {
    nameInput.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); Profile.saveName(); }
    });
  }

  // Double-tap zoom prevention via CSS (touch-action) — NOT via JS preventDefault
  // JS preventDefault on touchend breaks click events on mobile, so we use CSS only

  // Fix 100vh on mobile browsers (address bar issue)
  const setVH = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  };
  setVH();
  window.addEventListener("resize", setVH);
  window.addEventListener("orientationchange", () => setTimeout(setVH, 200));
});
