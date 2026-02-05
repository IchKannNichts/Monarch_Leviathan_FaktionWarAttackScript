# Monarch_Leviathan_ WarAttackScript – README 
### Todos
- [X] Rewrite the script to make an API call to get an array of factions that can no longer be attacked. -> Only concerns the opposing war faction
- [X] The attack button for people must then be disabled                                                 -> The attack button is active for all other players, but not for our War Franction players.   

## Overview  

`WarAttackScript.user.js` is a userscript designed for the browser‑based game **Torn**. It automatically disables the “Attack” button for a faction when a configurable **score cap** is reached. The script obtains the current cap from an external JSON endpoint (hosted on a Discord‑linked server) and checks the faction’s score via the Torn API (with a DOM fallback).  

## Features  

| Feature | Description |
|---------|-------------|
| **Score‑cap enforcement** | Disables the attack button when the faction’s score meets or exceeds the configured cap. |
| **Live cap updates** | Periodically fetches the latest cap value from `SCORECAP_URL`. |
| **Dual score source** | Tries the Torn API first (`rankedwars` and `basic` selections). If the API fails or the faction isn’t in a ranked war, it falls back to reading the score from the page’s DOM. |
| **Configurable intervals** | Separate timers control how often the cap is refreshed and how often the main logic runs. |
| **Self‑logging** | Writes informative messages to the console for debugging. |

## Installation  

1. Install a userscript manager such as **Tampermonkey**, **Greasemonkey**, or **Violentmonkey**.  

2. [Install](https://raw.githubusercontent.com/IchKannNichts/Monarch_Leviathan_FaktionWarAttackScript/main/WarAttackScript.user.js)

3. Save the script – it will automatically run on any page matching `https://www.torn.com/\*\`.  

## Configuration  
```js
/* ──────────────────────  KONFIGURATION  ────────────────────── */
// URL that serves a JSON file like { "active": true, "scorecap": 12345 }
const SCORECAP_URL = 'https://deinserver.de/scorecap.json';

// How often the main loop runs (milliseconds)
// Smaller values → quicker reaction to a score change
const CHECK_INTERVAL = 5_000;          // 5 seconds

// How often the cap JSON is refreshed from the remote server
const SCORECAP_REFRESH = 10_000;       // 10 seconds

// Your personal Torn API key (needs at least “Limited Access”)
// Insert the key you generated in the Torn developer portal
const TORN_API_KEY = 'YOUR_TORN_API_KEY_HERE';

// Numeric ID of the faction you want to monitor
// Find it in the faction’s URL: https://www.torn.com/factions.php?step=yourfaction&id=40518
const TORN_FACTION_ID = 40518;
```
| Setting |	Purpose |	Typical adjustment|
|---------|-------------|-------------|
|SCORECAP_URL | Points to a JSON file that tells the script whether the cap is active and what the numeric limit (scorecap) is. | Host the file on your own server or a trusted CDN.
|CHECK_INTERVAL | Interval for the main loop that checks the current faction score and toggles the attack button. | Lower if you need near‑real‑time disabling; higher to reduce CPU/network load.
|SCORECAP_REFRESH | Interval for re‑fetching the cap JSON. | Keep it a few seconds longer than CHECK_INTERVAL so the latest cap is always known.
|TORN_API_KEY | Authenticates the Torn API request. Without a valid key the script will fall back to reading the score from the page DOM. | Generate a new key in the Torn developer area and paste it here.
|TORN_FACTION_ID | Identifies which faction’s score the script monitors. | Use the numeric ID from your faction’s URL (the part after id=).

## How It Works

1. Profile ID Extraction
  Read hidden #skip-to-content, pull the number inside […] (e.g., [123456]) and store it as profileId. This ID builds the selector for the attack button (#button0-profile-${profileId}).

2. Score‑Cap Refresh
  Every SCORECAP_REFRESH ms send a GM_xmlhttpRequest to SCORECAP_URL. Expect JSON { active: bool, scorecap: number }. Store as capActive and scoreCapValue.

3. Current Faction Score
  Primary: Call Torn API
  https://api.torn.com/faction/<FACTION_ID>?selections=rankedwars,basic&key=<API_KEY>
  • If the faction appears in an active ranked war, use that war’s score.
  • Otherwise fall back to basic.score.
  Secondary (DOM fallback): Read span.right.scoreText___uVRQm.currentFaction___Omz6o, strip commas, convert to integer.

4. Main Loop (mainLoop) – runs every CHECK_INTERVAL ms
  If profileId missing → abort.
  If capActive is false → ensure the attack button stays enabled and exit.
  Retrieve current faction score (API → DOM).
  If score >= scoreCapValue → disable the button:
  Remove active CSS class.
  Set pointer-events: none and opacity: 0.35.
  Update tooltip to show the reached cap.
  Else → re‑enable the button: restore original styles and tooltip.
  
5. Timers
  setInterval(refreshCap, SCORECAP_REFRESH) – updates the cap JSON.
  setInterval(mainLoop, CHECK_INTERVAL) – continuously checks the score and toggles the button.

6. Customising Appearance
  Button styling is handled directly in disableAttack / enableAttack. Adjust opacity, pointer-events, or add extra cues (e.g., background colour) as desired.

## Debugging

All major actions emit console.log statements prefixed with tags such as [FACTION] or Scorecap. Open the browser’s developer console to trace execution, view fetched data, and spot errors (e.g., failed API calls or malformed JSON).

## Important Notes

API Key Required – Without inserting a valid Torn API key, the script cannot retrieve the score via the API and will rely solely on the DOM method, which may be less reliable during page changes.
CORS & Permissions – The script declares @grant GM_xmlhttpRequest and @connect entries for the external JSON host and api.torn.com. Ensure your userscript manager permits cross‑origin requests.
Score‑Cap JSON Structure – The remote JSON must contain at least { "active": true, "scorecap": 12345 }. Any additional fields are ignored.

## License & Attribution

Author: Kochaff3
Version: 2.3.1
