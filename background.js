// Fragt radioid.net ab (im Hintergrund, damit CORS kein Problem ist) und cached die Ergebnisse.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;      // 30 Tage für gefundene Rufzeichen
const TTL_MISS_MS = 24 * 60 * 60 * 1000;      // 1 Tag für "nicht gefunden"
const pending = new Map();

// Letzte Fehler für den Bug-Reporter merken (max. 20)
async function logError(where, call, e) {
  try {
    const { errlog = [] } = await chrome.storage.local.get('errlog');
    errlog.push({ t: Date.now(), where, call, msg: String(e) });
    await chrome.storage.local.set({ errlog: errlog.slice(-20) });
  } catch (_) { /* egal */ }
}

async function lookup(call) {
  const key = 'cs_' + call;
  const stored = (await chrome.storage.local.get(key))[key];
  if (stored && Date.now() - stored.t < (stored.name ? TTL_MS : TTL_MISS_MS)) return stored;

  if (pending.has(call)) return pending.get(call);
  const p = (async () => {
    try {
      const r = await fetch('https://radioid.net/api/dmr/user/?callsign=' + encodeURIComponent(call));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const hit = (j.results || []).find(x => (x.callsign || '').toUpperCase() === call) || (j.results || [])[0];
      const entry = {
        t: Date.now(),
        fname: hit ? (hit.fname || '').trim() : '',
        surname: hit ? (hit.surname || '').trim() : '',
        city: hit ? (hit.city || '').trim() : '',
        country: hit ? (hit.country || '').trim() : ''
      };
      entry.name = [entry.fname, entry.surname].filter(Boolean).join(' ');
      await chrome.storage.local.set({ [key]: entry });
      return entry;
    } catch (e) {
      logError('radioid', call, e);
      return { t: Date.now(), name: '', error: String(e) };   // Fehler nicht cachen
    } finally {
      pending.delete(call);
    }
  })();
  pending.set(call, p);
  return p;
}

// Profilfoto von qrz.com: steht öffentlich auf https://www.qrz.com/db/<CALL> als <img id="mypic">.
const PHOTO_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7 Tage
const pendingPhoto = new Map();

async function lookupPhoto(call) {
  const key = 'qrz_' + call;
  const stored = (await chrome.storage.local.get(key))[key];
  if (stored && Date.now() - stored.t < (stored.photo ? PHOTO_TTL_MS : TTL_MISS_MS)) return stored;

  if (pendingPhoto.has(call)) return pendingPhoto.get(call);
  const p = (async () => {
    try {
      const r = await fetch('https://www.qrz.com/db/' + encodeURIComponent(call), { credentials: 'omit' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      const tag = (html.match(/<img\b[^>]*\bid=["']mypic["'][^>]*>/i) || [''])[0];
      let photo = (tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1] || '';
      // Ohne eigenes Foto zeigt QRZ ein Platzhalterbild
      if (!/^https:\/\/cdn-bio\.qrz\.com\//i.test(photo)) photo = '';
      const entry = { t: Date.now(), photo };
      await chrome.storage.local.set({ [key]: entry });
      return entry;
    } catch (e) {
      logError('qrz', call, e);
      return { t: Date.now(), photo: '', error: String(e) };   // Fehler nicht cachen
    } finally {
      pendingPhoto.delete(call);
    }
  })();
  pendingPhoto.set(call, p);
  return p;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'radioid-lookup') {
    lookup(String(msg.callsign).toUpperCase()).then(sendResponse);
    return true; // asynchrone Antwort
  }
  if (msg && msg.type === 'qrz-photo') {
    lookupPhoto(String(msg.callsign).toUpperCase()).then(sendResponse);
    return true;
  }
});

// --- Freischaltung pro Adresse ---------------------------------------------
// Über das Popup erteilt der Nutzer Zugriff auf einzelne Dashboard-Adressen
// (optional_host_permissions). Für genau diese Adressen wird das Content-Script
// registriert; Chrome behält die Registrierung auch nach einem Neustart.
const SCRIPT_ID = 'wpsd';
const FIXED_HOSTS = ['https://radioid.net/*', 'https://www.qrz.com/*'];

async function grantedOrigins() {
  const { origins = [] } = await chrome.permissions.getAll();
  return origins.filter(o => !FIXED_HOSTS.includes(o));
}

async function syncContentScript() {
  const origins = await grantedOrigins();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  if (!origins.length) return;
  await chrome.scripting.registerContentScripts([{
    id: SCRIPT_ID,
    matches: origins,
    js: ['detect.js', 'content.js'],
    css: ['content.css'],
    runAt: 'document_idle',
    persistAcrossSessions: true
  }]);
}

// Sofort in bereits offene Tabs der neuen Adresse einfügen, ohne Neuladen
async function injectInto(origins) {
  const tabs = await chrome.tabs.query({ url: origins });
  for (const tab of tabs) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['detect.js', 'content.js'] });
    } catch (e) { /* Tab nicht zugreifbar */ }
  }
}

chrome.permissions.onAdded.addListener(async ({ origins = [] }) => {
  const added = origins.filter(o => !FIXED_HOSTS.includes(o));
  if (!added.length) return;
  await syncContentScript();
  await injectInto(added);
});
chrome.permissions.onRemoved.addListener(() => syncContentScript());
chrome.runtime.onInstalled.addListener(() => syncContentScript());
chrome.runtime.onStartup.addListener(() => syncContentScript());
