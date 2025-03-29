import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Supabase credentials
const SUPABASE_URL = "https://vzbwhvamfqkodiogwdww.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6YndodmFtZnFrb2Rpb2d3ZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI0NjM2NjgsImV4cCI6MjAzODAzOTY2OH0.ExqIbsojI2KKuA8kuu7hbIfBrSgDLLxJK1LrF_AlIfE"; // Replace with your actual Supabase anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const lastKnownPhases = {
  left: null,
  right: null
};
const cardStates = {
  left: { flipped: false },
  right: { flipped: false }
};
const lpChangeSoundTemplate = new Audio("src/sfx/lifepoints.mp3"); // your actual file
lpChangeSoundTemplate.preload = "auto";

//global timer state
let timerState = {
  currentTime: 0,
  isRunning: false,
  intervalId: null,
  hasInitialized: false,
  lastTimerValue: null,
  lastTimerAdjust: null,
  startTimestamp: null,
};

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map((p) => parseInt(p, 10));
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function updateTimerDisplay() {
  const timerEl = document.querySelector(".timer");
  if (timerEl) {
    timerEl.textContent = formatTime(timerState.currentTime);
  }
}

function startTimer() {
  if (timerState.intervalId) return;

  timerState.startTimestamp = Date.now() + timerState.currentTime * 1000;

  timerState.intervalId = setInterval(() => {
    const remaining = Math.max(0, Math.floor((timerState.startTimestamp - Date.now()) / 1000));
    timerState.currentTime = remaining;
    updateTimerDisplay();

    if (remaining <= 0) {
      stopTimer();
    }
  }, 250);
}

function stopTimer() {
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }

  // Preserve remaining time on pause
  timerState.currentTime = Math.max(0, Math.floor((timerState.startTimestamp - Date.now()) / 1000));
  updateTimerDisplay();
}

function animateLP(element, newValue) {
  let startValue = parseInt(element.textContent, 10);
  if (isNaN(startValue)) startValue = 0;

  // 🛑 Skip if there's no change
  if (startValue === newValue) return;

  // 🔊 Play preloaded sound
  const sound = lpChangeSoundTemplate.cloneNode();
  sound.play().catch(() => {});

  let change = newValue - startValue;
  let duration = 1500;
  let startTime = performance.now();

  function step(currentTime) {
    let elapsedTime = currentTime - startTime;
    let progress = Math.min(elapsedTime / duration, 1);
    let easing = progress * (2 - progress);
    let currentLP = Math.round(startValue + change * easing);
    element.textContent = currentLP;
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
// Track last known phase to avoid redundant animations
const currentPhases = {
  left: null,
  right: null,
};

let isAnimating = false;
const transitionQueue = [];

function queuePhase(player, phaseText) {
  transitionQueue.push({ player, phase: phaseText });
  processNextPhase();
}

function processNextPhase() {
  if (isAnimating || transitionQueue.length === 0) return;
  isAnimating = true;

  const { player, phase } = transitionQueue.shift();
  const otherPlayer = player === "left" ? "right" : "left";

  const clip = document.getElementById(`${player}-clip`);
  const oldText = document.getElementById(`${player}Text`);
  const otherText = document.getElementById(`${otherPlayer}Text`);

  if (otherText) {
    otherText.classList.remove("slide-in");
    otherText.classList.add("slide-out-up");
    setTimeout(() => otherText.remove(), 500);
  }

  if (oldText) {
    oldText.classList.remove("slide-in");
    oldText.classList.add("slide-out-up");
    setTimeout(() => oldText.remove(), 500);
  }

  if (!phase) {
    document.getElementById("leftArrow").classList.remove("active");
    document.getElementById("rightArrow").classList.remove("active");
    isAnimating = false;
    processNextPhase();
    return;
  }

  const newText = document.createElement("div");
  newText.className = "text start-below-up";
  newText.textContent = phase;
  newText.id = `${player}Text`;
  clip.appendChild(newText);

  void newText.offsetWidth;
  newText.classList.remove("start-below-up");
  newText.classList.add("slide-in");

  document.getElementById("leftArrow").classList.toggle("active", player === "left");
  document.getElementById("rightArrow").classList.toggle("active", player === "right");

  setTimeout(() => {
    isAnimating = false;
    processNextPhase();
  }, 500);
}

function updateUI(player, data) {
  const nameTextEl = document.getElementById(`brname${player}Text`);
  if (nameTextEl) {
    const isLeft = player === 1;
    const maxWidth = isLeft ? 288 : 288;
    const side = isLeft ? "left" : "right";
    squashTextToFit(nameTextEl, maxWidth, data.brName, side);
  }

  document.querySelector(`.record-${player}`).innerText = data.record;
  document.querySelector(`.deck-${player}`).innerText = data.deck;
  document.querySelector(`.flag-${player}-icon`).src = data.flagImgUrl;
  animateLP(document.querySelector(`.lp-${player}`), data.lifePoints);
  document.querySelector(`.score-${player}`).innerText = data.score;

  const side = player === 1 ? "left" : "right";
  const incomingPhase = (data.phase || "").trim();

  if (incomingPhase !== lastKnownPhases[side]) {
    lastKnownPhases[side] = incomingPhase;

    if (incomingPhase) {
      queuePhase(side, incomingPhase);
    } else {
      const el = document.getElementById(`${side}Text`);
      if (el) {
        el.classList.remove("slide-in");
        el.classList.add("slide-out-up");
        setTimeout(() => el.remove(), 500);
      }
      document.getElementById(`${side}Arrow`).classList.remove("active");
    }
  }

  // === 🔄 Card Flip Handling ===
  if (typeof data.cardFlipped === "boolean") {
    setCardFlippedForSide(side, data.cardFlipped);
  }

  // === 🎴 Update Card Front Image ===
  const cardId = side === "left" ? "card-1" : "card-2";
  const cardFrontImg = document.querySelector(`#${cardId} .card-front img`);
  if (cardFrontImg && data.cardHighlight) {
    cardFrontImg.src = data.cardHighlight;
  }

  // === ⏱ Global Timer Handling (only run once, from player 1) ===
  if (player === 1 && typeof data.timerValue === "string") {
    const baseTimeStr = data.timerValue;
    const adjustStr = data.timerAdjust;

    const baseSeconds = parseTimeToSeconds(baseTimeStr);
    const adjustSeconds = adjustStr ? parseTimeToSeconds(adjustStr) : null;

    if (!timerState.hasInitialized || timerState.lastTimerValue !== baseTimeStr) {
      timerState.currentTime = baseSeconds;
      timerState.hasInitialized = true;
      timerState.lastTimerValue = baseTimeStr;
    }

    if (adjustStr && adjustStr !== timerState.lastTimerAdjust) {
      timerState.currentTime = adjustSeconds;
      timerState.lastTimerAdjust = adjustStr;
    }

    updateTimerDisplay();

    if (data.timerPlay && !timerState.isRunning) {
      timerState.isRunning = true;
      startTimer();
    } else if (!data.timerPlay && timerState.isRunning) {
      timerState.isRunning = false;
      stopTimer();
    }
  }
}

function squashTextToFit(textEl, maxWidth, newText, side = "left") {
  textEl.textContent = newText;

  // Set x position and anchor based on alignment
  if (side === "left") {
    textEl.setAttribute("x", "0");
    textEl.setAttribute("text-anchor", "start");
    textEl.setAttribute("transform-origin", "left center");
  } else {
    textEl.setAttribute("x", maxWidth);
    textEl.setAttribute("text-anchor", "end");
    textEl.setAttribute("transform-origin", "right center");
  }

  // Wait for DOM update before measuring
  requestAnimationFrame(() => {
    const bbox = textEl.getBBox();
    const scaleX = Math.min(1, maxWidth / bbox.width);
    textEl.setAttribute("transform", `scale(${scaleX}, 1)`);
  });
}

// Fetch initial data
async function fetchPlayers() {
  const { data, error } = await supabase.from("featureScoreboard").select("*");
  if (error) {
    console.error("Error fetching data:", error);
  } else {
    data.forEach(player => updateUI(player.id, player));
  }
}

// Listen for real-time updates
supabase
  .channel("featureScoreboard")
  .on("postgres_changes", { event: "*", schema: "public", table: "featureScoreboard" }, (payload) => {
    updateUI(payload.new.id, payload.new);
  })
  .subscribe();

fetchPlayers();

//CardFlip animation
function setCardFlippedForSide(side, flipped) {
  const cardId = side === "left" ? "card-1" : "card-2";
  const card = document.getElementById(cardId);
  if (!card) return;

  const current = cardStates[side].flipped;

  if (flipped && !current) {
    card.classList.remove("hide", "flip-out-front", "flip-to-front");
    card.classList.add("show");

    requestAnimationFrame(() => {
      card.classList.add("flip-to-back");
    });

    setTimeout(() => {
      card.classList.remove("flip-to-back");
      card.classList.add("flip-to-front");
    }, 1000);

  } else if (!flipped && current) {
    card.classList.remove("flip-to-front");
    card.classList.add("flip-out-front");

    card.addEventListener("transitionend", function handler(e) {
      if (e.propertyName === "transform") {
        card.classList.remove("flip-out-front", "show");
        card.classList.add("hide");
        card.removeEventListener("transitionend", handler);
      }
    });
  }

  cardStates[side].flipped = flipped;
}
