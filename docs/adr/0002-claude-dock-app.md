# Use a Claude Dock app with a Safari Web Extension

The owner chose a Safari Add to Dock app based on `claude.ai`, with a Safari Web Extension providing the existing monitor design in a larger window. This combines the requested Dock experience with the no-backend constraint and keeps Claude as the underlying website for authentication. The architecture is accepted for investigation. A probe extension read usage inside the Dock app, also with Safari not running and after sign-in again (see `pwa-plan.md`). The monitor app is identified by `display-mode: standalone` and a mark in extension storage, set from a `?monitor` start URL. This also worked after sign-in again.

Apple documents independent web apps and extension support in [Use Safari web apps on Mac](https://support.apple.com/en-us/104996). This confirms platform capabilities, not compatibility with this extension.

The dashboard is limited to the dedicated monitor app. Normal Claude browsing keeps its existing interface. An expired session uses Claude's normal sign-in flow and returns to the dashboard after login.
