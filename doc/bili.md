# wx-change-tab-title.user.js — Bilibili fixes

## Problem
The `MutationObserver` in `setStableTitle` caused browser high CPU usage, freezing, and crashes. Two issues:

1. **Infinite observer loop** — Setting `document.title` inside the observer callback triggered another mutation, creating a tight CPU cycle even with the guard `if (document.title !== result)`.
2. **Bilibili SPA overwrites title** — Bilibili's page JS sets `document.title` after the script runs, so a one-shot set wasn't enough.

## Fixes applied

### 1. Disconnect/reconnect pattern (`setStableTitle`)
The observer now disconnects before setting `document.title` and reconnects after. This prevents our own write from re-triggering the observer, breaking the infinite loop. Also removed `subtree: true` (unnecessary for `<title>`).

### 2. Bounded observer for Bilibili
Replaced boolean `useStableTitle: false` with a configurable `stableTitle` object:
- **Bilibili**: `{ maxCorrections: 3, timeout: 30000 }` — observer corrects the title up to 3 times or for 30 seconds, then self-destructs. Enough to outlast Bilibili's initial SPA JS setup without indefinite CPU risk.
- **Weixin**: no `stableTitle` key → unlimited observer (original behavior preserved).

### 3. Bilibili title suffix
Added `titleSuffix: ' - bili'` so tab titles appear as `Video Title - Author Name - bili`.

## Key files
- `weixin/wx-change-tab-title.user.js` — the user script
