// ==UserScript==
// @name         Monarch_Leviathan_FaktionWarAttackScript
// @namespace    https://github.com/IchKannNichts/Monarch_Leviathan_FaktionWarAttackScript
// @version      2.5.0
// @description  Disables the attack button based on cached and live blacklist data.
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

    const CONFIG = Object.freeze({
        TORN_FACTION_ID:    '40518',
        ATTACKABLE_URL:     'https://outside-avril-hobbyprojectme-914f8088.koyeb.app/api/factions/non-attackable',
        REQUEST_TIMEOUT_MS: 8000,
        KEY_STORAGE:        'warattack_torn_api_key',
        CACHE_STORAGE:      'warattack_blacklist_cache', // Key for caching the API response
        CHECK_INTERVAL_MS:  10000,
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
    
    const fetchWithTimeout = (url) => {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                timeout: CONFIG.REQUEST_TIMEOUT_MS,
                onload: (response) => {
                    try {
                        const data = JSON.parse(response.responseText);
                        // Save to cache on successful fetch
                        localStorage.setItem(CONFIG.CACHE_STORAGE, JSON.stringify({
                            timestamp: Date.now(),
                            data: data
                        }));
                        resolve(data);
                    } catch(e) { reject(e); }
                },
                ontimeout: () => reject(new Error("Request Timeout")),
                onerror: (err) => reject(err)
            });
        });
    };

    GM_addStyle(`
        .warattack-disabled {
            opacity: 0.15 !important;
            pointer-events: none !important;
            filter: grayscale(100%);
            cursor: not-allowed !important;
        }
    `);

    /** --------------------------------------------------------------
     * CORE LOGIC
     * ----------------------------------------------------------- */

    const getTargetFactionId = () => {
        const factionLink = document.querySelector('a[href*="factions.php?step=profile&ID="]');
        if (!factionLink) return null;
        const m = factionLink.href.match(/ID=(\d+)/);
        return m ? m[1] : null;
    };

    const getProfileId = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('XID');
    };

    // New Function: Apply status based on a data object (either cached or live)
    const updateButtonStatus = (data) => {
        if (!state.attackBtn || !state.targetFactionId || !data || !data.nonAttackableFactions) return;

        const blacklisted = data.nonAttackableFactions.find(
            f => String(f.FactionId) === String(state.targetFactionId)
        );

        if (blacklisted) {
            state.attackBtn.classList.add('warattack-disabled');
            state.attackBtn.title = `BLOCKED: ${blacklisted.Reason}`;
        } else {
            state.attackBtn.classList.remove('warattack-disabled');
            state.attackBtn.title = "Target is attackable";
        }
    };

    const mainLoop = async () => {
        state.targetProfileId = getProfileId();
        if (!state.targetProfileId) return;

        state.targetFactionId = getTargetFactionId();
        state.attackBtn = document.querySelector(`#button0-profile-${state.targetProfileId}`);

        if (!state.attackBtn) return;

        // 1. Instant check using Cache (if exists)
        const cached = localStorage.getItem(CONFIG.CACHE_STORAGE);
        if (cached) {
            try {
                const parsedCache = JSON.parse(cached);
                updateButtonStatus(parsedCache.data);
            } catch (e) { warn("Cache corrupted"); }
        }

        // 2. Live fetch for update
        try {
            const url = `${CONFIG.ATTACKABLE_URL}?faction=${CONFIG.TORN_FACTION_ID}&key=${state.apiKey}`;
            const liveData = await fetchWithTimeout(url);
            updateButtonStatus(liveData);
        } catch (e) {
            warn('API live update failed:', e);
        }
    };

    /** --------------------------------------------------------------
     * INITIALIZATION
     * ----------------------------------------------------------- */

    const start = () => {
        const stored = localStorage.getItem(CONFIG.KEY_STORAGE);
        if (stored) {
            state.apiKey = stored;
            // Immediate run
            mainLoop();
            // Set interval
            setInterval(mainLoop, CONFIG.CHECK_INTERVAL_MS);
        } else {
            const key = prompt("Please enter your Torn Limited Access API Key:");
            if (key) {
                localStorage.setItem(CONFIG.KEY_STORAGE, key);
                location.reload();
            }
        }
    };

    start();
})();
