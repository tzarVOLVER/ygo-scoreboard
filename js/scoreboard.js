import { supabase } from './supabaseClient.js';
import { tableName, playerIds } from './config.js';
import { updateUI } from './uiUpdater.js';

// NEW: lightweight global toggle
if (cardsHidden) {
    document.documentElement.setAttribute('data-cards', 'hidden');
    const style = document.createElement('style');
    style.textContent = `html[data-cards="hidden"] .card-wrapper { display: none !important; }`;
    document.head.appendChild(style);
}

async function fetchPlayers() {
    const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .in("id", playerIds);

    if (error) {
        console.error("Error fetching players:", error);
        return;
    }

    data.forEach(player => {
        updateUI(player.id, player); // no options needed
    });
}

supabase
    .channel(`${tableName}-channel`)
    .on("postgres_changes", { event: "*", schema: "public", table: tableName }, (payload) => {
        const id = payload.new.id;
        if (playerIds.includes(id)) {
            updateUI(id, payload.new);
        }
    })
    .subscribe();

fetchPlayers();
