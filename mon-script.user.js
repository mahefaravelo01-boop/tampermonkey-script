// ==UserScript==
// @name         AutoClick SMMKingdom v2.5 Optimized
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  AutoClick Dashboard Pending + Tasker I'LL TAKE / BACK avec auto-refresh, pause/resume et réglage des vitesses
// @match        https://smmkingdom.com/tasker/editor/dashboard/*
// @match        https://smmkingdom.com/tasker/order/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /********************************************************
     *                    SETTINGS
     ********************************************************/

    let taskerSpeed =
        parseInt(localStorage.getItem("autoclick_taskerSpeed")) || 100;

    let dashboardSpeed =
        parseInt(localStorage.getItem("autoclick_dashboardSpeed")) || 100;

    let refreshDelay =
        parseInt(localStorage.getItem("autoclick_refreshDelay")) || 700;

    let SCRIPT_PAUSED = false;

    const isDashboard =
        window.location.pathname.includes("/tasker/editor/dashboard");

    const isTaskerPage =
        window.location.pathname.includes("/tasker/order");

    /********************************************************
     *                    POPUP UI
     ********************************************************/

    const popup = document.createElement("div");

    Object.assign(popup.style, {
        position: "fixed",
        bottom: "15px",
        left: "15px",
        background: "#111",
        color: "#00ff99",
        padding: "10px 12px",
        fontSize: "13px",
        borderRadius: "8px",
        zIndex: "999999",
        fontFamily: "monospace",
        lineHeight: "1.4",
        boxShadow: "0 0 10px rgba(0,0,0,.5)"
    });

    document.body.appendChild(popup);

    /********************************************************
     *                    STATUS
     ********************************************************/

    const textDiv = document.createElement("div");

    textDiv.innerHTML = "⚡ AutoClick running...";

    popup.appendChild(textDiv);

    /********************************************************
     *              DASHBOARD SPEED
     ********************************************************/

    const labelDash = document.createElement("label");

    labelDash.innerText = "Dashboard Pending Speed:";

    Object.assign(labelDash.style, {
        display: "block",
        fontSize: "12px",
        marginTop: "7px"
    });

    popup.appendChild(labelDash);

    const selectDash = document.createElement("select");

    [50, 100, 200, 300, 500].forEach(ms => {

        const opt = document.createElement("option");

        opt.value = ms;
        opt.textContent = ms + " ms";

        if (ms === dashboardSpeed) {
            opt.selected = true;
        }

        selectDash.appendChild(opt);
    });

    selectDash.addEventListener("change", () => {

        dashboardSpeed = parseInt(selectDash.value);

        localStorage.setItem(
            "autoclick_dashboardSpeed",
            dashboardSpeed
        );

    });

    popup.appendChild(selectDash);

    /********************************************************
     *              TASKER SPEED
     ********************************************************/

    const labelTask = document.createElement("label");

    labelTask.innerText = "I'LL TAKE Speed:";

    Object.assign(labelTask.style, {
        display: "block",
        fontSize: "12px",
        marginTop: "7px"
    });

    popup.appendChild(labelTask);

    const selectTask = document.createElement("select");

    [50, 100, 200, 300, 500, 1000].forEach(ms => {

        const opt = document.createElement("option");

        opt.value = ms;
        opt.textContent = ms + " ms";

        if (ms === taskerSpeed) {
            opt.selected = true;
        }

        selectTask.appendChild(opt);

    });

    selectTask.addEventListener("change", () => {

        taskerSpeed = parseInt(selectTask.value);

        localStorage.setItem(
            "autoclick_taskerSpeed",
            taskerSpeed
        );

        // Redémarre le système Tasker avec la nouvelle vitesse
        if (typeof restartTaskerInterval === "function") {
            restartTaskerInterval();
        }

    });

    popup.appendChild(selectTask);

    /********************************************************
     *              REFRESH DELAY
     ********************************************************/

    const labelRefresh = document.createElement("label");

    labelRefresh.innerText = "Auto-Refresh Delay:";

    Object.assign(labelRefresh.style, {
        display: "block",
        fontSize: "12px",
        marginTop: "7px"
    });

    popup.appendChild(labelRefresh);

    const selectRefresh = document.createElement("select");

    [700, 1000, 1300, 2000].forEach(ms => {

        const opt = document.createElement("option");

        opt.value = ms;
        opt.textContent = ms + " ms";

        if (ms === refreshDelay) {
            opt.selected = true;
        }

        selectRefresh.appendChild(opt);

    });

    selectRefresh.addEventListener("change", () => {

        refreshDelay = parseInt(selectRefresh.value);

        localStorage.setItem(
            "autoclick_refreshDelay",
            refreshDelay
        );

    });

    popup.appendChild(selectRefresh);

    /********************************************************
     *              PAUSE / RESUME
     ********************************************************/

    const pauseBtn = document.createElement("button");

    pauseBtn.innerText = "⏸ Pause";

    Object.assign(pauseBtn.style, {
        marginTop: "8px",
        fontSize: "12px",
        padding: "3px 7px",
        borderRadius: "4px",
        cursor: "pointer"
    });

    popup.appendChild(pauseBtn);

    pauseBtn.addEventListener("click", () => {

        SCRIPT_PAUSED = !SCRIPT_PAUSED;

        if (SCRIPT_PAUSED) {

            pauseBtn.innerText = "▶ Resume";
            textDiv.innerHTML = "⏸ Paused";

        } else {

            pauseBtn.innerText = "⏸ Pause";
            textDiv.innerHTML = "⚡ AutoClick running...";

        }

    });

    /********************************************************
     *              PROGRESS BAR
     ********************************************************/

    const progressDiv = document.createElement("div");

    progressDiv.style.marginTop = "8px";

    progressDiv.innerHTML = `
        <div style="
            width:100%;
            background:#444;
            height:8px;
            border-radius:4px;
            overflow:hidden;
        ">
            <div id="autoclick-progress-bar" style="
                width:0%;
                height:100%;
                background:#00ff00;
                border-radius:4px;
            "></div>
        </div>
    `;

    popup.appendChild(progressDiv);

    const progressBar =
        document.getElementById("autoclick-progress-bar");

    /********************************************************
     *        FUNCTION: EXTRACT PENDING NUMBER
     ********************************************************/

    function getPendingNumber(element) {

        const text = element.innerText || element.textContent || "";

        /*
         * Cherche tous les nombres présents dans le texte.
         *
         * Exemple :
         * "Pending (25)"  -> 25
         * "Pending 25"   -> 25
         * "25 Pending"   -> 25
         */

        const numbers = text.match(/\d+/g);

        if (!numbers || numbers.length === 0) {
            return 0;
        }

        /*
         * Si plusieurs nombres sont présents,
         * on prend le plus grand.
         */

        return Math.max(
            ...numbers.map(Number)
        );
    }

    /********************************************************
     *              DASHBOARD AUTO CLICK
     ********************************************************/

    if (isDashboard) {

        let isWaiting = false;

        const waitAfterClick = 5000;

        async function dashboardCycle() {

            if (SCRIPT_PAUSED) {

                setTimeout(
                    dashboardCycle,
                    refreshDelay
                );

                return;
            }

            if (isWaiting) {

                setTimeout(
                    dashboardCycle,
                    refreshDelay
                );

                return;
            }

            /**********************************************
             * PROGRESS BAR
             **********************************************/

            const startTime = Date.now();

            const progInterval = setInterval(() => {

                if (SCRIPT_PAUSED || isWaiting) {

                    progressBar.style.width = "0%";

                    clearInterval(progInterval);

                    return;
                }

                const percent =
                    Math.min(
                        100,
                        ((Date.now() - startTime) /
                            refreshDelay) * 100
                    );

                progressBar.style.width =
                    percent + "%";

            }, 20);

            /**********************************************
             * FETCH DASHBOARD
             **********************************************/

            try {

                const response = await fetch(
                    window.location.href,
                    {
                        cache: "no-store",
                        credentials: "same-origin"
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        "HTTP " + response.status
                    );
                }

                const html = await response.text();

                const doc =
                    new DOMParser().parseFromString(
                        html,
                        "text/html"
                    );

                const newPanel =
                    doc.querySelector(".panel");

                const currentPanel =
                    document.querySelector(".panel");

                if (newPanel && currentPanel) {

                    currentPanel.innerHTML =
                        newPanel.innerHTML;

                }

            } catch (error) {

                console.log(
                    "AutoClick: Dashboard refresh failed:",
                    error
                );

            }

            /**********************************************
             * FIND PENDING LINKS
             **********************************************/

            const links =
                Array.from(
                    document.querySelectorAll("a")
                ).filter(link => {

                    const text =
                        (
                            link.innerText ||
                            link.textContent ||
                            ""
                        ).trim().toLowerCase();

                    return text.includes("pending");

                });

            /**********************************************
             * FIND HIGHEST PENDING
             **********************************************/

            let maxLink = null;
            let maxValue = -1;

            links.forEach(link => {

                const value =
                    getPendingNumber(link);

                if (value > maxValue) {

                    maxValue = value;
                    maxLink = link;

                }

            });

            /**********************************************
             * CLICK HIGHEST PENDING
             **********************************************/

            if (maxLink && maxValue >= 0) {

                console.log(
                    "AutoClick: Pending trouvé =",
                    maxValue,
                    maxLink
                );

                isWaiting = true;

                maxLink.click();

                textDiv.innerHTML =
                    "⚡ Pending sélectionné : " +
                    maxValue;

                setTimeout(() => {

                    isWaiting = false;

                    if (!SCRIPT_PAUSED) {

                        textDiv.innerHTML =
                            "⚡ AutoClick running...";

                    }

                }, waitAfterClick);

            }

            /**********************************************
             * END CYCLE
             **********************************************/

            clearInterval(progInterval);

            progressBar.style.width = "100%";

            setTimeout(
                dashboardCycle,
                dashboardSpeed
            );
        }

        dashboardCycle();
    }

    /********************************************************
     *              TASKER AUTO CLICK
     ********************************************************/

    if (isTaskerPage) {

        let buttonClicked = false;
        let hasClickedBack = false;
        let taskerInterval = null;

        /**********************************************
         * FIND BUTTONS
         **********************************************/

        function findTaskerButtons() {

            const elements =
                document.querySelectorAll(
                    "button, a, input[type='button'], input[type='submit']"
                );

            let illTakeBtn = null;
            let backBtn = null;

            elements.forEach(element => {

                const text = (
                    element.innerText ||
                    element.textContent ||
                    element.value ||
                    ""
                )
                    .trim()
                    .toUpperCase();

                if (
                    !illTakeBtn &&
                    text.includes("I'LL TAKE")
                ) {

                    illTakeBtn = element;

                }

                if (
                    !backBtn &&
                    text === "BACK"
                ) {

                    backBtn = element;

                }

            });

            return {
                illTakeBtn,
                backBtn
            };
        }

        /**********************************************
         * START TASKER
         **********************************************/

        function startTaskerInterval() {

            if (taskerInterval) {
                clearInterval(taskerInterval);
            }

            taskerInterval = setInterval(() => {

                if (SCRIPT_PAUSED) {
                    return;
                }

                if (buttonClicked) {
                    return;
                }

                if (hasClickedBack) {
                    return;
                }

                const {
                    illTakeBtn,
                    backBtn
                } = findTaskerButtons();

                /****************************************
                 * I'LL TAKE
                 ****************************************/

                if (
                    illTakeBtn &&
                    !illTakeBtn.disabled
                ) {

                    console.log(
                        "AutoClick: I'LL TAKE trouvé"
                    );

                    textDiv.innerHTML =
                        "⚡ I'LL TAKE détecté";

                    buttonClicked = true;

                    illTakeBtn.click();

                    clearInterval(
                        taskerInterval
                    );

                    return;
                }

                /****************************************
                 * BACK
                 ****************************************/

                if (
                    backBtn &&
                    !backBtn.disabled
                ) {

                    console.log(
                        "AutoClick: BACK trouvé"
                    );

                    textDiv.innerHTML =
                        "↩ BACK détecté";

                    hasClickedBack = true;

                    backBtn.click();

                    clearInterval(
                        taskerInterval
                    );

                    return;
                }

            }, taskerSpeed);
        }

        /**********************************************
         * RESTART TASKER
         **********************************************/

        function restartTaskerInterval() {

            if (taskerInterval) {
                clearInterval(taskerInterval);
            }

            buttonClicked = false;
            hasClickedBack = false;

            startTaskerInterval();
        }

        /**********************************************
         * START
         **********************************************/

        startTaskerInterval();

        /**********************************************
         * PAGE FOCUS
         **********************************************/

        window.addEventListener(
            "focus",
            () => {

                if (!SCRIPT_PAUSED) {
                    restartTaskerInterval();
                }

            }
        );

        /**********************************************
         * DOM CHANGES
         *
         * Permet de détecter un bouton qui apparaît
         * dynamiquement sans attendre uniquement
         * le prochain intervalle.
         **********************************************/

        const observer =
            new MutationObserver(() => {

                if (
                    !SCRIPT_PAUSED &&
                    !buttonClicked &&
                    !hasClickedBack
                ) {

                    const {
                        illTakeBtn,
                        backBtn
                    } = findTaskerButtons();

                    if (illTakeBtn || backBtn) {

                        // On laisse l'intervalle gérer le clic
                        // pour respecter taskerSpeed.

                    }

                }

            });

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );
    }

})();
