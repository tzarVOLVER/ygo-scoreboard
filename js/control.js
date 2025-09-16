// control.js
import { supabase } from './supabaseClient.js';

// Your stage → table/id mapping
const STAGES = {
  bonus2: { table: 'bonus2Scoreboard', ids: [5, 6] },
  bonus3: { table: 'bonus3Scoreboard', ids: [7, 8] },
};

// ---- (Optional) legacy/compat fields (rename if your old overlay expects different names)
const LEGACY = {
  enabled: true,                 // set to false if you don't need legacy columns
  running: 'timerRunning',
  remainingMs: 'timerRemainingMs',
  updatedAt: 'timerLastUpdatedAt',
};

// --- Utilities ---
function $(sel, root=document) { return root.querySelector(sel); }
function status(stage, msg, ok=false) {
  const el = document.getElementById(`${stage}-status`);
  if (!el) return;
  el.innerHTML = ok ? `<span class="ok">${msg}</span>` : `<span class="err">${msg}</span>`;
}
function msFromTimeString(str) {
  // Supports "mm:ss", "hh:mm:ss", or minutes like "45"
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10) * 60_000; // minutes
  const parts = s.split(':').map(n => parseInt(n, 10));
  if (parts.some(Number.isNaN)) return null;
  let h=0,m=0,sec=0;
  if (parts.length === 2) [m, sec] = parts;
  else if (parts.length === 3) [h, m, sec] = parts;
  else return null;
  return (h*3600 + m*60 + sec) * 1000;
}
function isoNow() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }

// derive remaining time from the “timeline” fields
function computeRemainingMs(row) {
  const duration = Number(row?.timer_duration_ms ?? 0);
  const startedAt = row?.timer_started_at ? new Date(row.timer_started_at).getTime() : null;
  const pausedAt  = row?.timer_paused_at  ? new Date(row.timer_paused_at).getTime()  : null;
  const accPause  = Number(row?.timer_accumulated_pause_ms ?? 0);
  const state     = row?.timer_state;

  if (!duration || !startedAt) return 0;

  const now = nowMs();
  if (state === 'running') {
    const elapsed = now - startedAt - accPause;
    return Math.max(0, duration - elapsed);
  } else {
    // paused: freeze at pause moment
    const elapsed = (pausedAt ?? startedAt) - startedAt - accPause;
    return Math.max(0, duration - elapsed);
  }
}

// fetch one row for a stage (either id works since we mirror both)
async function fetchOneRow(stage) {
  const { table, ids } = STAGES[stage];
  const { data, error } = await supabase.from(table)
    .select('id, timer_state, timer_duration_ms, timer_started_at, timer_paused_at, timer_accumulated_pause_ms')
    .eq('id', ids[0])    // just read left row for state
    .single();

  if (error) return { row: null, error };
  return { row: data, error: null };
}

// mirror to legacy columns if enabled
async function mirrorLegacy(stage) {
  if (!LEGACY.enabled) return;
  const { table, ids } = STAGES[stage];

  const { row, error } = await fetchOneRow(stage);
  if (error || !row) return; // silent fail for legacy

  const remainingMs = computeRemainingMs(row);
  const running = row?.timer_state === 'running';
  const payload = {
    [LEGACY.running]: running,
    [LEGACY.remainingMs]: remainingMs,
    [LEGACY.updatedAt]: isoNow(),
  };
  await supabase.from(table).update(payload).in('id', ids);
}

// --- Data loaders ---
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

// --- Timer controls ---
// Timeline model + resume behavior when Start pressed with no input.
async function timerStart(stage, msMaybe) {
  const { table, ids } = STAGES[stage];

  if (msMaybe == null) {
    // RESUME path (no new time entered)
    const { row, error } = await fetchOneRow(stage);
    if (error || !row) { status(stage, `Resume error: ${error?.message || 'no state'}`); return; }

    // Only valid if currently paused and previously started
    if (row.timer_state !== 'paused' || !row.timer_started_at) {
      status(stage, 'Nothing to resume (enter a time to start fresh)', false);
      return;
    }

    const nowIso = isoNow();
    const pausedAt = row.timer_paused_at ? new Date(row.timer_paused_at).getTime() : nowMs();
    const addPause = Math.max(0, nowMs() - pausedAt);

    const payload = {
      timer_state: 'running',
      timer_started_at: row.timer_started_at, // keep original start
      timer_paused_at: null,
      timer_accumulated_pause_ms: Number(row.timer_accumulated_pause_ms || 0) + addPause,
      // keep existing duration
    };

    const { error: uerr } = await supabase.from(table).update(payload).in('id', ids);
    if (uerr) { status(stage, `Resume error: ${uerr.message}`); return; }
    await mirrorLegacy(stage);
    status(stage, 'Resumed', true);
    return;
  }

  // START FRESH path (time provided)
  const payload = {
    timer_state: 'running',
    timer_duration_ms: msMaybe,
    timer_started_at: isoNow(),
    timer_paused_at: null,
    timer_accumulated_pause_ms: 0,
  };
  const { error } = await supabase.from(table).update(payload).in('id', ids);
  if (error) { status(stage, `Start error: ${error.message}`); return; }
  await mirrorLegacy(stage);
  status(stage, `Started (${formatForStatus(msMaybe)})`, true);
}

async function timerPause(stage) {
  const { table, ids } = STAGES[stage];

  // Mark paused (we don’t change duration/accumulated here; resume will add the pause time)
  const { error } = await supabase.from(table).update({
    timer_state: 'paused',
    timer_paused_at: isoNow(),
  }).in('id', ids);

  if (error) { status(stage, `Pause error: ${error.message}`); return; }
  await mirrorLegacy(stage);
  status(stage, 'Paused', true);
}

async function timerSet(stage, ms, start=false) {
  const { table, ids } = STAGES[stage];
  if (ms == null) { status(stage, 'Enter a time like 45:00', false); return; }

  const payload = {
    timer_duration_ms: ms,
    timer_started_at: start ? isoNow() : null,
    timer_paused_at: start ? null : isoNow(),
    timer_accumulated_pause_ms: 0,
    timer_state: start ? 'running' : 'paused',
  };
  const { error } = await supabase.from(table).update(payload).in('id', ids);
  if (error) { status(stage, `Set error: ${error.message}`); return; }
  await mirrorLegacy(stage);
  status(stage, `${start ? 'Set & started' : 'Set (paused)'} to ${formatForStatus(ms)}`, true);
}

function formatForStatus(ms){
  const total = Math.max(0, Math.round(ms/1000));
  const h = Math.floor(total/3600);
  const m = Math.floor((total%3600)/60);
  const s = total%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
           : `${m}:${String(s).padStart(2,'0')}`;
}

// --- Wire up UI ---
for (const stage of Object.keys(STAGES)) {
  // initial load
  loadNames(stage);

  const root = document.querySelector(`.card[data-stage="${stage}"]`);
  root.querySelector('[data-action="reload"]').addEventListener('click', () => loadNames(stage));
  root.querySelector('[data-action="save-names"]').addEventListener('click', () => saveNames(stage));

  root.querySelector('[data-action="start"]').addEventListener('click', () => {
    const input = $(`#${stage}-time`).value;
    const ms = msFromTimeString(input);
    // resume if no time entered; start fresh if time provided
    timerStart(stage, ms);
  });
  root.querySelector('[data-action="pause"]').addEventListener('click', () => timerPause(stage));
  root.querySelector('[data-action="set"]').addEventListener('click', () => {
    const ms = msFromTimeString($(`#${stage}-time`).value);
    timerSet(stage, ms, false);
  });
  root.querySelector('[data-action="set-and-start"]').addEventListener('click', () => {
    const ms = msFromTimeString($(`#${stage}-time`).value);
    timerSet(stage, ms, true);
  });
}
