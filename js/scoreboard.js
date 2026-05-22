// scoreboard.js
import { scoreboardApiUrl, cardsHidden, cardsSolo } from './config.js';
import { updateUI } from './uiUpdater.js';

const POLL_INTERVAL_MS = 500;
const FETCH_TIMEOUT_MS = 5000;

// Apply CSS toggle for hidden cards
if (cardsHidden) {
  document.documentElement.setAttribute('data-cards', 'hidden');
}

if (cardsSolo) {
  document.documentElement.setAttribute('data-cards', 'solo');
}

function flagUrlFromCode(code) {
  const cc = String(code || '').trim().toLowerCase();
  return cc ? `https://flagcdn.com/h80/${cc}.png` : '';
}

function imageUrlFromPath(path) {
  if (!path) return '';

  try {
    return new URL(path, scoreboardApiUrl).href;
  } catch {
    return String(path);
  }
}

function formatPhaseText(phase) {
  const normalized = String(phase || '').trim().toLowerCase();
  if (!normalized) return '';

  const labels = {
    draw: 'DRAW PHASE',
    standby: 'STANDBY PHASE',
    main: 'MAIN PHASE',
    main2: 'MAIN PHASE 2',
    battle: 'BATTLE PHASE',
    end: 'END PHASE',
  };

  return labels[normalized] || normalized.replace(/-/g, ' ').toUpperCase();
}

function normalizePhase(currentPhase) {
  const phase = String(currentPhase || '').trim().toLowerCase();
  const match = /^(blue|red)-(.+)$/.exec(phase);

  if (match) {
    const phaseText = formatPhaseText(match[2]);

    return {
      blue: match[1] === 'blue' ? phaseText : '',
      red: match[1] === 'red' ? phaseText : '',
    };
  }

  return {
    blue: phase === 'siding' ? '' : formatPhaseText(phase),
    red: '',
  };
}

function normalizePlayer(player, stage, side, phases) {
  const isBlue = side === 'blue';
  const broadcastName = String(player?.broadcastName || '').trim();

  return {
    id: isBlue ? 1 : 2,
    brName: broadcastName || player?.playerName || '',
    record: player?.playerRecord ?? '',
    deck: player?.deckType ?? '',
    flagImgUrl: player?.flagImgUrl || flagUrlFromCode(player?.playerCountry),
    score: isBlue ? stage?.scoreBlue : stage?.scoreRed,
    lifePoints: isBlue ? stage?.lifePointsBlue : stage?.lifePointsRed,
    phase: isBlue ? phases.blue : phases.red,
    cardFlipped: isBlue ? stage?.cardFlippedBlue : stage?.cardFlippedRed,
    cardHighlight: imageUrlFromPath(isBlue ? stage?.cardFilePathBlue : stage?.cardFilePathRed)
      || player?.deckImageUrl
      || '',
    timerValue: stage?.timerValue,
  };
}

function normalizeScoreboard(payload) {
  const { playerBlue, playerRed, stage } = payload || {};
  const phases = normalizePhase(stage?.currentPhase);

  return [
    normalizePlayer(playerBlue, stage, 'blue', phases),
    normalizePlayer(playerRed, stage, 'red', phases),
  ];
}

let activeFetch = null;

async function fetchScoreboard() {
  if (activeFetch) return;

  const controller = new AbortController();
  activeFetch = controller;
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(scoreboardApiUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    normalizeScoreboard(payload).forEach((row) => scheduleUpdate(row.id, row));
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error fetching scoreboard:', error);
    }
  } finally {
    clearTimeout(timeoutId);
    if (activeFetch === controller) activeFetch = null;
  }
}

// --- Coalesce realtime updates per animation frame ---
const pending = new Map(); // id -> latest row
let scheduled = false;

function flushPending() {
  scheduled = false;
  for (const [pid, row] of pending.entries()) {
    pending.delete(pid);
    updateUI(pid, row);
  }
}

function scheduleUpdate(id, row) {
  pending.set(id, row);
  if (scheduled) return;
  scheduled = true;
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(flushPending);
  } else {
    setTimeout(flushPending, 0);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') fetchScoreboard();
});

// Kick off
fetchScoreboard();
setInterval(fetchScoreboard, POLL_INTERVAL_MS);
