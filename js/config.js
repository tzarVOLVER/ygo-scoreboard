const urlParams = new URLSearchParams(window.location.search);
const stage = (urlParams.get("stage") || "feature").toLowerCase();

// NEW: cards=hidden|off|false|0  → hide card callouts
const cardsParam = (urlParams.get("cards") || "").toLowerCase();
const cardsHidden = ["hidden", "off", "false", "0"].includes(cardsParam);

let tableName, playerIds;
switch (stage) {
  case "bonus":
  case "bonus1":
    tableName = "bonusScoreboard"; playerIds = [3, 4]; break;
  case "bonus2":
    tableName = "bonus2Scoreboard"; playerIds = [5, 6]; break;
  case "bonus3":
    tableName = "bonus3Scoreboard"; playerIds = [7, 8]; break;
  default:
    tableName = "featureScoreboard"; playerIds = [1, 2];
}

export { tableName, playerIds, stage, cardsHidden };