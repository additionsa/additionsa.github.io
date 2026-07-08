import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  Coins, Lock, Play, RotateCcw, Home as HomeIcon, Trophy, Clock,
  Zap, CheckCircle2, XCircle, ArrowLeft, Flame, TrendingUp, Star,
  Settings as SettingsIcon, Award, Gift, Sparkles, X, Volume2, VolumeX,
  Vibrate, Sun, Moon, Info, User, RotateCw,
  Target, Medal, ShieldCheck, Rocket,
} from "lucide-react";

/* ===========================================================
   DESIGN TOKENS
   Two palettes: the classic "casino floor" dark theme, and a
   "champagne room" light theme, both built from the same gold
   / navy language so the branding never feels inconsistent.
=========================================================== */

const DARK_COLORS = {
  deep: "#070c1f",
  navy: "#0d1638",
  navy2: "#131f4d",
  navy3: "#1a2a63",
  panel: "#0f1a3d",
  border: "#25305c",
  gold: "#f2c14e",
  goldDeep: "#b9852e",
  goldLine: "#ffe9a8",
  correct: "#33d17a",
  wrong: "#e0435c",
  ink: "#f5f1e6",
  inkDim: "#9aa3c7",
  xp: "#7dd3fc",
  xpDeep: "#0ea5e9",
};

const LIGHT_COLORS = {
  deep: "#f6efe0",
  navy: "#fffaf0",
  navy2: "#fff3d9",
  navy3: "#ffe6ad",
  panel: "#fffaf0",
  border: "#e6c98a",
  gold: "#c8871e",
  goldDeep: "#946313",
  goldLine: "#8a5c10",
  correct: "#1f9d5c",
  wrong: "#c62f45",
  ink: "#2a1e08",
  inkDim: "#7a6a45",
  xp: "#0369a1",
  xpDeep: "#075985",
};

/* ===========================================================
   STORAGE — wraps localStorage in the same async get/set shape
   the game already speaks, so it saves progress on any real
   host (GitHub Pages, installed PWA, etc). Works offline.
=========================================================== */
const storage = {
  async get(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      return { value: raw };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { value };
    } catch (e) {
      return null;
    }
  },
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function fmtMoney(n) {
  const rounded = Math.round(n);
  return "$" + rounded.toLocaleString("en-US");
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function daysSince(dateKey) {
  if (!dateKey) return Infinity;
  const [y, m, d] = dateKey.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowMid - then) / 86400000);
}

/* ===========================================================
   AUDIO ENGINE — pure Web Audio API, zero external assets.
=========================================================== */

function useAudioEngine(soundOn, musicOn) {
  const ctxRef = useRef(null);
  const musicNodesRef = useRef(null);

  const ensureCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctxRef.current) ctxRef.current = new AC();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  const tone = useCallback((ctx, { freq, start, dur, type = "sine", peak = 0.2, freqEnd = null, pan = 0 }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const t0 = ctx.currentTime + start;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (pan !== 0 && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, t0);
      osc.connect(panner);
      panner.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }, []);

  const playSfx = useCallback((name) => {
    if (!soundOn) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    switch (name) {
      case "click":
        tone(ctx, { freq: 720, start: 0, dur: 0.05, type: "square", peak: 0.06 });
        break;
      case "correct":
        tone(ctx, { freq: 880, start: 0, dur: 0.09, type: "triangle", peak: 0.18 });
        tone(ctx, { freq: 1318, start: 0.06, dur: 0.12, type: "triangle", peak: 0.18 });
        break;
      case "wrong":
        tone(ctx, { freq: 260, start: 0, dur: 0.14, type: "sawtooth", peak: 0.14, freqEnd: 140 });
        tone(ctx, { freq: 180, start: 0.1, dur: 0.16, type: "sawtooth", peak: 0.12, freqEnd: 90 });
        break;
      case "coin":
        tone(ctx, { freq: 1200, start: 0, dur: 0.06, type: "triangle", peak: 0.15, freqEnd: 1900 });
        break;
      case "combo":
        [880, 1108, 1318].forEach((f, i) => tone(ctx, { freq: f, start: i * 0.05, dur: 0.09, type: "triangle", peak: 0.15 }));
        break;
      case "highCombo":
        [660, 880, 1108, 1318, 1760].forEach((f, i) => tone(ctx, { freq: f, start: i * 0.05, dur: 0.12, type: "triangle", peak: 0.18 }));
        break;
      case "heartbeat":
        tone(ctx, { freq: 90, start: 0, dur: 0.09, type: "sine", peak: 0.22 });
        break;
      case "gameOver":
        [520, 440, 340, 260].forEach((f, i) => tone(ctx, { freq: f, start: i * 0.14, dur: 0.2, type: "sawtooth", peak: 0.14 }));
        break;
      case "victory":
        [523, 659, 784, 1046].forEach((f, i) => tone(ctx, { freq: f, start: i * 0.09, dur: 0.35, type: "triangle", peak: 0.2 }));
        break;
      case "unlock":
        for (let i = 0; i < 8; i++) tone(ctx, { freq: 500 + i * 90, start: i * 0.03, dur: 0.1, type: "sine", peak: 0.09 });
        break;
      case "purchaseSuccess":
        tone(ctx, { freq: 700, start: 0, dur: 0.08, type: "triangle", peak: 0.16 });
        tone(ctx, { freq: 1050, start: 0.07, dur: 0.14, type: "triangle", peak: 0.18 });
        break;
      case "purchaseFail":
        tone(ctx, { freq: 200, start: 0, dur: 0.1, type: "square", peak: 0.12 });
        tone(ctx, { freq: 160, start: 0.12, dur: 0.12, type: "square", peak: 0.12 });
        break;
      case "achievement":
        [660, 880, 1108, 1568].forEach((f, i) => tone(ctx, { freq: f, start: i * 0.07, dur: 0.22, type: "triangle", peak: 0.2 }));
        break;
      case "countdownTick":
        tone(ctx, { freq: 440, start: 0, dur: 0.12, type: "square", peak: 0.14 });
        break;
      case "countdownGo":
        tone(ctx, { freq: 880, start: 0, dur: 0.3, type: "triangle", peak: 0.22 });
        break;
      case "levelComplete":
        [523, 659, 784].forEach((f, i) => tone(ctx, { freq: f, start: i * 0.08, dur: 0.22, type: "triangle", peak: 0.18 }));
        break;
      case "wheelTick":
        tone(ctx, { freq: 900, start: 0, dur: 0.03, type: "square", peak: 0.08 });
        break;
      case "wheelWin":
        [700, 1000, 1400].forEach((f, i) => tone(ctx, { freq: f, start: i * 0.06, dur: 0.2, type: "triangle", peak: 0.2 }));
        break;
      default:
        break;
    }
  }, [soundOn, ensureCtx, tone]);

  // Soft ambient pad loop for "music" toggle — two detuned oscillators.
  useEffect(() => {
    if (!musicOn) {
      if (musicNodesRef.current) {
        try {
          musicNodesRef.current.forEach((n) => n.stop && n.stop());
        } catch (e) { /* already stopped */ }
        musicNodesRef.current = null;
      }
      return;
    }
    const ctx = ensureCtx();
    if (!ctx) return;
    const nodes = [];
    [130.81, 164.81].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.0;
      gain.gain.setTargetAtTime(0.02, ctx.currentTime, 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      nodes.push(osc, gain);
    });
    musicNodesRef.current = nodes;
    return () => {
      nodes.forEach((n) => n.stop && n.stop());
      musicNodesRef.current = null;
    };
  }, [musicOn, ensureCtx]);

  return { playSfx, unlockAudio: ensureCtx };
}

/* ===========================================================
   VIBRATION
=========================================================== */

const VIBRATION_PATTERNS = {
  click: [8],
  correct: [10],
  wrong: [55],
  combo: [14, 25, 14],
  highCombo: [14, 20, 14, 20, 30],
  achievement: [20, 40, 20, 40, 70],
  gameOver: [220],
  victory: [30, 50, 30, 50, 30, 50, 120],
  heartbeat: [35, 70],
  levelUp: [25, 40, 25, 40, 90],
  wheel: [10, 15, 10],
};

function vibrate(name, enabled) {
  if (!enabled) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const pattern = VIBRATION_PATTERNS[name];
  if (pattern) {
    try { navigator.vibrate(pattern); } catch (e) { /* unsupported */ }
  }
}

/* ===========================================================
   LEVEL DEFINITIONS (math generators — unchanged logic)
=========================================================== */

function genNoCarry2() {
  const tensA = randInt(1, 8), unitsA = randInt(0, 8);
  const tensB = randInt(1, 9 - tensA), unitsB = randInt(0, 9 - unitsA);
  return { a: tensA * 10 + unitsA, b: tensB * 10 + unitsB };
}
function genEasyCarry2() {
  const unitsA = randInt(4, 9);
  const unitsB = randInt(Math.max(1, 10 - unitsA), 9);
  const tensA = randInt(1, 8), tensB = randInt(1, 9 - tensA);
  return { a: tensA * 10 + unitsA, b: tensB * 10 + unitsB };
}
function genCarry3() {
  const unitsA = randInt(4, 9);
  const unitsB = randInt(Math.max(1, 10 - unitsA), 9);
  const a = randInt(1, 8) * 100 + randInt(0, 9) * 10 + unitsA;
  const b = randInt(1, 8) * 100 + randInt(0, 9) * 10 + unitsB;
  return { a, b };
}
function genMixed() {
  const digitsA = randInt(1, 4), digitsB = randInt(1, 4);
  const lo = [0, 1, 10, 100, 1000], hi = [0, 9, 99, 999, 9999];
  return { a: randInt(lo[digitsA], hi[digitsA]), b: randInt(lo[digitsB], hi[digitsB]) };
}

const LEVELS = [
  { id: 1, name: "First Steps", tag: "1-digit addition", tier: "easy", unlockCost: 0,
    gen: () => ({ a: randInt(0, 9), b: randInt(0, 9) }) },
  { id: 2, name: "Sharp Digits", tag: "harder 1-digit combos", tier: "easy", unlockCost: 2000,
    gen: () => ({ a: randInt(4, 9), b: randInt(4, 9) }) },
  { id: 3, name: "Double Debut", tag: "2-digit, no carrying", tier: "medium", unlockCost: 5000,
    gen: genNoCarry2 },
  { id: 4, name: "Carry It Over", tag: "2-digit, easy carrying", tier: "medium", unlockCost: 10000,
    gen: genEasyCarry2 },
  { id: 5, name: "Double Chaos", tag: "random 2-digit", tier: "medium", unlockCost: 25000,
    gen: () => ({ a: randInt(10, 99), b: randInt(10, 99) }) },
  { id: 6, name: "Triple Threat", tag: "3-digit addition", tier: "hard", unlockCost: 50000,
    gen: () => ({ a: randInt(100, 999), b: randInt(100, 999) }) },
  { id: 7, name: "Triple Surge", tag: "3-digit with carrying", tier: "hard", unlockCost: 100000,
    gen: genCarry3 },
  { id: 8, name: "Four-Digit Fortune", tag: "4-digit addition", tier: "hard", unlockCost: 250000,
    gen: () => ({ a: randInt(1000, 9999), b: randInt(1000, 9999) }) },
  { id: 9, name: "Mixed Mayhem", tag: "mixed digit lengths", tier: "master", unlockCost: 500000,
    gen: genMixed },
  { id: 10, name: "Millionaire Mind", tag: "master mode \u2014 anything goes", tier: "master", unlockCost: 1000000,
    gen: () => LEVELS[randInt(0, 8)].gen() },
];

const TIER_REWARD = { easy: 100, medium: 250, hard: 500, master: 1000 };
const TIER_XP = { easy: 6, medium: 10, hard: 16, master: 26 };
const TIER_LABEL = { easy: "EASY", medium: "MEDIUM", hard: "HARD", master: "MASTER" };

function comboMultiplier(streak) {
  if (streak >= 20) return 5;
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  return 1;
}

/* ===========================================================
   XP / PLAYER LEVEL SYSTEM
=========================================================== */

function xpNeededFor(level) {
  return 100 + (level - 1) * 55;
}
function getLevelInfo(totalXp) {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpNeededFor(level)) {
    remaining -= xpNeededFor(level);
    level += 1;
    if (level > 999) break;
  }
  return { level, into: remaining, need: xpNeededFor(level) };
}

/* ===========================================================
   ACHIEVEMENTS
=========================================================== */

const ACHIEVEMENTS = [
  { id: "first_correct", title: "First Steps", desc: "Answer your first question correctly.", icon: CheckCircle2,
    check: (c) => c.records.totalCorrect >= 1 },
  { id: "combo_5", title: "Warming Up", desc: "Reach a 5-answer combo.", icon: Flame,
    check: (c) => c.records.bestCombo >= 5 },
  { id: "combo_10", title: "On Fire", desc: "Reach a 10-answer combo.", icon: Flame,
    check: (c) => c.records.bestCombo >= 10 },
  { id: "combo_20", title: "Unstoppable", desc: "Reach a 20-answer combo.", icon: Rocket,
    check: (c) => c.records.bestCombo >= 20 },
  { id: "accuracy_90", title: "Sharpshooter", desc: "Finish a run with 90%+ accuracy.", icon: Target,
    check: (c) => c.records.bestAccuracy >= 90 },
  { id: "accuracy_100", title: "Flawless", desc: "Finish a run with 100% accuracy.", icon: ShieldCheck,
    check: (c) => c.records.bestAccuracy >= 100 },
  { id: "money_run_5000", title: "High Roller", desc: "Earn $5,000 in a single run.", icon: Coins,
    check: (c) => c.records.bestMoneyRun >= 5000 },
  { id: "bank_100k", title: "Six Figures", desc: "Bank a total of $100,000.", icon: Trophy,
    check: (c) => c.money >= 100000 },
  { id: "bank_1m", title: "Millionaire", desc: "Bank a total of $1,000,000.", icon: Star,
    check: (c) => c.money >= 1000000 },
  { id: "plays_10", title: "Dedicated", desc: "Play 10 rounds.", icon: Medal,
    check: (c) => c.records.totalPlays >= 10 },
  { id: "plays_50", title: "Addicted (the good kind)", desc: "Play 50 rounds.", icon: Medal,
    check: (c) => c.records.totalPlays >= 50 },
  { id: "levels_5", title: "Collector", desc: "Unlock 5 levels.", icon: Award,
    check: (c) => c.purchased.length >= 5 },
  { id: "levels_all", title: "Completionist", desc: "Unlock every level.", icon: Award,
    check: (c) => c.purchased.length >= LEVELS.length },
  { id: "level_5", title: "Rising Star", desc: "Reach player level 5.", icon: Sparkles,
    check: (c) => c.level >= 5 },
  { id: "level_10", title: "Math Prodigy", desc: "Reach player level 10.", icon: Sparkles,
    check: (c) => c.level >= 10 },
];

function checkNewAchievements(ctx, unlockedIds) {
  return ACHIEVEMENTS.filter((a) => !unlockedIds.includes(a.id) && a.check(ctx));
}

/* ===========================================================
   DAILY REWARDS & LUCKY WHEEL
=========================================================== */

const DAILY_REWARDS = [
  { coins: 200, xp: 20 },
  { coins: 300, xp: 25 },
  { coins: 450, xp: 30 },
  { coins: 600, xp: 40 },
  { coins: 800, xp: 50 },
  { coins: 1200, xp: 70 },
  { coins: 2500, xp: 150 },
];

const WHEEL_SEGMENTS = [
  { label: "200", coins: 200 },
  { label: "500", coins: 500 },
  { label: "100", coins: 100 },
  { label: "1,000", coins: 1000 },
  { label: "300", coins: 300 },
  { label: "2,000", coins: 2000 },
  { label: "150", coins: 150 },
  { label: "JACKPOT", coins: 5000 },
];

/* ===========================================================
   RANK SYSTEM — derived purely from player level.
=========================================================== */

const RANKS = [
  { id: "beginner", name: "Beginner", minLevel: 1, color: "#9aa3c7" },
  { id: "learner", name: "Learner", minLevel: 5, color: "#7dd3fc" },
  { id: "calculator", name: "Calculator", minLevel: 10, color: "#33d17a" },
  { id: "quick_thinker", name: "Quick Thinker", minLevel: 16, color: "#f2c14e" },
  { id: "expert", name: "Expert", minLevel: 24, color: "#f2a13c" },
  { id: "master", name: "Master", minLevel: 34, color: "#e0435c" },
  { id: "grandmaster", name: "Grandmaster", minLevel: 46, color: "#a78bfa" },
  { id: "legend", name: "Legend", minLevel: 60, color: "#ffe9a8" },
];

function getRank(level) {
  let current = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) current = r;
  return current;
}
function getNextRank(level) {
  return RANKS.find((r) => r.minLevel > level) || null;
}

/* ===========================================================
   WORLD SYSTEM — basic unlock logic, no adventure mode yet.
=========================================================== */

const WORLDS = [
  { id: 1, name: "Training Ground", theme: "#f2c14e", minLevel: 1 },
  { id: 2, name: "Forest of Numbers", theme: "#33d17a", minLevel: 8 },
  { id: 3, name: "Golden Desert", theme: "#e0a33e", minLevel: 16 },
  { id: 4, name: "Crystal Cave", theme: "#7dd3fc", minLevel: 26 },
  { id: 5, name: "Sky Kingdom", theme: "#a78bfa", minLevel: 38 },
  { id: 6, name: "Cyber City", theme: "#f472b6", minLevel: 52 },
];

function getWorldProgress(level) {
  let current = WORLDS[0];
  for (const w of WORLDS) if (level >= w.minLevel) current = w;
  const idx = WORLDS.findIndex((w) => w.id === current.id);
  const next = WORLDS[idx + 1] || null;
  const unlockedIds = WORLDS.filter((w) => level >= w.minLevel).map((w) => w.id);
  return { current, next, unlockedIds };
}

/* ===========================================================
   PERMANENT UPGRADE SYSTEM — centralized cost/bonus formulas.
=========================================================== */

const UPGRADE_DEFS = [
  { id: "coinMult", name: "Coin Multiplier", desc: "Increase coins earned from every correct answer.", icon: Coins, maxLevel: 10, baseCost: 500, costGrowth: 1.6, bonusPerLevel: 0.05, bonusLabel: (v) => `+${Math.round(v * 100)}% coins` },
  { id: "xpMult", name: "XP Multiplier", desc: "Increase XP earned from every correct answer.", icon: Sparkles, maxLevel: 10, baseCost: 400, costGrowth: 1.55, bonusPerLevel: 0.05, bonusLabel: (v) => `+${Math.round(v * 100)}% XP` },
  { id: "comboBonus", name: "Combo Bonus", desc: "Boost the payout multiplier earned from combo streaks.", icon: Flame, maxLevel: 8, baseCost: 800, costGrowth: 1.7, bonusPerLevel: 0.08, bonusLabel: (v) => `+${Math.round(v * 100)}% combo payout` },
  { id: "luckyBonus", name: "Lucky Bonus", desc: "Chance for a surprise double payout on a correct answer.", icon: Star, maxLevel: 6, baseCost: 1200, costGrowth: 1.8, bonusPerLevel: 0.03, bonusLabel: (v) => `${Math.round(v * 100)}% lucky chance` },
];

function upgradeCost(def, currentLevel) {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}
function upgradeBonus(def, currentLevel) {
  return def.bonusPerLevel * currentLevel;
}
function getUpgradeDef(id) {
  return UPGRADE_DEFS.find((u) => u.id === id);
}

/* ===========================================================
   ECONOMY — every reward formula lives here, no magic numbers
   scattered through the game logic.
=========================================================== */

function computeAnswerReward({ tier, comboStreak, upgrades }) {
  const base = TIER_REWARD[tier];
  const combo = comboMultiplier(comboStreak);
  const comboBoost = 1 + upgradeBonus(getUpgradeDef("comboBonus"), upgrades.comboBonus || 0);
  const coinBoost = 1 + upgradeBonus(getUpgradeDef("coinMult"), upgrades.coinMult || 0);
  let coins = base * combo * comboBoost * coinBoost;
  const luckyChance = upgradeBonus(getUpgradeDef("luckyBonus"), upgrades.luckyBonus || 0);
  let lucky = false;
  if (luckyChance > 0 && Math.random() < luckyChance) {
    coins *= 2;
    lucky = true;
  }
  return { coins: Math.round(coins), lucky, comboMult: combo };
}

function computeXpReward({ tier, comboStreak, upgrades }) {
  const base = TIER_XP[tier];
  const comboFactor = Math.min(comboMultiplier(comboStreak), 2);
  const xpBoost = 1 + upgradeBonus(getUpgradeDef("xpMult"), upgrades.xpMult || 0);
  return Math.round(base * comboFactor * xpBoost);
}

/* ===========================================================
   THEME SYSTEM — full palettes, persisted selection.
   "classic" reuses the existing dark/light toggle; every other
   theme is a fixed, purchasable palette.
=========================================================== */

const THEME_DEFS = [
  { id: "classic", name: "Classic Gold", cost: 0, colors: null },
  { id: "dark", name: "Obsidian", cost: 3000, colors: {
    deep: "#000000", navy: "#0a0a0a", navy2: "#141414", navy3: "#1f1f1f", panel: "#0a0a0a",
    border: "#2c2c2c", gold: "#e5e5e5", goldDeep: "#9a9a9a", goldLine: "#ffffff",
    correct: "#33d17a", wrong: "#e0435c", ink: "#f5f5f5", inkDim: "#9a9a9a", xp: "#7dd3fc", xpDeep: "#0ea5e9",
  } },
  { id: "neon", name: "Neon Pulse", cost: 5000, colors: {
    deep: "#08010f", navy: "#150a29", navy2: "#1e1040", navy3: "#2a1658", panel: "#150a29",
    border: "#5b21b6", gold: "#ff2fd0", goldDeep: "#a3116f", goldLine: "#66f9ff",
    correct: "#39ff88", wrong: "#ff3860", ink: "#f2e9ff", inkDim: "#b39ddb", xp: "#66f9ff", xpDeep: "#12b8c4",
  } },
  { id: "galaxy", name: "Galaxy", cost: 5000, colors: {
    deep: "#050318", navy: "#0d0a2b", navy2: "#151140", navy3: "#1e1958", panel: "#0d0a2b",
    border: "#3730a3", gold: "#a78bfa", goldDeep: "#6d28d9", goldLine: "#e0d4ff",
    correct: "#34d399", wrong: "#f87171", ink: "#ede9fe", inkDim: "#a5a3c9", xp: "#818cf8", xpDeep: "#4f46e5",
  } },
  { id: "forest", name: "Forest", cost: 4000, colors: {
    deep: "#08140d", navy: "#0f2117", navy2: "#163220", navy3: "#1e4229", panel: "#0f2117",
    border: "#2f5b3d", gold: "#d4a94e", goldDeep: "#8f6f24", goldLine: "#f0dca0",
    correct: "#4ade80", wrong: "#f87171", ink: "#eef6ee", inkDim: "#9db8a4", xp: "#86efac", xpDeep: "#22c55e",
  } },
];

function getThemeDef(id) {
  return THEME_DEFS.find((t) => t.id === id) || THEME_DEFS[0];
}
function resolveThemeColors(themeId, darkMode) {
  const def = getThemeDef(themeId);
  if (!def.colors) return darkMode ? DARK_COLORS : LIGHT_COLORS;
  return def.colors;
}

/* ===========================================================
   AVATAR SYSTEM
=========================================================== */

const AVATAR_DEFS = [
  { id: "default", emoji: "\u{1F642}", name: "Rookie", cost: 0 },
  { id: "fox", emoji: "\u{1F98A}", name: "Fox", cost: 1500 },
  { id: "lion", emoji: "\u{1F981}", name: "Lionheart", cost: 1500 },
  { id: "owl", emoji: "\u{1F989}", name: "Owl", cost: 2000 },
  { id: "robot", emoji: "\u{1F916}", name: "Robot", cost: 3000 },
  { id: "rocket", emoji: "\u{1F680}", name: "Rocketeer", cost: 5000 },
  { id: "brain", emoji: "\u{1F9E0}", name: "Genius", cost: 6000 },
  { id: "crown", emoji: "\u{1F451}", name: "Royalty", cost: 8000 },
];

function getAvatarDef(id) {
  return AVATAR_DEFS.find((a) => a.id === id) || AVATAR_DEFS[0];
}

/* ===========================================================
   TITLE SYSTEM — unlocked automatically by player level.
=========================================================== */

const TITLE_DEFS = [
  { id: "beginner", name: "Beginner", unlockLevel: 1 },
  { id: "fast_thinker", name: "Fast Thinker", unlockLevel: 5 },
  { id: "calculator_t", name: "Calculator", unlockLevel: 10 },
  { id: "brain_trainer", name: "Brain Trainer", unlockLevel: 18 },
  { id: "number_cruncher", name: "Number Cruncher", unlockLevel: 28 },
  { id: "mental_genius", name: "Mental Genius", unlockLevel: 40 },
  { id: "math_legend", name: "Math Legend", unlockLevel: 55 },
];

function getTitleDef(id) {
  return TITLE_DEFS.find((t) => t.id === id) || TITLE_DEFS[0];
}
function getUnlockedTitles(level) {
  return TITLE_DEFS.filter((t) => level >= t.unlockLevel);
}

/* ===========================================================
   PERSISTENCE
=========================================================== */

const SAVE_VERSION = 3;
const STORAGE_KEY = "millionaire_addition_state_v2";

const DEFAULT_SETTINGS = {
  sound: true,
  music: false,
  vibration: true,
  darkMode: true,
  reduceMotion: false,
};

const DEFAULT_RECORDS = {
  totalCorrect: 0,
  totalWrong: 0,
  totalPlays: 0,
  bestCombo: 0,
  bestAccuracy: 0,
  bestMoneyRun: 0,
  bestAvgTime: null,
};

const DEFAULT_UPGRADES = { coinMult: 0, xpMult: 0, comboBonus: 0, luckyBonus: 0 };
const DEFAULT_INVENTORY = { themes: ["classic"], avatars: ["default"] };
const DEFAULT_EQUIPPED = { theme: "classic", avatar: "default", title: "beginner" };

function defaultState() {
  return {
    version: SAVE_VERSION,
    money: 0,
    purchased: [1],
    levelStats: {},
    totalXp: 0,
    achievementsUnlocked: [],
    dailyReward: { lastClaim: null, streak: 0 },
    wheel: { lastSpin: null },
    settings: { ...DEFAULT_SETTINGS },
    records: { ...DEFAULT_RECORDS },
    upgrades: { ...DEFAULT_UPGRADES },
    inventory: { themes: [...DEFAULT_INVENTORY.themes], avatars: [...DEFAULT_INVENTORY.avatars] },
    equipped: { ...DEFAULT_EQUIPPED },
  };
}

// Gracefully upgrades an older / partial save into the current shape so
// missing saves, older saves, and corrupted saves never crash the game.
function migrateSave(parsed) {
  const d = defaultState();
  if (!parsed || typeof parsed !== "object") return d;
  try {
    return {
      version: SAVE_VERSION,
      money: typeof parsed.money === "number" ? parsed.money : d.money,
      purchased: Array.isArray(parsed.purchased) && parsed.purchased.length ? parsed.purchased : d.purchased,
      levelStats: parsed.levelStats && typeof parsed.levelStats === "object" ? parsed.levelStats : d.levelStats,
      totalXp: typeof parsed.totalXp === "number" ? parsed.totalXp : d.totalXp,
      achievementsUnlocked: Array.isArray(parsed.achievementsUnlocked) ? parsed.achievementsUnlocked : d.achievementsUnlocked,
      dailyReward: parsed.dailyReward && typeof parsed.dailyReward === "object" ? { ...d.dailyReward, ...parsed.dailyReward } : d.dailyReward,
      wheel: parsed.wheel && typeof parsed.wheel === "object" ? { ...d.wheel, ...parsed.wheel } : d.wheel,
      settings: parsed.settings && typeof parsed.settings === "object" ? { ...d.settings, ...parsed.settings } : d.settings,
      records: parsed.records && typeof parsed.records === "object" ? { ...d.records, ...parsed.records } : d.records,
      upgrades: parsed.upgrades && typeof parsed.upgrades === "object" ? { ...d.upgrades, ...parsed.upgrades } : d.upgrades,
      inventory: parsed.inventory && typeof parsed.inventory === "object" ? {
        themes: Array.isArray(parsed.inventory.themes) && parsed.inventory.themes.length ? parsed.inventory.themes : d.inventory.themes,
        avatars: Array.isArray(parsed.inventory.avatars) && parsed.inventory.avatars.length ? parsed.inventory.avatars : d.inventory.avatars,
      } : d.inventory,
      equipped: parsed.equipped && typeof parsed.equipped === "object" ? { ...d.equipped, ...parsed.equipped } : d.equipped,
    };
  } catch (e) {
    return d;
  }
}

/* ===========================================================
   MAIN COMPONENT
=========================================================== */

export default function MillionaireAdditionGame() {
  const [loaded, setLoaded] = useState(false);

  const [money, setMoney] = useState(0);
  const [purchased, setPurchased] = useState([1]);
  const [levelStats, setLevelStats] = useState({});
  const [totalXp, setTotalXp] = useState(0);
  const [achievementsUnlocked, setAchievementsUnlocked] = useState([]);
  const [dailyReward, setDailyReward] = useState({ lastClaim: null, streak: 0 });
  const [wheelState, setWheelState] = useState({ lastSpin: null });
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [records, setRecords] = useState({ ...DEFAULT_RECORDS });
  const [upgrades, setUpgrades] = useState({ ...DEFAULT_UPGRADES });
  const [inventory, setInventory] = useState({ themes: [...DEFAULT_INVENTORY.themes], avatars: [...DEFAULT_INVENTORY.avatars] });
  const [equipped, setEquipped] = useState({ ...DEFAULT_EQUIPPED });
  const [showShop, setShowShop] = useState(false);
  const [shopTab, setShopTab] = useState("upgrades");
  const [purchaseFlash, setPurchaseFlash] = useState(null);

  const [screen, setScreen] = useState("home"); // home | timer | countdown | playing | end
  const [selectedLevelId, setSelectedLevelId] = useState(1);
  const [selectedTime, setSelectedTime] = useState(60);
  const [buyFlash, setBuyFlash] = useState(null);
  const [countdownVal, setCountdownVal] = useState(3);

  // run state
  const [timeLeft, setTimeLeft] = useState(60);
  const [runMoney, setRunMoney] = useState(0);
  const [runXp, setRunXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [responseTimes, setResponseTimes] = useState([]);
  const [question, setQuestion] = useState({ a: 0, b: 0 });
  const [inputVal, setInputVal] = useState("");
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [floaters, setFloaters] = useState([]);
  const [coinBursts, setCoinBursts] = useState([]);
  const [lastResult, setLastResult] = useState(null);

  // overlays
  const [showSettings, setShowSettings] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(null);
  const [achievementToasts, setAchievementToasts] = useState([]);
  const [resetConfirm, setResetConfirm] = useState(false);

  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const questionStartRef = useRef(Date.now());
  const inputRef = useRef(null);
  const endGameRef = useRef(() => {});
  const floaterIdRef = useRef(0);
  const burstIdRef = useRef(0);
  const prevLevelRef = useRef(1);

  const { playSfx, unlockAudio } = useAudioEngine(settings.sound, settings.music);

  const selectedLevel = LEVELS.find((l) => l.id === selectedLevelId) || LEVELS[0];
  const COLORS = resolveThemeColors(equipped.theme, settings.darkMode);
  const motionOn = !settings.reduceMotion;
  const levelInfo = useMemo(() => getLevelInfo(totalXp), [totalXp]);
  const rank = useMemo(() => getRank(levelInfo.level), [levelInfo.level]);
  const nextRank = useMemo(() => getNextRank(levelInfo.level), [levelInfo.level]);
  const worldProgress = useMemo(() => getWorldProgress(levelInfo.level), [levelInfo.level]);
  const unlockedTitles = useMemo(() => getUnlockedTitles(levelInfo.level), [levelInfo.level]);

  const buildAchievementCtx = useCallback((recordsOverride, moneyOverride) => ({
    records: recordsOverride || records,
    purchased,
    money: moneyOverride !== undefined ? moneyOverride : money,
    level: levelInfo.level,
  }), [records, purchased, money, levelInfo.level]);

  /* ---------------- persistence ---------------- */

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          const migrated = migrateSave(parsed);
          setMoney(migrated.money);
          setPurchased(migrated.purchased);
          setLevelStats(migrated.levelStats);
          setTotalXp(migrated.totalXp);
          setAchievementsUnlocked(migrated.achievementsUnlocked);
          setDailyReward(migrated.dailyReward);
          setWheelState(migrated.wheel);
          setSettings(migrated.settings);
          setRecords(migrated.records);
          setUpgrades(migrated.upgrades);
          setInventory(migrated.inventory);
          setEquipped(migrated.equipped);
        }
      } catch (e) {
        // corrupted or missing save; defaults are already applied
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const state = {
      version: SAVE_VERSION, money, purchased, levelStats, totalXp, achievementsUnlocked,
      dailyReward, wheel: wheelState, settings, records, upgrades, inventory, equipped,
    };
    storage.set(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [money, purchased, levelStats, totalXp, achievementsUnlocked, dailyReward, wheelState, settings, records, upgrades, inventory, equipped, loaded]);

  /* ---------------- floaters / particles ---------------- */

  const addFloater = useCallback((text, kind) => {
    const id = ++floaterIdRef.current;
    setFloaters((f) => [...f, { id, text, kind, x: randInt(-20, 20) }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);
  }, []);

  const addCoinBurst = useCallback(() => {
    if (!motionOn) return;
    const id = ++burstIdRef.current;
    const pieces = Array.from({ length: 7 }, (_, i) => ({
      key: i, dx: randInt(-70, 70), dy: randInt(-90, -30), rot: randInt(-90, 90), delay: i * 0.02,
    }));
    setCoinBursts((b) => [...b, { id, pieces }]);
    setTimeout(() => setCoinBursts((b) => b.filter((x) => x.id !== id)), 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionOn]);

  /* ---------------- XP / achievements helpers ---------------- */

  const grantXp = useCallback((amount) => {
    const before = getLevelInfo(totalXp).level;
    const newTotal = totalXp + amount;
    const after = getLevelInfo(newTotal).level;
    setTotalXp(newTotal);
    if (after > before) {
      setShowLevelUp(after);
      playSfx("levelComplete");
      vibrate("levelUp", settings.vibration);
    }
    setRunXp((x) => x + amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalXp, settings.vibration]);

  const unlockAchievements = useCallback((recordsSnapshot, moneySnapshot) => {
    const ctx = buildAchievementCtx(recordsSnapshot, moneySnapshot);
    const fresh = checkNewAchievements(ctx, achievementsUnlocked);
    if (fresh.length) {
      setAchievementsUnlocked((prev) => [...prev, ...fresh.map((a) => a.id)]);
      setAchievementToasts((prev) => [...prev, ...fresh.map((a) => ({ ...a, toastId: `${a.id}-${Date.now()}` }))]);
      playSfx("achievement");
      vibrate("achievement", settings.vibration);
      fresh.forEach((a, i) => {
        setTimeout(() => {
          setAchievementToasts((prev) => prev.filter((t) => t.id !== a.id));
        }, 4200 + i * 400);
      });
    }
    return fresh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievementsUnlocked, buildAchievementCtx, settings.vibration]);

  /* ---------------- game flow ---------------- */

  function nextQuestion(levelOverride) {
    const lvl = levelOverride || selectedLevel;
    const { a, b } = lvl.gen();
    setQuestion({ a, b });
    questionStartRef.current = Date.now();
  }

  function beginCountdown() {
    unlockAudio();
    setCountdownVal(3);
    setScreen("countdown");
  }

  useEffect(() => {
    if (screen !== "countdown") return;
    if (countdownVal <= 0) return;
    playSfx(countdownVal === 1 ? "countdownGo" : "countdownTick");
    countdownRef.current = setTimeout(() => {
      if (countdownVal === 1) {
        startGame();
      } else {
        setCountdownVal((v) => v - 1);
      }
    }, countdownVal === 1 ? 500 : 700);
    return () => clearTimeout(countdownRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, countdownVal]);

  function startGame() {
    setRunMoney(0);
    setRunXp(0);
    setCorrectCount(0);
    setWrongCount(0);
    setCombo(0);
    setMaxCombo(0);
    setResponseTimes([]);
    setTimeLeft(selectedTime);
    nextQuestion(selectedLevel);
    setScreen("playing");
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  }

  function endGame() {
    clearInterval(timerRef.current);
    const finalRunMoney = Math.round(runMoney);
    const accuracy = correctCount + wrongCount > 0
      ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0;
    const avgTime = responseTimes.length
      ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length : 0;
    const completed = correctCount >= 5 && accuracy >= 60;

    playSfx(completed ? "victory" : "gameOver");
    vibrate(completed ? "victory" : "gameOver", settings.vibration);

    const newMoney = money + finalRunMoney;
    setMoney(newMoney);
    setLevelStats((prev) => {
      const cur = prev[selectedLevelId] || { bestMoney: 0, bestAvgTime: null, plays: 0, bestCombo: 0 };
      return {
        ...prev,
        [selectedLevelId]: {
          bestMoney: Math.max(cur.bestMoney, finalRunMoney),
          bestAvgTime: cur.bestAvgTime === null ? avgTime : Math.min(cur.bestAvgTime, avgTime || Infinity),
          plays: cur.plays + 1,
          bestCombo: Math.max(cur.bestCombo, maxCombo),
        },
      };
    });

    const newRecords = {
      totalCorrect: records.totalCorrect + correctCount,
      totalWrong: records.totalWrong + wrongCount,
      totalPlays: records.totalPlays + 1,
      bestCombo: Math.max(records.bestCombo, maxCombo),
      bestAccuracy: Math.max(records.bestAccuracy, accuracy),
      bestMoneyRun: Math.max(records.bestMoneyRun, finalRunMoney),
      bestAvgTime: records.bestAvgTime === null ? avgTime : Math.min(records.bestAvgTime, avgTime || Infinity),
    };
    setRecords(newRecords);

    const freshAchievements = unlockAchievements(newRecords, newMoney);

    setLastResult({
      moneyEarned: finalRunMoney,
      xpEarned: runXp,
      correctCount, wrongCount, accuracy, avgTime, maxCombo, completed,
      newAchievements: freshAchievements,
    });
    setScreen("end");
  }

  useEffect(() => { endGameRef.current = endGame; });

  // Capture keyboard input for the whole play screen, so the player can
  // just start typing digits without first clicking into the input box.
  useEffect(() => {
    if (screen !== "playing") return;
    function onKeyDown(e) {
      if (feedback) return;
      const isInputFocused = document.activeElement === inputRef.current;
      if (/^[0-9]$/.test(e.key)) {
        if (!isInputFocused) {
          e.preventDefault();
          handleInputChange(inputVal + e.key);
          inputRef.current && inputRef.current.focus();
        }
      } else if (e.key === "Backspace") {
        if (!isInputFocused) {
          e.preventDefault();
          handleInputChange(inputVal.slice(0, -1));
          inputRef.current && inputRef.current.focus();
        }
      } else if (e.key === "Enter") {
        handleSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, feedback, inputVal, question]);

  useEffect(() => {
    if (screen !== "playing") return;
    let lastHeartbeat = -1;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        const nt = Math.round((t - 0.1) * 10) / 10;
        if (nt <= 5 && nt > 0 && Math.ceil(nt) !== lastHeartbeat) {
          lastHeartbeat = Math.ceil(nt);
          playSfx("heartbeat");
          vibrate("heartbeat", settings.vibration);
        }
        if (nt <= 0) {
          clearInterval(timerRef.current);
          setTimeout(() => endGameRef.current(), 0);
          return 0;
        }
        return nt;
      });
    }, 100);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  function handleInputChange(value) {
    if (feedback) return;
    setInputVal(value);
    const correctAnswer = question.a + question.b;
    // Auto-submit the moment the player has typed as many digits as the
    // answer has — no need to press Enter or tap Submit.
    if (value !== "" && value.length >= String(correctAnswer).length) {
      setTimeout(() => handleSubmit(value), 120);
    }
  }

  function handleSubmit(valueOverride) {
    const value = valueOverride !== undefined ? valueOverride : inputVal;
    if (value === "" || feedback) return;
    const correctAnswer = question.a + question.b;
    const given = parseInt(value, 10);
    const responseTime = (Date.now() - questionStartRef.current) / 1000;

    if (given === correctAnswer) {
      const newCombo = combo + 1;
      const reward = computeAnswerReward({ tier: selectedLevel.tier, comboStreak: newCombo, upgrades });
      const earned = reward.coins;
      const xpGain = computeXpReward({ tier: selectedLevel.tier, comboStreak: newCombo, upgrades });
      const mult = reward.comboMult;
      setRunMoney((rm) => rm + earned);
      grantXp(xpGain);
      setCorrectCount((c) => c + 1);
      setCombo(newCombo);
      setMaxCombo((mc) => Math.max(mc, newCombo));
      setResponseTimes((rts) => [...rts, responseTime]);
      addFloater(`+${fmtMoney(earned)}${mult > 1 ? ` \u00d7${mult}` : ""}${reward.lucky ? " \u2605" : ""}`, "correct");
      addCoinBurst();
      setFeedback("correct");
      if (reward.lucky) {
        playSfx("wheelWin");
        vibrate("achievement", settings.vibration);
      } else if (newCombo >= 10 && newCombo % 5 === 0) {
        playSfx("highCombo");
        vibrate("highCombo", settings.vibration);
      } else if (newCombo >= 3) {
        playSfx("combo");
        vibrate("combo", settings.vibration);
      } else {
        playSfx("correct");
        vibrate("correct", settings.vibration);
      }
    } else {
      setWrongCount((w) => w + 1);
      setCombo(0);
      setTimeLeft((t) => Math.round((t + 3) * 10) / 10);
      setRunMoney((rm) => Math.max(0, rm - rm * 0.05));
      addFloater("+3s  \u22125%", "wrong");
      setFeedback("wrong");
      playSfx("wrong");
      vibrate("wrong", settings.vibration);
    }
    setInputVal("");
    setTimeout(() => {
      setFeedback(null);
      nextQuestion();
      inputRef.current && inputRef.current.focus();
    }, 550);
  }

  function buyLevel(level) {
    if (purchased.includes(level.id) || money < level.unlockCost) {
      if (!purchased.includes(level.id)) {
        playSfx("purchaseFail");
        vibrate("wrong", settings.vibration);
      }
      return;
    }
    setMoney((m) => m - level.unlockCost);
    setPurchased((p) => [...p, level.id]);
    setBuyFlash(level.id);
    playSfx("purchaseSuccess");
    playSfx("unlock");
    vibrate("levelUp", settings.vibration);
    setTimeout(() => setBuyFlash(null), 900);
    setTimeout(() => unlockAchievements(records, money - level.unlockCost), 50);
  }

  function goPlay(level) {
    if (!purchased.includes(level.id)) return;
    unlockAudio();
    playSfx("click");
    setSelectedLevelId(level.id);
    setScreen("timer");
  }

  function clickSound() {
    playSfx("click");
    vibrate("click", settings.vibration);
  }

  function claimDailyReward() {
    const today = todayKey();
    if (dailyReward.lastClaim === today) return;
    const gapDays = daysSince(dailyReward.lastClaim);
    const newStreak = gapDays === 1 ? clamp(dailyReward.streak + 1, 1, 7) : 1;
    const reward = DAILY_REWARDS[(newStreak - 1) % DAILY_REWARDS.length];
    setMoney((m) => m + reward.coins);
    grantXp(reward.xp);
    setDailyReward({ lastClaim: today, streak: newStreak });
    playSfx("purchaseSuccess");
    vibrate("levelUp", settings.vibration);
    setTimeout(() => unlockAchievements(records, money + reward.coins), 50);
  }

  function spinWheel(landedIndex) {
    const today = todayKey();
    const seg = WHEEL_SEGMENTS[landedIndex];
    setMoney((m) => m + seg.coins);
    grantXp(Math.round(seg.coins / 20));
    setWheelState({ lastSpin: today });
    playSfx("wheelWin");
    vibrate("wheel", settings.vibration);
    setTimeout(() => unlockAchievements(records, money + seg.coins), 50);
  }

  function updateSettings(patch) {
    setSettings((s) => ({ ...s, ...patch }));
  }

  function resetSettingsOnly() {
    setSettings({ ...DEFAULT_SETTINGS });
    playSfx("click");
  }

  /* ---------------- shop: upgrades ---------------- */

  function buyUpgrade(def) {
    const currentLevel = upgrades[def.id] || 0;
    if (currentLevel >= def.maxLevel) return;
    const cost = upgradeCost(def, currentLevel);
    if (money < cost) {
      playSfx("purchaseFail");
      vibrate("wrong", settings.vibration);
      return;
    }
    setMoney((m) => m - cost);
    setUpgrades((u) => ({ ...u, [def.id]: currentLevel + 1 }));
    setPurchaseFlash(`upgrade-${def.id}`);
    playSfx("purchaseSuccess");
    vibrate("levelUp", settings.vibration);
    setTimeout(() => setPurchaseFlash(null), 900);
  }

  /* ---------------- shop: themes ---------------- */

  function buyTheme(def) {
    if (inventory.themes.includes(def.id)) return;
    if (money < def.cost) {
      playSfx("purchaseFail");
      vibrate("wrong", settings.vibration);
      return;
    }
    setMoney((m) => m - def.cost);
    setInventory((inv) => ({ ...inv, themes: [...inv.themes, def.id] }));
    setPurchaseFlash(`theme-${def.id}`);
    playSfx("purchaseSuccess");
    playSfx("unlock");
    vibrate("levelUp", settings.vibration);
    setTimeout(() => setPurchaseFlash(null), 900);
  }

  function equipTheme(id) {
    if (!inventory.themes.includes(id)) return;
    setEquipped((e) => ({ ...e, theme: id }));
    playSfx("click");
    vibrate("click", settings.vibration);
  }

  /* ---------------- shop: avatars ---------------- */

  function buyAvatar(def) {
    if (inventory.avatars.includes(def.id)) return;
    if (money < def.cost) {
      playSfx("purchaseFail");
      vibrate("wrong", settings.vibration);
      return;
    }
    setMoney((m) => m - def.cost);
    setInventory((inv) => ({ ...inv, avatars: [...inv.avatars, def.id] }));
    setPurchaseFlash(`avatar-${def.id}`);
    playSfx("purchaseSuccess");
    playSfx("unlock");
    vibrate("levelUp", settings.vibration);
    setTimeout(() => setPurchaseFlash(null), 900);
  }

  function equipAvatar(id) {
    if (!inventory.avatars.includes(id)) return;
    setEquipped((e) => ({ ...e, avatar: id }));
    playSfx("click");
    vibrate("click", settings.vibration);
  }

  /* ---------------- shop: titles ---------------- */

  function equipTitle(id) {
    if (!unlockedTitles.some((t) => t.id === id)) return;
    setEquipped((e) => ({ ...e, title: id }));
    playSfx("click");
    vibrate("click", settings.vibration);
  }

  function resetProgress() {
    const d = defaultState();
    setMoney(d.money);
    setPurchased(d.purchased);
    setLevelStats(d.levelStats);
    setTotalXp(d.totalXp);
    setAchievementsUnlocked(d.achievementsUnlocked);
    setDailyReward(d.dailyReward);
    setWheelState(d.wheel);
    setRecords(d.records);
    setUpgrades(d.upgrades);
    setInventory(d.inventory);
    setEquipped(d.equipped);
    setResetConfirm(false);
    setShowSettings(false);
    setScreen("home");
  }

  /* ---------------- shared style bits ---------------- */

  const pageStyle = {
    minHeight: "100%",
    background: `radial-gradient(ellipse 120% 80% at 50% -10%, ${COLORS.navy3} 0%, ${COLORS.deep} 55%)`,
    color: COLORS.ink,
    fontFamily: "Georgia, 'Times New Roman', serif",
    position: "relative",
    overflow: "hidden",
  };

  const canClaimDaily = dailyReward.lastClaim !== todayKey();
  const canSpinWheel = wheelState.lastSpin !== todayKey();

  return (
    <div style={pageStyle} className="w-full min-h-screen safe-area-pad" data-theme={settings.darkMode ? "dark" : "light"}>
      <GlobalStyle motionOn={motionOn} />

      {screen === "home" && (
        <HomeScreen
          COLORS={COLORS}
          money={money}
          purchased={purchased}
          levelStats={levelStats}
          buyFlash={buyFlash}
          levelInfo={levelInfo}
          rank={rank}
          nextRank={nextRank}
          worldProgress={worldProgress}
          equipped={equipped}
          dailyReward={dailyReward}
          canClaimDaily={canClaimDaily}
          canSpinWheel={canSpinWheel}
          onBuy={buyLevel}
          onPlay={goPlay}
          onOpenSettings={() => { clickSound(); setShowSettings(true); }}
          onOpenAchievements={() => { clickSound(); setShowAchievements(true); }}
          onOpenDaily={() => { clickSound(); setShowDaily(true); }}
          onOpenWheel={() => { clickSound(); setShowWheel(true); }}
          onOpenAbout={() => { clickSound(); setShowAbout(true); }}
          onOpenShop={() => { clickSound(); setShowShop(true); }}
          achievementsUnlocked={achievementsUnlocked}
          motionOn={motionOn}
        />
      )}
      {screen === "timer" && (
        <TimerScreen
          COLORS={COLORS}
          level={selectedLevel}
          selectedTime={selectedTime}
          setSelectedTime={(t) => { clickSound(); setSelectedTime(t); }}
          onBack={() => { clickSound(); setScreen("home"); }}
          onStart={beginCountdown}
          motionOn={motionOn}
        />
      )}
      {screen === "countdown" && (
        <CountdownOverlay COLORS={COLORS} value={countdownVal} level={selectedLevel} motionOn={motionOn} />
      )}
      {screen === "playing" && (
        <PlayScreen
          COLORS={COLORS}
          level={selectedLevel}
          timeLeft={timeLeft}
          totalTime={selectedTime}
          runMoney={runMoney}
          runXp={runXp}
          correctCount={correctCount}
          wrongCount={wrongCount}
          combo={combo}
          question={question}
          inputVal={inputVal}
          setInputVal={handleInputChange}
          feedback={feedback}
          floaters={floaters}
          coinBursts={coinBursts}
          onSubmit={handleSubmit}
          inputRef={inputRef}
          motionOn={motionOn}
        />
      )}
      {screen === "end" && lastResult && (
        <EndScreen
          COLORS={COLORS}
          level={selectedLevel}
          result={lastResult}
          money={money}
          levelInfo={levelInfo}
          onPlayAgain={() => { clickSound(); setScreen("timer"); }}
          onRetry={() => { clickSound(); beginCountdown(); }}
          onHome={() => { clickSound(); setScreen("home"); }}
          motionOn={motionOn}
        />
      )}

      {showSettings && (
        <SettingsModal
          COLORS={COLORS}
          settings={settings}
          equipped={equipped}
          inventory={inventory}
          onEquipTheme={equipTheme}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
          onOpenAbout={() => setShowAbout(true)}
          onResetRequest={() => setResetConfirm(true)}
          onResetSettings={resetSettingsOnly}
        />
      )}
      {showShop && (
        <ShopModal
          COLORS={COLORS}
          money={money}
          upgrades={upgrades}
          inventory={inventory}
          equipped={equipped}
          shopTab={shopTab}
          setShopTab={setShopTab}
          purchaseFlash={purchaseFlash}
          levelInfo={levelInfo}
          unlockedTitles={unlockedTitles}
          onBuyUpgrade={buyUpgrade}
          onBuyTheme={buyTheme}
          onEquipTheme={equipTheme}
          onBuyAvatar={buyAvatar}
          onEquipAvatar={equipAvatar}
          onEquipTitle={equipTitle}
          onClose={() => setShowShop(false)}
        />
      )}
      {resetConfirm && (
        <ConfirmModal
          COLORS={COLORS}
          title="Reset all progress?"
          message="This will erase your bank balance, unlocked levels, XP, achievements, and stats. This can't be undone."
          confirmLabel="Reset Everything"
          onConfirm={resetProgress}
          onCancel={() => setResetConfirm(false)}
        />
      )}
      {showAchievements && (
        <AchievementsModal
          COLORS={COLORS}
          unlockedIds={achievementsUnlocked}
          onClose={() => setShowAchievements(false)}
        />
      )}
      {showDaily && (
        <DailyRewardModal
          COLORS={COLORS}
          dailyReward={dailyReward}
          canClaim={canClaimDaily}
          onClaim={() => { claimDailyReward(); }}
          onClose={() => setShowDaily(false)}
        />
      )}
      {showWheel && (
        <LuckyWheelModal
          COLORS={COLORS}
          canSpin={canSpinWheel}
          onSpinResolved={spinWheel}
          onClose={() => setShowWheel(false)}
          playSfx={playSfx}
        />
      )}
      {showAbout && (
        <AboutModal COLORS={COLORS} onClose={() => setShowAbout(false)} />
      )}
      {showLevelUp && (
        <LevelUpModal COLORS={COLORS} level={showLevelUp} onClose={() => setShowLevelUp(null)} />
      )}

      <AchievementToastStack COLORS={COLORS} toasts={achievementToasts} />
    </div>
  );
}

/* ===========================================================
   GLOBAL STYLE (keyframes + theme-aware CSS)
=========================================================== */

function GlobalStyle({ motionOn }) {
  return (
    <style>{`
      @keyframes spinSlow { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      @keyframes spinSlowRev { from { transform: rotate(360deg);} to { transform: rotate(0deg);} }
      @keyframes pulseGold {
        0%,100% { box-shadow: 0 0 18px 2px rgba(242,193,78,0.35), inset 0 0 24px rgba(242,193,78,0.06);}
        50% { box-shadow: 0 0 34px 8px rgba(242,193,78,0.6), inset 0 0 30px rgba(242,193,78,0.14);}
      }
      @keyframes shakeX {
        0%,100% { transform: translateX(0);}
        20% { transform: translateX(-10px);}
        40% { transform: translateX(9px);}
        60% { transform: translateX(-6px);}
        80% { transform: translateX(4px);}
      }
      @keyframes floatUp {
        0% { opacity: 0; transform: translate(-50%, 0) scale(0.85);}
        15% { opacity: 1; transform: translate(-50%, -6px) scale(1);}
        100% { opacity: 0; transform: translate(-50%, -70px) scale(1.05);}
      }
      @keyframes popIn {
        0% { opacity: 0; transform: scale(0.7);}
        60% { opacity: 1; transform: scale(1.08);}
        100% { opacity: 1; transform: scale(1);}
      }
      @keyframes flashGreen {
        0% { background-color: rgba(51,209,122,0); }
        30% { background-color: rgba(51,209,122,0.22); }
        100% { background-color: rgba(51,209,122,0); }
      }
      @keyframes flashRed {
        0% { background-color: rgba(224,67,92,0); }
        30% { background-color: rgba(224,67,92,0.24); }
        100% { background-color: rgba(224,67,92,0); }
      }
      @keyframes comboGlow {
        0%,100% { text-shadow: 0 0 8px rgba(242,193,78,0.5);}
        50% { text-shadow: 0 0 20px rgba(242,193,78,0.95);}
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes coinPop {
        0% { opacity: 1; transform: translate(0,0) rotate(0deg) scale(1); }
        100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.6); }
      }
      @keyframes toastSlideIn {
        0% { opacity: 0; transform: translateX(60px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes fadeInUp {
        0% { opacity: 0; transform: translateY(14px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes modalIn {
        0% { opacity: 0; transform: scale(0.92) translateY(10px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes overlayIn {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
      @keyframes countdownPop {
        0% { opacity: 0; transform: scale(0.4); }
        30% { opacity: 1; transform: scale(1.25); }
        100% { opacity: 0; transform: scale(1.5); }
      }
      @keyframes xpFill {
        0% { transform: scaleX(var(--xp-from)); }
        100% { transform: scaleX(var(--xp-to)); }
      }
      @keyframes badgeBounce {
        0%,100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes confettiFall {
        0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(420px) rotate(540deg); opacity: 0; }
      }
      .spin-slow { animation: spinSlow 40s linear infinite; }
      .spin-slow-rev { animation: spinSlowRev 55s linear infinite; }
      .pulse-gold { animation: pulseGold 2.4s ease-in-out infinite; }
      .shake-x { animation: shakeX 0.4s ease; }
      .float-up { animation: floatUp 0.9s ease-out forwards; }
      .pop-in { animation: popIn 0.35s cubic-bezier(.34,1.56,.64,1); }
      .flash-green { animation: flashGreen 0.55s ease; }
      .flash-red { animation: flashRed 0.55s ease; }
      .combo-glow { animation: comboGlow 1s ease-in-out infinite; }
      .fade-in-up { animation: fadeInUp 0.4s ease-out both; }
      .modal-in { animation: modalIn 0.28s cubic-bezier(.34,1.56,.64,1); }
      .overlay-in { animation: overlayIn 0.2s ease; }
      .toast-in { animation: toastSlideIn 0.35s cubic-bezier(.34,1.56,.64,1); }
      .countdown-pop { animation: countdownPop 0.7s cubic-bezier(.2,.8,.3,1); }
      .badge-bounce { animation: badgeBounce 1.6s ease-in-out infinite; }
      .coin-piece { animation: coinPop 0.65s ease-out forwards; }
      .confetti-piece { animation: confettiFall 1.8s linear forwards; }
      .gold-text {
        background: linear-gradient(90deg, #b9852e, #ffe9a8 40%, #f2c14e 60%, #b9852e);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: shimmer 4s linear infinite;
      }
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      ${!motionOn ? `
        *, *::before, *::after {
          animation-duration: 0.001s !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001s !important;
        }
      ` : ""}
      button { touch-action: manipulation; }
      ::selection { background: rgba(242,193,78,0.35); }

      /* ---- mobile / installed-app friendliness ---- */
      html, body, #root {
        height: 100%;
        overscroll-behavior: none;
      }
      body {
        -webkit-tap-highlight-color: transparent;
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
      input, textarea { -webkit-user-select: text; user-select: text; }
      /* keep inputs at 16px+ so iOS/Android don't auto-zoom on focus */
      input[type=number] { font-size: max(16px, 1em); }
      /* respect device notches / gesture bars when installed as an app */
      .safe-area-pad {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      }
    `}</style>
  );
}

/* ===========================================================
   SPOTLIGHT BACKGROUND
=========================================================== */

function Spotlight({ motionOn = true }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", pointerEvents: "none", zIndex: 0,
      }}
    >
      <div
        className={motionOn ? "spin-slow" : ""}
        style={{
          width: 900, height: 900, borderRadius: "50%",
          background: `conic-gradient(from 0deg, rgba(242,193,78,0.10) 0deg, transparent 24deg, transparent 336deg, rgba(242,193,78,0.10) 360deg)`,
          position: "absolute",
        }}
      />
      <div
        className={motionOn ? "spin-slow-rev" : ""}
        style={{
          width: 700, height: 700, borderRadius: "50%",
          background: `conic-gradient(from 45deg, rgba(255,233,168,0.08) 0deg, transparent 20deg, transparent 340deg, rgba(255,233,168,0.08) 360deg)`,
          position: "absolute",
        }}
      />
      <div
        style={{
          width: 520, height: 520, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(242,193,78,0.16) 0%, rgba(242,193,78,0.04) 55%, transparent 75%)",
          position: "absolute",
        }}
      />
    </div>
  );
}

/* ===========================================================
   SHARED UI ATOMS
=========================================================== */

const XPBar = memo(function XPBar({ COLORS, levelInfo, compact }) {
  const pct = clamp((levelInfo.into / levelInfo.need) * 100, 0, 100);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold" style={{ color: COLORS.xp }}>LEVEL {levelInfo.level}</span>
        {!compact && (
          <span className="text-[11px]" style={{ color: COLORS.inkDim }}>
            {levelInfo.into} / {levelInfo.need} XP
          </span>
        )}
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 8, background: "rgba(125,211,252,0.15)", border: `1px solid ${COLORS.border}` }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${COLORS.xpDeep}, ${COLORS.xp})`,
            transition: "width 0.5s cubic-bezier(.2,.8,.3,1)",
          }}
        />
      </div>
    </div>
  );
});

const IconButton = memo(function IconButton({ COLORS, icon, label, onClick, badge, accent }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-2xl px-3 py-3 transition-transform active:scale-95 relative"
      style={{
        background: `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`,
        border: `1px solid ${accent ? COLORS.gold : COLORS.border}`,
        minWidth: 76,
      }}
    >
      {badge && (
        <span
          className="badge-bounce absolute -top-2 -right-2 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ width: 20, height: 20, background: COLORS.wrong, color: "#fff" }}
        >
          !
        </span>
      )}
      <div style={{ color: accent ? COLORS.gold : COLORS.inkDim }}>{icon}</div>
      <span className="text-[11px] font-semibold" style={{ color: COLORS.ink }}>{label}</span>
    </button>
  );
});

function ModalShell({ COLORS, onClose, children, maxWidth = 420, title, icon }) {
  return (
    <div
      className="overlay-in"
      style={{
        position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(4,7,20,0.72)", padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="modal-in w-full flex flex-col"
        style={{
          maxWidth, maxHeight: "88vh", overflowY: "auto",
          background: `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`,
          border: `1px solid ${COLORS.goldDeep}`, borderRadius: 20, padding: 22,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-bold text-lg" style={{ color: COLORS.gold }}>{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 transition-transform active:scale-90" style={{ background: "rgba(255,255,255,0.06)" }}>
            <X size={18} color={COLORS.inkDim} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ COLORS, title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <ModalShell COLORS={COLORS} onClose={onCancel} title={title} maxWidth={380}>
      <p className="text-sm mb-6" style={{ color: COLORS.inkDim }}>{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl py-3 font-semibold transition-transform active:scale-95"
          style={{ background: COLORS.navy2, color: COLORS.ink, border: `1px solid ${COLORS.border}` }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-xl py-3 font-semibold transition-transform active:scale-95"
          style={{ background: COLORS.wrong, color: "#fff" }}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function Stat({ COLORS, icon, label, value }) {
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-2"
      style={{ background: COLORS.navy2, border: `1px solid ${COLORS.border}` }}
    >
      {icon}
      <div>
        <div className="text-xs" style={{ color: COLORS.inkDim }}>{label}</div>
        <div className="font-bold text-sm" style={{ color: COLORS.ink }}>{value}</div>
      </div>
    </div>
  );
}

function CoinBurstLayer({ bursts }) {
  return (
    <>
      {bursts.map((b) => (
        <div key={b.id} style={{ position: "absolute", left: "50%", top: "50%", pointerEvents: "none", zIndex: 25 }}>
          {b.pieces.map((p) => (
            <div
              key={p.key}
              className="coin-piece"
              style={{
                position: "absolute",
                width: 14, height: 14, borderRadius: "50%",
                background: "radial-gradient(circle, #ffe9a8, #f2c14e 60%, #b9852e)",
                boxShadow: "0 0 6px rgba(242,193,78,0.8)",
                "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function AchievementToastStack({ COLORS, toasts }) {
  if (!toasts.length) return null;
  return (
    <div
      style={{ position: "fixed", top: 16, right: 16, zIndex: 70, display: "flex", flexDirection: "column", gap: 10, maxWidth: 300 }}
    >
      {toasts.map((t) => {
        const Icon = t.icon;
        return (
          <div
            key={t.id}
            className="toast-in flex items-center gap-3 rounded-xl p-3"
            style={{
              background: `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`,
              border: `1px solid ${COLORS.gold}`, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <div
              className="rounded-full flex items-center justify-center flex-shrink-0"
              style={{ width: 36, height: 36, background: `radial-gradient(circle, ${COLORS.gold}, ${COLORS.goldDeep})` }}
            >
              <Icon size={18} color={COLORS.deep} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: COLORS.gold }}>Achievement Unlocked</div>
              <div className="text-sm font-bold" style={{ color: COLORS.ink }}>{t.title}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===========================================================
   HOME SCREEN
=========================================================== */

const LevelCard = memo(function LevelCard({ COLORS, level, owned, affordable, stats, isBuyFlash, onPlay, onBuy }) {
  return (
    <div
      className={`rounded-xl p-4 flex flex-col justify-between ${isBuyFlash ? "pop-in" : ""}`}
      style={{
        background: owned
          ? `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`
          : `linear-gradient(160deg, ${COLORS.navy}, ${COLORS.deep})`,
        border: `1px solid ${owned ? COLORS.goldDeep : COLORS.border}`,
        opacity: owned || affordable ? 1 : 0.7,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs font-semibold tracking-wider" style={{ color: COLORS.gold }}>
            LEVEL {level.id} &middot; {TIER_LABEL[level.tier]}
          </div>
          <div className="font-bold text-lg" style={{ color: COLORS.ink }}>{level.name}</div>
          <div className="text-sm" style={{ color: COLORS.inkDim }}>{level.tag}</div>
        </div>
        {!owned && <Lock size={18} color={COLORS.inkDim} />}
      </div>

      {stats && (
        <div className="text-xs mb-3 flex gap-3" style={{ color: COLORS.inkDim }}>
          <span className="flex items-center gap-1"><Trophy size={12} /> {fmtMoney(stats.bestMoney)}</span>
          <span className="flex items-center gap-1"><Flame size={12} /> x{stats.bestCombo}</span>
        </div>
      )}

      {owned ? (
        <button
          onClick={() => onPlay(level)}
          className="w-full rounded-lg py-2 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95"
          style={{ background: COLORS.gold, color: COLORS.deep }}
        >
          <Play size={16} fill={COLORS.deep} /> Play
        </button>
      ) : (
        <button
          onClick={() => onBuy(level)}
          disabled={!affordable}
          className="w-full rounded-lg py-2 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:cursor-not-allowed"
          style={{
            background: affordable ? `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})` : "rgba(0,0,0,0.15)",
            color: affordable ? COLORS.deep : COLORS.inkDim,
            border: affordable ? "none" : `1px solid ${COLORS.border}`,
          }}
        >
          <Coins size={16} /> Buy for {fmtMoney(level.unlockCost)}
        </button>
      )}
    </div>
  );
});

const RankBadge = memo(function RankBadge({ COLORS, rank, size = "sm" }) {
  const big = size === "lg";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-bold tracking-wide"
      style={{
        color: COLORS.deep, background: `linear-gradient(160deg, ${rank.color}, ${COLORS.goldDeep})`,
        padding: big ? "4px 12px" : "2px 8px", fontSize: big ? 12 : 10,
      }}
    >
      <Medal size={big ? 13 : 11} /> {rank.name.toUpperCase()}
    </span>
  );
});

const PlayerCard = memo(function PlayerCard({ COLORS, levelInfo, rank, nextRank, worldProgress, equipped, money, dailyReward, motionOn }) {
  const avatarDef = getAvatarDef(equipped.avatar);
  const titleDef = getTitleDef(equipped.title);
  const pct = clamp((levelInfo.into / levelInfo.need) * 100, 0, 100);
  return (
    <div
      className="w-full rounded-3xl p-5 mb-5 relative overflow-hidden"
      style={{
        background: `linear-gradient(150deg, ${COLORS.navy2} 0%, ${COLORS.navy} 55%, ${COLORS.deep} 130%)`,
        border: `1px solid ${COLORS.goldDeep}`,
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className={`rounded-2xl flex items-center justify-center flex-shrink-0 ${motionOn ? "pulse-gold" : ""}`}
          style={{ width: 64, height: 64, fontSize: 32, background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold} 55%, ${COLORS.goldDeep})` }}
        >
          <span>{avatarDef.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg truncate" style={{ color: COLORS.ink }}>Player</span>
            <RankBadge COLORS={COLORS} rank={rank} />
          </div>
          <div className="text-xs mb-1.5" style={{ color: COLORS.goldDeep }}>{titleDef.name}</div>
          <XPBar COLORS={COLORS} levelInfo={levelInfo} />
          {nextRank && (
            <div className="text-[10px] mt-1" style={{ color: COLORS.inkDim }}>
              {nextRank.minLevel - levelInfo.level} level{nextRank.minLevel - levelInfo.level === 1 ? "" : "s"} to {nextRank.name}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="rounded-xl px-3 py-2.5 flex flex-col items-center" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${COLORS.border}` }}>
          <Coins size={16} color={COLORS.gold} />
          <span className="font-bold text-sm mt-1" style={{ color: COLORS.ink }}>{fmtMoney(money)}</span>
          <span className="text-[9px] uppercase tracking-wide" style={{ color: COLORS.inkDim }}>Coins</span>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex flex-col items-center" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${COLORS.border}` }}>
          <Rocket size={16} color={COLORS.gold} />
          <span className="font-bold text-sm mt-1 truncate max-w-full" style={{ color: COLORS.ink }}>{worldProgress.current.name}</span>
          <span className="text-[9px] uppercase tracking-wide" style={{ color: COLORS.inkDim }}>World {worldProgress.current.id}</span>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex flex-col items-center" style={{ background: "rgba(0,0,0,0.18)", border: `1px solid ${COLORS.border}` }}>
          <Flame size={16} color={COLORS.gold} />
          <span className="font-bold text-sm mt-1" style={{ color: COLORS.ink }}>{dailyReward.streak || 0} day{dailyReward.streak === 1 ? "" : "s"}</span>
          <span className="text-[9px] uppercase tracking-wide" style={{ color: COLORS.inkDim }}>Streak</span>
        </div>
      </div>
    </div>
  );
});

const WorldStrip = memo(function WorldStrip({ COLORS, worldProgress }) {
  return (
    <div className="w-full flex gap-2 overflow-x-auto pb-1 mb-6" style={{ scrollbarWidth: "thin" }}>
      {WORLDS.map((w) => {
        const unlocked = worldProgress.unlockedIds.includes(w.id);
        const active = w.id === worldProgress.current.id;
        return (
          <div
            key={w.id}
            className="flex-shrink-0 rounded-xl px-3 py-2 flex flex-col items-center"
            style={{
              minWidth: 108,
              background: active ? `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})` : COLORS.navy2,
              border: `1px solid ${active ? w.theme : COLORS.border}`,
              opacity: unlocked ? 1 : 0.5,
            }}
          >
            <div className="flex items-center gap-1">
              {!unlocked && <Lock size={11} color={COLORS.inkDim} />}
              <span className="text-[10px] font-bold" style={{ color: unlocked ? w.theme : COLORS.inkDim }}>WORLD {w.id}</span>
            </div>
            <span className="text-xs font-semibold text-center" style={{ color: COLORS.ink }}>{w.name}</span>
            {!unlocked && <span className="text-[9px] mt-0.5" style={{ color: COLORS.inkDim }}>Lvl {w.minLevel}</span>}
          </div>
        );
      })}
    </div>
  );
});

function HomeScreen({
  COLORS, money, purchased, levelStats, buyFlash, levelInfo, rank, nextRank, worldProgress, equipped, dailyReward,
  canClaimDaily, canSpinWheel, onBuy, onPlay, onOpenSettings, onOpenAchievements, onOpenDaily, onOpenWheel, onOpenAbout,
  onOpenShop, achievementsUnlocked, motionOn,
}) {
  const highestUnlocked = Math.max(...purchased);
  const nextLevel = LEVELS.find((l) => !purchased.includes(l.id));

  return (
    <div style={{ position: "relative", zIndex: 1 }} className="min-h-screen flex flex-col items-center px-4 py-6">
      <Spotlight motionOn={motionOn} />
      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl">

        <div className="w-full flex items-center justify-between mb-3">
          <div className="text-xs tracking-[0.35em]" style={{ color: COLORS.inkDim }}>
            THE ADDITION HOT SEAT
          </div>
          <button onClick={onOpenSettings} className="rounded-full p-2.5 transition-transform active:scale-90" style={{ background: COLORS.navy2, border: `1px solid ${COLORS.border}` }}>
            <SettingsIcon size={20} color={COLORS.inkDim} />
          </button>
        </div>
        <h1
          className="gold-text text-center font-bold mb-5"
          style={{ fontSize: "clamp(28px, 6vw, 46px)", letterSpacing: "1px" }}
        >
          MILLIONAIRE ADDITION
        </h1>

        <PlayerCard
          COLORS={COLORS}
          levelInfo={levelInfo}
          rank={rank}
          nextRank={nextRank}
          worldProgress={worldProgress}
          equipped={equipped}
          money={money}
          dailyReward={dailyReward}
          motionOn={motionOn}
        />

        <WorldStrip COLORS={COLORS} worldProgress={worldProgress} />

        {/* Primary CTA row: Play / Continue / Shop */}
        <div className="w-full flex items-center justify-center gap-3 mb-4 flex-wrap">
          <button
            onClick={() => onPlay(LEVELS.find((l) => l.id === highestUnlocked))}
            className="flex items-center gap-3 rounded-full px-8 py-4 font-bold text-lg transition-transform active:scale-95"
            style={{
              background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold} 55%, ${COLORS.goldDeep})`,
              color: COLORS.deep,
              boxShadow: "0 8px 24px rgba(242,193,78,0.35)",
            }}
          >
            <Play size={22} fill={COLORS.deep} />
            Play Level {highestUnlocked}
          </button>
          <button
            disabled
            className="flex items-center gap-2 rounded-full px-5 py-4 font-semibold transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: COLORS.navy2, color: COLORS.inkDim, border: `1px solid ${COLORS.border}` }}
            title="Continue a run in progress \u2014 coming soon"
          >
            <RotateCcw size={18} /> Continue
          </button>
          <button
            onClick={onOpenShop}
            className="flex items-center gap-2 rounded-full px-5 py-4 font-semibold transition-transform active:scale-95"
            style={{ background: COLORS.navy2, color: COLORS.ink, border: `1px solid ${COLORS.gold}` }}
          >
            <Gift size={18} color={COLORS.gold} /> Shop
          </button>
        </div>

        {nextLevel && (
          <div className="text-xs mb-6" style={{ color: COLORS.inkDim }}>
            Next level unlock: <span style={{ color: money >= nextLevel.unlockCost ? COLORS.correct : COLORS.ink, fontWeight: 700 }}>{fmtMoney(nextLevel.unlockCost)}</span>
          </div>
        )}

        {/* quick action row */}
        <div className="w-full flex items-center justify-center gap-3 mb-8 flex-wrap">
          <IconButton COLORS={COLORS} icon={<Gift size={20} />} label="Daily" onClick={onOpenDaily} badge={canClaimDaily} accent={canClaimDaily} />
          <IconButton COLORS={COLORS} icon={<RotateCw size={20} />} label="Wheel" onClick={onOpenWheel} badge={canSpinWheel} accent={canSpinWheel} />
          <IconButton COLORS={COLORS} icon={<Award size={20} />} label="Awards" onClick={onOpenAchievements} />
          <IconButton COLORS={COLORS} icon={<Info size={20} />} label="About" onClick={onOpenAbout} />
        </div>
        {achievementsUnlocked.length > 0 && (
          <div className="text-xs mb-6 -mt-4" style={{ color: COLORS.inkDim }}>
            {achievementsUnlocked.length} / {ACHIEVEMENTS.length} achievements unlocked
          </div>
        )}

        {/* Level grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEVELS.map((level) => (
            <LevelCard
              key={level.id}
              COLORS={COLORS}
              level={level}
              owned={purchased.includes(level.id)}
              affordable={money >= level.unlockCost}
              stats={levelStats[level.id]}
              isBuyFlash={buyFlash === level.id}
              onPlay={onPlay}
              onBuy={onBuy}
            />
          ))}
        </div>

        <div className="text-xs mt-8 mb-1 text-center" style={{ color: COLORS.inkDim }}>
          Progress saves automatically &mdash; come back any time.
        </div>
        <div className="text-[11px] mb-2 text-center tracking-wide" style={{ color: COLORS.goldDeep }}>
          Made by Project ReBan
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   TIMER SELECT SCREEN
=========================================================== */

function TimerScreen({ COLORS, level, selectedTime, setSelectedTime, onBack, onStart, motionOn }) {
  const options = [30, 60, 120];
  return (
    <div style={{ position: "relative", zIndex: 1 }} className="min-h-screen flex flex-col items-center justify-center px-4">
      <Spotlight motionOn={motionOn} />
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        <button
          onClick={onBack}
          className="self-start mb-6 flex items-center gap-2 text-sm"
          style={{ color: COLORS.inkDim }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="text-xs tracking-widest mb-1" style={{ color: COLORS.inkDim }}>LEVEL {level.id}</div>
        <h2 className="gold-text font-bold text-2xl mb-1 text-center">{level.name}</h2>
        <div className="text-sm mb-8" style={{ color: COLORS.inkDim }}>{level.tag}</div>

        <div className="text-sm uppercase tracking-wider mb-3" style={{ color: COLORS.gold }}>Choose Your Time</div>
        <div className="flex gap-3 mb-10">
          {options.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTime(t)}
              className="rounded-xl px-6 py-4 font-bold text-lg transition-transform active:scale-95"
              style={{
                background: selectedTime === t
                  ? `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})`
                  : COLORS.navy2,
                color: selectedTime === t ? COLORS.deep : COLORS.ink,
                border: `1px solid ${selectedTime === t ? COLORS.gold : COLORS.border}`,
              }}
            >
              {t}s
            </button>
          ))}
        </div>

        <button
          onClick={onStart}
          className="flex items-center gap-3 rounded-full px-10 py-4 font-bold text-lg pulse-gold transition-transform active:scale-95"
          style={{
            background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold} 55%, ${COLORS.goldDeep})`,
            color: COLORS.deep,
          }}
        >
          <Play size={22} fill={COLORS.deep} /> Start Game
        </button>
      </div>
    </div>
  );
}

/* ===========================================================
   COUNTDOWN OVERLAY
=========================================================== */

function CountdownOverlay({ COLORS, value, level, motionOn }) {
  return (
    <div style={{ position: "relative", zIndex: 1 }} className="min-h-screen flex flex-col items-center justify-center px-4">
      <Spotlight motionOn={motionOn} />
      <div className="relative z-10 flex flex-col items-center">
        <div className="text-xs tracking-widest mb-2" style={{ color: COLORS.inkDim }}>GET READY</div>
        <div className="text-sm mb-10" style={{ color: COLORS.gold }}>{level.name}</div>
        <div
          key={value}
          className="countdown-pop font-bold"
          style={{ fontSize: 110, color: value === 1 ? COLORS.correct : COLORS.gold }}
        >
          {value === 1 ? "GO!" : value}
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   PLAY SCREEN
=========================================================== */

function PlayScreen({
  COLORS, level, timeLeft, totalTime, runMoney, runXp, correctCount, wrongCount, combo,
  question, inputVal, setInputVal, feedback, floaters, coinBursts, onSubmit, inputRef, motionOn,
}) {
  const total = correctCount + wrongCount;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 100;
  const pct = Math.max(0, Math.min(1, timeLeft / totalTime));
  const urgent = timeLeft <= 10;
  const mult = comboMultiplier(combo);

  const ringBg = `conic-gradient(${urgent ? COLORS.wrong : COLORS.gold} ${pct * 360}deg, rgba(0,0,0,0.15) 0deg)`;

  return (
    <div
      style={{ position: "relative", zIndex: 1 }}
      className={`min-h-screen flex flex-col items-center px-4 py-5 ${feedback === "correct" ? "flash-green" : ""} ${feedback === "wrong" ? "flash-red" : ""} ${urgent && motionOn ? "shake-x" : ""}`}
    >
      <Spotlight motionOn={motionOn} />

      {/* top bar */}
      <div className="relative z-10 w-full max-w-3xl flex items-start justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.inkDim }}>Level {level.id}</div>
          <div className="font-bold" style={{ color: COLORS.gold }}>{level.name}</div>
        </div>

        <div className="flex flex-col items-center">
          <div
            className="rounded-full flex items-center justify-center relative"
            style={{ width: 78, height: 78, background: ringBg }}
          >
            <div
              className="rounded-full flex items-center justify-center"
              style={{ width: 64, height: 64, background: COLORS.deep }}
            >
              <span className="font-bold text-lg" style={{ color: urgent ? COLORS.wrong : COLORS.ink }}>
                {timeLeft.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.inkDim }}>Money This Run</div>
          <div className="font-bold" style={{ color: COLORS.gold }}>{fmtMoney(runMoney)}</div>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-3xl mb-4">
        <XPBar COLORS={COLORS} levelInfo={{ into: runXp, need: Math.max(runXp, 40) }} compact />
      </div>

      {/* accuracy + combo */}
      <div className="relative z-10 w-full max-w-3xl flex items-center justify-between mb-6 text-sm">
        <div style={{ color: COLORS.inkDim }}>Accuracy: <span style={{ color: COLORS.ink }}>{accuracy}%</span></div>
        {combo >= 3 && (
          <div className={`flex items-center gap-1 font-bold ${mult > 1 ? "combo-glow" : ""}`} style={{ color: COLORS.gold }}>
            <Flame size={16} /> {combo} combo {mult > 1 && `\u00d7${mult}`}
          </div>
        )}
      </div>

      {/* question card */}
      <div className="relative z-10 flex-1 flex items-center justify-center w-full">
        <div className="relative flex items-center justify-center">
          {floaters.map((f) => (
            <div
              key={f.id}
              className="float-up absolute font-bold whitespace-nowrap"
              style={{
                left: `calc(50% + ${f.x}px)`, top: -10,
                color: f.kind === "correct" ? COLORS.correct : COLORS.wrong,
                fontSize: 20, zIndex: 20,
              }}
            >
              {f.text}
            </div>
          ))}
          <CoinBurstLayer bursts={coinBursts} />
          <div
            className={`rounded-3xl flex items-center justify-center px-10 py-14 sm:px-16 sm:py-16 ${feedback === "wrong" && motionOn ? "shake-x" : ""} ${!feedback && motionOn ? "pulse-gold" : ""}`}
            style={{
              background: `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`,
              border: `2px solid ${feedback === "correct" ? COLORS.correct : feedback === "wrong" ? COLORS.wrong : COLORS.goldDeep}`,
              minWidth: 280,
            }}
          >
            <div
              className="font-bold text-center"
              style={{ fontSize: "clamp(30px, 8vw, 56px)", color: COLORS.ink, letterSpacing: "1px" }}
            >
              {question.a} + {question.b}
            </div>
          </div>
        </div>
      </div>

      {/* input */}
      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-3 pb-4">
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          autoFocus
          readOnly
          value={inputVal}
          disabled={!!feedback}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
          placeholder="?"
          className="w-full text-center rounded-xl px-4 py-4 font-bold outline-none"
          style={{
            fontSize: 28, background: COLORS.deep, color: COLORS.ink,
            border: `2px solid ${COLORS.goldDeep}`,
          }}
        />

        {/* on-screen number pad — tap to answer, no system keyboard needed */}
        <NumberPad
          COLORS={COLORS}
          disabled={!!feedback}
          onDigit={(d) => setInputVal(inputVal + d)}
          onBackspace={() => setInputVal(inputVal.slice(0, -1))}
          onClear={() => setInputVal("")}
        />
        {/* note: setInputVal here is the parent's handleInputChange,
            so number-pad taps auto-submit exactly like typed digits do */}

        <button
          onClick={onSubmit}
          disabled={inputVal === "" || !!feedback}
          className="w-full rounded-xl py-3 font-bold text-lg transition-transform active:scale-95 disabled:opacity-50"
          style={{
            background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold} 55%, ${COLORS.goldDeep})`,
            color: COLORS.deep,
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

/* ===========================================================
   ON-SCREEN NUMBER PAD
   A large-tap-target 0-9 keypad rendered below the answer box,
   so the game is fully playable by touch on Android/iOS with no
   dependency on the device's own keyboard popping up.
=========================================================== */

function NumberPad({ COLORS, disabled, onDigit, onBackspace, onClear }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];
  return (
    <div
      className="w-full grid grid-cols-3 gap-2 select-none"
      style={{ touchAction: "manipulation" }}
    >
      {keys.map((k) => {
        const isBack = k === "back";
        const isClear = k === "clear";
        return (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (isBack) onBackspace();
              else if (isClear) onClear();
              else onDigit(k);
            }}
            className="rounded-xl font-bold text-xl flex items-center justify-center transition-transform active:scale-90 disabled:opacity-50"
            style={{
              height: 54,
              background: isBack || isClear ? COLORS.navy3 : COLORS.navy2,
              color: isBack || isClear ? COLORS.gold : COLORS.ink,
              border: `1.5px solid ${COLORS.border}`,
            }}
            aria-label={isBack ? "Backspace" : isClear ? "Clear" : `Digit ${k}`}
          >
            {isBack ? "\u232b" : isClear ? "C" : k}
          </button>
        );
      })}
    </div>
  );
}

/* ===========================================================
   END SCREEN
=========================================================== */

function EndScreen({ COLORS, level, result, money, levelInfo, onPlayAgain, onRetry, onHome, motionOn }) {
  const { moneyEarned, xpEarned, correctCount, wrongCount, accuracy, avgTime, maxCombo, completed, newAchievements } = result;
  return (
    <div style={{ position: "relative", zIndex: 1 }} className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <Spotlight motionOn={motionOn} />
      <div className={`relative z-10 w-full max-w-md flex flex-col items-center ${motionOn ? "pop-in" : ""}`}>
        <div
          className="mb-2 px-4 py-1 rounded-full text-xs font-bold tracking-widest"
          style={{
            background: completed ? "rgba(51,209,122,0.15)" : "rgba(224,67,92,0.15)",
            color: completed ? COLORS.correct : COLORS.wrong,
            border: `1px solid ${completed ? COLORS.correct : COLORS.wrong}`,
          }}
        >
          {completed ? "LEVEL COMPLETED" : "LEVEL FAILED"}
        </div>
        <h2 className="gold-text font-bold text-3xl mb-1 text-center">Time's Up!</h2>
        <div className="text-sm mb-6" style={{ color: COLORS.inkDim }}>Level {level.id} &middot; {level.name}</div>

        <div
          className={`w-full rounded-2xl p-6 mb-4 flex flex-col items-center ${motionOn ? "pulse-gold" : ""}`}
          style={{ background: `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`, border: `1px solid ${COLORS.goldDeep}` }}
        >
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.inkDim }}>Money Earned</div>
          <div className="font-bold mb-4" style={{ fontSize: 34, color: COLORS.gold }}>+{fmtMoney(moneyEarned)}</div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.inkDim }}>Total Bank Balance</div>
          <div className="font-semibold" style={{ fontSize: 20, color: COLORS.ink }}>{fmtMoney(money)}</div>
        </div>

        <div className="w-full rounded-2xl p-4 mb-6" style={{ background: COLORS.navy2, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider flex items-center gap-1" style={{ color: COLORS.xp }}>
              <Zap size={13} /> +{xpEarned} XP earned
            </span>
            <span className="text-xs" style={{ color: COLORS.inkDim }}>Level {levelInfo.level}</span>
          </div>
          <XPBar COLORS={COLORS} levelInfo={levelInfo} compact />
        </div>

        <div className="w-full grid grid-cols-2 gap-3 mb-6">
          <Stat COLORS={COLORS} icon={<CheckCircle2 size={16} color={COLORS.correct} />} label="Correct" value={correctCount} />
          <Stat COLORS={COLORS} icon={<XCircle size={16} color={COLORS.wrong} />} label="Wrong" value={wrongCount} />
          <Stat COLORS={COLORS} icon={<TrendingUp size={16} color={COLORS.gold} />} label="Accuracy" value={`${accuracy}%`} />
          <Stat COLORS={COLORS} icon={<Clock size={16} color={COLORS.gold} />} label="Avg Speed" value={`${avgTime.toFixed(1)}s`} />
          <Stat COLORS={COLORS} icon={<Flame size={16} color={COLORS.gold} />} label="Highest Combo" value={maxCombo} />
          <Stat COLORS={COLORS} icon={<Star size={16} color={COLORS.gold} />} label="Tier" value={TIER_LABEL[level.tier]} />
        </div>

        {newAchievements && newAchievements.length > 0 && (
          <div className="w-full mb-6">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: COLORS.gold }}>Achievements Unlocked</div>
            <div className="flex flex-col gap-2">
              {newAchievements.map((a) => {
                const Icon = a.icon;
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: COLORS.navy2, border: `1px solid ${COLORS.gold}` }}>
                    <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, background: `radial-gradient(circle, ${COLORS.gold}, ${COLORS.goldDeep})` }}>
                      <Icon size={16} color={COLORS.deep} />
                    </div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: COLORS.ink }}>{a.title}</div>
                      <div className="text-xs" style={{ color: COLORS.inkDim }}>{a.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="w-full rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-transform active:scale-95"
            style={{ background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold} 55%, ${COLORS.goldDeep})`, color: COLORS.deep }}
          >
            <Play size={18} fill={COLORS.deep} /> Play Again
          </button>
          <div className="flex gap-3">
            <button
              onClick={onRetry}
              className="flex-1 rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95"
              style={{ background: COLORS.navy2, color: COLORS.ink, border: `1px solid ${COLORS.border}` }}
            >
              <RotateCcw size={16} /> Retry
            </button>
            <button
              onClick={onHome}
              className="flex-1 rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95"
              style={{ background: COLORS.navy2, color: COLORS.ink, border: `1px solid ${COLORS.border}` }}
            >
              <HomeIcon size={16} /> Home
            </button>
          </div>
          <button
            onClick={() => {}}
            className="w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 opacity-70 cursor-default"
            style={{ background: "transparent", color: COLORS.inkDim, border: `1px dashed ${COLORS.border}` }}
          >
            Share Score (coming soon)
          </button>
        </div>

        <div className="text-[11px] mt-6 text-center tracking-wide" style={{ color: COLORS.goldDeep }}>
          Made by Project ReBan
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   SETTINGS MODAL
=========================================================== */

function ToggleRow({ COLORS, icon, label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <div className="flex items-center gap-3">
        <div style={{ color: COLORS.inkDim }}>{icon}</div>
        <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{label}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="rounded-full transition-colors relative"
        style={{ width: 46, height: 26, background: value ? COLORS.gold : "rgba(255,255,255,0.12)" }}
      >
        <span
          className="absolute rounded-full transition-transform"
          style={{
            width: 20, height: 20, top: 3, left: 3, background: value ? COLORS.deep : COLORS.ink,
            transform: value ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  );
}

function SettingsModal({ COLORS, settings, equipped, inventory, onEquipTheme, onUpdate, onClose, onOpenAbout, onResetRequest, onResetSettings }) {
  return (
    <ModalShell COLORS={COLORS} onClose={onClose} title="Settings" icon={<SettingsIcon size={20} color={COLORS.gold} />} maxWidth={440}>
      <div className="flex flex-col">
        <ToggleRow COLORS={COLORS} icon={settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />} label="Sound Effects" value={settings.sound} onChange={(v) => onUpdate({ sound: v })} />
        <ToggleRow COLORS={COLORS} icon={<Sparkles size={18} />} label="Background Music" value={settings.music} onChange={(v) => onUpdate({ music: v })} />
        <ToggleRow COLORS={COLORS} icon={<Vibrate size={18} />} label="Vibration" value={settings.vibration} onChange={(v) => onUpdate({ vibration: v })} />
        <ToggleRow COLORS={COLORS} icon={settings.darkMode ? <Moon size={18} /> : <Sun size={18} />} label="Dark Mode" value={settings.darkMode} onChange={(v) => onUpdate({ darkMode: v })} />
        <ToggleRow COLORS={COLORS} icon={<Zap size={18} />} label="Reduce Animations" value={settings.reduceMotion} onChange={(v) => onUpdate({ reduceMotion: v })} />
      </div>

      <div className="mt-5">
        <div className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: COLORS.gold }}>Theme</div>
        <div className="grid grid-cols-3 gap-2">
          {THEME_DEFS.map((t) => {
            const owned = inventory.themes.includes(t.id);
            const active = equipped.theme === t.id;
            const swatch = t.colors || (settings.darkMode ? DARK_COLORS : LIGHT_COLORS);
            return (
              <button
                key={t.id}
                onClick={() => owned && onEquipTheme(t.id)}
                disabled={!owned}
                className="rounded-xl p-2 flex flex-col items-center gap-1 transition-transform active:scale-95 disabled:opacity-40"
                style={{ background: swatch.navy2, border: `2px solid ${active ? COLORS.gold : COLORS.border}` }}
              >
                <div className="flex gap-1">
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: swatch.gold, display: "inline-block" }} />
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: swatch.navy3, display: "inline-block" }} />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: swatch.ink }}>{t.name}</span>
                {!owned && <Lock size={10} color={swatch.inkDim} />}
              </button>
            );
          })}
        </div>
        <div className="text-[11px] mt-2" style={{ color: COLORS.inkDim }}>More themes are unlocked in the Shop.</div>
      </div>

      <div className="flex gap-2 mt-3 opacity-50">
        <div className="flex-1 rounded-xl px-3 py-2.5 text-xs flex items-center gap-2" style={{ background: COLORS.navy2, border: `1px solid ${COLORS.border}`, color: COLORS.inkDim }}>
          <VolumeX size={14} /> More audio options coming soon
        </div>
      </div>

      <button
        onClick={onOpenAbout}
        className="w-full mt-5 rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95"
        style={{ background: COLORS.navy2, color: COLORS.ink, border: `1px solid ${COLORS.border}` }}
      >
        <Info size={16} /> About Project ReBan
      </button>

      <button
        onClick={onResetSettings}
        className="w-full mt-3 rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95"
        style={{ background: COLORS.navy2, color: COLORS.ink, border: `1px solid ${COLORS.border}` }}
      >
        <RotateCw size={16} /> Reset Settings to Default
      </button>

      <button
        onClick={onResetRequest}
        className="w-full mt-3 rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95"
        style={{ background: "rgba(224,67,92,0.12)", color: COLORS.wrong, border: `1px solid ${COLORS.wrong}` }}
      >
        <RotateCcw size={16} /> Reset Progress
      </button>

      <div className="text-[10px] text-center mt-4 tracking-wide" style={{ color: COLORS.inkDim }}>
        Millionaire Addition &middot; v2.0 &middot; Save format v{SAVE_VERSION}
      </div>
    </ModalShell>
  );
}

/* ===========================================================
   SHOP MODAL — Upgrades / Themes / Avatars / Titles
=========================================================== */

const SHOP_TABS = [
  { id: "upgrades", label: "Upgrades", icon: TrendingUp },
  { id: "themes", label: "Themes", icon: Sparkles },
  { id: "avatars", label: "Avatars", icon: User },
  { id: "titles", label: "Titles", icon: Award },
];

function ShopModal({
  COLORS, money, upgrades, inventory, equipped, shopTab, setShopTab, purchaseFlash, levelInfo, unlockedTitles,
  onBuyUpgrade, onBuyTheme, onEquipTheme, onBuyAvatar, onEquipAvatar, onEquipTitle, onClose,
}) {
  return (
    <ModalShell COLORS={COLORS} onClose={onClose} title="Shop" icon={<Gift size={20} color={COLORS.gold} />} maxWidth={520}>
      <div className="flex items-center justify-between rounded-xl px-4 py-2.5 mb-4" style={{ background: COLORS.navy2, border: `1px solid ${COLORS.border}` }}>
        <span className="text-xs uppercase tracking-wider" style={{ color: COLORS.inkDim }}>Balance</span>
        <span className="font-bold flex items-center gap-1.5" style={{ color: COLORS.gold }}>
          <Coins size={16} /> {fmtMoney(money)}
        </span>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {SHOP_TABS.map((t) => {
          const Icon = t.icon;
          const active = shopTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setShopTab(t.id)}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-transform active:scale-95"
              style={{
                background: active ? `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})` : COLORS.navy2,
                color: active ? COLORS.deep : COLORS.inkDim,
                border: `1px solid ${active ? COLORS.gold : COLORS.border}`,
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {shopTab === "upgrades" && (
        <div className="flex flex-col gap-3">
          {UPGRADE_DEFS.map((def) => {
            const Icon = def.icon;
            const lvl = upgrades[def.id] || 0;
            const maxed = lvl >= def.maxLevel;
            const cost = maxed ? null : upgradeCost(def, lvl);
            const currentBonus = upgradeBonus(def, lvl);
            const nextBonus = maxed ? currentBonus : upgradeBonus(def, lvl + 1);
            const affordable = !maxed && money >= cost;
            return (
              <div
                key={def.id}
                className={`rounded-xl p-4 ${purchaseFlash === `upgrade-${def.id}` ? "pop-in" : ""}`}
                style={{ background: `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`, border: `1px solid ${COLORS.border}` }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, background: `radial-gradient(circle, ${COLORS.gold}, ${COLORS.goldDeep})` }}>
                      <Icon size={17} color={COLORS.deep} />
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: COLORS.ink }}>{def.name}</div>
                      <div className="text-xs" style={{ color: COLORS.inkDim }}>{def.desc}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold flex-shrink-0" style={{ color: COLORS.gold }}>LV {lvl}/{def.maxLevel}</span>
                </div>
                <div
                  className="w-full rounded-full overflow-hidden mb-2.5"
                  style={{ height: 6, background: "rgba(255,255,255,0.08)" }}
                >
                  <div style={{ width: `${(lvl / def.maxLevel) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.goldDeep}, ${COLORS.gold})` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: COLORS.inkDim }}>
                    {maxed ? `Maxed \u2014 ${def.bonusLabel(currentBonus)}` : `Next: ${def.bonusLabel(nextBonus)}`}
                  </span>
                  <button
                    onClick={() => onBuyUpgrade(def)}
                    disabled={maxed || !affordable}
                    className="rounded-lg px-4 py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                    style={{
                      background: maxed ? COLORS.navy3 : `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})`,
                      color: maxed ? COLORS.inkDim : COLORS.deep,
                    }}
                  >
                    {maxed ? "MAXED" : <><Coins size={12} /> {fmtMoney(cost)}</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shopTab === "themes" && (
        <div className="grid grid-cols-2 gap-3">
          {THEME_DEFS.map((t) => {
            const owned = inventory.themes.includes(t.id);
            const equippedNow = equipped.theme === t.id;
            const swatch = t.colors || DARK_COLORS;
            const affordable = money >= t.cost;
            return (
              <div
                key={t.id}
                className={`rounded-xl p-3.5 flex flex-col ${purchaseFlash === `theme-${t.id}` ? "pop-in" : ""}`}
                style={{ background: `linear-gradient(160deg, ${swatch.navy2}, ${swatch.navy})`, border: `1px solid ${equippedNow ? COLORS.gold : COLORS.border}` }}
              >
                <div className="flex gap-1.5 mb-2">
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: swatch.gold }} />
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: swatch.navy3 }} />
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: swatch.correct }} />
                </div>
                <div className="font-bold text-sm mb-0.5" style={{ color: swatch.ink }}>{t.name}</div>
                <div className="text-xs mb-3" style={{ color: swatch.inkDim }}>{t.cost === 0 ? "Included free" : fmtMoney(t.cost)}</div>
                {owned ? (
                  <button
                    onClick={() => onEquipTheme(t.id)}
                    disabled={equippedNow}
                    className="mt-auto rounded-lg py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-70"
                    style={{ background: equippedNow ? COLORS.navy3 : `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})`, color: equippedNow ? COLORS.gold : COLORS.deep }}
                  >
                    {equippedNow ? "EQUIPPED" : "EQUIP"}
                  </button>
                ) : (
                  <button
                    onClick={() => onBuyTheme(t)}
                    disabled={!affordable}
                    className="mt-auto rounded-lg py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1"
                    style={{ background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})`, color: COLORS.deep }}
                  >
                    <Coins size={12} /> {fmtMoney(t.cost)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {shopTab === "avatars" && (
        <div className="grid grid-cols-3 gap-3">
          {AVATAR_DEFS.map((a) => {
            const owned = inventory.avatars.includes(a.id);
            const equippedNow = equipped.avatar === a.id;
            const affordable = money >= a.cost;
            return (
              <div
                key={a.id}
                className={`rounded-xl p-3 flex flex-col items-center text-center ${purchaseFlash === `avatar-${a.id}` ? "pop-in" : ""}`}
                style={{ background: `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`, border: `1px solid ${equippedNow ? COLORS.gold : COLORS.border}` }}
              >
                <span className="text-3xl mb-1.5">{a.emoji}</span>
                <div className="font-bold text-xs mb-0.5" style={{ color: COLORS.ink }}>{a.name}</div>
                <div className="text-[10px] mb-2.5" style={{ color: COLORS.inkDim }}>{a.cost === 0 ? "Free" : fmtMoney(a.cost)}</div>
                {owned ? (
                  <button
                    onClick={() => onEquipAvatar(a.id)}
                    disabled={equippedNow}
                    className="w-full rounded-lg py-1.5 text-[10px] font-bold transition-transform active:scale-95 disabled:opacity-70"
                    style={{ background: equippedNow ? COLORS.navy3 : `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})`, color: equippedNow ? COLORS.gold : COLORS.deep }}
                  >
                    {equippedNow ? "EQUIPPED" : "EQUIP"}
                  </button>
                ) : (
                  <button
                    onClick={() => onBuyAvatar(a)}
                    disabled={!affordable}
                    className="w-full rounded-lg py-1.5 text-[10px] font-bold transition-transform active:scale-95 disabled:opacity-40"
                    style={{ background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})`, color: COLORS.deep }}
                  >
                    BUY
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {shopTab === "titles" && (
        <div className="flex flex-col gap-2.5">
          {TITLE_DEFS.map((t) => {
            const unlocked = unlockedTitles.some((u) => u.id === t.id);
            const equippedNow = equipped.title === t.id;
            return (
              <div
                key={t.id}
                className="rounded-xl p-3.5 flex items-center justify-between"
                style={{ background: COLORS.navy2, border: `1px solid ${equippedNow ? COLORS.gold : COLORS.border}`, opacity: unlocked ? 1 : 0.55 }}
              >
                <div>
                  <div className="font-bold text-sm flex items-center gap-1.5" style={{ color: COLORS.ink }}>
                    {!unlocked && <Lock size={12} color={COLORS.inkDim} />} {t.name}
                  </div>
                  <div className="text-[10px]" style={{ color: COLORS.inkDim }}>
                    {unlocked ? "Unlocked" : `Unlocks at player level ${t.unlockLevel}`}
                  </div>
                </div>
                <button
                  onClick={() => onEquipTitle(t.id)}
                  disabled={!unlocked || equippedNow}
                  className="rounded-lg px-3.5 py-2 text-[10px] font-bold transition-transform active:scale-95 disabled:opacity-40"
                  style={{ background: equippedNow ? COLORS.navy3 : `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})`, color: equippedNow ? COLORS.gold : COLORS.deep }}
                >
                  {equippedNow ? "EQUIPPED" : "EQUIP"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

/* ===========================================================
   ACHIEVEMENTS MODAL
=========================================================== */

function AchievementsModal({ COLORS, unlockedIds, onClose }) {
  return (
    <ModalShell COLORS={COLORS} onClose={onClose} title="Achievements" icon={<Award size={20} color={COLORS.gold} />} maxWidth={460}>
      <div className="text-xs mb-4" style={{ color: COLORS.inkDim }}>
        {unlockedIds.length} / {ACHIEVEMENTS.length} unlocked
      </div>
      <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = unlockedIds.includes(a.id);
          const Icon = a.icon;
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{
                background: COLORS.navy2,
                border: `1px solid ${unlocked ? COLORS.gold : COLORS.border}`,
                opacity: unlocked ? 1 : 0.55,
              }}
            >
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{ width: 38, height: 38, background: unlocked ? `radial-gradient(circle, ${COLORS.gold}, ${COLORS.goldDeep})` : "rgba(255,255,255,0.08)" }}
              >
                <Icon size={18} color={unlocked ? COLORS.deep : COLORS.inkDim} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold" style={{ color: COLORS.ink }}>{a.title}</div>
                <div className="text-xs" style={{ color: COLORS.inkDim }}>{a.desc}</div>
              </div>
              {unlocked && <CheckCircle2 size={18} color={COLORS.correct} />}
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}

/* ===========================================================
   DAILY REWARD MODAL
=========================================================== */

function DailyRewardModal({ COLORS, dailyReward, canClaim, onClaim, onClose }) {
  const [claimed, setClaimed] = useState(false);
  const activeIndex = canClaim
    ? clamp(dailyReward.streak, 0, DAILY_REWARDS.length - 1) % DAILY_REWARDS.length
    : (dailyReward.streak - 1 + DAILY_REWARDS.length) % DAILY_REWARDS.length;

  return (
    <ModalShell COLORS={COLORS} onClose={onClose} title="Daily Reward" icon={<Gift size={20} color={COLORS.gold} />} maxWidth={440}>
      <p className="text-sm mb-4" style={{ color: COLORS.inkDim }}>
        Come back every day to grow your streak and earn bigger rewards.
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
        {DAILY_REWARDS.map((r, i) => {
          const dayNum = i + 1;
          const isToday = canClaim ? i === activeIndex : false;
          const isPast = canClaim ? i < activeIndex : i <= activeIndex;
          return (
            <div
              key={i}
              className={`rounded-lg p-2 flex flex-col items-center ${isToday ? "pulse-gold" : ""}`}
              style={{
                background: isToday ? `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})` : COLORS.navy2,
                border: `1px solid ${isToday ? COLORS.gold : COLORS.border}`,
                opacity: isPast || isToday ? 1 : 0.55,
              }}
            >
              <span className="text-[10px] font-bold" style={{ color: isToday ? COLORS.deep : COLORS.inkDim }}>DAY {dayNum}</span>
              <Coins size={14} color={isToday ? COLORS.deep : COLORS.gold} className="my-1" />
              <span className="text-[10px] font-bold" style={{ color: isToday ? COLORS.deep : COLORS.ink }}>{r.coins}</span>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => { onClaim(); setClaimed(true); }}
        disabled={!canClaim || claimed}
        className="w-full rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
        style={{ background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold} 55%, ${COLORS.goldDeep})`, color: COLORS.deep }}
      >
        <Gift size={18} /> {claimed ? "Claimed!" : canClaim ? `Claim +${DAILY_REWARDS[activeIndex].coins} Coins` : "Come Back Tomorrow"}
      </button>
    </ModalShell>
  );
}

/* ===========================================================
   LUCKY WHEEL MODAL
=========================================================== */

function LuckyWheelModal({ COLORS, canSpin, onSpinResolved, onClose, playSfx }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const segAngle = 360 / WHEEL_SEGMENTS.length;
  const tickRef = useRef(null);

  const segColors = ["#f2c14e", "#131f4d", "#f2c14e", "#131f4d", "#f2c14e", "#131f4d", "#f2c14e", "#131f4d"];
  const gradient = WHEEL_SEGMENTS.map((s, i) => `${segColors[i]} ${i * segAngle}deg ${(i + 1) * segAngle}deg`).join(", ");

  function doSpin() {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setResult(null);
    const landedIndex = randInt(0, WHEEL_SEGMENTS.length - 1);
    const targetCenter = landedIndex * segAngle + segAngle / 2;
    const spins = 6;
    const finalRotation = rotation + spins * 360 + (360 - targetCenter) - (rotation % 360);
    let ticks = 0;
    tickRef.current = setInterval(() => {
      ticks += 1;
      playSfx("wheelTick");
      if (ticks > 26) clearInterval(tickRef.current);
    }, 110);
    setRotation(finalRotation);
    setTimeout(() => {
      clearInterval(tickRef.current);
      setSpinning(false);
      setResult(WHEEL_SEGMENTS[landedIndex]);
      onSpinResolved(landedIndex);
    }, 3000);
  }

  useEffect(() => () => clearInterval(tickRef.current), []);

  return (
    <ModalShell COLORS={COLORS} onClose={onClose} title="Lucky Wheel" icon={<RotateCw size={20} color={COLORS.gold} />} maxWidth={420}>
      <p className="text-sm mb-5 text-center" style={{ color: COLORS.inkDim }}>
        {canSpin ? "One free spin per day. Good luck!" : "You've already spun today \u2014 come back tomorrow."}
      </p>
      <div className="flex flex-col items-center">
        <div style={{ position: "relative", width: 240, height: 240 }}>
          <div
            style={{
              position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
              width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent",
              borderTop: `18px solid ${COLORS.gold}`, zIndex: 5,
            }}
          />
          <div
            style={{
              width: 240, height: 240, borderRadius: "50%",
              background: `conic-gradient(${gradient})`,
              border: `4px solid ${COLORS.goldDeep}`,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 3s cubic-bezier(.17,.67,.32,1.02)" : "none",
              position: "relative",
            }}
          >
            {WHEEL_SEGMENTS.map((s, i) => {
              const mid = i * segAngle + segAngle / 2;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute", top: "50%", left: "50%", width: 100, textAlign: "center",
                    transform: `rotate(${mid}deg) translate(0, -92px) rotate(0deg)`,
                    transformOrigin: "0 0", marginLeft: -50,
                  }}
                >
                  <span className="text-[11px] font-bold" style={{ color: i % 2 === 0 ? COLORS.deep : COLORS.gold }}>{s.label}</span>
                </div>
              );
            })}
          </div>
          <div
            className="absolute rounded-full flex items-center justify-center"
            style={{
              width: 46, height: 46, top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              background: `radial-gradient(circle, ${COLORS.goldLine}, ${COLORS.gold})`, border: `2px solid ${COLORS.goldDeep}`,
            }}
          >
            <Sparkles size={20} color={COLORS.deep} />
          </div>
        </div>

        {result && (
          <div className="mt-5 text-center">
            <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.inkDim }}>You Won</div>
            <div className="font-bold text-2xl" style={{ color: COLORS.gold }}>+{fmtMoney(result.coins)}</div>
          </div>
        )}

        <button
          onClick={doSpin}
          disabled={!canSpin || spinning}
          className="w-full mt-6 rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold} 55%, ${COLORS.goldDeep})`, color: COLORS.deep }}
        >
          <RotateCw size={18} /> {spinning ? "Spinning..." : canSpin ? "Spin the Wheel" : "Come Back Tomorrow"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ===========================================================
   ABOUT MODAL
=========================================================== */

function AboutModal({ COLORS, onClose }) {
  return (
    <ModalShell COLORS={COLORS} onClose={onClose} title="About" icon={<Info size={20} color={COLORS.gold} />} maxWidth={420}>
      <div className="flex flex-col items-center text-center">
        <div
          className="rounded-2xl flex items-center justify-center mb-4 pulse-gold"
          style={{ width: 72, height: 72, background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold} 55%, ${COLORS.goldDeep})` }}
        >
          <Sparkles size={34} color={COLORS.deep} />
        </div>
        <h4 className="gold-text font-bold text-xl mb-2">Project ReBan</h4>
        <p className="text-sm mb-5" style={{ color: COLORS.inkDim }}>
          Building engaging educational experiences through technology.
        </p>
        <div className="w-full flex flex-col gap-2 text-left">
          <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: COLORS.navy2, border: `1px solid ${COLORS.border}` }}>
            <Rocket size={18} color={COLORS.gold} />
            <span className="text-sm" style={{ color: COLORS.ink }}>Millionaire Addition &mdash; version 2.0</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: COLORS.navy2, border: `1px solid ${COLORS.border}` }}>
            <ShieldCheck size={18} color={COLORS.gold} />
            <span className="text-sm" style={{ color: COLORS.ink }}>Your progress is saved automatically</span>
          </div>
        </div>
        <div className="text-[11px] mt-6 tracking-wide" style={{ color: COLORS.goldDeep }}>
          Made with care by Project ReBan
        </div>
      </div>
    </ModalShell>
  );
}

/* ===========================================================
   LEVEL UP MODAL
=========================================================== */

function LevelUpModal({ COLORS, level, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="overlay-in"
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,7,20,0.55)", pointerEvents: "none" }}
    >
      <div className="pop-in flex flex-col items-center">
        <div
          className="rounded-full flex items-center justify-center mb-3 pulse-gold"
          style={{ width: 100, height: 100, background: `radial-gradient(circle, ${COLORS.goldLine}, ${COLORS.gold} 60%, ${COLORS.goldDeep})` }}
        >
          <Sparkles size={44} color={COLORS.deep} />
        </div>
        <div className="gold-text font-bold text-3xl">LEVEL UP!</div>
        <div className="font-bold text-xl mt-1" style={{ color: COLORS.ink }}>You reached Level {level}</div>
      </div>
    </div>
  );
}
