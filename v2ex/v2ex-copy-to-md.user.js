// ==UserScript==
// @name         V2EX Copy to Markdown
// @namespace    https://github.com/hunterMG/TampermonkeyScripts/
// @version      2026.09.08.02
// @description  Copy a V2EX topic and its current-page comments as Markdown.
// @author       hunterMG
// @match        *://*.v2ex.com/t/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// @ref
// ==/UserScript==

(function () {
    'use strict';

    const widgetId = 'v2ex-to-md';
    if (document.getElementById(widgetId)) return;

    const escapeText = (text) => text.replace(/\\/g, '\\\\').replace(/([`*_{}\[\]<>#|])/g, '\\$1')
        .replace(/^(\s*)([-+]|\d+[.)])(?=\s)/gm, '$1\\$2');
    const textOf = (node) => node?.textContent.trim() || '';
    const timeOf = (node) => node?.getAttribute('title') || textOf(node);

    function absoluteUrl(value) {
        if (!value) return '';
        try {
            const url = new URL(value, location.href);
            return /^(https?:|mailto:)$/.test(url.protocol)
                ? url.href.replace(/[()<>]/g, (char) => encodeURIComponent(char).replace('(', '%28').replace(')', '%29'))
                : '';
        } catch {
            return '';
        }
    }

    // Convert only content containers, never the tables used to lay out replies.
    function markdown(root) {
        function children(node) {
            return Array.from(node.childNodes, convert).join('');
        }

        function convert(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return escapeText(node.textContent.replace(/\s+/g, ' '));
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return '';
            const tag = node.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'button', 'input', 'textarea'].includes(tag)
                || node.hidden || node.getAttribute('aria-hidden') === 'true'
                || node.style.display === 'none') return '';

            if (tag === 'pre') {
                const code = node.querySelector('code') || node;
                const source = code.textContent.replace(/\r\n?/g, '\n').replace(/\n$/, '');
                const runs = source.match(/`+/g) || [];
                const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
                const language = code.className.match(/(?:language|lang)-([\w+-]+)/)?.[1] || '';
                return `\n\n${fence}${language}\n${source}\n${fence}\n\n`;
            }
            if (tag === 'code') {
                const source = node.textContent.replace(/\n/g, ' ');
                const runs = source.match(/`+/g) || [];
                const fence = '`'.repeat(Math.max(1, ...runs.map((run) => run.length + 1)));
                const padding = /^`|`$|^ .* $/.test(source) ? ' ' : '';
                return `${fence}${padding}${source}${padding}${fence}`;
            }
            if (tag === 'br') return '  \n';
            if (tag === 'hr') return '\n\n---\n\n';
            if (tag === 'img') {
                const url = absoluteUrl(node.getAttribute('src') || node.getAttribute('data-src'));
                return url ? `![${escapeText(node.getAttribute('alt') || '')}](${url})` : '';
            }
            if (tag === 'ul' || tag === 'ol') {
                let number = Number(node.getAttribute('start')) || 1;
                const items = Array.from(node.children).filter((child) => child.tagName === 'LI');
                return '\n\n' + items.map((item) => {
                    if (item.hasAttribute('value')) number = Number(item.getAttribute('value'));
                    const prefix = tag === 'ol' ? `${number++}. ` : '- ';
                    return prefix + children(item).trim().replace(/\n/g, '\n' + ' '.repeat(prefix.length));
                }).join('\n') + '\n\n';
            }
            if (tag === 'table') {
                const rows = Array.from(node.rows, (row) => Array.from(row.cells, (cell) =>
                    children(cell).trim().replace(/\n+/g, '<br>').replace(/(?<!\\)\|/g, '\\|')));
                if (!rows.length) return '';
                const width = Math.max(...rows.map((row) => row.length));
                const line = (row) => '| ' + Array.from({ length: width }, (_, i) => row[i] || '').join(' | ') + ' |';
                const header = node.rows[0].querySelector('th') ? rows.shift() : [];
                return '\n\n' + [line(header), line(Array(width).fill('---')), ...rows.map(line)].join('\n') + '\n\n';
            }

            const content = children(node);
            if (tag === 'a') {
                const url = absoluteUrl(node.getAttribute('href'));
                return url ? `[${content.trim() || escapeText(url)}](${url})` : content;
            }
            if (tag === 'strong' || tag === 'b') return content.trim() ? `**${content.trim()}**` : content;
            if (tag === 'em' || tag === 'i') return content.trim() ? `*${content.trim()}*` : content;
            if (['s', 'del', 'strike'].includes(tag)) return `~~${content.trim()}~~`;
            if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${content.trim()}\n\n`;
            if (tag === 'blockquote') return '\n\n' + content.trim().replace(/^/gm, '> ') + '\n\n';
            if (['p', 'div', 'section', 'article', 'figure', 'figcaption'].includes(tag)) return `\n\n${content.trim()}\n\n`;
            return content;
        }

        // Do not collapse newlines globally: fenced code must remain verbatim.
        return root ? convert(root).trim() : '';
    }

    function exportMarkdown(commentsOnly) {
        const main = document.querySelector('#Main');
        const title = main?.querySelector('.header h1');
        if (!title) throw new Error('No V2EX topic found.');
        const pageUrl = new URL(location.href);
        pageUrl.hash = '';
        const parts = [];

        if (!commentsOnly) {
            parts.push(`# ${escapeText(textOf(title))}`, `Source: ${pageUrl.href}`);
            const header = title.closest('.header');
            const author = header.querySelector('small a[href^="/member/"]');
            const date = timeOf(header.querySelector('small span[title]'));
            if (author) parts.push(`Author: ${markdown(author)}${date ? ` · ${escapeText(date)}` : ''}`);
            const topic = title.closest('.box');
            topic?.querySelectorAll('.topic_content, .subtle').forEach((content) => {
                // A supplement may itself contain a topic_content element.
                if (content.parentElement.closest('.topic_content, .subtle')) return;
                const result = markdown(content);
                if (result) parts.push(result);
            });
        }

        const comments = Array.from(main.querySelectorAll('[id^="r_"]'))
            .filter((reply) => reply.querySelector('.reply_content') && !reply.hidden && reply.style.display !== 'none');
        if (commentsOnly && !comments.length) throw new Error('No comments on this page.');
        if (comments.length) parts.push('## Comments');
        comments.forEach((reply, index) => {
            const author = reply.querySelector('strong a[href^="/member/"]');
            const number = textOf(reply.querySelector('.no')) || String(index + 1);
            const date = timeOf(reply.querySelector('.ago'));
            parts.push(`### #${escapeText(number)} ${author ? markdown(author) : 'Unknown author'}`);
            if (date) parts.push(escapeText(date));
            parts.push(markdown(reply.querySelector('.reply_content')));
        });
        return parts.filter(Boolean).join('\n\n') + '\n';
    }

    // Shadow DOM keeps the controls independent of the site's theme and CSS.
    const host = document.createElement('div');
    host.id = widgetId;
    // Establish shrink-to-fit sizing before measuring or restoring a position.
    host.style.setProperty('position', 'fixed', 'important');
    const shadow = host.attachShadow({ mode: 'open' });
    // CSSOM styles work even when the page's CSP blocks inline <style> tags.
    const stylesheet = new CSSStyleSheet();
    stylesheet.replaceSync(`
            :host { font: 14px/1.4 system-ui, sans-serif; }
            .controls { display:flex; flex-direction:column; align-items:stretch; min-width:132px; gap:6px; }
            button { box-sizing:border-box; min-height:36px; padding:8px 14px; border:1px solid #555;
                border-radius:6px; background:#262626; color:#fff; cursor:pointer; font:inherit;
                box-shadow:0 2px 8px #0003; white-space:nowrap; }
            button:hover { background:#444; }
            .copy { cursor:grab; touch-action:none; user-select:none; transition:transform 0.2s ease; }
            .copy:hover { transform:scale(1.05); }
            .copy.dragging { cursor:grabbing; transform:scale(1.05); }
            @media (prefers-reduced-motion:reduce) { .copy { transition:none; } }
            button:focus-visible { outline:3px solid #60a5fa; outline-offset:2px; }
            /* Reserve the second row even when hidden so hover never moves Copy. */
            .comments { visibility:hidden; }
            .controls:hover .comments, .controls:has(:focus-visible) .comments { visibility:visible; }
            .status { position:absolute; right:0; bottom:100%; margin-bottom:8px; width:max-content;
                max-width:min(280px, 80vw); color:#fff; background:#262626; border-radius:6px; padding:8px 12px; }
            .status:empty { display:none; }
            @media (hover:none) {
                .comments { visibility:visible; }
            }
    `);
    shadow.adoptedStyleSheets = [stylesheet];
    shadow.innerHTML = `
        <div class="status" role="status" aria-live="polite"></div>
        <div class="controls">
            <button type="button" class="copy" title="Copy topic and current-page comments as Markdown">Copy</button>
            <button type="button" class="comments" title="Copy only current-page comments as Markdown">Only comments</button>
        </div>`;
    // Keep body transforms/containment from anchoring fixed controls to the page.
    // Important shadow-host rules also protect positioning from page CSS.
    document.documentElement.appendChild(host);

    const savedPosition = typeof GM_getValue === 'function' ? GM_getValue('copy-button-position', null) : null;
    let manualPosition = savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)
        ? { x: Math.max(0, Math.min(1, savedPosition.x)), y: Math.max(0, Math.min(1, savedPosition.y)) } : null;

    function viewportBounds() {
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft || 0;
        const top = viewport?.offsetTop || 0;
        const width = viewport?.width || window.innerWidth;
        const height = viewport?.height || window.innerHeight;
        const margin = 20 / (viewport?.scale || 1);
        const bottomMargin = 32 / (viewport?.scale || 1);
        // Leave room for the 5% hover enlargement at each edge.
        const inset = 4 / (viewport?.scale || 1);
        return { left, top, width, height, margin, bottomMargin,
            minX: inset, minY: inset,
            maxX: Math.max(inset, width - host.offsetWidth - inset),
            maxY: Math.max(inset, height - host.offsetHeight - inset) };
    }

    // Preserve the chosen position relative to the visible viewport on zoom/resize.
    function positionBox() {
        const bounds = viewportBounds();
        const x = manualPosition
            ? bounds.minX + manualPosition.x * (bounds.maxX - bounds.minX)
            : Math.max(bounds.minX, bounds.width - host.offsetWidth - bounds.margin);
        const y = manualPosition
            ? bounds.minY + manualPosition.y * (bounds.maxY - bounds.minY)
            : Math.max(bounds.minY, bounds.height - host.offsetHeight - bounds.bottomMargin);
        host.style.setProperty('position', 'fixed', 'important');
        host.style.setProperty('display', 'block', 'important');
        host.style.setProperty('z-index', '2147483647', 'important');
        host.style.setProperty('margin', '0', 'important');
        host.style.setProperty('right', 'auto', 'important');
        host.style.setProperty('bottom', 'auto', 'important');
        host.style.setProperty('left', `${bounds.left + x}px`, 'important');
        host.style.setProperty('top', `${bounds.top + y}px`, 'important');
    }
    positionBox();
    window.addEventListener('resize', positionBox);
    window.visualViewport?.addEventListener('resize', positionBox);
    window.visualViewport?.addEventListener('scroll', positionBox);
    new ResizeObserver(positionBox).observe(host);

    const copyButton = shadow.querySelector('.copy');
    let drag = null;
    let suppressClick = false;
    copyButton.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        suppressClick = false;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
            left: host.offsetLeft, top: host.offsetTop, moved: false };
        copyButton.setPointerCapture(event.pointerId);
    });
    copyButton.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) <= 3) return;
        drag.moved = true;
        copyButton.classList.add('dragging');
        const bounds = viewportBounds();
        const x = Math.max(bounds.minX, Math.min(bounds.maxX, drag.left + dx - bounds.left));
        const y = Math.max(bounds.minY, Math.min(bounds.maxY, drag.top + dy - bounds.top));
        manualPosition = {
            x: (x - bounds.minX) / (bounds.maxX - bounds.minX || 1),
            y: (y - bounds.minY) / (bounds.maxY - bounds.minY || 1)
        };
        positionBox();
    });
    function finishDrag(event) {
        if (!drag || event.pointerId !== drag.id) return;
        suppressClick = drag.moved;
        if (drag.moved && typeof GM_setValue === 'function') {
            GM_setValue('copy-button-position', manualPosition);
        }
        drag = null;
        copyButton.classList.remove('dragging');
        if (copyButton.hasPointerCapture(event.pointerId)) copyButton.releasePointerCapture(event.pointerId);
    }
    copyButton.addEventListener('pointerup', finishDrag);
    copyButton.addEventListener('pointercancel', finishDrag);
    copyButton.addEventListener('lostpointercapture', finishDrag);

    let statusTimer;
    let copying = false;
    async function copy(commentsOnly) {
        if (copying) return;
        copying = true;
        const status = shadow.querySelector('.status');
        clearTimeout(statusTimer);
        try {
            const output = exportMarkdown(commentsOnly);
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(output, 'text');
            } else {
                await navigator.clipboard.writeText(output);
            }
            status.textContent = 'Copied!';
        } catch (error) {
            status.textContent = `Copy failed: ${error.message}`;
        } finally {
            copying = false;
            statusTimer = setTimeout(() => { status.textContent = ''; }, 3000);
        }
    }
    copyButton.addEventListener('click', (event) => {
        if (suppressClick && event.detail !== 0) {
            suppressClick = false;
            return;
        }
        copy(false);
    });
    shadow.querySelector('.comments').addEventListener('click', () => copy(true));
})();
