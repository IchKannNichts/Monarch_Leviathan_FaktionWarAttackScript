// ==UserScript==
// @name         Monarch_Leviathan_FaktionWarAttackScript
// @namespace    https://github.com/IchKannNichts/Monarch_Leviathan_FaktionWarAttackScript
// @version      2.5.7
// @description  Hard‑locks the attack button on load and unlocks only if target is not blacklisted.
// @author       Kochaff3
// @match        https://www.torn.com/profiles.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.torn.com
// @connect      koyeb.app
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    /* ==============================================================
       0️⃣  Konstanten & Speicher‑Keys
       ============================================================== */
    const CONFIG = {
        TORN_FACTION_ID:   '40518',
        ATTACKABLE_URL:    'https://outside-avril-hobbyprojectme-914f8088.koyeb.app/api/factions/non-attackable',
        KEY_STORAGE:       'warattack_torn_api_key',
        CACHE_STORAGE:     'warattack_blacklist_cache',          // permanent, ohne Family‑Einträge
        FAMILY_STORE:      'warattack_family_faction_store',     // permanent, nur Family‑Factions
        CHECK_INTERVAL_MS: 10000,
    };

    /* ==============================================================
       1️⃣  CSS – Grund‑Lock + grünes X‑Overlay
       ============================================================== */
    GM_addStyle(`
        /* Grund‑Lock: alles grau und nicht anklickbar (ohne !important) */
        [id^="button0-profile-"] {
            opacity: 0.15;
            pointer-events: none;
            filter: grayscale(100%);
            transition: opacity 0.2s ease;
            position: relative;
        }

        .warattack-allowed {
            opacity: 1 !important;
            pointer-events: auto !important;
            filter: none !important;
        }

        /* Overlay für Family‑Factions – grünes X */
        .warattack-family::after {
            content: "✖";
            color: #00ff00;
            font-size: 2rem;
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }
    `);

    /* ==============================================================
       2️⃣  Laufzeit‑State
       ============================================================== */
    const state = {
        apiKey:          localStorage.getItem(CONFIG.KEY_STORAGE),
        targetFactionId: null,
        lastReason:      null,   // speichert den Grund, falls es ein Family‑X ist
    };

    /* ==============================================================
       3️⃣  UI‑Update‑Funktion
       ============================================================== */
    function updateUI(isBlocked, reason = '') {
        const btn = document.querySelector('[id^="button0-profile-"]');
        if (!btn) return;

        // Reset aller Klassen & Inline‑Styles
        btn.classList.remove('warattack-allowed', 'warattack-family');
        btn.title = '';
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        btn.style.filter = 'none';

        if (isBlocked) {
            // ---------- Family Faction (grünes X, aktiv) ----------
            if (reason === 'Family Faction') {
                btn.classList.add('warattack-family');
                btn.title = `BLOCKED (Family Faction): ${reason}`;
                state.lastReason = reason;

                // Persistente Speicherung im Family‑Store
                const famStore = JSON.parse(localStorage.getItem(CONFIG.FAMILY_STORE) || '[]');
                if (!famStore.includes(state.targetFactionId)) {
                    famStore.push(state.targetFactionId);
                    localStorage.setItem(CONFIG.FAMILY_STORE, JSON.stringify(famStore));
                }
            }
            // ---------- normale Blacklist (graues Overlay) ----------
            else {
                btn.title = `BLOCKED: ${reason}`;
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.15';
                btn.style.filter = 'grayscale(100%)';
                state.lastReason = null;
            }
        } else {
            // ---------- kein Block (freigeschaltet) ----------
            btn.classList.add('warattack-allowed');
            btn.title = 'Target is attackable';
            state.lastReason = null;
        }
    }

    /* ==============================================================
       4️⃣  Click‑Handler für das grüne X (Family Faction)
       ============================================================== */
    function attachFamilyClickHandler() {
        const btn = document.querySelector('[id^="button0-profile-"]');
        if (!btn) return;

        btn.removeEventListener('click', familyClickListener);
        if (state.lastReason === 'Family Faction') {
            btn.addEventListener('click', familyClickListener);
        }
    }

    function familyClickListener(e) {
        if (!e.currentTarget.classList.contains('warattack-family')) return;

        e.stopPropagation();
        e.preventDefault();

        const confirmed = confirm('Are you sure you want to attack this person?');
        if (confirmed) {
            // X entfernen, Button aktivieren und echten Klick auslösen
            e.currentTarget.classList.remove('warattack-family');
            e.currentTarget.classList.add('warattack-allowed');

            const newClick = new MouseEvent('click', { bubbles: true, cancelable: true });
            e.currentTarget.dispatchEvent(newClick);
        }
        // bei Abbruch bleibt das X erhalten – nichts weiter tun
    }

    /* ==============================================================
       5️⃣  Hauptlogik – getrennte Stores + Live‑API
       ============================================================== */
    async function checkLogic() {
        // ---- Ziel‑Fraktion ermitteln ----
        const factionLink = document.querySelector('a[href*="factions.php?step=profile&ID="]');
        state.targetFactionId = factionLink
            ? factionLink.href.match(/ID=(\d+)/)?.[1]
            : null;

        // ---- Kein Fraktionsprofil → immer attackierbar ----
        if (!state.targetFactionId) {
            updateUI(false);
            attachFamilyClickHandler();
            return;
        }

        // ---- Family‑Store prüfen (grünes X, aktiv) ----
        const familyStore = JSON.parse(localStorage.getItem(CONFIG.FAMILY_STORE) || '[]');
        if (familyStore.includes(state.targetFactionId)) {
            updateUI(true, 'Family Faction');
            attachFamilyClickHandler();
            return; // kein API‑Call nötig
        }

        // ---- Blacklist‑Cache prüfen (normale Block‑Einträge) ----
        const cached = localStorage.getItem(CONFIG.CACHE_STORAGE);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const blk = parsed.data.nonAttackableFactions.find(
                    f => String(f.FactionId) === String(state.targetFactionId)
                );
                if (blk) {
                    updateUI(true, blk.Reason); // Reason ist hier NICHT „Family Faction“
                } else {
                    updateUI(false);
                }
                attachFamilyClickHandler();
            } catch (e) {
                console.warn('[WarAttack] Cache parse error', e);
            }
        }

        // ---- Live‑API‑Abfrage (benötigt API‑Key) ----
        if (!state.apiKey) return;

        GM_xmlhttpRequest({
            method: 'GET',
            url: `${CONFIG.ATTACKABLE_URL}?faction=${CONFIG.TORN_FACTION_ID}&key=${state.apiKey}`,
            onload: res => {
                try {
                    const data = JSON.parse(res.responseText);

                    // --------- Trennen der Ergebnisse ----------
                    const familyIds = [];
                    const blacklistEntries = [];

                    data.nonAttackableFactions.forEach(entry => {
                        if (entry.Reason === 'Family Faction') {
                            familyIds.push(entry.FactionId);
                        } else {
                            blacklistEntries.push(entry);
                        }
                    });

                    // ---- Persistenter Blacklist‑Cache (ohne Family‑Einträge) ----
                    localStorage.setItem(
                        CONFIG.CACHE_STORAGE,
                        JSON.stringify({ data: { nonAttackableFactions: blacklistEntries } })
                    );

                    // ---- Family‑Store aktualisieren (nur neue IDs) ----
                    if (familyIds.length > 0) {
                        const existingFam = new Set(JSON.parse(localStorage.getItem(CONFIG.FAMILY_STORE) || '[]'));
                        familyIds.forEach(id => existingFam.add(String(id)));
                        localStorage.setItem(CONFIG.FAMILY_STORE, JSON.stringify(Array.from(existingFam)));
                    }

                    // ---- UI für das aktuelle Ziel setzen ----
                    const blk = data.nonAttackableFactions.find(
                        f => String(f.FactionId) === String(state.targetFactionId)
                    );

                    if (blk) {
                        updateUI(true, blk.Reason);
                    } else {
                        updateUI(false);
                    }
                    attachFamilyClickHandler();
                } catch (e) {
                    console.error('[WarAttack] API response error', e);
                }
            }
        });
    }

    /* ==============================================================
       6️⃣  DOM‑Beobachter – wartet auf den Attack‑Button
       ============================================================== */
    const observer = new MutationObserver(() => {
        const btn = document.querySelector('[id^="button0-profile-"]');
        if (btn) checkLogic();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Initialer Aufruf + periodische Aktualisierung
    checkLogic();
    setInterval(checkLogic, CONFIG.CHECK_INTERVAL_MS);

    /* ==============================================================
       7️⃣  API‑Key‑Prompt (einmalig)
       ============================================================== */
    if (!state.apiKey) {
        const key = prompt('Please enter your Torn API Key:');
        if (key) {
            localStorage.setItem(CONFIG.KEY_STORAGE, key);
            location.reload();
        }
    }
})();
