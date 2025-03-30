//global timer state
export let timerState = {
    currentTime: 0,
    isRunning: false,
    intervalId: null,
    hasInitialized: false,
    lastTimerValue: null,
    lastTimerAdjust: null,
    startTimestamp: null,
};

export function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
        return parts[0];
    }
    return 0;
}

export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
export function updateTimerDisplay() {
    const timerEl = document.querySelector(".timer");
    if (timerEl) {
        timerEl.textContent = formatTime(timerState.currentTime);
    }
}

export function startTimer() {
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

export function stopTimer() {
    if (timerState.intervalId) {
        clearInterval(timerState.intervalId);
        timerState.intervalId = null;
    }

    // Preserve remaining time on pause
    timerState.currentTime = Math.max(0, Math.floor((timerState.startTimestamp - Date.now()) / 1000));
    updateTimerDisplay();
}