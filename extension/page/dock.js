// Safari only (manifest.safari.json). Shows the dashboard full-window in the
// Claude Monitor Dock app and nowhere else. The rule comes from the probe
// evidence in docs/pwa-plan.md ("Monitor-app marker results"): a Dock app
// (display-mode: standalone) whose extension storage holds the monitor mark,
// set when the app starts from a ?monitor URL. Each Dock app has its own
// extension storage; Claude clears page localStorage on sign-out and drops the
// marker from the URL after sign-in, so neither of those can hold the mark.
(() => {
  if (!matchMedia('(display-mode: standalone)').matches) return;

  const MARK = 'dockMonitor';
  let frame = null;

  // Claude's sign-in pages stay visible, so an expired session recovers the
  // normal way and the dashboard comes back after login.
  const onSignIn = () => /^\/(login|magic-link)/.test(location.pathname);
  // The reads that mean "signed out" when refused; others answer 403 for
  // features a plan lacks.
  const SESSION_READS = /^\/api\/organizations(\/[^/]+\/usage)?$/;

  function sync() {
    const show = !onSignIn();
    if (show && !frame) {
      frame = document.createElement('iframe');
      frame.src = chrome.runtime.getURL('popup.html?dock');
      frame.title = 'Claude Monitor';
      frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;background:#fff';
      document.documentElement.append(frame);
      // On a cold app start Safari loads an empty page into the frame, and
      // setting its src again does not help; a reload of the page does (as ⌘R).
      // shortcut: one reload after 3 s, cause unknown; drop it if Safari fixes this.
      const f = frame;
      const RELOADED = 'claudeMonitorDockReloaded';
      const reload = setTimeout(() => {
        if (!document.contains(f) || sessionStorage.getItem(RELOADED)) return;
        sessionStorage.setItem(RELOADED, '1');
        location.reload();
      }, 3000);
      addEventListener('message', (e) => {
        if (e.source !== f.contentWindow || e.data !== 'claude-monitor-dock-ready') return;
        clearTimeout(reload);
        sessionStorage.removeItem(RELOADED);
      });
    } else if (!show && frame) {
      frame.remove();
      frame = null;
    }
  }

  const launched = /[?&]monitor\b/.test(location.search);
  (launched ? chrome.storage.local.set({ [MARK]: true }) : Promise.resolve())
    .then(() => chrome.storage.local.get(MARK))
    .then((stored) => {
      if (!stored[MARK]) return;
      // The worker's own requests carry no sign-in in a Dock app, so it reads
      // claude.ai through this page (claudeFetch in background.js).
      chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
        if (msg?.type !== 'DOCK_FETCH' || !String(msg.url).startsWith('https://claude.ai/')) return;
        fetch(msg.url, { credentials: 'include', headers: msg.headers })
          .then(async (r) => {
            reply({ status: r.status, body: await r.text() });
            // Signed out while the dashboard covers Claude's page: show Claude's
            // own sign-in in this window; after login it returns to the app.
            if ((r.status === 401 || r.status === 403) && SESSION_READS.test(new URL(msg.url).pathname) && !onSignIn()) {
              location.assign('/login');
            }
          })
          .catch((error) => reply({ error: String(error?.message || error) }));
        return true;
      });
      sync();
      // Claude moves between /login and the app without a page load.
      let path = location.pathname;
      setInterval(() => {
        if (location.pathname !== path) { path = location.pathname; sync(); }
      }, 1000);
    });
})();
