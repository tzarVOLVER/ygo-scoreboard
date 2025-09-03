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

const imageReady = {
    left: false,
    right: false,
};

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
    const mappedPlayer = ((player - 1) % 2) + 1;
    const isLeft = mappedPlayer === 1;
    const side = isLeft ? "left" : "right";

    // 🃏 Card flip
    if (typeof data.cardFlipped === "boolean") {
        setCardFlippedForSide(side, data.cardFlipped);
    }

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

    // 🃏 Card image and flip (wait until image is loaded before flipping)
    const cardId = isLeft ? "card-1" : "card-2";
    const cardFrontImg = document.querySelector(`#${cardId} .card-front img`);
    if (cardFrontImg && cardFrontImg.src !== data.cardHighlight) {
        imageReady[side] = false; // Mark not ready

        const preload = new Image();
        preload.onload = () => {
            cardFrontImg.src = data.cardHighlight;
            imageReady[side] = true; // Mark ready

            if (typeof data.cardFlipped === "boolean" && data.cardFlipped) {
                setCardFlippedForSide(side, true); // Now safe to animate
            }
        };
        preload.onerror = () => {
            console.error(`[Card] Failed to load highlight image for ${side}: ${data.cardHighlight}`);
        };
        preload.src = data.cardHighlight;
    } else if (typeof data.cardFlipped === "boolean") {
        if (imageReady[side]) {
            setCardFlippedForSide(side, data.cardFlipped);
        } else {
            console.log(`[CardFlip] Blocked: image not ready for ${side}`);
        }
    }


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