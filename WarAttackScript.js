// ==UserScript==
// @name         Torn Discord Scorecap Blocker
// @namespace    torn-discord-scorecap
// @version      1.1
// @description  Deaktiviert den Attack-Button sobald die Discord-Scorecap erreicht ist
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @connect      deinserver.de
// ==/UserScript==

(function () {
    'use strict';

    /***********************
     * KONFIG
     ***********************/

    const SCORECAP_URL = 'https://deinserver.de/scorecap.json';
    const CHECK_INTERVAL = 15000;

    /***********************
     * BUTTON HANDLING
     ***********************/

    function getAttackButton() {
        return document.querySelector(
            '.profile-button.profile-button-attack'
        );
    }

    function disableAttackButton() {
        const btn = getAttackButton();
        if (!btn) return;

        btn.classList.remove('active');
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.35';
        btn.title = 'Scorecap erreicht – Angriffe gestoppt';
    }

    function enableAttackButton() {
        const btn = getAttackButton();
        if (!btn) return;

        btn.classList.add('active');
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        btn.title = '';
    }

    /***********************
     * SCORECAP CHECK
     ***********************/

    function fetchScorecap(callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: SCORECAP_URL + '?t=' + Date.now(),
            onload: function (response) {
                try {
                   //const data = JSON.parse(response.responseText);
                    const data = 7200;
                    callback(data);
                } catch (e) {}
            }
        });
    }

    function getCurrentFactionScore() {
        const el = document.querySelector('.faction-war-score');
        if (!el) return null;

        return parseInt(el.innerText.replace(/,/g, ''), 10);
    }

    function checkCap() {
        fetchScorecap(data => {
            if (!data.active) {
                enableAttackButton();
                return;
            }

            const currentScore = getCurrentFactionScore();
            if (currentScore === null) return;

            if (currentScore >= data.scorecap) {
                disableAttackButton();
            } else {
                enableAttackButton();
            }
        });
    }

    setInterval(checkCap, CHECK_INTERVAL);
})();
