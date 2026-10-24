// Fügt in jeder Tabelle mit einer Spalte "CALLSIGN" (ohne eigene NAME-Spalte)
// die Spalten "NAME" (Vorname + Nachname) und "ORT" (Wohnort) von radioid.net ein.
// Wird nur auf Adressen geladen, die über das Erweiterungs-Symbol freigeschaltet wurden,
// und dort nur aktiv, wenn die Seite als WPSD erkannt wird (detect.js).
(() => {
  if (window.__ridActive || !document.body || !globalThis.ridIsWPSD || !ridIsWPSD()) return;
  window.__ridActive = true; // nicht doppelt starten (z.B. nach Freischalten + Neuladen)

  const COL_CLASS = 'rid-name';
  const CITY_CLASS = 'rid-city';
  const cache = new Map(); // Rufzeichen -> Promise<entry>

  function baseCall(text) {
    // "DD3LL/P", "DD3LL-JOTA", "DD3LL 123" -> "DD3LL"
    const m = (text || '').toUpperCase().trim().match(/^[A-Z0-9]{3,8}/);
    return m ? m[0] : '';
  }

  function getName(call) {
    if (!cache.has(call)) {
      cache.set(call, new Promise(resolve => {
        try {
          chrome.runtime.sendMessage({ type: 'radioid-lookup', callsign: call }, res => {
            if (chrome.runtime.lastError || !res) { cache.delete(call); resolve({ error: 'keine Antwort' }); return; }
            if (res.error) cache.delete(call); // später erneut versuchen
            resolve(res);
          });
        } catch (e) { cache.delete(call); resolve({ error: String(e) }); }
      }));
    }
    return cache.get(call);
  }

  // Ergebnis in die Zellen schreiben. Bei einem Fehler "?" anzeigen und später
  // automatisch neu abfragen, statt die Zelle dauerhaft leer zu lassen.
  function fill(td, tdCity, res) {
    td.removeAttribute('title');
    tdCity.removeAttribute('title');
    if (!res || res.error) {
      td.textContent = '?';
      tdCity.textContent = '';
      td.title = 'radioid.net gerade nicht erreichbar – neuer Versuch folgt automatisch';
      td.dataset.ridState = 'error';
      scheduleRetry();
      return;
    }
    delete td.dataset.ridState;
    retryDelay = RETRY_MIN; // radioid.net antwortet wieder
    td.textContent = res.name || '';
    tdCity.textContent = res.city || '';
    const place = [res.city, res.country].filter(Boolean).join(', ');
    if (place) td.title = tdCity.title = place;
  }

  // Wiederholung mit wachsendem Abstand (30 s, 1 min, 2 min … max. 10 min),
  // damit radioid.net bei Störungen nicht mit Anfragen überhäuft wird.
  const RETRY_MIN = 30 * 1000, RETRY_MAX = 10 * 60 * 1000;
  let retryDelay = RETRY_MIN, retryTimer = null;

  function scheduleRetry() {
    if (!retryTimer) retryTimer = setTimeout(retryFailed, retryDelay);
  }

  function retryFailed() {
    retryTimer = null;
    const failed = document.querySelectorAll('td.' + COL_CLASS + '[data-rid-state="error"]');
    if (!failed.length) return;
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX); // wird bei Erfolg zurückgesetzt
    const calls = new Set([...failed].map(td => td.dataset.ridCall));
    calls.forEach(call => getName(call).then(res => {
      document.querySelectorAll('td.' + COL_CLASS + '[data-rid-state="error"][data-rid-call="' + call + '"]')
        .forEach(td => fill(td, td.nextElementSibling, res));
    }));
  }

  function processTable(table) {
    const head = table.rows[0];
    if (!head) return;
    const headers = [...head.cells].map(c => c.innerText.trim().toUpperCase());
    const csIdx = headers.findIndex(h => h === 'CALLSIGN' || h === 'RUFZEICHEN');
    if (csIdx < 0) return;
    // Tabelle hat schon eine eigene NAME-Spalte (z.B. "Caller Details") -> nichts tun
    if (headers.some((h, i) => h === 'NAME' && !head.cells[i].classList.contains(COL_CLASS))) return;

    if (!head.querySelector('.' + COL_CLASS)) {
      const th = document.createElement(head.cells[csIdx].tagName);
      th.className = head.cells[csIdx].className + ' ' + COL_CLASS;
      th.textContent = 'NAME';
      const thCity = document.createElement(head.cells[csIdx].tagName);
      thCity.className = head.cells[csIdx].className + ' ' + CITY_CLASS;
      thCity.textContent = 'ORT';
      head.cells[csIdx].after(th, thCity);
    }

    for (let r = 1; r < table.rows.length; r++) {
      const row = table.rows[r];
      if (row.querySelector('.' + COL_CLASS)) continue;
      const csCell = row.cells[csIdx];
      if (!csCell || row.cells.length < headers.length - 1) {
        // z.B. "keine Daten"-Zeile mit colspan
        if (csCell && csCell.colSpan > 1) csCell.colSpan += 2;
        continue;
      }
      const td = document.createElement('td');
      td.className = COL_CLASS;
      const tdCity = document.createElement('td');
      tdCity.className = CITY_CLASS;
      csCell.after(td, tdCity);
      const call = baseCall(csCell.innerText);
      if (!call) continue;
      td.textContent = '…';
      td.dataset.ridCall = call;
      getName(call).then(res => { if (td.isConnected) fill(td, tdCity, res); });
    }
  }

  // --- Profilfoto von qrz.com im Bereich "Current / Last Caller Details" ---
  const PHOTO_CLASS = 'rid-photo';
  const photoCache = new Map(); // Rufzeichen -> Promise<url|''>
  const photoKnown = new Map(); // Rufzeichen -> url|'' (sofort verfügbar, verhindert Flackern)

  function getPhoto(call) {
    if (!photoCache.has(call)) {
      photoCache.set(call, new Promise(resolve => {
        try {
          chrome.runtime.sendMessage({ type: 'qrz-photo', callsign: call }, res => {
            if (chrome.runtime.lastError || !res || res.error) { photoCache.delete(call); resolve(''); return; }
            photoKnown.set(call, res.photo || '');
            resolve(res.photo || '');
          });
        } catch (e) { photoCache.delete(call); resolve(''); }
      }));
    }
    return photoCache.get(call);
  }

  function addPhoto(cell, call, url, live) {
    if (!url || cell.querySelector('.' + PHOTO_CLASS)) return;
    // Foto verlinkt auf die QRZ-Profilseite
    const link = document.createElement('a');
    link.href = 'https://www.qrz.com/db/' + encodeURIComponent(call);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = call + ' auf QRZ.com';
    const img = document.createElement('img');
    img.className = PHOTO_CLASS;
    img.src = url;
    img.alt = call;
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => link.remove();
    link.append(img);
    if (live) {
      // Live-Caller-Seite: groß unter der Flagge. Die Flagge ist per "top" nach unten
      // verschoben, diesen Versatz übernehmen, damit sich beides nicht überlappt.
      link.className = 'rid-live-photo';
      const flag = cell.querySelector('span');
      const shift = flag ? parseFloat(getComputedStyle(flag).top) || 0 : 0;
      link.style.marginTop = (shift + 24) + 'px';
      cell.append(link);
    } else {
      cell.prepend(link);
    }
  }

  function processCallerDetails() {
    const box = document.getElementById('caller-details-container');
    if (!box) return;
    box.querySelectorAll('tbody tr').forEach(row => {
      const cell = row.cells[0];
      if (!cell || cell.dataset.ridPhoto) return;
      const call = baseCall(cell.innerText);
      if (!call) return;
      cell.dataset.ridPhoto = call;
      if (photoKnown.has(call)) { addPhoto(cell, call, photoKnown.get(call)); return; }
      getPhoto(call).then(url => { if (cell.isConnected) addPhoto(cell, call, url); });
    });
  }

  // Seite "Live Caller" (/live/): Foto in der Spalte mit der Länderflagge
  function processLivePage() {
    const root = document.getElementById('liveDetails');
    if (!root) return;
    const callEl = root.querySelector('.oc_call');
    if (!callEl) return;
    const call = baseCall(callEl.innerText);
    const flag = root.querySelector('.orange-column img.responsive');
    const col = flag ? flag.closest('.orange-column') : root.querySelectorAll('.orange-column')[1];
    if (!call || !col || col.dataset.ridPhoto === call) return;
    col.dataset.ridPhoto = call;
    col.querySelectorAll('.rid-live-photo').forEach(e => e.remove()); // Foto des vorigen Anrufers
    if (photoKnown.has(call)) { addPhoto(col, call, photoKnown.get(call), true); return; }
    getPhoto(call).then(url => {
      if (col.isConnected && col.dataset.ridPhoto === call) addPhoto(col, call, url, true);
    });
  }

  function run() {
    document.querySelectorAll('table').forEach(processTable);
    processCallerDetails();
    processLivePage();
  }

  let scheduled = false;
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; run(); });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  run();
})();
