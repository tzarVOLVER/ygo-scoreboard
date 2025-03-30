const urlParams = new URLSearchParams(window.location.search);
const stage = urlParams.get("stage") || "feature";

export const tableName = stage === "bonus" ? "bonusScoreboard" : "featureScoreboard";
export const playerIds = stage === "bonus" ? [3, 4] : [1, 2];
