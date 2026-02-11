// scoreboard.js
import { supabase } from './supabaseClient.js';
import { tableName, playerIds, cardsHidden, cardsSolo } from './config.js';
import { updateUI } from './uiUpdater.js';

// Apply CSS toggle for hidden cards
if (cardsHidden) {
  document.documentElement.setAttribute('data-cards', 'hidden');
}

if (cardsSolo) {
  document.documentElement.setAttribute('data-cards', 'solo');
}

// One-shot snapshot fetch
async function fetchPlayers() {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .in('id', playerIds);

  if (error) {
    console.error('Error fetching players:', error);
    return;
  }

  data.forEach((row) => updateUI(row.id, row));
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


// Row-level subscriptions (one per player row)
const rowChannels = playerIds.map((id) =>
  supabase
    .channel(`${tableName}-row-${id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: tableName,
        filter: `id=eq.${id}`, // <-- subscribe to just this row
      },
      (payload) => {
        const row = payload?.new;
        if (!row) return;
        scheduleUpdate(id, row);
      }
    )
    .subscribe()
);

// Optional: re-sync when the tab becomes visible (helps after idle)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') fetchPlayers();
});

// Kick off initial state load
fetchPlayers();

// Optional cleanup helper (useful in hot-reload / SPA situations)
function unsubscribeRows() {
  rowChannels.forEach((ch) => supabase.removeChannel(ch));
}