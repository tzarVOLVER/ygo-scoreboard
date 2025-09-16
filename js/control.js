// control.js
import { supabase } from './supabaseClient.js';

async function writeBothRows(stage, payload) {
  const { table, ids } = STAGES[stage];
  return supabase.from(table).update(payload).in('id', ids);
}

// Stage → table/id mapping
const STAGES = {
  bonus2: { table: 'bonus2Scoreboard', ids: [5, 6] },
  bonus3: { table: 'bonus3Scoreboard', ids: [7, 8] },
};

// --- Utilities ---
function $(sel, root=document) { return root.querySelector(sel); }
function status(stage, msg, ok=false) {
  const el = document.getElementById(`${stage}-status`);
  if (!el) return;
  el.innerHTML = ok ? `<span class="ok">${msg}</span>` : `<span class="err">${msg}</span>`;
}

// accepts "mm:ss", "hh:mm:ss", or minutes like "45"
function msFromTimeString(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10) * 60_000; // minutes → ms
  const parts = s.split(':').map(n => parseInt(n, 10));
  if (parts.some(Number.isNaN)) return null;
  let h=0,m=0,sec=0;
  if (parts.length === 2) [m, sec] = parts;
  else if (parts.length === 3) [h, m, sec] = parts;
  else return null;
  return (h*3600 + m*60 + sec) * 1000;
}

// normalize to overlay-friendly "m:ss" or "mm:ss"
function clockFromMs(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function normalizeClockInput(inputStr) {
  const ms = msFromTimeString(inputStr);
  if (ms == null) return null;
  return clockFromMs(ms);
}

// --- Names ---
async function loadNames(stage) {
  const { table, ids } = STAGES[stage];
  const { data, error } = await supabase.from(table).select('id, brName').in('id', ids);
  if (error) { status(stage, `Load error: ${error.message}`); return; }
  const left = data.find(r => r.id === ids[0]);
  const right = data.find(r => r.id === ids[1]);
  $(`#${stage}-left`).value  = left?.brName  || '';
  $(`#${stage}-right`).value = right?.brName || '';
  status(stage, 'Loaded', true);
}
async function saveNames(stage) {
  const { table, ids } = STAGES[stage];
  const left  = $(`#${stage}-left`).value.trim();
  const right = $(`#${stage}-right`).value.trim();
  const u1 = supabase.from(table).update({ brName: left  }).eq('id', ids[0]);
  const u2 = supabase.from(table).update({ brName: right }).eq('id', ids[1]);
  const [{ error: e1 }, { error: e2 }] = await Promise.all([u1, u2]);
  if (e1 || e2) { status(stage, `Save error: ${(e1||e2).message}`); return; }
  status(stage, 'Names saved', true);
}

// --- TIMER (old schema writer: timerValue, timerAdjust, timerPlay) ---
async function timerStart(stage, inputStr) {
  const txt = (inputStr ?? '').trim();

  if (!txt) {
    // RESUME (no new time)
    const { error } = await writeBothRows(stage, { timerPlay: true });
    if (error) { status(stage, `Resume error: ${error.message}`); return; }
    status(stage, 'Resumed', true);
    return;
  }

  // START FRESH (new base time) — null first, then write
  const clock = normalizeClockInput(txt);
  if (clock == null) { status(stage, 'Enter a time like 45 or 45:00', false); return; }

  const { error: e1 } = await writeBothRows(stage, {
    timerValue: null,
    timerAdjust: null
  });
  if (e1) { status(stage, `Start error (clear): ${e1.message}`); return; }

  const { error: e2 } = await writeBothRows(stage, {
    timerValue: clock,
    timerAdjust: null,
    timerPlay: true
  });
  if (e2) { status(stage, `Start error (set): ${e2.message}`); return; }

  status(stage, `Started (${clock})`, true);
}

async function timerPause(stage) {
  const { table, ids } = STAGES[stage];
  const { error } = await supabase.from(table).update({ timerPlay: false }).in('id', ids);
  if (error) { status(stage, `Pause error: ${error.message}`); return; }
  status(stage, 'Paused', true);
}

// Set without starting = write timerAdjust and keep paused
// Set & Start = write timerAdjust and start
async function timerSet(stage, inputStr, start=false) {
  const txt = (inputStr ?? '').trim();
  const clock = normalizeClockInput(txt);
  if (clock == null) { status(stage, 'Enter a time like 45 or 45:00', false); return; }

  // Clear first
  const { error: e1 } = await writeBothRows(stage, {
    timerValue: null,
    timerAdjust: null
  });
  if (e1) { status(stage, `Set error (clear): ${e1.message}`); return; }

  // Then write the adjust (overlay treats this as the override)
  const { error: e2 } = await writeBothRows(stage, {
    timerAdjust: clock,
    timerPlay: !!start
  });
  if (e2) { status(stage, `Set error (set): ${e2.message}`); return; }

  status(stage, `${start ? 'Set & started' : 'Set (paused)'} to ${clock}`, true);
}

// --- Wire up UI ---
for (const stage of Object.keys(STAGES)) {
  loadNames(stage);

  const root = document.querySelector(`.card[data-stage="${stage}"]`);
  root.querySelector('[data-action="reload"]').addEventListener('click', () => loadNames(stage));
  root.querySelector('[data-action="save-names"]').addEventListener('click', () => saveNames(stage));

  root.querySelector('[data-action="start"]').addEventListener('click', () => {
    const input = $(`#${stage}-time`).value;
    timerStart(stage, input);
  });
  root.querySelector('[data-action="pause"]').addEventListener('click', () => timerPause(stage));
  root.querySelector('[data-action="set"]').addEventListener('click', () => {
    const input = $(`#${stage}-time`).value;
    timerSet(stage, input, false);
  });
  root.querySelector('[data-action="set-and-start"]').addEventListener('click', () => {
    const input = $(`#${stage}-time`).value;
    timerSet(stage, input, true);
  });
}
