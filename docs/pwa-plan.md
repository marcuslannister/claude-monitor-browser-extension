# Claude Monitor Desktop Design

Status: Product decisions agreed. The implementation sequence below awaits final confirmation. No application code has changed.

## Agreed scope

- Build a personal desktop usage monitor first. Public release is a later task.
- Use Safari Add to Dock with `claude.ai` as the underlying website.
- A Safari Web Extension supplies the monitor dashboard in a separate app window. See [ADR 0002](adr/0002-claude-dock-app.md).
- Reuse the existing design in a larger, resizable window.
- Support one Claude Pro account.
- Show usage, remaining allowance, and reset times.
- Refresh when the app opens and through a manual refresh control. Show the last successful update time.
- Show the dashboard only in the dedicated Claude Monitor app. Keep normal Claude browsing unchanged.
- When the session expires, show Claude's normal sign-in screen and return to the dashboard after login.
- Use no backend anywhere, including private servers, managed backends, and serverless proxies. See [ADR 0001](adr/0001-no-backend.md).

## Deferred work

- iPhone support follows the desktop version. Its earlier requirement for fresh readings without the desktop remains a later feasibility question.
- Background refresh and alerts while the monitor app is closed.
- Public distribution.

## Evidence and limits

The existing `fetchClaudeJson()` in `extension/background.js` uses `credentials: 'include'`. The current extension manifest grants access to Claude endpoints through host permissions.

[Apple documents](https://support.apple.com/en-us/104996) that Safari Dock apps run independently of Safari and support Safari Web Extensions. These platform capabilities do not prove that this extension works inside a Claude Dock app.

The current extension already adds isolated UI to Claude pages. Its popup also depends on extension messaging and storage. Reusing the source requires adaptation to the Safari content-script context.

### Feasibility probe results (2026-10-21)

The probe in `safari-probe/` is a content script on `claude.ai`. It reads `/api/organizations` and `/usage` with the page's cookies and shows window signals. It ran as a development-signed Safari app (Xcode 27.1, Personal Team) on macOS 27.

| Test | Result |
| --- | --- |
| A: normal Safari tab | Usage read OK. `display-mode: standalone` false, `navigator.standalone` false. |
| B: Claude Dock app | Usage read OK. `display-mode: standalone` true, `navigator.standalone` true. |
| C: Dock app, Safari not running | Usage read OK. |
| D: sign out, then sign in in the Dock app window | `/login` gives `http-403`; Claude's sign-in page stays. After sign-in, usage read OK. `standalone` stays true. |

- Usage retrieval needs no backend and no Safari main window.
- Each Dock app has its own extension settings. The user must turn the extension on and allow `claude.ai` separately in Safari and in each Dock app.
- A development-signed extension does not need "Allow unsigned extensions". An ad hoc signed build did not appear in Safari's extension list.
- `standalone` separates Dock apps from tabs, but it is true in every Claude Dock app. `window.toolbar.visible` is true in both places and is not a signal.

### Monitor-app marker results (2026-10-21)

Probe v0.0.2 marks the app when the launch URL has `?monitor`, and stores the mark in page `localStorage` and in extension `storage.local`. Active = `standalone` and the mark.

| Test | Result |
| --- | --- |
| E: new Dock app "Claude Monitor", start URL edited to `/new?monitor` | Marker read, both marks set, active. |
| F: old Claude Dock app | No marks, not active. |
| G: normal Safari tab with both marks | Not active (`standalone` false). |
| H: Claude Monitor restarted | Starts at `/new?monitor` again, active. |
| I: sign out, then sign in, in Claude Monitor | Claude clears page `localStorage`; the extension mark remains. After sign-in Claude opens `/new` without the marker; still active. |

- Add to Dock proposes `https://claude.ai/` from Claude's manifest. The user must edit the URL to add `?monitor`. Safari keeps the edited start URL.
- Each Dock app has its own extension storage, separate from Safari and from other Dock apps.
- Activation rule for step 5: `display-mode: standalone` and a mark in extension `storage.local`, set when the launch URL has `?monitor`. Do not use page `localStorage`, and do not depend on the current URL.
### Dashboard in the Dock app (step 5, 2026-10-21)

Build: `SAFARI_TEAM=<team id> safari/build.sh` converts `extension/` with `manifest.safari.json`, signs it, and installs `Claude Monitor Extension.app` in `~/Applications`. Create the Dock app from `https://claude.ai/new?monitor` (edit the URL in Add to Dock).

- `page/dock.js` shows the existing popup (`popup.html?dock`) full-window in the monitor app, and hides it on Claude's sign-in pages.
- The background script's own requests carry no Dock app sign-in (`auth-failed` while the page was signed in). `dock.js` does the claude.ai reads for it (`claudeFetch` in `background.js`, Safari build only). Usage data is stored and shown in the Dock app.
- On a cold app start, Safari loads an empty page into the dashboard frame; a new `src` does not help, a page reload does. `dock.js` reloads once when the dashboard does not report ready within 3 s. Cause unknown.
- Each Dock app has its own Claude session after sign-in in it. A sign-out in Safari or in another Dock app does not sign out the monitor app.

| Check | Result |
| --- | --- |
| Dashboard after app start, with usage, reset times, update time | Pass |
| Resize; manual refresh changes the update time | Pass |
| Old Claude Dock app and normal Safari tab keep the normal interface | Pass |
| App start while signed out: Claude sign-in in the app window, dashboard after login | Pass |
| Session expires while the app is open: refresh opens Claude sign-in | Code in place (`dock.js`), not tested |

Known limits: links in the dashboard (sign in, usage page, help) open in Safari, not in the Dock app. Safari does not support the `notifications` permission, so alerts are unverified.

## Local build prerequisite

Xcode 27.1 is installed. `safari-web-extension-converter` and `safari-web-extension-packager` work. The build needs an Apple Development certificate (a free Personal Team is sufficient).

## Proposed implementation sequence

1. Establish the local Safari build tooling.
2. Package the smallest Safari extension needed to read one usage response inside the Claude Dock app.
3. Prove the app can authenticate and retrieve a reading with the main Safari window closed.
4. Prove dashboard activation is limited to the dedicated monitor app, including after login.
5. Adapt the existing dashboard to a larger, resizable view and connect refresh and update-time controls.
6. Check the agreed behavior before expanding the app or preparing public distribution.

If a feasibility check fails, report the evidence and revisit the approach. Do not introduce a backend as a workaround.

## Completion checks

- Opening the dedicated Dock app shows the monitor dashboard after successful authentication.
- Normal Claude tabs and other Claude web apps retain their normal interface.
- Opening the monitor and selecting manual refresh retrieve current usage and update the displayed timestamp.
- Expired authentication shows the normal Claude sign-in flow and returns to the monitor after login.
- Closing Safari's main window does not prevent the Dock app from retrieving usage.
- The dashboard remains usable when the window is resized.
- Usage retrieval does not depend on an application backend.

Implementation details, including the activation marker and Safari packaging configuration, must follow the feasibility evidence. A URL marker alone does not prove that a page is inside the dedicated app.
