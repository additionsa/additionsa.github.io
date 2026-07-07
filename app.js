/* ---------------------------------------------------------
   MILLIONAIRE ADDITION — vanilla JS port
   Original design/logic adapted for installable PWA.
   Footer credit: ReBan Technologies
--------------------------------------------------------- */
(function () {
  "use strict";

  const COLORS = {
    correct: "#33d17a",
    wrong: "#e0435c",
    gold: "#f2c14e",
  };

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /* ---------------- level generators ---------------- */
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
    { id: 10, name: "Millionaire Mind", tag: "master mode — anything goes", tier: "master", unlockCost: 1000000,
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
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  const STORAGE_KEY = "millionaire_addition_state_v1";

  /* ---------------- persisted state ---------------- */
  let money = 0;
  let purchased = [1];
  let levelStats = {};

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        money = parsed.money || 0;
        purchased = (parsed.purchased && parsed.purchased.length) ? parsed.purchased : [1];
        levelStats = parsed.levelStats || {};
      }
    } catch (e) { /* defaults are fine */ }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ money, purchased, levelStats }));
    } catch (e) { /* storage may be unavailable */ }
  }

  /* ---------------- run state ---------------- */
  let selectedLevelId = 1;
  let selectedTime = 60;
  let timeLeft = 60;
  let totalTime = 60;
  let runMoney = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let combo = 0;
  let maxCombo = 0;
  let responseTimes = [];
  let question = { a: 0, b: 0 };
  let inputVal = "";
  let feedback = null; // 'correct' | 'wrong' | null
  let questionStart = Date.now();
  let timerHandle = null;
  let lastResult = null;
  let floaterId = 0;

  function selectedLevel() {
    return LEVELS.find((l) => l.id === selectedLevelId) || LEVELS[0];
  }

  /* ---------------- DOM refs ---------------- */
  const el = (id) => document.getElementById(id);
  const screens = {
    home: el("screen-home"),
    timer: el("screen-timer"),
    playing: el("screen-playing"),
    end: el("screen-end"),
  };
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  /* ---------------- HOME ---------------- */
  function renderHome() {
    el("home-money").textContent = fmtMoney(money);
    const highestUnlocked = Math.max(...purchased);
    const nextLevel = LEVELS.find((l) => !purchased.includes(l.id));
    el("home-play-label").textContent = "Play Level " + highestUnlocked;

    const nextCostEl = el("home-next-cost");
    if (nextLevel) {
      nextCostEl.innerHTML =
        '<div class="label-xs">Next Level Cost</div>' +
        '<div style="font-weight:600; color:' + (money >= nextLevel.unlockCost ? COLORS.correct : "var(--ink)") + '">' +
        fmtMoney(nextLevel.unlockCost) + "</div>";
    } else {
      nextCostEl.innerHTML = '<div class="label-xs" style="color:var(--gold);">All Levels Owned</div>';
    }

    const grid = el("level-grid");
    grid.innerHTML = "";
    LEVELS.forEach((level) => {
      const owned = purchased.includes(level.id);
      const affordable = money >= level.unlockCost;
      const stats = levelStats[level.id];

      const card = document.createElement("div");
      card.className = "level-card " + (owned ? "owned" : "locked");
      card.style.opacity = owned || affordable ? 1 : 0.7;

      let statsHtml = "";
      if (stats) {
        statsHtml = '<div class="level-stats">' +
          '<span>🏆 ' + fmtMoney(stats.bestMoney) + '</span>' +
          '<span>🔥 x' + stats.bestCombo + '</span></div>';
      }

      card.innerHTML =
        '<div class="level-top">' +
          '<div>' +
            '<div class="level-tag">LEVEL ' + level.id + ' · ' + TIER_LABEL[level.tier] + '</div>' +
            '<div class="level-name">' + level.name + '</div>' +
            '<div class="level-desc">' + level.tag + '</div>' +
          '</div>' +
          (owned ? "" : '<div style="opacity:.7;">🔒</div>') +
        '</div>' +
        statsHtml +
        (owned
          ? '<button class="btn btn-gold" style="width:100%;" data-play="' + level.id + '">▶ Play</button>'
          : '<button class="btn" style="width:100%; ' +
              (affordable
                ? 'background:linear-gradient(160deg,var(--gold-line),var(--gold)); color:var(--deep);'
                : 'background:#1a2340; color:var(--ink-dim); border:1px solid #2a3560;') +
              '" ' + (affordable ? "" : "disabled") + ' data-buy="' + level.id + '">🪙 Buy for ' + fmtMoney(level.unlockCost) + '</button>');

      grid.appendChild(card);
    });

    grid.querySelectorAll("[data-play]").forEach((btn) => {
      btn.addEventListener("click", () => goPlay(parseInt(btn.dataset.play, 10)));
    });
    grid.querySelectorAll("[data-buy]").forEach((btn) => {
      btn.addEventListener("click", () => buyLevel(parseInt(btn.dataset.buy, 10)));
    });
  }

  function buyLevel(levelId) {
    const level = LEVELS.find((l) => l.id === levelId);
    if (!level || purchased.includes(level.id) || money < level.unlockCost) return;
    money -= level.unlockCost;
    purchased.push(level.id);
    saveState();
    renderHome();
  }

  function goPlay(levelId) {
    if (!purchased.includes(levelId)) return;
    selectedLevelId = levelId;
    renderTimerScreen();
    showScreen("timer");
  }

  el("home-play-btn").addEventListener("click", () => {
    goPlay(Math.max(...purchased));
  });

  /* ---------------- TIMER SELECT ---------------- */
  function renderTimerScreen() {
    const level = selectedLevel();
    el("timer-level-id").textContent = "LEVEL " + level.id;
    el("timer-level-name").textContent = level.name;
    el("timer-level-tag").textContent = level.tag;

    const opts = el("time-options");
    opts.innerHTML = "";
    [30, 60, 120].forEach((t) => {
      const b = document.createElement("button");
      b.className = "time-opt" + (selectedTime === t ? " sel" : "");
      b.textContent = t + "s";
      b.addEventListener("click", () => { selectedTime = t; renderTimerScreen(); });
      opts.appendChild(b);
    });
  }
  el("timer-back-btn").addEventListener("click", () => { showScreen("home"); renderHome(); });
  el("start-game-btn").addEventListener("click", startGame);

  /* ---------------- PLAY ---------------- */
  function nextQuestion() {
    const lvl = selectedLevel();
    question = lvl.gen();
    questionStart = Date.now();
    inputVal = "";
    feedback = null;
    renderQuestion();
  }

  function buildKeypad() {
    const kp = el("keypad");
    kp.innerHTML = "";
    const layout = ["1","2","3","4","5","6","7","8","9","⌫","0","OK"];
    layout.forEach((k) => {
      const b = document.createElement("button");
      b.className = "key" + (k === "⌫" ? " back" : "");
      b.textContent = k;
      b.addEventListener("click", () => {
        if (feedback) return;
        if (k === "⌫") {
          inputVal = inputVal.slice(0, -1);
          renderAnswerDisplay();
        } else if (k === "OK") {
          submitAnswer();
        } else {
          handleDigit(k);
        }
      });
      kp.appendChild(b);
    });
  }
  buildKeypad();

  function handleDigit(d) {
    if (feedback) return;
    inputVal += d;
    renderAnswerDisplay();
    const correctAnswer = question.a + question.b;
    if (inputVal.length >= String(correctAnswer).length) {
      setTimeout(submitAnswer, 120);
    }
  }

  function renderAnswerDisplay() {
    el("answer-display").textContent = inputVal === "" ? "?" : inputVal;
  }

  function renderQuestion() {
    el("qtext").textContent = question.a + " + " + question.b;
    renderAnswerDisplay();
    const qcard = el("qcard");
    qcard.style.borderColor = "var(--gold-deep)";
    qcard.classList.remove("shake-x");
  }

  function addFloater(text, kind) {
    const id = ++floaterId;
    const wrap = el("qcard-wrap") || document.querySelector(".qcard-wrap");
    const f = document.createElement("div");
    f.className = "float-up floater";
    f.style.color = kind === "correct" ? COLORS.correct : COLORS.wrong;
    f.style.marginLeft = randInt(-20, 20) + "px";
    f.textContent = text;
    document.querySelector(".qcard-wrap").appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  function submitAnswer() {
    if (inputVal === "" || feedback) return;
    const correctAnswer = question.a + question.b;
    const given = parseInt(inputVal, 10);
    const responseTime = (Date.now() - questionStart) / 1000;
    const level = selectedLevel();
    const qcard = el("qcard");

    if (given === correctAnswer) {
      const newCombo = combo + 1;
      const mult = comboMultiplier(newCombo);
      const earned = TIER_REWARD[level.tier] * mult;
      runMoney += earned;
      correctCount += 1;
      combo = newCombo;
      maxCombo = Math.max(maxCombo, newCombo);
      responseTimes.push(responseTime);
      addFloater("+" + fmtMoney(earned) + (mult > 1 ? " x" + mult : ""), "correct");
      feedback = "correct";
      qcard.style.borderColor = COLORS.correct;
      flashScreen("flash-green");
    } else {
      wrongCount += 1;
      combo = 0;
      timeLeft = Math.round((timeLeft + 3) * 10) / 10;
      runMoney = Math.max(0, runMoney - runMoney * 0.05);
      addFloater("+3s  −5%", "wrong");
      feedback = "wrong";
      qcard.style.borderColor = COLORS.wrong;
      qcard.classList.add("shake-x");
      flashScreen("flash-red");
    }

    updatePlayHud();

    setTimeout(() => {
      feedback = null;
      nextQuestion();
    }, 550);
  }

  function flashScreen(cls) {
    const s = screens.playing;
    s.classList.remove("flash-green", "flash-red");
    void s.offsetWidth;
    s.classList.add(cls);
    setTimeout(() => s.classList.remove(cls), 600);
  }

  function updatePlayHud() {
    const level = selectedLevel();
    el("play-level-id").textContent = "Level " + level.id;
    el("play-level-name").textContent = level.name;
    el("run-money").textContent = fmtMoney(runMoney);

    const total = correctCount + wrongCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 100;
    el("accuracy").textContent = accuracy;

    const comboTag = el("combo-tag");
    if (combo >= 3) {
      const mult = comboMultiplier(combo);
      comboTag.style.display = "flex";
      comboTag.className = "combo-tag" + (mult > 1 ? " combo-glow" : "");
      comboTag.textContent = "🔥 " + combo + " combo" + (mult > 1 ? " x" + mult : "");
    } else {
      comboTag.style.display = "none";
    }

    const urgent = timeLeft <= 10;
    el("time-left").textContent = timeLeft.toFixed(1);
    el("time-left").style.color = urgent ? COLORS.wrong : "var(--ink)";
    const pct = Math.max(0, Math.min(1, timeLeft / totalTime));
    el("timer-ring").style.background =
      "conic-gradient(" + (urgent ? COLORS.wrong : COLORS.gold) + " " + (pct * 360) + "deg, #1a2340 0deg)";
  }

  function startGame() {
    runMoney = 0; correctCount = 0; wrongCount = 0; combo = 0; maxCombo = 0;
    responseTimes = []; timeLeft = selectedTime; totalTime = selectedTime;
    nextQuestion();
    updatePlayHud();
    showScreen("playing");
    clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      const nt = Math.round((timeLeft - 0.1) * 10) / 10;
      if (nt <= 0) {
        timeLeft = 0;
        clearInterval(timerHandle);
        updatePlayHud();
        setTimeout(endGame, 0);
        return;
      }
      timeLeft = nt;
      updatePlayHud();
    }, 100);
  }

  function endGame() {
    clearInterval(timerHandle);
    const finalRunMoney = Math.round(runMoney);
    const accuracy = correctCount + wrongCount > 0
      ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0;
    const avgTime = responseTimes.length
      ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length : 0;
    const completed = correctCount >= 5 && accuracy >= 60;

    money += finalRunMoney;

    const cur = levelStats[selectedLevelId] || { bestMoney: 0, bestAvgTime: null, plays: 0, bestCombo: 0 };
    levelStats[selectedLevelId] = {
      bestMoney: Math.max(cur.bestMoney, finalRunMoney),
      bestAvgTime: cur.bestAvgTime === null ? avgTime : Math.min(cur.bestAvgTime, avgTime || Infinity),
      plays: cur.plays + 1,
      bestCombo: Math.max(cur.bestCombo, maxCombo),
    };
    saveState();

    lastResult = { moneyEarned: finalRunMoney, correctCount, wrongCount, accuracy, avgTime, maxCombo, completed };
    renderEnd();
    showScreen("end");
  }

  /* ---------------- END ---------------- */
  function renderEnd() {
    const level = selectedLevel();
    const r = lastResult;
    const badge = el("end-badge");
    badge.textContent = r.completed ? "LEVEL COMPLETED" : "LEVEL FAILED";
    badge.style.background = r.completed ? "rgba(51,209,122,0.15)" : "rgba(224,67,92,0.15)";
    badge.style.color = r.completed ? COLORS.correct : COLORS.wrong;
    badge.style.border = "1px solid " + (r.completed ? COLORS.correct : COLORS.wrong);

    el("end-level-info").textContent = "Level " + level.id + " · " + level.name;
    el("end-earned").textContent = "+" + fmtMoney(r.moneyEarned);
    el("end-bank").textContent = fmtMoney(money);

    const stats = [
      ["✔", COLORS.correct, "Correct", r.correctCount],
      ["✖", COLORS.wrong, "Wrong", r.wrongCount],
      ["📈", COLORS.gold, "Accuracy", r.accuracy + "%"],
      ["⏱", COLORS.gold, "Avg Speed", r.avgTime.toFixed(1) + "s"],
      ["🔥", COLORS.gold, "Highest Combo", r.maxCombo],
      ["⭐", COLORS.gold, "Tier", TIER_LABEL[level.tier]],
    ];
    const grid = el("end-stats");
    grid.innerHTML = "";
    stats.forEach(([icon, color, label, value]) => {
      const box = document.createElement("div");
      box.className = "stat-box";
      box.innerHTML = '<span style="color:' + color + ';">' + icon + '</span>' +
        '<div><div class="l">' + label + '</div><div class="v">' + value + '</div></div>';
      grid.appendChild(box);
    });
  }

  el("end-play-again").addEventListener("click", () => { renderTimerScreen(); showScreen("timer"); });
  el("end-retry").addEventListener("click", () => { startGame(); });
  el("end-home").addEventListener("click", () => { renderHome(); showScreen("home"); });

  /* ---------------- boot ---------------- */
  loadState();
  renderHome();
  showScreen("home");
})();
