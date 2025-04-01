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

function safeSetText(el, newText) {
    if (el && el.innerText !== newText) {
        el.innerText = newText;
    }
}

function safeSetImageSrc(el, newSrc) {
    if (el && el.src !== newSrc) {
        el.src = newSrc;
    }
}

export function updateUI(player, data) {
    const mappedPlayer = player === 3 ? 1 : player === 4 ? 2 : player;
    const isLeft = mappedPlayer === 1;
    const side = isLeft ? "left" : "right";

    // 🎨 Update name
    const nameTextEl = document.getElementById(`brname${mappedPlayer}Text`);
    if (nameTextEl && nameTextEl.innerText !== data.brName) {
        const maxWidth = 288;
        squashTextToFit(nameTextEl, maxWidth, data.brName, side);
    }

    // 🧾 Update record, deck, flag, score, LP
    safeSetText(document.querySelector(`.record-${mappedPlayer}`), data.record);
    safeSetText(document.querySelector(`.deck-${mappedPlayer}`), data.deck);
    safeSetImageSrc(document.querySelector(`.flag-${mappedPlayer}-icon`), data.flagImgUrl);
    safeSetText(document.querySelector(`.score-${mappedPlayer}`), data.score);

    const lpEl = document.querySelector(`.lp-${mappedPlayer}`);
    if (lpEl && typeof data.lifePoints === "number") {
        animateLP(lpEl, data.lifePoints);
    }

    // 🎬 Handle phase animation
    const incomingPhase = (data.phase || "").trim().toLowerCase();
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
    safeSetImageSrc(cardFrontImg, data.cardHighlight);

    // ⏱ Timer (Player 1 only)
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