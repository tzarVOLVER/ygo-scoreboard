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

import { supabase } from './supabaseClient.js';
import { tableName } from './config.js';

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

    //Update name
    const nameTextEl = document.getElementById(`brname${mappedPlayer}Text`);
    if (nameTextEl && nameTextEl.innerText !== data.brName) {
        const maxWidth = 288;
        squashTextToFit(nameTextEl, maxWidth, data.brName, side);
    }

    //Update record, deck, flag, score, LP
    safeSetText(document.querySelector(`.record-${mappedPlayer}`), data.record);
    safeSetText(document.querySelector(`.deck-${mappedPlayer}`), data.deck);
    safeSetImageSrc(document.querySelector(`.flag-${mappedPlayer}-icon`), data.flagImgUrl);
    safeSetText(document.querySelector(`.score-${mappedPlayer}`), data.score);

    const lpEl = document.querySelector(`.lp-${mappedPlayer}`);
    if (lpEl && typeof data.lifePoints === "number") {
        animateLP(lpEl, data.lifePoints);
    }

    // Handle phase animation
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

    // Card image and flip (wait until image is loaded before flipping)
    const cardId = isLeft ? "card-1" : "card-2";
    const cardFrontImg = document.querySelector(`#${cardId} .card-front img`);
    if (cardFrontImg && cardFrontImg.src !== data.cardHighlight) {
        const preload = new Image();
        preload.onload = async () => {
            cardFrontImg.src = data.cardHighlight;

            await supabase
                .from(tableName)
                .update({ [`${side}_image_loaded`]: true })
                .eq("id", player);

            if (typeof data.cardFlipped === "boolean" && data.cardFlipped) {
                setCardFlippedForSide(side, true);
            }
        };
        preload.onerror = () => {
            console.error(`[Card] Failed to load highlight image for ${side}: ${data.cardHighlight}`);
        };
        preload.src = data.cardHighlight;
    } else if (typeof data.cardFlipped === "boolean") {
        // If image hasn't changed, just apply the flip state
        setCardFlippedForSide(side, data.cardFlipped);
    }

    // Timer (Player 1 only)
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
