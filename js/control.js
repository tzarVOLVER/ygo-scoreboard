// control.js
import { supabase } from './supabaseClient.js';

// Single-stage mapping (Bonus 2 only)
const STAGE = { table: 'bonus2Scoreboard', ids: [5, 6] };

// --- Utilities ---
function $(sel, root=document) { return root.querySelector(sel); }
function status(msg, ok=false) {
  const el = document.getElementById('bonus2-status');
  if (!el) return;
  el.innerHTML = ok ? `<span class="ok">${msg}</span>` : `<span class="err">${msg}</span>`;
}
async function writeBothRows(payload) {
  const { table, ids } = STAGE;
  return supabase.from(table).update(payload).in('id', ids);
}
function sideToId(side) {
  const { ids } = STAGE;
  return side === 'left' ? ids[0] : ids[1];
}
function toIntOrDefault(v, d) {
  const n = Number.parseInt(String(v ?? '').trim(), 10);
  return Number.isNaN(n) ? d : n;
}

// --- Timer helpers ---
function msFromTimeString(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10) * 60_000; // plain minutes -> ms
  const parts = s.split(':').map(n => parseInt(n, 10));
  if (parts.some(Number.isNaN)) return null;
  let h=0,m=0,sec=0;
  if (parts.length === 2) [m, sec] = parts;
  else if (parts.length === 3) [h, m, sec] = parts;
  else return null;
  return (h*3600 + m*60 + sec) * 1000;
}
// minutes-only display (even > 60 mins)
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

// --- Flag code -> URL (FlagCDN PNG; lowercased 2-letter ISO) ---
function flagUrlFromCode(code) {
  const cc = String(code || '').trim().toLowerCase();
  if (!cc) return '';
  // 2x height PNG (80px tall) looks crisp; adjust if you need another size
  return `https://flagcdn.com/h80/${cc}.png`;
}

// --- Load / Save Names & Meta ---
async function loadAll() {
  const { table, ids } = STAGE;
  const { data, error } = await supabase
    .from(table)
    .select('id, brName, score, lifePoints, deck, flagImgUrl')
    .in('id', ids);

  if (error) { status(`Load error: ${error.message}`); return; }

  const left = data.find(r => r.id === ids[0]) || {};
  const right = data.find(r => r.id === ids[1]) || {};

  // Names
  $('#bonus2-left').value  = left.brName  ?? '';
  $('#bonus2-right').value = right.brName ?? '';

  // Score / LP placeholders
  $('#bonus2-left-score')?.setAttribute('placeholder', String(left.score ?? 0));
  $('#bonus2-right-score')?.setAttribute('placeholder', String(right.score ?? 0));
  $('#bonus2-left-lp')?.setAttribute('placeholder', String(left.lifePoints ?? 8000));
  $('#bonus2-right-lp')?.setAttribute('placeholder', String(right.lifePoints ?? 8000));

  // Deck
  $('#bonus2-left-deck').value  = left.deck  ?? '';
  $('#bonus2-right-deck').value = right.deck ?? '';

  // Flag dropdown preselect based on existing flagImgUrl (best-effort parse)
  const leftFlagCode  = (left.flagImgUrl  || '').split('/').pop()?.split('.')[0]?.toUpperCase() || '';
  const rightFlagCode = (right.flagImgUrl || '').split('/').pop()?.split('.')[0]?.toUpperCase() || '';
  $('#bonus2-left-flagcode').value  = leftFlagCode.length === 2 ? leftFlagCode : '';
  $('#bonus2-right-flagcode').value = rightFlagCode.length === 2 ? rightFlagCode : '';

  status('Loaded', true);
}

async function saveNames() {
  const { table, ids } = STAGE;
  const left  = $('#bonus2-left').value.trim();
  const right = $('#bonus2-right').value.trim();
  const u1 = supabase.from(table).update({ brName: left  }).eq('id', ids[0]);
  const u2 = supabase.from(table).update({ brName: right }).eq('id', ids[1]);
  const [{ error: e1 }, { error: e2 }] = await Promise.all([u1, u2]);
  if (e1 || e2) { status(`Save error: ${(e1||e2).message}`); return; }
  status('Names saved', true);
}

// --- Deck & Flag (per-side Set) ---
async function setMeta(side) {
  const { table } = STAGE;
  const id = sideToId(side);
  const deck = $(`#bonus2-${side}-deck`)?.value ?? '';
  const code = $(`#bonus2-${side}-flagcode`)?.value ?? '';
  const flagImgUrl = flagUrlFromCode(code);
  const { error } = await supabase.from(table).update({ deck, flagImgUrl }).eq('id', id);
  if (error) { status(`Meta (${side}) error: ${error.message}`); return; }
  status(`Updated ${side} deck & flag`, true);
}

// --- Timer (old schema: timerValue, timerAdjust, timerPlay) ---
async function timerSet() {
  const txt = ($('#bonus2-time').value ?? '').trim();
  const clock = normalizeClockInput(txt);
  if (clock == null) { status('Enter a time like 45 or 45:00', false); return; }
  // clear (0:00) first to force realtime change, then set paused
  const { error: e1 } = await writeBothRows({ timerValue: '0:00', timerAdjust: null });
  if (e1) { status(`Set error (clear): ${e1.message}`); return; }
  const { error: e2 } = await writeBothRows({ timerValue: clock, timerPlay: false });
  if (e2) { status(`Set error (set): ${e2.message}`); return; }
  status(`Set timerValue to ${clock} (paused)`, true);
}
async function timerPlay() {
  const { error } = await writeBothRows({ timerPlay: true });
  if (error) { status(`Play error: ${error.message}`); return; }
  status('Playing', true);
}
async function timerPause() {
  const { error } = await writeBothRows({ timerPlay: false });
  if (error) { status(`Pause error: ${error.message}`); return; }
  status('Paused', true);
}
async function timerReset() {
  const txt = ($('#bonus2-time').value ?? '').trim();
  const clock = normalizeClockInput(txt);
  if (clock == null) { status('Enter a time like 45 or 45:00', false); return; }
  const { error: e1 } = await writeBothRows({ timerValue: '0:00', timerAdjust: null });
  if (e1) { status(`Reset error (clear): ${e1.message}`); return; }
  const { error: e2 } = await writeBothRows({ timerValue: clock, timerPlay: false });
  if (e2) { status(`Reset error (set): ${e2.message}`); return; }
  status(`Reset to ${clock} (paused)`, true);
}

// --- Score / Life Points (Set + Reset) ---
async function setScore(side) {
  const { table } = STAGE;
  const id = sideToId(side);
  const val = toIntOrDefault($(`#bonus2-${side}-score`)?.value, 0);
  const { error } = await supabase.from(table).update({ score: val }).eq('id', id);
  if (error) { status(`Score (${side}) error: ${error.message}`); return; }
  status(`Score (${side}) → ${val}`, true);
}
async function resetScore(side) {
  const { table } = STAGE;
  const id = sideToId(side);
  const { error } = await supabase.from(table).update({ score: 0 }).eq('id', id);
  if (error) { status(`Score reset (${side}) error: ${error.message}`); return; }
  status(`Score (${side}) reset to 0`, true);
}
async function setLP(side) {
  const { table } = STAGE;
  const id = sideToId(side);
  const val = toIntOrDefault($(`#bonus2-${side}-lp`)?.value, 8000);
  const { error } = await supabase.from(table).update({ lifePoints: val }).eq('id', id);
  if (error) { status(`LP (${side}) error: ${error.message}`); return; }
  status(`LP (${side}) → ${val}`, true);
}
async function resetLP(side) {
  const { table } = STAGE;
  const id = sideToId(side);
  const { error } = await supabase.from(table).update({ lifePoints: 8000 }).eq('id', id);
  if (error) { status(`LP reset (${side}) error: ${error.message}`); return; }
  status(`LP (${side}) reset to 8000`, true);
}

// --- Wire up ---
(function init() {
  loadAll();

  const root = document.querySelector('.card[data-stage="bonus2"]');

  // names
  root.querySelector('[data-action="reload"]').addEventListener('click', loadAll);
  root.querySelector('[data-action="save-names"]').addEventListener('click', saveNames);

  // deck + flag
  root.querySelector('[data-action="set-left-meta"]').addEventListener('click', () => setMeta('left'));
  root.querySelector('[data-action="set-right-meta"]').addEventListener('click', () => setMeta('right'));

  // timer
  root.querySelector('[data-action="set"]').addEventListener('click', timerSet);
  root.querySelector('[data-action="play"]').addEventListener('click', timerPlay);
  root.querySelector('[data-action="pause"]').addEventListener('click', timerPause);
  root.querySelector('[data-action="reset"]').addEventListener('click', timerReset);

  // score / lp
  root.querySelector('[data-action="set-left-score"]').addEventListener('click', () => setScore('left'));
  root.querySelector('[data-action="set-right-score"]').addEventListener('click', () => setScore('right'));
  root.querySelector('[data-action="reset-left-score"]').addEventListener('click', () => resetScore('left'));
  root.querySelector('[data-action="reset-right-score"]').addEventListener('click', () => resetScore('right'));
  root.querySelector('[data-action="set-left-lp"]').addEventListener('click', () => setLP('left'));
  root.querySelector('[data-action="set-right-lp"]').addEventListener('click', () => setLP('right'));
  root.querySelector('[data-action="reset-left-lp"]').addEventListener('click', () => resetLP('left'));
  root.querySelector('[data-action="reset-right-lp"]').addEventListener('click', () => resetLP('right'));
})();
