// ==UserScript==
// @name         Monarch_Leviathan_FaktionWarAttackScript
// @version      1.20.2
// @description  Deactivate the attack button when the score cap is reached (API-based)
// @author       Kochaff3
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @connect      deinserver.de
// @connect      api.torn.com
// @updateURL    https://raw.githubusercontent.com/IchKannNichts/Monarch_Leviathan_FaktionWarAttackScript/main/WarAttackScript.user.js
// @downloadURL  https://raw.githubusercontent.com/IchKannNichts/Monarch_Leviathan_FaktionWarAttackScript/main/WarAttackScript.user.js
// ==/UserScript==

(function () {
    'use strict';

    /* --------------------------------------------------------------
       CONFIGURATION
    -------------------------------------------------------------- */
    const SCORECAP_URL      = 'https://outside-avril-hobbyprojectme-914f8088.koyeb.app/api/factions/non-attackable?usrId=3865367';
    const CHECK_INTERVAL    = 5000;
    const SCORECAP_REFRESH  = 10000;
    const TORN_API_KEY      = 'API-Key'; //Limited Access
    const TORN_FACTION_ID   = '40518';

    /* --------------------------------------------------------------
       STATUS
    -------------------------------------------------------------- */
    let cachedProfileId = null;
    let capActive       = false;
    let scoreCapReach   = false;

    console.log(' Script geladen');

    /* --------------------------------------------------------------
       PROFIL‑ID read
    -------------------------------------------------------------- */
    function getProfileId() {
        const el = document.getElementById('skip-to-content');
        if (!el) {
            console.log(' skip-to-content NICHT gefunden');
            return null;
        }
        console.log(' skip-to-content Text:', el.innerText);

        const match = el.innerText.match(/\[(\d+)\]/);
        if (!match) {
            console.log(' Keine ID in eckigen Klammern gefunden');
            return null;
        }
        console.log(' Profil-ID erfolgreich ausgelesen:', match[1]);
        return match[1];
    }

    /* --------------------------------------------------------------
       BUTTON Search / ACTION
    -------------------------------------------------------------- */
    function findAttackButton(profileId) {
        const btn = document.getElementById(`button0-profile-${profileId}`);
        if (!btn) console.log(' Attack‑Button NICHT gefunden');
        return btn;
    }

    function disableAttack(profileId) {
        const btn = findAttackButton(profileId);
        if (!btn) return;
        btn.classList.remove('active');
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.35';
        btn.title = `Scorecap (${scoreCapValue}) erreicht`;
        console.log(' Attack‑Button deaktiviert');
    }

    function enableAttack(profileId) {
        const btn = findAttackButton(profileId);
        if (!btn) return;
        btn.classList.add('active');
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        btn.title = '';
        console.log(' Attack‑Button aktiviert');
    }

    /* --------------------------------------------------------------
      GET Information
    -------------------------------------------------------------- */
    function fetchScorecap() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: SCORECAP_URL,
            onload: function (response) {
                try {
                    const data = JSON.parse(response.responseText);
                    const factionReasonMap = data.nonAttackableFactions.reduce((result, faction) => {
                      result[faction.FactionId] = faction.Reason;
                      return result;
                    }, {});
                    console.log(' Discord‑Daten geladen:', factionReasonMap);
                    Object.keys(factionReasonMap).forEach(factionId => {
                      const reason = factionReasonMap[factionId];
                      if(reason === "War score reached"){
                         scoreCapReach = true;
                      }
                    console.log("FactionId: ${factionId}, Reason: ${reason}")};
                } catch (e) {
                    console.log(' Fehler beim Parsen der Discord‑JSON');
                }
            },
            onerror: function () {
                console.log(' Fehler beim Laden der Scorecap‑URL');
            }
        });
    }

    /* --------------------------------------------------------------
       FACTION SCORE from TornApi (mit Fallback)
    -------------------------------------------------------------- */
    async function getFactionScore() {
        // -----------------------------------------------------------------
        // 1 API‑Versuch (vollständige Fraktions‑Daten inkl. ranked_wars)
        // -----------------------------------------------------------------
        const endpoint = `https://api.torn.com/faction/${TORN_FACTION_ID}?selections=rankedwars,basic&key=${TORN_API_KEY}`;
        //  → `rankedwars` muss als Auswahl‑Parameter angegeben werden, damit das Feld
        //    `ranked_wars` im JSON enthalten ist.
        try {
            const resp = await fetch(endpoint);
            if (!resp.ok) {
                console.warn('API‑Antwort nicht OK:', resp.status);
            } else {
                const json = await resp.json();

                // -------------------------------------------------------------
                // Hilfsfunktion: sucht in allen Ranked‑Wars nach deiner Fraktion
                // -------------------------------------------------------------
                const findMyFactionInfo = (data, factionId) => {
                    const fid = String(factionId);
                    const wars = data.ranked_wars || {};

                    for (const warKey of Object.keys(wars)) {
                        const myFaction = wars[warKey].factions?.[fid];
                        if (myFaction) {
                            return {
                                name : myFaction.name,
                                score: Number(myFaction.score),
                                chain: Number(myFaction.chain)
                            };
                        }
                    }
                    return null; // keine passende War gefunden
                };

                const myInfo = findMyFactionInfo(json, TORN_FACTION_ID);
                if (myInfo && !isNaN(myInfo.score)) {
                    console.log('Score aus API (Ranked‑War):', myInfo.score);
                    return myInfo.score;
                }

                // Falls die Fraktion nicht in einem Ranked‑War ist, kann das normale
                // `basic`‑Feld `score` (Gesamt‑Fraktions‑Score) verwendet werden:
                if (json.score !== undefined) {
                    const apiScore = Number(json.score);
                    if (!isNaN(apiScore)) {
                        console.log('Score aus API (basic):', apiScore);
                        return apiScore;
                    }
                }
            }
        } catch (err) {
            console.error('Fehler beim API‑Call:', err);
        }

        // -----------------------------------------------------------------
        // 2 DOM‑Fallback
        // -----------------------------------------------------------------
        const span = document.querySelector('span.right.scoreText___uVRQm.currentFaction___Omz6o');
        if (!span) {
            console.log('Score‑Span nicht gefunden – kein Score verfügbar');
            return null;
        }
        const txt = span.innerText.replace(/,/g, '').trim();
        const value = parseInt(txt, 10);
        if (isNaN(value)) {
            console.log('Ungültiger Score‑Text im DOM:', span.innerText);
            return null;
        }
        console.log('Score aus DOM:', value);
        return value;
    }

    /* --------------------------------------------------------------
       Main logic
    -------------------------------------------------------------- */
    async function mainLoop() {
        const profileId = getProfileId();
        if (!profileId) return;
        cachedProfileId = profileId;

        if (!capActive) {
            console.log(' Scorecap nicht aktiv');
            enableAttack(profileId);
            return;
        }

        if (scoreCapReach) {
            console.log(' SCORECAP ERREICHT');
            disableAttack(profileId);
        } else {
            console.log(' Unter Scorecap');
            enableAttack(profileId);
        }
    }

    /* --------------------------------------------------------------
       TIMER
    -------------------------------------------------------------- */
    setInterval(fetchScorecap, SCORECAP_REFRESH);
    setInterval(() => {
        mainLoop().catch(err => console.error(' Fehler im mainLoop:', err));
    }, CHECK_INTERVAL);
})();
