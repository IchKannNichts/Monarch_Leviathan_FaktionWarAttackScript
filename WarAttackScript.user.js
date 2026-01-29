// ==UserScript==
// @name         Monarch_Leviathan_FaktionWarAttackScript
// @namespace    https://github.com/IchKannNichts/Monarch_Leviathan_FaktionWarAttackScript
// @version      2.3.1
// @description  Disables the attack button when the external API returns isAttackable = false. Shows a prompt for a Limited‑Access Torn API key on first run.
// @author       Kochaff3
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @connect      api.torn.com
// @connect      your-external-api.example.com   // <-- replace with the domain of your isAttackable API
// @run-at       document-end
// ==/UserScript==

(() => {
    'use strict';

    /** --------------------------------------------------------------
     *  CONSTANTS – change only here if needed
     *  ----------------------------------------------------------- */
    const CONFIG = Object.freeze({
        // ---- Torn API -------------------------------------------------
        TORN_FACTION_ID:   '40518',               // your faction ID
        // ---- External "isAttackable" API -------------------------------
        ATTACKABLE_URL:    'https://your-external-api.example.com/check', // <-- adjust!
        // ---- Miscellaneous --------------------------------------------
        REQUEST_TIMEOUT_MS: 8000,
        LOCAL_STORAGE_KEY:  'warattack_torn_api_key', // key used in localStorage
        CHECK_INTERVAL_MS: 3000,   // how often the API is queried (3 seconds)
    });

    /** --------------------------------------------------------------
     *  LOGGING HELPERS
     *  ----------------------------------------------------------- */
    const log  = (...a) => console.log('[WarAttack]', ...a);
    const warn = (...a) => console.warn('[WarAttack]', ...a);
    const err  = (...a) => console.error('[WarAttack]', ...a);

    /** --------------------------------------------------------------
     *  INTERNAL STATE
     *  ----------------------------------------------------------- */
    const state = {
        apiKey: null,                 // loaded from localStorage or the prompt
        profileId: null,
        attackBtn: null,
    };

    /** --------------------------------------------------------------
     *  UTILITY FUNCTIONS
     *  ----------------------------------------------------------- */
    // fetch with timeout (works in Tampermonkey/Greasemonkey)
    const fetchWithTimeout = async (url, opts = {}) => {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), CONFIG.REQUEST_TIMEOUT_MS);
        try {
            const resp = await fetch(url, { ...opts, signal: ctrl.signal });
            clearTimeout(timeout);
            return resp;
        } catch (e) {
            clearTimeout(timeout);
            throw e;
        }
    };

    // Add a CSS class for the disabled state (once)
    GM_addStyle(`
        .warattack-disabled {
            opacity: 0.35 !important;
            pointer-events: none !important;
        }
    `);

    /** --------------------------------------------------------------
     *  API‑KEY PROMPT
     *  ----------------------------------------------------------- */
    const showApiKeyPrompt = () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.6);display:flex;align-items:center;
            justify-content:center;z-index:99999;
        `;
        const modal = document.createElement('div');
        modal.style.cssText = `
            background:#fff;padding:20px;border-radius:8px;
            max-width:420px;width:90%;box-shadow:0 2px 12px rgba(0,0,0,.3);
            font-family:Arial,sans-serif;
        `;
        modal.innerHTML = `
            <h2 style="margin-top:0;">Enter your Torn API‑Key</h2>
            <p>Please paste a <strong>Limited Access</strong> API key here (found under <em>Settings → API</em> in the game).</p>
            <input id="warattack-key-inp" type="text" placeholder="API‑Key" style="width:100%;padding:8px;margin:10px 0;font-size:14px;">
            <div style="text-align:right;">
                <button id="warattack-save-btn" style="padding:6px 12px;">Save</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const inp = modal.querySelector('#warattack-key-inp');
        const btn = modal.querySelector('#warattack-save-btn');

        btn.onclick = () => {
            const val = inp.value.trim();
            if (!val) {
                alert('Please enter a valid API key.');
                return;
            }
            localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, val);
            state.apiKey = val;
            document.body.removeChild(overlay);
            log('API key saved, starting script...');
            initAfterKey(); // continue with the main workflow
        };
    };

    /** --------------------------------------------------------------
     *  CORE FUNCTIONS
     *  ----------------------------------------------------------- */

    // 1️⃣ Extract the profile ID from the hidden element
    const getProfileId = () => {
        const el = document.getElementById('skip-to-content');
        if (!el) { warn('#skip-to-content not found'); return null; }
        const m = el.innerText.match(/\[(\d+)]/);
        return m ? m[1] : null;
    };

    // 2️⃣ Find the attack button for the current profile
    const findAttackButton = (pid) => document.querySelector(`#button0-profile-${pid}`);

    // 3️⃣ UI helpers
    const enableAttack = (reason = '') => {
        if (!state.attackBtn) return;
        state.attackBtn.classList.remove('warattack-disabled', 'active');
        state.attackBtn.title = reason;
    };
    const disableAttack = (reason = '') => {
        if (!state.attackBtn) return;
        state.attackBtn.classList.add('warattack-disabled');
        state.attackBtn.classList.remove('active');
        state.attackBtn.title = reason || 'Disabled';
    };

    // 4️⃣ Query the external isAttackable API
    const fetchIsAttackable = async () => {
        // Example URL: …/check?faction=40518&key=YOUR_KEY
        const url = `${CONFIG.ATTACKABLE_URL}?faction=${CONFIG.TORN_FACTION_ID}&key=${state.apiKey}`;
        try {
            const resp = await fetchWithTimeout(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json(); // expected { isAttackable: bool, Reason?: string }
            return {
                allowed: Boolean(data.isAttackable),
                reason:  data.Reason || '',
            };
        } catch (e) {
            warn('Error while calling isAttackable API:', e);
            // In doubt we allow the attack so the script does not block unnecessarily
            return { allowed: true, reason: '' };
        }
    };

    // 5️⃣ Main loop – runs regularly
    const mainLoop = async () => {
        // Ensure we have the profile ID and the button reference
        if (!state.profileId) {
            state.profileId = getProfileId();
            if (!state.profileId) return; // nothing to do without a profile
        }
        if (!state.attackBtn) {
            state.attackBtn = findAttackButton(state.profileId);
            if (!state.attackBtn) {
                warn('Attack button not found for profile', state.profileId);
                return;
            }
        }

        // Ask the external service whether attacking is allowed
        const { allowed, reason } = await fetchIsAttackable();

        if (allowed) {
            enableAttack(); // button active, clear any tooltip
        } else {
            const tooltip = reason ? `Blocked externally: ${reason}` : 'Blocked externally';
            disableAttack(tooltip);
        }
    };

    /** --------------------------------------------------------------
     *  INITIALISATION
     *  ----------------------------------------------------------- */
    const initAfterKey = async () => {
        // Run the first check immediately, then continue on an interval
        await mainLoop();
        setInterval(mainLoop, CONFIG.CHECK_INTERVAL_MS);
        log('WarAttackScript (isAttackable‑only) started.');
    };

    const start = () => {
        const stored = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
        if (stored) {
            state.apiKey = stored;
            log('Found API key in storage, starting immediately.');
            initAfterKey();
        } else {
            log('No API key found – showing input dialog.');
            showApiKeyPrompt();
        }
    };

    // Entry point
    start();

})();
