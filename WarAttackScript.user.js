// ==UserScript==
// @name         Monarch_Leviathan_FaktionWarAttackScript
// @namespace    https://github.com/IchKannNichts/Monarch_Leviathan_FaktionWarAttackScript
// @version      2.4.1
// @description  Disables the attack button based on a list of non-attackable faction IDs from an external API.
// @author       Kochaff3
// @match        https://www.torn.com/profiles.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @connect      api.torn.com
// @connect      koyeb.app
// @run-at       document-end
// ==/UserScript==

(() => {
    'use strict';

    /** --------------------------------------------------------------
     * CONFIGURATIONS
     * ----------------------------------------------------------- */
    const CONFIG = Object.freeze({
        TORN_FACTION_ID:    '40518',
        ATTACKABLE_URL:     'https://outside-avril-hobbyprojectme-914f8088.koyeb.app/api/factions/non-attackable',
        REQUEST_TIMEOUT_MS: 8000,
        LOCAL_STORAGE_KEY:  'warattack_torn_api_key',
        CHECK_INTERVAL_MS:  10000, // Set to 10 seconds as requested
    });

    const log  = (...a) => console.log('[WarAttack]', ...a);
    const warn = (...a) => console.warn('[WarAttack]', ...a);

    const state = {
        apiKey: null,
        targetProfileId: null,
        targetFactionId: null,
        attackBtn: null,
    };

    /** --------------------------------------------------------------
     * UTILITIES
     * ----------------------------------------------------------- */

    // Wrapper for GM_xmlhttpRequest to bypass CSP and handle timeouts
    const fetchWithTimeout = (url) => {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                timeout: CONFIG.REQUEST_TIMEOUT_MS,
                onload: (response) => {
                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch(e) { reject(e); }
                },
                ontimeout: () => reject(new Error("Request Timeout")),
                onerror: (err) => reject(err)
            });
        });
    };

    // Styling for the disabled button state
    GM_addStyle(`
        .warattack-disabled {
            opacity: 0.2 !important;
            pointer-events: none !important;
            filter: grayscale(100%);
        }
    `);

    /** --------------------------------------------------------------
     * HELPER FUNCTIONS
     * ----------------------------------------------------------- */
    // Extracts the Faction ID from the profile page links
    const getTargetFactionId = () => {
        const factionLink = document.querySelector('a[href*="factions.php?step=profile&ID="]');
        if (!factionLink) return null;
        const m = factionLink.href.match(/ID=(\d+)/);
        return m ? m[1] : null;
    };

    // Extracts the Profile ID (XID) from the URL
    const getProfileId = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('XID');
    };

    /** --------------------------------------------------------------
     * MAIN LOGIC
     * ----------------------------------------------------------- */
    const mainLoop = async () => {
        state.targetProfileId = getProfileId();
        if (!state.targetProfileId) return;

        // Try to find the attack button and the target's faction
        state.targetFactionId = getTargetFactionId();
        state.attackBtn = document.querySelector(`#button0-profile-${state.targetProfileId}`);

        if (!state.attackBtn) return;

        // If the target has no faction, they cannot be on the blacklist
        if (!state.targetFactionId) {
            state.attackBtn.classList.remove('warattack-disabled');
            state.attackBtn.title = "";
            return;
        }

        try {
            const url = `${CONFIG.ATTACKABLE_URL}?faction=${CONFIG.TORN_FACTION_ID}&key=${state.apiKey}`;
            const data = await fetchWithTimeout(url);

            // Check if the target's faction ID exists in the nonAttackableFactions array
            if (data && data.nonAttackableFactions) {
                const blacklistedFaction = data.nonAttackableFactions.find(
                    f => String(f.FactionId) === String(state.targetFactionId)
                );

                if (blacklistedFaction) {
                    // Disable button and show the reason in the tooltip
                    state.attackBtn.classList.add('warattack-disabled');
                    state.attackBtn.title = `BLOCKED: ${blacklistedFaction.Reason}`;
                    log(`Attack blocked: ${blacklistedFaction.FactionName} (${blacklistedFaction.Reason})`);
                } else {
                    // Enable button if faction is not blacklisted
                    state.attackBtn.classList.remove('warattack-disabled');
                    state.attackBtn.title = "Target is attackable";
                }
            }
        } catch (e) {
            warn('API connection failed:', e);
            // In case of error, we don't block the button to avoid getting stuck
            state.attackBtn.classList.remove('warattack-disabled');
        }
    };

    /** --------------------------------------------------------------
     * ENTRY POINT
     * ----------------------------------------------------------- */
    const start = () => {
        const stored = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
        if (stored) {
            state.apiKey = stored;
            mainLoop();
            setInterval(mainLoop, CONFIG.CHECK_INTERVAL_MS);
            log('Script initialized. Interval: 10s');
        } else {
            const key = prompt("Please enter your Torn Limited Access API Key:");
            if (key) {
                localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, key);
                location.reload();
            }
        }
    };

    start();
})();
