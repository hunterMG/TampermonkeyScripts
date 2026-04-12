// ==UserScript==
// @name         Weixin official accounts tab title postfix
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Get the author name, append it to tab title with a postfix, and set it as the new tab title on Weixin official accounts pages.
// @author       hunterMG
// @match        https://mp.weixin.qq.com/s*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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

    function handleReady() {
        try {

            // 获取第一个元素的文本（article title）
            const elem1 = document.querySelector('#activity-name');
            const text1 = elem1 ? elem1.textContent.trim() : '';
            
            // 获取第二个元素的文本
            const elem2 = document.querySelector('#js_name');
            const text2 = elem2 ? elem2.textContent.trim() : '';
            
            // 检查是否获取到文本
            if (!text1 || !text2) {
                showNotification('Warning: Failed to find one or both elements!\nFirst element(article title): ' + (text1 ? '✓' : '✗') + '\nSecond element(author name): ' + (text2 ? '✓' : '✗'));
                return;
            }
            
            // 用"_"拼接两个文本
            const result = text1 + '_' + text2
            
            // 设置标签页标题
            document.title = result;
            showNotification('Tab Title Changed to【' + result + '】');
            
            // 监听title变化，防止被网页JS覆盖
            const titleElement = document.querySelector('title');
            if (titleElement) {
                const observer = new MutationObserver(() => {
                    if (document.title !== result) {
                        document.title = result;
                    }
                });
                observer.observe(titleElement, { childList: true, subtree: true, characterData: true });
            }
        } catch(err) {
            showNotification('Error: ' + err);
        }
    }

    // 等待所有资源加载完成，以及页面本身的JS执行完成后执行
    window.addEventListener('load', () => {
        setTimeout(handleReady, 0);
    });
})();
