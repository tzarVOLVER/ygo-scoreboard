// uiUpdater.js
import {
    animateLP,
    queuePhase,
    setCardFlippedForSide,
    squashTextToFit
} from './animations.js';

import { cardsHidden } from './config.js';

// If cards are hidden, treat both sides as already "ready" so no flip waits
const imageReady = {
    left: !!cardsHidden,
    right: !!cardsHidden,
};

const lastKnownPhases = {
    left: null,
    right: null,
};

const lastKnownLifePoints = {
    1: null,
    2: null,
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

    // Card flip flag only applies if cards are not hidden
    if (!cardsHidden && typeof data.cardFlipped === "boolean") {
        setCardFlippedForSide(side, data.cardFlipped);
    }

    // Update name and auto-squash
    const nameTextEl = document.getElementById(`brname${mappedPlayer}Text`);
    if (nameTextEl && nameTextEl.innerText !== data.brName) {
        const maxWidth = 288;
        squashTextToFit(nameTextEl, maxWidth, data.brName ?? '', side);
    }

    safeSetText(document.querySelector(`.record-${mappedPlayer}`), data.record);
    safeSetText(document.querySelector(`.deck-${mappedPlayer}`), data.deck);
    safeSetImageSrc(document.querySelector(`.flag-${mappedPlayer}-icon`), data.flagImgUrl);
    safeSetText(document.querySelector(`.score-${mappedPlayer}`), data.score);

    const lpEl = document.querySelector(`.lp-${mappedPlayer}`);
    if (
        lpEl &&
        typeof data.lifePoints === "number" &&
        lastKnownLifePoints[mappedPlayer] !== data.lifePoints
    ) {
        lastKnownLifePoints[mappedPlayer] = data.lifePoints;
        animateLP(lpEl, data.lifePoints);
    }

    // Phase animation, de-duped
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

    // Card image + flip, entirely bypassed if cards are hidden
    if (!cardsHidden) {
        const cardId = isLeft ? "card-1" : "card-2";
        const cardFrontImg = document.querySelector(`#${cardId} .card-front img`);

        if (cardFrontImg && hasImageUrl(data.cardHighlight) && cardFrontImg.src !== data.cardHighlight) {
            imageReady[side] = false;

            const preload = new Image();
            preload.onload = () => {
                cardFrontImg.src = data.cardHighlight;
                imageReady[side] = true;

                if (typeof data.cardFlipped === "boolean" && data.cardFlipped) {
                    setCardFlippedForSide(side, true);
                }
            };
            preload.onerror = () => {
                console.warn(`[Card] Failed to load highlight image for ${side}: ${data.cardHighlight}`);
                imageReady[side] = true;
            };
            preload.src = data.cardHighlight;

        } else if (typeof data.cardFlipped === "boolean") {
            if (imageReady[side]) {
                setCardFlippedForSide(side, data.cardFlipped);
            }
        }
    }

    // Timer is rendered directly from the API value.
    if (mappedPlayer === 1 && typeof data.timerValue === "string") {
        safeSetText(document.querySelector(".timer"), data.timerValue);
    }
}

// One-time audio unlock
import { lpChangeSoundTemplate } from './animations.js';

const popup = document.getElementById("audio-popup");
const button = document.getElementById("enable-audio-btn");

button.addEventListener("click", async () => {
    try {
        await lpChangeSoundTemplate.play();
        lpChangeSoundTemplate.pause();
        lpChangeSoundTemplate.currentTime = 0;
        console.log("Audio enabled");
        popup.style.display = "none";
    } catch (e) {
        alert("Audio could not be unlocked. Please try again.");
        console.error("Audio unlock failed:", e);
    }
});
