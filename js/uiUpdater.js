import {
    animateLP,
    queuePhase,
    setCardFlippedForSide,
    squashTextToFit
} from './animations.js';

import {
    timerState,
    parseTimeToSeconds,
    updateTimerDisplay,
    startTimer,
    stopTimer
} from './timer.js';

// 🧠 Keep phase state persistent across updates
const lastKnownPhases = {
    left: null,
    right: null,
};

export function updateUI(player, data) {
    // ✅ Remap Supabase IDs 3 → 1, and 4 → 2
    const mappedPlayer = player === 3 ? 1 : player === 4 ? 2 : player;
    const isLeft = mappedPlayer === 1;
    const side = isLeft ? "left" : "right";

    // 🎨 Update name
    const nameTextEl = document.getElementById(`brname${mappedPlayer}Text`);
    if (nameTextEl) {
        const maxWidth = 288;
        squashTextToFit(nameTextEl, maxWidth, data.brName, side);
    }

    // 🧾 Update record, deck, flag, score, LP
    const recordEl = document.querySelector(`.record-${mappedPlayer}`);
    if (recordEl) recordEl.innerText = data.record;

    const deckEl = document.querySelector(`.deck-${mappedPlayer}`);
    if (deckEl) deckEl.innerText = data.deck;

    const flagImgEl = document.querySelector(`.flag-${mappedPlayer}-icon`);
    if (flagImgEl) flagImgEl.src = data.flagImgUrl;

    const lpEl = document.querySelector(`.lp-${mappedPlayer}`);
    if (lpEl) animateLP(lpEl, data.lifePoints);

    const scoreEl = document.querySelector(`.score-${mappedPlayer}`);
    if (scoreEl) scoreEl.innerText = data.score;

    // 🎬 Handle phase animation
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
            document.getElementById(`${side}Arrow`)?.classList.remove("active");
        }
    }

    // 🃏 Card flip
    if (typeof data.cardFlipped === "boolean") {
        setCardFlippedForSide(side, data.cardFlipped);
    }

    // 🖼️ Highlight image
    const cardId = isLeft ? "card-1" : "card-2";
    const cardFrontImg = document.querySelector(`#${cardId} .card-front img`);
    if (cardFrontImg && data.cardHighlight) {
        cardFrontImg.src = data.cardHighlight;
    }

    // ⏱ Timer (handled by Player 1 only)
    if (mappedPlayer === 1 && typeof data.timerValue === "string") {
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

import { lpChangeSoundTemplate } from './animations.js';

const popup = document.getElementById("audio-popup");
const button = document.getElementById("enable-audio-btn");

button.addEventListener("click", async () => {
    try {
        await lpChangeSoundTemplate.play();
        lpChangeSoundTemplate.pause();
        lpChangeSoundTemplate.currentTime = 0;
        console.log("🔓 Audio enabled");
        popup.style.display = "none";
    } catch (e) {
        alert("Audio could not be unlocked. Please try again.");
        console.error("Audio unlock failed:", e);
    }
});