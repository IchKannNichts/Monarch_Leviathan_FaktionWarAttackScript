# Monarch_Leviathan_ WarAttackScript – README 

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

2. Create a new script and paste the entire contents of `WarAttackScript.js`.  

3. Save the script – it will automatically run on any page matching `https://www.torn.com/\*\`.  

## Configuration  

Edit the top section of the script (the **KONFIGURATION** block) to suit your faction:
const SCORECAP_URL      = 'https://deinserver.de/scorecap.json'; // URL that returns {"active":true,"scorecap":}
const CHECK_INTERVAL    = 5000;   // How often (ms) the main loop runs
const SCORECAP_REFRESH  = 10000;  // How often (ms) the cap JSON is re‑fetched
const TORN_API_KEY      = 'API-Key'; // ← INSERT YOUR OWN Torn API key here
const TORN_FACTION_ID   = '40518';   // Your faction’s numeric ID
SCORECAP_URL – Must point to a JSON file that contains at least the fields active (boolean) and scorecap (numeric).
CHECK_INTERVAL – Determines how responsive the script is to score changes.
SCORECAP_REFRESH – Controls how frequently the cap value is refreshed from the remote server.
TORN_API_KEY – You must replace 'API-Key' with a valid Torn API key that has at least “Limited Access”. Without a proper key the API request will fail and the script will fall back to the DOM method only.
TORN_FACTION_ID – The numeric ID of the faction whose score you want to monitor.

## How It Works

Profile ID Extraction – The script reads the hidden element #skip-to-content, extracts the numeric profile ID inside square brackets ([123456]), and stores it. This ID is used to locate the attack button (#button0-profile-).
Fetching the Score Cap
Every SCORECAP_REFRESH milliseconds the script sends a GM_xmlhttpRequest to SCORECAP_URL.
The response is expected to be JSON with active (whether the cap is enforced) and scorecap (the numeric threshold).
The values are stored in capActive and scoreCapValue.
Obtaining the Current Faction Score
Primary method – Torn API
Calls https://api.torn.com/faction/<FACTION_ID>?selections=rankedwars,basic&key=<API_KEY>.
Looks for the faction inside any active ranked war (ranked_wars). If found, returns that war’s score.
If the faction isn’t in a ranked war, falls back to the basic field’s score.
Secondary method – DOM fallback
Selects the element span.right.scoreText___uVRQm.currentFaction___Omz6o (the on‑page score display).
Parses the inner text, stripping commas, and converts it to an integer.
Main Loop (mainLoop) – Runs every CHECK_INTERVAL milliseconds:
Retrieves the profile ID (if missing, aborts).
If capActive is false, ensures the attack button is enabled and exits.
Otherwise, gets the current faction score via the API/Dom routine.
If the score ≥ scoreCapValue, the script disables the attack button:
Removes the active CSS class.
Sets pointer-events: none and reduces opacity to indicate disabled state.
Updates the button’s tooltip to show the cap that was reached.
If the score is below the cap, the button is re‑enabled (restoring original styles).
Timers – Two setInterval calls keep the script alive: one for refreshing the cap JSON, another for repeatedly executing mainLoop.
Customising Button Appearance
The script directly manipulates the button’s style attributes:
opacity – 0.35 when disabled, 1 when enabled.
pointerEvents – "none" when disabled, "auto" when enabled.
Feel free to adjust these values or add additional visual cues (e.g., background colour) by editing the disableAttack and enableAttack functions.

## Debugging

All major actions emit console.log statements prefixed with tags such as [FACTION] or Scorecap. Open the browser’s developer console to trace execution, view fetched data, and spot errors (e.g., failed API calls or malformed JSON).

## Important Notes

API Key Required – Without inserting a valid Torn API key, the script cannot retrieve the score via the API and will rely solely on the DOM method, which may be less reliable during page changes.
CORS & Permissions – The script declares @grant GM_xmlhttpRequest and @connect entries for the external JSON host and api.torn.com. Ensure your userscript manager permits cross‑origin requests.
Score‑Cap JSON Structure – The remote JSON must contain at least { "active": true, "scorecap": 12345 }. Any additional fields are ignored.

## License & Attribution

Author: Kochaff3
Version: 1.20.1 (as of the script header)
