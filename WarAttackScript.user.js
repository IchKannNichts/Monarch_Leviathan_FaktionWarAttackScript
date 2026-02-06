// ==UserScript==
// @name         Monarch_Leviathan_FaktionWarAttackScript
// @namespace    https://github.com/IchKannNichts/Monarch_Leviathan_FaktionWarAttackScript
// @version      2.5.1
// @description  Hard-locks the attack button on load and unlocks only if target is not blacklisted using cache.
// @author       Kochaff3
// @match        https://www.torn.com/profiles.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.torn.com
// @connect      koyeb.app
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        TORN_FACTION_ID:    '40518',
        ATTACKABLE_URL:     'https://outside-avril-hobbyprojectme-914f8088.koyeb.app/api/factions/non-attackable',
        KEY_STORAGE:        'warattack_torn_api_key',
        CACHE_STORAGE:      'warattack_blacklist_cache',
        CHECK_INTERVAL_MS:  10000,
    };

    /**
     * 1. PRE-EMPTIVE CSS LOCK
     * This CSS is injected immediately at document-start.
     * It ensures the button is disabled by default as soon as it appears.
     */
    GM_addStyle(`
        [id^="button0-profile-"] { 
            opacity: 0.15 !important; 
            pointer-events: none !important; 
            filter: grayscale(100%) !important;
            transition: opacity 0.2s ease;
        }
        /* This class will be added only if the check passes */
        .warattack-allowed { 
            opacity: 1 !important; 
            pointer-events: auto !important; 
            filter: none !important;
        }
    `);

    let state = {
        apiKey: localStorage.getItem(CONFIG.KEY_STORAGE),
        targetFactionId: null
    };

    /**
     * Updates the button UI based on the evaluation
     */
    const updateUI = (isBlocked, reason = "") => {
        const btn = document.querySelector('[id^="button0-profile-"]');
        if (!btn) return;

        if (isBlocked) {
            btn.classList.remove('warattack-allowed');
            btn.title = `BLOCKED: ${reason}`;
        } else {
            btn.classList.add('warattack-allowed');
            btn.title = "Target is attackable";
        }
    };

    /**
     * The main logic that checks cache and triggers live updates
     */
    const checkLogic = async () => {
        // Find target faction ID in the DOM
        const factionLink = document.querySelector('a[href*="factions.php?step=profile&ID="]');
        state.targetFactionId = factionLink ? factionLink.href.match(/ID=(\d+)/)?.[1] : null;

        // If no faction, target is always attackable
        if (!state.targetFactionId) {
            updateUI(false);
            return;
        }

        // 2. CHECK CACHE (Instant reaction)
        const cached = localStorage.getItem(CONFIG.CACHE_STORAGE);
        let blacklistedInCache = null;

        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                blacklistedInCache = parsed.data.nonAttackableFactions.find(
                    f => String(f.FactionId) === String(state.targetFactionId)
                );
                
                // Immediately apply cache status
                updateUI(!!blacklistedInCache, blacklistedInCache?.Reason || "");
            } catch (e) {
                console.warn('[WarAttack] Cache error', e);
            }
        }

        // 3. LIVE UPDATE (Background)
        // We only do this if we haven't checked recently or to keep the cache fresh
        if (!state.apiKey) return;
        
        GM_xmlhttpRequest({
            method: "GET",
            url: `${CONFIG.ATTACKABLE_URL}?faction=${CONFIG.TORN_FACTION_ID}&key=${state.apiKey}`,
            onload: (res) => {
                try {
                    const data = JSON.parse(res.responseText);
                    // Update cache for the next page load
                    localStorage.setItem(CONFIG.CACHE_STORAGE, JSON.stringify({ data }));
                    
                    const blacklisted = data.nonAttackableFactions.find(
                        f => String(f.FactionId) === String(state.targetFactionId)
                    );
                    updateUI(!!blacklisted, blacklisted?.Reason);
                } catch (e) {
                    console.error('[WarAttack] API Response error');
                }
            }
        });
    };

    /**
     * Observe the DOM for the button to appear
     */
    const observer = new MutationObserver(() => {
        const btn = document.querySelector('[id^="button0-profile-"]');
        if (btn) checkLogic();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Initial check
    checkLogic();

    // Regular update interval (10s)
    setInterval(checkLogic, CONFIG.CHECK_INTERVAL_MS);

    // API Key Prompt
    if (!state.apiKey) {
        const key = prompt("Please enter your Torn API Key:");
        if (key) {
            localStorage.setItem(CONFIG.KEY_STORAGE, key);
            location.reload();
        }
    }
})();
