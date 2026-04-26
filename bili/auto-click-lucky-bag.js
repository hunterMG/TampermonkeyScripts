// ==UserScript==
// @name         Bilibili Live Auto Click
// @namespace    tampermonkey-scripts
// @version      1.2.0
// @description  Auto click Bilibili live lucky bag actions every minute.
// @author       Codex
// @match        https://live.bilibili.com/*
// @grant        none
// @license      MIT
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const CHECK_INTERVAL_MS = 60 * 1000;
    let hasStarted = false;

    function getTimestamp() {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');

        return [
            now.getFullYear(),
            pad(now.getMonth() + 1),
            pad(now.getDate())
        ].join('-') + ' ' + [
            pad(now.getHours()),
            pad(now.getMinutes()),
            pad(now.getSeconds())
        ].join(':');
    }

    function log(message, isPositive = false) {
        const suffix = isPositive ? ' ✅' : '';
        console.log(`[Bili Auto Click][${getTimestamp()}] ${message}${suffix}`);
    }

    function clickElement(element) {
        if (!element) {
            return false;
        }

        element.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        }));
        return true;
    }

    function normalizeText(text) {
        return (text || '').replace(/\s+/g, '').trim();
    }

    function findSpanByClassAndText(className, text) {
        return Array.from(document.querySelectorAll(`span.${className.split(' ').join('.')}`))
            .find((element) => normalizeText(element.textContent) === normalizeText(text));
    }

    function findParagraphByClassAndText(className, text) {
        return Array.from(document.querySelectorAll(`p.${className.split(' ').join('.')}`))
            .find((element) => normalizeText(element.textContent).includes(normalizeText(text)));
    }

    function clickPrimaryButtonByText(text) {
        const button = findSpanByClassAndText('action-btn primary-btn', text);
        if (!button) {
            log(`Primary button not found: ${text}`);
            return false;
        }

        clickElement(button);
        log(`Clicked ${text}`, true);
        return true;
    }

    function handleParticipatedDialog() {
        const participatedButton = findSpanByClassAndText('action-btn primary-btn participated', '已参与');
        if (!participatedButton) {
            log('Participated status not found: 已参与');
            return false;
        }

        log('Found 已参与 status', true);

        const closeButton = document.querySelector('img.close-btn');
        if (!closeButton) {
            log('Close button not found: img.close-btn');
            return true;
        }

        clickElement(closeButton);
        log('Clicked close button', true);
        return true;
    }

    function handleKnownDialog() {
        return clickPrimaryButtonByText('我知道了') || handleParticipatedDialog();
    }

    function handleLuckyBagFlow() {
        if (clickPrimaryButtonByText('一键参与')) {
            setTimeout(handleKnownDialog, 1000);
            return true;
        }

        const luckyBagTitle = findParagraphByClassAndText('anchor-lot-text title', '天选福袋');
        if (!luckyBagTitle) {
            log('Tag not found: 天选福袋');
            return handleKnownDialog();
        }

        clickElement(luckyBagTitle);
        log('Clicked 天选福袋', true);

        setTimeout(() => {
            if (!clickPrimaryButtonByText('一键参与')) {
                handleKnownDialog();
                return;
            }

            setTimeout(handleKnownDialog, 1000);
        }, 1000);

        return true;
    }

    function runCheck() {
        try {
            const handled = handleLuckyBagFlow();
            if (!handled) {
                log('No matching target found in this check');
                handleKnownDialog();
            }
        } catch (error) {
            console.error('[Bili Auto Click] Check failed:', error);
        }
    }

    function startChecks() {
        if (hasStarted) {
            return;
        }

        hasStarted = true;
        log('DOM loaded, starting auto check loop', true);
        runCheck();
        setInterval(runCheck, CHECK_INTERVAL_MS);
    }

    log(`Script injected, document.readyState=${document.readyState}`, true);

    if (document.readyState === 'loading') {
        log('Waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', startChecks, { once: true });
        window.addEventListener('load', startChecks, { once: true });
    } else {
        startChecks();
    }
})();
