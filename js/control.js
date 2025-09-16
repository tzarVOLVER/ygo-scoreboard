// control.js
import { supabase } from './supabaseClient.js';

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

async function writeBothRows(stage, payload) {
  const { table, ids } = STAGES[stage];
  return supabase.from(table).update(payload).in('id', ids);
}

// Accepts "mm:ss", "hh:mm:ss", or minutes like "45"
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

// ALWAYS minutes:seconds (even > 60min)
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

// SET: set display value only (paused)
// SET: set base value only (paused)
async function timerSet(stage, inputStr) {
  const txt = (inputStr ?? '').trim();
  const clock = normalizeClockInput(txt);
  if (clock == null) { 
    status(stage, 'Enter a time like 45 or 45:00', false); 
    return; 
  }

  // Null first to ensure change event, then set BASE value (paused)
  const { error: e1 } = await writeBothRows(stage, { timerValue: null, timerAdjust: null });
  if (e1) { status(stage, `Set error (clear): ${e1.message}`); return; }

  const { error: e2 } = await writeBothRows(stage, { timerValue: clock, timerPlay: false });
  if (e2) { status(stage, `Set error (set): ${e2.message}`); return; }

  status(stage, `Set timerValue to ${clock} (paused)`, true);
}

// PLAY: start/resume (don’t change values)
async function timerPlayFn(stage) {
  const { error } = await writeBothRows(stage, { timerPlay: true });
  if (error) { status(stage, `Play error: ${error.message}`); return; }
  status(stage, 'Playing', true);
}

// PAUSE: pause (don’t change values)
async function timerPauseFn(stage) {
  const { error } = await writeBothRows(stage, { timerPlay: false });
  if (error) { status(stage, `Pause error: ${error.message}`); return; }
  status(stage, 'Paused', true);
}

// RESET: stop/pause and update to typed display value (base)
async function timerReset(stage, inputStr) {
  const txt = (inputStr ?? '').trim();
  const clock = normalizeClockInput(txt);
  if (clock == null) { status(stage, 'Enter a time like 45 or 45:00', false); return; }

  // Null first to force change, then set BASE value (not adjust), paused
  const { error: e1 } = await writeBothRows(stage, { timerValue: null });
  if (e1) { status(stage, `Reset error (clear): ${e1.message}`); return; }

  const { error: e2 } = await writeBothRows(stage, { timerValue: clock, timerPlay: false });
  if (e2) { status(stage, `Reset error (set): ${e2.message}`); return; }

  status(stage, `Reset to ${clock} (paused)`, true);
}

// --- Wire up UI ---
for (const stage of Object.keys(STAGES)) {
  loadNames(stage);

  const root = document.querySelector(`.card[data-stage="${stage}"]`);
  root.querySelector('[data-action="reload"]').addEventListener('click', () => loadNames(stage));
  root.querySelector('[data-action="save-names"]').addEventListener('click', () => saveNames(stage));

  // SET
  root.querySelector('[data-action="set"]').addEventListener('click', () => {
    const input = $(`#${stage}-time`).value;
    timerSet(stage, input);
  });

  // PLAY
  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    timerPlayFn(stage);
  });

  // PAUSE
  root.querySelector('[data-action="pause"]').addEventListener('click', () => {
    timerPauseFn(stage);
  });

  // RESET
  root.querySelector('[data-action="reset"]').addEventListener('click', () => {
    const input = $(`#${stage}-time`).value;
    timerReset(stage, input);
  });
}
