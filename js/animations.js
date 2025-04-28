// Track last known phase to avoid redundant animations
export const lastKnownPhases = {
    left: null,
    right: null
};

export const cardStates = {
    left: { flipped: false },
    right: { flipped: false }
};

//LP SFX PRE-LOAD
export const lpChangeSoundTemplate = new Audio("https://tzarvolver.github.io/ygo-scoreboard/src/sfx/lifepoints.mp3");
lpChangeSoundTemplate.preload = "auto";

export let isAnimating = false;
const transitionQueue = [];

export function queuePhase(player, phaseText) {
    transitionQueue.push({ player, phase: phaseText });
    processNextPhase();
}

export function processNextPhase() {
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

    void newText.offsetWidth; // Trigger reflow for animation
    newText.classList.remove("start-below-up");
    newText.classList.add("slide-in");

    document.getElementById("leftArrow").classList.toggle("active", player === "left");
    document.getElementById("rightArrow").classList.toggle("active", player === "right");

    setTimeout(() => {
        isAnimating = false;
        processNextPhase();
    }, 500);
}

//TEXT AUTO RESIZE
export function squashTextToFit(textEl, maxWidth, newText, side = "left") {
    textEl.textContent = newText;

    if (side === "left") {
        textEl.setAttribute("x", "0");
        textEl.setAttribute("text-anchor", "start");
        textEl.setAttribute("transform-origin", "left center");
    } else {
        textEl.setAttribute("x", maxWidth);
        textEl.setAttribute("text-anchor", "end");
        textEl.setAttribute("transform-origin", "right center");
    }

    // Wait for layout, then scale down if needed
    requestAnimationFrame(() => {
        const bbox = textEl.getBBox();
        const scaleX = Math.min(1, maxWidth / bbox.width);
        textEl.setAttribute("transform", `scale(${scaleX}, 1)`);
    });
}

//CARD FLIP
export function setCardFlippedForSide(side, flipped) {
    const cardId = side === "left" ? "card-1" : "card-2";
    const card = document.getElementById(cardId);
    if (!card) return;

    const current = cardStates[side]?.flipped;
    const hasBeenInitialized = card.hasAttribute("data-flip-initialized");

    // Don't re-apply if it's already in the desired state and has been initialized
    if (flipped === current && hasBeenInitialized) return;

    // Reset classes to restart animation
    card.classList.remove("animate-in", "animate-out");
    void card.offsetWidth; // force reflow

    // Apply the new animation class
    card.classList.add(flipped ? "animate-in" : "animate-out");

    // Mark the card as initialized
    card.setAttribute("data-flip-initialized", "true");

    // Update internal state
    cardStates[side].flipped = flipped;

    console.log(`[CardFlip] side: ${side} | applied: ${flipped}`);
}

//LIFEPOINTS
export function animateLP(element, newValue) {
    let startValue = parseInt(element.textContent, 10);
    if (isNaN(startValue)) startValue = 0;

    if (startValue === newValue) return; //checks for new value

    const sound = lpChangeSoundTemplate.cloneNode();
    sound.play().catch(() => { });

    const change = newValue - startValue;
    const duration = 1350;
    const startTime = performance.now();

    function step(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const easing = progress * (2 - progress);
        const currentLP = Math.round(startValue + change * easing);

        element.textContent = currentLP;
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}
