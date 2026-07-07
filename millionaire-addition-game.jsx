import { useState, useEffect, useRef, useCallback } from "react";
import {
  Coins, Lock, Play, RotateCcw, Home as HomeIcon, Trophy, Clock,
  Zap, CheckCircle2, XCircle, ArrowLeft, Flame, TrendingUp, Star
} from "lucide-react";

/* ---------------------------------------------------------
   TOKENS
   bg-deep:   #070c1f  (near-black navy, the "studio floor")
   bg-navy:   #0d1638  (panel navy)
   bg-navy-2: #131f4d  (raised panel navy)
   gold:      #f2c14e  (primary gold)
   gold-deep: #b9852e  (shadow gold)
   gold-line: #ffe9a8  (hairline gold / hot highlight)
   correct:   #33d17a
   wrong:     #e0435c
   ink:       #f5f1e6  (warm off-white text)
   ink-dim:   #9aa3c7  (secondary text)
--------------------------------------------------------- */

const COLORS = {
  deep: "#070c1f",
  navy: "#0d1638",
  navy2: "#131f4d",
  navy3: "#1a2a63",
  gold: "#f2c14e",
  goldDeep: "#b9852e",
  goldLine: "#ffe9a8",
  correct: "#33d17a",
  wrong: "#e0435c",
  ink: "#f5f1e6",
  inkDim: "#9aa3c7",
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ---------------------------------------------------------
   LEVEL DEFINITIONS
--------------------------------------------------------- */

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
const TIER_LABEL = { easy: "EASY", medium: "MEDIUM", hard: "HARD", master: "MASTER" };

function comboMultiplier(streak) {
  if (streak >= 20) return 5;
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  return 1;
}

function fmtMoney(n) {
  const rounded = Math.round(n);
  return "$" + rounded.toLocaleString("en-US");
}

const STORAGE_KEY = "millionaire_addition_state_v1";

/* ---------------------------------------------------------
   MAIN COMPONENT
--------------------------------------------------------- */

export default function MillionaireAdditionGame() {
  const [loaded, setLoaded] = useState(false);
  const [money, setMoney] = useState(0);
  const [purchased, setPurchased] = useState([1]);
  const [levelStats, setLevelStats] = useState({});

  const [screen, setScreen] = useState("home"); // home | timer | playing | end
  const [selectedLevelId, setSelectedLevelId] = useState(1);
  const [selectedTime, setSelectedTime] = useState(60);
  const [buyFlash, setBuyFlash] = useState(null);

  // run state
  const [timeLeft, setTimeLeft] = useState(60);
  const [runMoney, setRunMoney] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [responseTimes, setResponseTimes] = useState([]);
  const [question, setQuestion] = useState({ a: 0, b: 0 });
  const [inputVal, setInputVal] = useState("");
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [floaters, setFloaters] = useState([]);
  const [lastResult, setLastResult] = useState(null);

  const timerRef = useRef(null);
  const questionStartRef = useRef(Date.now());
  const inputRef = useRef(null);
  const endGameRef = useRef(() => {});
  const floaterIdRef = useRef(0);

  const selectedLevel = LEVELS.find((l) => l.id === selectedLevelId) || LEVELS[0];

  /* ---------------- persistence ---------------- */

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setMoney(parsed.money || 0);
          setPurchased(parsed.purchased && parsed.purchased.length ? parsed.purchased : [1]);
          setLevelStats(parsed.levelStats || {});
        }
      } catch (e) {
        // no saved state yet; defaults are fine
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const state = { money, purchased, levelStats };
    window.storage.set(STORAGE_KEY, JSON.stringify(state), false).catch(() => {});
  }, [money, purchased, levelStats, loaded]);

  /* ---------------- floaters ---------------- */

  const addFloater = useCallback((text, kind) => {
    const id = ++floaterIdRef.current;
    setFloaters((f) => [...f, { id, text, kind, x: randInt(-20, 20) }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);
  }, []);

  /* ---------------- game flow ---------------- */

  function nextQuestion(levelOverride) {
    const lvl = levelOverride || selectedLevel;
    const { a, b } = lvl.gen();
    setQuestion({ a, b });
    questionStartRef.current = Date.now();
  }

  function startGame() {
    setRunMoney(0);
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

    setMoney((m) => m + finalRunMoney);
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

    setLastResult({
      moneyEarned: finalRunMoney,
      correctCount, wrongCount, accuracy, avgTime, maxCombo, completed,
    });
    setScreen("end");
  }

  useEffect(() => { endGameRef.current = endGame; });

  useEffect(() => {
    if (screen !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        const nt = Math.round((t - 0.1) * 10) / 10;
        if (nt <= 0) {
          clearInterval(timerRef.current);
          setTimeout(() => endGameRef.current(), 0);
          return 0;
        }
        return nt;
      });
    }, 100);
    return () => clearInterval(timerRef.current);
  }, [screen]);

  function handleSubmit() {
    if (inputVal === "" || feedback) return;
    const correctAnswer = question.a + question.b;
    const given = parseInt(inputVal, 10);
    const responseTime = (Date.now() - questionStartRef.current) / 1000;

    if (given === correctAnswer) {
      const newCombo = combo + 1;
      const mult = comboMultiplier(newCombo);
      const earned = TIER_REWARD[selectedLevel.tier] * mult;
      setRunMoney((rm) => rm + earned);
      setCorrectCount((c) => c + 1);
      setCombo(newCombo);
      setMaxCombo((mc) => Math.max(mc, newCombo));
      setResponseTimes((rts) => [...rts, responseTime]);
      addFloater(`+${fmtMoney(earned)}${mult > 1 ? ` x${mult}` : ""}`, "correct");
      setFeedback("correct");
    } else {
      setWrongCount((w) => w + 1);
      setCombo(0);
      setTimeLeft((t) => Math.round((t + 3) * 10) / 10);
      setRunMoney((rm) => Math.max(0, rm - rm * 0.05));
      addFloater("+3s  \u22125%", "wrong");
      setFeedback("wrong");
    }
    setInputVal("");
    setTimeout(() => {
      setFeedback(null);
      nextQuestion();
      inputRef.current && inputRef.current.focus();
    }, 550);
  }

  function buyLevel(level) {
    if (purchased.includes(level.id) || money < level.unlockCost) return;
    setMoney((m) => m - level.unlockCost);
    setPurchased((p) => [...p, level.id]);
    setBuyFlash(level.id);
    setTimeout(() => setBuyFlash(null), 900);
  }

  function goPlay(level) {
    if (!purchased.includes(level.id)) return;
    setSelectedLevelId(level.id);
    setScreen("timer");
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

  return (
    <div style={pageStyle} className="w-full min-h-screen">
      <GlobalStyle />
      {screen === "home" && (
        <HomeScreen
          money={money}
          purchased={purchased}
          levelStats={levelStats}
          buyFlash={buyFlash}
          onBuy={buyLevel}
          onPlay={goPlay}
        />
      )}
      {screen === "timer" && (
        <TimerScreen
          level={selectedLevel}
          selectedTime={selectedTime}
          setSelectedTime={setSelectedTime}
          onBack={() => setScreen("home")}
          onStart={startGame}
        />
      )}
      {screen === "playing" && (
        <PlayScreen
          level={selectedLevel}
          timeLeft={timeLeft}
          totalTime={selectedTime}
          runMoney={runMoney}
          correctCount={correctCount}
          wrongCount={wrongCount}
          combo={combo}
          question={question}
          inputVal={inputVal}
          setInputVal={setInputVal}
          feedback={feedback}
          floaters={floaters}
          onSubmit={handleSubmit}
          inputRef={inputRef}
        />
      )}
      {screen === "end" && lastResult && (
        <EndScreen
          level={selectedLevel}
          result={lastResult}
          money={money}
          onPlayAgain={() => setScreen("timer")}
          onRetry={() => { startGame(); }}
          onHome={() => setScreen("home")}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   GLOBAL STYLE (keyframes)
--------------------------------------------------------- */

function GlobalStyle() {
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
      .spin-slow { animation: spinSlow 40s linear infinite; }
      .spin-slow-rev { animation: spinSlowRev 55s linear infinite; }
      .pulse-gold { animation: pulseGold 2.4s ease-in-out infinite; }
      .shake-x { animation: shakeX 0.4s ease; }
      .float-up { animation: floatUp 0.9s ease-out forwards; }
      .pop-in { animation: popIn 0.35s cubic-bezier(.34,1.56,.64,1); }
      .flash-green { animation: flashGreen 0.55s ease; }
      .flash-red { animation: flashRed 0.55s ease; }
      .combo-glow { animation: comboGlow 1s ease-in-out infinite; }
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
    `}</style>
  );
}

/* ---------------------------------------------------------
   SPOTLIGHT BACKGROUND
--------------------------------------------------------- */

function Spotlight() {
  return (
    <div
      style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", pointerEvents: "none", zIndex: 0,
      }}
    >
      <div
        className="spin-slow"
        style={{
          width: 900, height: 900, borderRadius: "50%",
          background: `conic-gradient(from 0deg, rgba(242,193,78,0.10) 0deg, transparent 24deg, transparent 336deg, rgba(242,193,78,0.10) 360deg)`,
          position: "absolute",
        }}
      />
      <div
        className="spin-slow-rev"
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

/* ---------------------------------------------------------
   HOME SCREEN
--------------------------------------------------------- */

function HomeScreen({ money, purchased, levelStats, buyFlash, onBuy, onPlay }) {
  const highestUnlocked = Math.max(...purchased);
  const nextLevel = LEVELS.find((l) => !purchased.includes(l.id));

  return (
    <div style={{ position: "relative", zIndex: 1 }} className="min-h-screen flex flex-col items-center px-4 py-8">
      <Spotlight />
      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl">
        <div className="text-xs tracking-[0.35em] mb-2" style={{ color: COLORS.inkDim }}>
          THE ADDITION HOT SEAT
        </div>
        <h1
          className="gold-text text-center font-bold mb-6"
          style={{ fontSize: "clamp(28px, 6vw, 46px)", letterSpacing: "1px" }}
        >
          MILLIONAIRE ADDITION
        </h1>

        {/* Money panel */}
        <div
          className="w-full flex items-center justify-between rounded-2xl px-6 py-5 mb-8 pulse-gold"
          style={{
            background: `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`,
            border: `1px solid ${COLORS.goldDeep}`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="rounded-full flex items-center justify-center"
              style={{ width: 46, height: 46, background: `radial-gradient(circle, ${COLORS.gold}, ${COLORS.goldDeep})` }}
            >
              <Coins size={24} color={COLORS.deep} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.inkDim }}>Total Bank Balance</div>
              <div className="font-bold" style={{ fontSize: "clamp(22px,5vw,32px)", color: COLORS.gold }}>
                {fmtMoney(money)}
              </div>
            </div>
          </div>
          {nextLevel ? (
            <div className="text-right hidden sm:block">
              <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.inkDim }}>Next Level Cost</div>
              <div className="font-semibold" style={{ color: money >= nextLevel.unlockCost ? COLORS.correct : COLORS.ink }}>
                {fmtMoney(nextLevel.unlockCost)}
              </div>
            </div>
          ) : (
            <div className="text-right hidden sm:block">
              <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.gold }}>All Levels Owned</div>
            </div>
          )}
        </div>

        {/* Main play CTA */}
        <button
          onClick={() => onPlay(LEVELS.find((l) => l.id === highestUnlocked))}
          className="mb-10 flex items-center gap-3 rounded-full px-8 py-4 font-bold text-lg transition-transform active:scale-95"
          style={{
            background: `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold} 55%, ${COLORS.goldDeep})`,
            color: COLORS.deep,
            boxShadow: "0 8px 24px rgba(242,193,78,0.35)",
          }}
        >
          <Play size={22} fill={COLORS.deep} />
          Play Level {highestUnlocked}
        </button>

        {/* Level grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEVELS.map((level) => {
            const owned = purchased.includes(level.id);
            const affordable = money >= level.unlockCost;
            const stats = levelStats[level.id];
            const isBuyFlash = buyFlash === level.id;
            return (
              <div
                key={level.id}
                className={`rounded-xl p-4 flex flex-col justify-between ${isBuyFlash ? "pop-in" : ""}`}
                style={{
                  background: owned
                    ? `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`
                    : `linear-gradient(160deg, ${COLORS.navy}, ${COLORS.deep})`,
                  border: `1px solid ${owned ? COLORS.goldDeep : "#25305c"}`,
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
                      background: affordable ? `linear-gradient(160deg, ${COLORS.goldLine}, ${COLORS.gold})` : "#1a2340",
                      color: affordable ? COLORS.deep : COLORS.inkDim,
                      border: affordable ? "none" : "1px solid #2a3560",
                    }}
                  >
                    <Coins size={16} /> Buy for {fmtMoney(level.unlockCost)}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-xs mt-8 mb-2 text-center" style={{ color: COLORS.inkDim }}>
          Progress saves automatically \u2014 come back any time.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TIMER SELECT SCREEN
--------------------------------------------------------- */

function TimerScreen({ level, selectedTime, setSelectedTime, onBack, onStart }) {
  const options = [30, 60, 120];
  return (
    <div style={{ position: "relative", zIndex: 1 }} className="min-h-screen flex flex-col items-center justify-center px-4">
      <Spotlight />
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
                border: `1px solid ${selectedTime === t ? COLORS.gold : "#25305c"}`,
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

/* ---------------------------------------------------------
   PLAY SCREEN
--------------------------------------------------------- */

function PlayScreen({
  level, timeLeft, totalTime, runMoney, correctCount, wrongCount, combo,
  question, inputVal, setInputVal, feedback, floaters, onSubmit, inputRef,
}) {
  const total = correctCount + wrongCount;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 100;
  const pct = Math.max(0, Math.min(1, timeLeft / totalTime));
  const urgent = timeLeft <= 10;
  const mult = comboMultiplier(combo);

  const ringBg = `conic-gradient(${urgent ? COLORS.wrong : COLORS.gold} ${pct * 360}deg, #1a2340 0deg)`;

  return (
    <div
      style={{ position: "relative", zIndex: 1 }}
      className={`min-h-screen flex flex-col items-center px-4 py-5 ${feedback === "correct" ? "flash-green" : ""} ${feedback === "wrong" ? "flash-red" : ""}`}
    >
      <Spotlight />

      {/* top bar */}
      <div className="relative z-10 w-full max-w-3xl flex items-start justify-between mb-4">
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
          <div
            className={`rounded-3xl flex items-center justify-center px-10 py-14 sm:px-16 sm:py-16 ${feedback === "wrong" ? "shake-x" : ""} ${!feedback ? "pulse-gold" : ""}`}
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
          value={inputVal}
          disabled={!!feedback}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
          placeholder="?"
          className="w-full text-center rounded-xl px-4 py-4 font-bold outline-none"
          style={{
            fontSize: 28, background: COLORS.deep, color: COLORS.ink,
            border: `2px solid ${COLORS.goldDeep}`,
          }}
        />
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

/* ---------------------------------------------------------
   END SCREEN
--------------------------------------------------------- */

function EndScreen({ level, result, money, onPlayAgain, onRetry, onHome }) {
  const { moneyEarned, correctCount, wrongCount, accuracy, avgTime, maxCombo, completed } = result;
  return (
    <div style={{ position: "relative", zIndex: 1 }} className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <Spotlight />
      <div className="relative z-10 w-full max-w-md flex flex-col items-center pop-in">
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
          className="w-full rounded-2xl p-6 mb-6 flex flex-col items-center pulse-gold"
          style={{ background: `linear-gradient(160deg, ${COLORS.navy2}, ${COLORS.navy})`, border: `1px solid ${COLORS.goldDeep}` }}
        >
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.inkDim }}>Money Earned</div>
          <div className="font-bold mb-4" style={{ fontSize: 34, color: COLORS.gold }}>+{fmtMoney(moneyEarned)}</div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.inkDim }}>Total Bank Balance</div>
          <div className="font-semibold" style={{ fontSize: 20, color: COLORS.ink }}>{fmtMoney(money)}</div>
        </div>

        <div className="w-full grid grid-cols-2 gap-3 mb-8">
          <Stat icon={<CheckCircle2 size={16} color={COLORS.correct} />} label="Correct" value={correctCount} />
          <Stat icon={<XCircle size={16} color={COLORS.wrong} />} label="Wrong" value={wrongCount} />
          <Stat icon={<TrendingUp size={16} color={COLORS.gold} />} label="Accuracy" value={`${accuracy}%`} />
          <Stat icon={<Clock size={16} color={COLORS.gold} />} label="Avg Speed" value={`${avgTime.toFixed(1)}s`} />
          <Stat icon={<Flame size={16} color={COLORS.gold} />} label="Highest Combo" value={maxCombo} />
          <Stat icon={<Star size={16} color={COLORS.gold} />} label="Tier" value={TIER_LABEL[level.tier]} />
        </div>

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
              style={{ background: COLORS.navy2, color: COLORS.ink, border: "1px solid #25305c" }}
            >
              <RotateCcw size={16} /> Retry
            </button>
            <button
              onClick={onHome}
              className="flex-1 rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95"
              style={{ background: COLORS.navy2, color: COLORS.ink, border: "1px solid #25305c" }}
            >
              <HomeIcon size={16} /> Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-2"
      style={{ background: COLORS.navy2, border: "1px solid #25305c" }}
    >
      {icon}
      <div>
        <div className="text-xs" style={{ color: COLORS.inkDim }}>{label}</div>
        <div className="font-bold text-sm" style={{ color: COLORS.ink }}>{value}</div>
      </div>
    </div>
  );
}
