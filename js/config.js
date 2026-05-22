const urlParams = new URLSearchParams(window.location.search);

const stageNumber = Math.max(1, parseInt(urlParams.get("stage"), 10) || 1);

const cardsParam = (urlParams.get("cards") || "").toLowerCase();
const cardsHidden = ["hidden", "off", "false", "0"].includes(cardsParam);
const cardsSolo   = cardsParam === "solo";

const tableName = `Stage${stageNumber}Scoreboard`;
const playerIds = [(stageNumber * 2) - 1, stageNumber * 2];
const scoreboardApiBase = urlParams.get("apiBase") || "http://192.168.0.127:5173/api/scoreboard";
const scoreboardApiUrl = `${scoreboardApiBase.replace(/\/$/, "")}/${stageNumber}`;

export { tableName, playerIds, stageNumber, cardsHidden, cardsSolo, scoreboardApiUrl };
