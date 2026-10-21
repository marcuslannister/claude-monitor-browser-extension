// Feasibility probe, not the product (docs/pwa-plan.md steps 2-4).
// It reads one usage response and shows the signals that may tell the monitor
// Dock app apart from a normal Safari tab and from other Claude Dock apps.

const MARK = 'claudeMonitorApp';
const ext = globalThis.browser ?? chrome;
// Read at document_start, before Claude's own redirects can drop the marker.
const launchMarker = /[?&#]monitor\b/.test(location.search + location.hash);

async function getJson(path) {
  const response = await fetch(path, { credentials: 'include', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`http-${response.status}`);
  return response.json();
}

// Two stores, to learn which one is separate per Dock app and survives sign-out.
async function setMark(on) {
  if (on) localStorage.setItem(MARK, '1'); else localStorage.removeItem(MARK);
  await (on ? ext.storage.local.set({ [MARK]: true }) : ext.storage.local.remove(MARK));
}

async function marks() {
  return {
    launchMarker,
    pageStorage: localStorage.getItem(MARK) === '1',
    extensionStorage: Boolean((await ext.storage.local.get(MARK))[MARK]),
  };
}

function signals() {
  const mode = m => matchMedia(`(display-mode: ${m})`).matches;
  return {
    url: location.pathname + location.search + location.hash,
    standalone: mode('standalone'),
    browser: mode('browser'),
    navigatorStandalone: navigator.standalone ?? null,
  };
}

async function reading() {
  try {
    const orgs = await getJson('/api/organizations');
    const list = Array.isArray(orgs) ? orgs : [];
    const org = list.find(o => o.capabilities?.includes('chat')) || list[0];
    if (!org) return { ok: false, error: 'no-org' };
    const usage = await getJson(`/api/organizations/${org.uuid}/usage`);
    // Only figures, never org names or ids.
    const pick = b => b && { utilization: b.utilization, resets_at: b.resets_at };
    return { ok: true, session: pick(usage.five_hour), weekly: pick(usage.seven_day) };
  } catch (error) {
    return { ok: false, error: String(error.message || error) };
  }
}

function button(label, onclick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

async function run() {
  const s = signals();
  const m = await marks();
  const record = {
    at: new Date().toISOString(),
    signals: s,
    marks: m,
    activeIfPageStorage: s.standalone && m.pageStorage,
    activeIfExtensionStorage: s.standalone && m.extensionStorage,
    reading: await reading(),
  };
  console.log('[dock-probe]', JSON.stringify(record));
  let box = document.getElementById('dock-probe');
  if (!box) {
    box = document.createElement('div');
    box.id = 'dock-probe';
    box.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483647;max-width:420px;' +
      'padding:8px;background:#111;color:#eee;font:11px/1.4 ui-monospace,monospace;border-radius:6px;white-space:pre-wrap';
    document.documentElement.append(box);
  }
  box.textContent = JSON.stringify(record, null, 2);
  box.append('\n',
    button('Run again', run), ' ',
    button('Mark this app', () => setMark(true).then(run)), ' ',
    button('Unmark', () => setMark(false).then(run)), ' ',
    button('Close', () => box.remove()));
}

(launchMarker ? setMark(true) : Promise.resolve()).then(run);
