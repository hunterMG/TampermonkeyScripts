// ==UserScript==
// @name         Page tab title suffix
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Get the author name, append it to tab title with a suffix, and set it as the new tab title on supported pages.
// @author       hunterMG
// @match        https://mp.weixin.qq.com/s*
// @match        https://www.bilibili.com/video/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const pageConfigs = [
        {
            name: 'Weixin official account',
            matches: () => location.hostname === 'mp.weixin.qq.com' && location.pathname.startsWith('/s'),
            titleSelector: '#activity-name',
            authorSelector: '#js_name',
            titleLabel: 'First element(article title)',
            authorLabel: 'Second element(author name)'
        },
        {
            name: 'Bilibili video',
            matches: () => location.hostname === 'www.bilibili.com' && location.pathname.startsWith('/video/'),
            titleSelector: 'h1.video-title, .video-info-title h1',
            authorSelector: 'a.up-name[href*="space.bilibili.com"], .up-info-container .up-name, .up-name',
            titleLabel: 'Video title',
            authorLabel: 'Author name',
            preferTitleAttribute: true,
            removeNestedSelector: '.mask',
            stableTitle: { maxCorrections: 3, timeout: 30000 },
            titleSuffix: ' - bili'
        }
    ];

    let titleObserver = null;

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        const totalDuration = 6000; // 1s fade-in + 4s hold + 1s fade-out
        notification.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; padding: 12px 20px; background-color: #4CAF50; color: white; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 14px; opacity: 0; animation: fadeInOut ' + totalDuration + 'ms ease-in-out forwards;';
        document.body.appendChild(notification);
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = '@keyframes fadeInOut { 0% { opacity: 0; } 16.667% { opacity: 1; } 83.333% { opacity: 1; } 100% { opacity: 0; } }';
        document.head.appendChild(style);
        
        // 总时长后移除通知
        setTimeout(() => notification.remove(), totalDuration);
    }

    function getCurrentPageConfig() {
        return pageConfigs.find((config) => config.matches());
    }

    function getElementText(selector, config, isTitle) {
        const element = document.querySelector(selector);
        if (!element) {
            return '';
        }

        if (isTitle && config.preferTitleAttribute) {
            const title = element.getAttribute('title');
            if (title && title.trim()) {
                return title.trim().replace(/\s+/g, ' ');
            }
        }

        let textSource = element;
        if (!isTitle && config.removeNestedSelector) {
            textSource = element.cloneNode(true);
            textSource.querySelectorAll(config.removeNestedSelector).forEach((node) => node.remove());
        }

        return textSource.textContent.trim().replace(/\s+/g, ' ');
    }

    function setStableTitle(result, config) {
        document.title = result;
        showNotification('Tab Title Changed to【' + result + '】');

        const stableOpts = config && config.stableTitle;
        if (stableOpts && stableOpts.maxCorrections === 0) {
            return;
        }

        // 监听title变化，防止被网页JS覆盖
        const titleElement = document.querySelector('title');
        if (!titleElement) return;

        if (titleObserver) {
            titleObserver.disconnect();
        }

        let corrections = 0;
        const startTime = Date.now();
        const maxCorrections = (stableOpts && stableOpts.maxCorrections) || Infinity;
        const maxAge = (stableOpts && stableOpts.timeout) || Infinity;

        function isExpired() {
            return corrections >= maxCorrections || (Date.now() - startTime) >= maxAge;
        }

        titleObserver = new MutationObserver(() => {
            if (document.title !== result) {
                titleObserver.disconnect();
                document.title = result;
                corrections++;
                if (!isExpired()) {
                    titleObserver.observe(titleElement, { childList: true, characterData: true });
                }
            }
        });
        titleObserver.observe(titleElement, { childList: true, characterData: true });
    }

    function handleReady(showWarning) {
        try {
            const config = getCurrentPageConfig();
            if (!config) {
                return true;
            }

            // 获取第一个元素的文本（article title）
            const text1 = getElementText(config.titleSelector, config, true);
            
            // 获取第二个元素的文本
            const text2 = getElementText(config.authorSelector, config, false);
            
            // 检查是否获取到文本
            if (!text1 || !text2) {
                if (showWarning) {
                    showNotification('Warning: Failed to find one or both elements on ' + config.name + '!\n' + config.titleLabel + ': ' + (text1 ? '✓' : '✗') + '\n' + config.authorLabel + ': ' + (text2 ? '✓' : '✗'));
                }
                return false;
            }
            
            // 用" - "拼接两个文本
            let result = text1 + ' - ' + text2
            if (config.titleSuffix) {
                result += config.titleSuffix;
            }
            
            // 设置标签页标题
            setStableTitle(result, config);
            return true;
        } catch(err) {
            showNotification('Error: ' + err);
            return true;
        }
    }

    function waitForReady() {
        const startTime = Date.now();
        const timeout = 15000;

        function tryHandleReady() {
            if (handleReady(false)) {
                return;
            }

            if (Date.now() - startTime >= timeout) {
                handleReady(true);
                return;
            }

            setTimeout(tryHandleReady, 500);
        }

        tryHandleReady();
    }

    // 等待所有资源加载完成，以及页面本身的JS执行完成后执行
    if (document.readyState === 'loading') {
        window.addEventListener('load', waitForReady);
    } else {
        setTimeout(waitForReady, 0);
    }
})();
