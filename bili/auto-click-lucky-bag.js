// ==UserScript==
// @name         Bilibili Live lucky bag Auto Click
// @namespace    tampermonkey-scripts
// @version      1.3.0
// @description  Auto click Bilibili live lucky bag actions every minute.
// @author       hunterMG
// @match        https://live.bilibili.com/*
// @grant        none
// @license      MIT
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Only run in the top-level document to avoid duplicate UI in embedded frames.
    if (window.top !== window.self) {
        return;
    }

    const CHECK_INTERVAL_MS = 60 * 1000;
    const ENABLE_STORAGE_KEY = 'bili-live-auto-click-enabled';
    const TOGGLE_BUTTON_ID = 'bili-live-auto-click-toggle';
    let hasStarted = false;
    let isEnabled = window.localStorage.getItem(ENABLE_STORAGE_KEY) === 'true';

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

    function setEnabled(nextEnabled) {
        isEnabled = nextEnabled;
        window.localStorage.setItem(ENABLE_STORAGE_KEY, String(nextEnabled));
        updateToggleButton();
        log(`Auto click ${nextEnabled ? 'enabled' : 'disabled'}`, nextEnabled);
    }

    function updateToggleButton() {
        const button = document.getElementById(TOGGLE_BUTTON_ID);
        if (!button) {
            return;
        }

        button.textContent = `Auto Click: ${isEnabled ? 'Enabled' : 'Disabled'}`;
        button.style.background = isEnabled ? '#00aeec' : '#6b7280';
    }

    function ensureToggleButton() {
        if (!document.body) {
            window.requestAnimationFrame(ensureToggleButton);
            return;
        }

        let button = document.getElementById(TOGGLE_BUTTON_ID);
        if (!button) {
            button = document.createElement('button');
            button.id = TOGGLE_BUTTON_ID;
            button.type = 'button';
            button.style.position = 'fixed';
            button.style.left = '16px';
            button.style.top = '50%';
            button.style.transform = 'translateY(-50%)';
            button.style.zIndex = '2147483647';
            button.style.padding = '10px 14px';
            button.style.border = 'none';
            button.style.borderRadius = '999px';
            button.style.color = '#ffffff';
            button.style.fontSize = '14px';
            button.style.fontWeight = '700';
            button.style.cursor = 'pointer';
            button.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.2)';
            button.style.transition = 'opacity 0.2s ease';
            button.addEventListener('mouseenter', () => {
                button.style.opacity = '0.9';
            });
            button.addEventListener('mouseleave', () => {
                button.style.opacity = '1';
            });
            button.addEventListener('click', () => {
                setEnabled(!isEnabled);
                if (isEnabled) {
                    runCheck();
                }
            });
            document.body.appendChild(button);
            log('Enable toggle button added', true);
        }

        updateToggleButton();
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
        if (!isEnabled) {
            log('Auto click is disabled; skipping this check');
            return;
        }

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
        ensureToggleButton();
        log('DOM loaded, starting auto check loop', true);
        if (isEnabled) {
            runCheck();
        } else {
            log('Auto click is disabled on startup');
        }
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
