// uiUpdater.js
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

import { cardsHidden } from './config.js'; // ⬅️ read URL switch (?cards=hidden|off|false|0)

// If cards are hidden, treat both sides as already "ready" so no flip waits
const imageReady = {
    left:  !!cardsHidden,
    right: !!cardsHidden,
};

const lastKnownPhases = {
    left: null,
    right: null,
};

function safeSetText(el, newText) {
    if (el && el.innerText !== newText) {
        el.innerText = newText ?? '';
    }
}

function safeSetImageSrc(el, newSrc) {
    if (el && el.src !== newSrc) {
        el.src = newSrc || '';
    }
}

// Helper: ensure we only try to load real image URLs
function hasImageUrl(u) {
    return typeof u === "string" && u.trim() && u !== "null" && u !== "undefined";
}

export function updateUI(player, data) {
    const mappedPlayer = ((player - 1) % 2) + 1;
    const isLeft = mappedPlayer === 1;
    const side = isLeft ? "left" : "right";

    // 🃏 Card flip flag (only applies if cards are not hidden)
    if (!cardsHidden && typeof data.cardFlipped === "boolean") {
        setCardFlippedForSide(side, data.cardFlipped);
    }

    // 🎨 Update name (auto-squash)
    const nameTextEl = document.getElementById(`brname${mappedPlayer}Text`);
    if (nameTextEl && nameTextEl.innerText !== data.brName) {
        const maxWidth = 288;
        squashTextToFit(nameTextEl, maxWidth, data.brName ?? '', side);
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

    // 🎬 Phase animation (de-duped)
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

    // 🃏 Card image + flip (ENTIRELY BYPASSED IF cardsHidden)
    if (!cardsHidden) {
        const cardId = isLeft ? "card-1" : "card-2";
        const cardFrontImg = document.querySelector(`#${cardId} .card-front img`);

        if (cardFrontImg && hasImageUrl(data.cardHighlight) && cardFrontImg.src !== data.cardHighlight) {
            imageReady[side] = false; // loading

            const preload = new Image();
            preload.onload = () => {
                cardFrontImg.src = data.cardHighlight;
                imageReady[side] = true;

                if (typeof data.cardFlipped === "boolean" && data.cardFlipped) {
                    setCardFlippedForSide(side, true); // safe to animate
                }
            };
            preload.onerror = () => {
                console.warn(`[Card] Failed to load highlight image for ${side}: ${data.cardHighlight}`);
                imageReady[side] = true; // don't block flips forever
            };
            preload.src = data.cardHighlight;

        } else if (typeof data.cardFlipped === "boolean") {
            if (imageReady[side]) {
                setCardFlippedForSide(side, data.cardFlipped);
            } else {
                console.log(`[CardFlip] Blocked: image not ready for ${side}`);
            }
        }
    }
    // else: no card work at all when hidden

    // ⏱ Timer (Player 1 drives the display)
    if (mappedPlayer === 1 && typeof data.timerValue === "string") {
        const baseTimeStr = data.timerValue;
        const adjustStr = data.timerAdjust;

        const baseSeconds = parseTimeToSeconds(baseTimeStr);
        const adjustSeconds = adjustStr ? parseTimeToSeconds(adjustStr) : null;

        // (Re)initialize from base
        if (!timerState.hasInitialized || timerState.lastTimerValue !== baseTimeStr) {
            timerState.currentTime = baseSeconds;
            timerState.hasInitialized = true;
            timerState.lastTimerValue = baseTimeStr;
        }

        // Apply adjust override if present and changed
        if (adjustStr && adjustStr !== timerState.lastTimerAdjust) {
            timerState.currentTime = adjustSeconds;
            timerState.lastTimerAdjust = adjustStr;
        }

        updateTimerDisplay();

        // Play/pause
        if (data.timerPlay && !timerState.isRunning) {
            timerState.isRunning = true;
            startTimer();
        } else if (!data.timerPlay && timerState.isRunning) {
            timerState.isRunning = false;
            stopTimer();
        }
    }
}

// 🔊 One-time audio unlock (unchanged)
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
