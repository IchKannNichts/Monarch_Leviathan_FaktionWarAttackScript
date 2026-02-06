# Monarch_Leviathan_WarAttackScript – README

## Installation

1. Install a userscript manager such as **Tampermonkey**, **Greasemonkey**, or **Violentmonkey**.

2. [Install the Script](https://raw.githubusercontent.com/IchKannNichts/Monarch_Leviathan_FaktionWarAttackScript/main/WarAttackScript.user.js)

3. Save the script – it will automatically run on any page matching `https://www.torn.com/profiles.php*`.

## Overview

`WarAttackScript.user.js` is an advanced utility for the browser‑based game **Torn**. It automatically manages the accessibility of the "Attack" button on player profiles. By communicating with an external API, it identifies if a target belongs to a blacklisted faction (e.g., Family Factions or factions that have reached a specific score cap).

## Features

| Feature | Description |
|---------|-------------|
| **Instant CSS Lock** | Hard-locks the attack button the moment it appears in the DOM to prevent accidental clicks during page load. |
| **Blacklist Enforcement** | Automatically disables the button if the target's Faction ID matches an entry in the remote blacklist. |
| **Smart Caching** | Stores the latest blacklist in `localStorage` for instant reaction on page reload (F5) before the API even responds. |
| **Mutation Observation** | Uses a `MutationObserver` to detect the attack button immediately without waiting for the full page load. |
| **Reason Tooltips** | Displays the specific reason for a block (e.g., "Family Faction") as a browser tooltip on hover. |

## Configuration

The script prompts for a **Limited Access API Key** on the first run. Internal configuration can be found at the top of the script:

```js
const CONFIG = {
    // Numeric ID of your own faction
    TORN_FACTION_ID: '40518',

    // Remote API endpoint providing the blacklist JSON
    ATTACKABLE_URL: 'https://outside-avril-hobbyprojectme-914f8088.koyeb.app/api/factions/non-attackable',

    // Interval for background updates (10 seconds)
    CHECK_INTERVAL_MS: 10000,
};
```
## How It Works

1. **Security First (CSS Injection)**
   At `document-start`, the script injects a global style that sets all attack buttons to `opacity: 0.15` and `pointer-events: none`. The button is only enabled if the script explicitly grants permission.

2. **Data Fetching & Caching**
   The script fetches a JSON array from the `ATTACKABLE_URL`. This data is cached locally.
   **JSON Format:**
   ```json
   {
     "nonAttackableFactions": [
       { "FactionName": "Monarch HQ", "FactionId": 8336, "Reason": "Family Faction" },
       { "FactionName":"Example","FactionId": "XXXX", "Reason": "War score reached" },
       .... some more ....
     ]
   }
   
3. Target Identification
   The script extracts the target's Profile ID from the URL and the Faction ID from the faction link on the profile page.

4. Evaluation Loop
   - Step A: Check local cache for the target's Faction ID. If found, the button remains locked.
   - Step B: Perform a live background update to ensure the cache is fresh.
   - Step C: If the faction is not on the blacklist, the .warattack-allowed class is added, making the button clickable and fully visible.

## Debugging & Maintenance

- Console Logs: Major events are logged with the [WarAttack] prefix in the browser console (F12).
- Resetting the Key: If you need to update your API key, run the following command in the console:
  localStorage.removeItem('warattack_torn_api_key'); location.reload();
- Permissions: Ensure your script manager allows connections to koyeb.app and api.torn.com.

## License & Attribution

Author: Kochaff3  
Version: 2.5.1
