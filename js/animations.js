// Track last known phase to avoid redundant animations
export const lastKnownPhases = {
    left: null,
    right: null
};

export const cardStates = {
    left: { flipped: false },
    right: { flipped: false }
};

// 🔊 Preload LP change sound
const lpChangeSoundTemplate = new Audio("/ygo-scoreboard/src/sfx/lifepoints.mp3");
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

// ✏️ Text resizing logic for SVG text labels
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

// 🎴 Flip animation logic for cards
export function setCardFlippedForSide(side, flipped) {
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

// 💖 Animate life point changes with easing and sound
export function animateLP(element, newValue) {
    let startValue = parseInt(element.textContent, 10);
    if (isNaN(startValue)) startValue = 0;

    if (startValue === newValue) return; // No change? No animation.

    const sound = lpChangeSoundTemplate.cloneNode();
    sound.play().catch(() => { });

    const change = newValue - startValue;
    const duration = 1500;
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
