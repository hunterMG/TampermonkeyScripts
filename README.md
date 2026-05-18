# TamperMonkeyScript

Useful scripts for TamperMonkey.

## [51Job auto apply](./51job/autoApply.js)

[Install via GitHub](https://raw.githubusercontent.com/hunterMG/TampermonkeyScripts/main/51job/autoApply.js).

Apply to ALL 20 positions in the page automatically. (It might get banned.)

## [Page tab title suffix](./weixin/wx-change-tab-title.js)

[Install via GitHub](https://raw.githubusercontent.com/hunterMG/TampermonkeyScripts/main/weixin/wx-change-tab-title.js).

Appends the author name as a suffix to the browser tab title on
- Weixin official account articles (`mp.weixin.qq.com/s*`)
- Bilibili videos (`bilibili.com/video/*`)

A lightweight observer defends against page JS overwriting the title. Bilibili uses a bounded observer (max 3 corrections, 30s timeout) to avoid CPU issues, and adds ` - bili` suffix.
