// ==UserScript==
// @name         V2EX Copy to Markdown
// @namespace    https://github.com/hunterMG/TampermonkeyScripts/
// @version      2026.09.05.06
// @description  Copy a V2EX topic and its current-page comments as Markdown.
// @author       hunterMG
// @match        *://*.v2ex.com/t/*
// @grant        GM_setClipboard
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
            button:focus-visible { outline:3px solid #60a5fa; outline-offset:2px; }
            /* Reserve the second row even when hidden so hover never moves Copy. */
            .comments { visibility:hidden; }
            .controls:hover .comments, .controls:focus-within .comments { visibility:visible; }
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

    // Like the reference exporter box, use fixed positioning and viewport
    // coordinates. Set properties through CSSOM instead of an inline style tag.
    function positionBox() {
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft || 0;
        const top = viewport?.offsetTop || 0;
        const width = viewport?.width || window.innerWidth;
        const height = viewport?.height || window.innerHeight;
        const margin = 20 / (viewport?.scale || 1);
        const bottomMargin = 32 / (viewport?.scale || 1);
        host.style.setProperty('position', 'fixed', 'important');
        host.style.setProperty('display', 'block', 'important');
        host.style.setProperty('z-index', '2147483647', 'important');
        host.style.setProperty('margin', '0', 'important');
        host.style.setProperty('right', 'auto', 'important');
        host.style.setProperty('bottom', 'auto', 'important');
        host.style.setProperty('left', `${left + Math.max(0, width - host.offsetWidth - margin)}px`, 'important');
        host.style.setProperty('top', `${top + Math.max(0, height - host.offsetHeight - bottomMargin)}px`, 'important');
    }
    positionBox();
    window.addEventListener('resize', positionBox);
    window.visualViewport?.addEventListener('resize', positionBox);
    window.visualViewport?.addEventListener('scroll', positionBox);
    new ResizeObserver(positionBox).observe(host);

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
    shadow.querySelector('.copy').addEventListener('click', () => copy(false));
    shadow.querySelector('.comments').addEventListener('click', () => copy(true));
})();
