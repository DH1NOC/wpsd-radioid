// Bug-Reporter im Popup:
// 1. Snapshot von Seite + Erweiterung (inkl. Screenshot des sichtbaren Bereichs)
// 2. Nutzer beschreibt, was schiefgelaufen ist
// 3. E-Mail an den Entwickler mit sprechendem Betreff wird im Mailprogramm geöffnet
(() => {
  const MAIL_TO = 'dh1noc@posteo.de';
  const MAX_MAILTO = 7500; // längere mailto-Links schneiden manche Mailprogramme ab

  const $ = id => document.getElementById(id);
  const bar = $('bugBar'), box = $('bug'), status = $('bugStatus'), form = $('bugForm');
  const shotImg = $('bugShot'), preview = $('bugPreview'), text = $('bugText');

  let snap = null;

  // Läuft im Tab (isolierte Welt der Erweiterung, sieht also auch __ridActive / ridIsWPSD).
  // Muss eigenständig sein – keine Variablen von außen verwenden.
  function pageSnapshot() {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const q = sel => !!document.querySelector(sel);
    const out = {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      viewport: innerWidth + 'x' + innerHeight,
      detectLoaded: typeof globalThis.ridIsWPSD === 'function',
      isWPSD: typeof globalThis.ridIsWPSD === 'function' ? globalThis.ridIsWPSD() : null,
      contentActive: !!window.__ridActive,
      signals: {
        wpsdCss: q('link[rel="stylesheet"][href*="wpsd-css"]'),
        wpsdLink: q('a[href*="wpsd.radio"]'),
        liveDetails: q('#liveDetails'),
        liveCss: q('link[rel="stylesheet"][href*="live-caller.css"]')
      },
      tables: [],
      callerDetails: null,
      live: null
    };

    document.querySelectorAll('table').forEach((t, i) => {
      const head = t.rows[0];
      if (!head) return;
      const headers = [...head.cells].map(c => clean(c.innerText).toUpperCase());
      const csIdx = headers.findIndex(h => h === 'CALLSIGN' || h === 'RUFZEICHEN');
      if (csIdx < 0) return;
      const names = [...t.querySelectorAll('td.rid-name')];
      const rows = [];
      for (let r = 1; r < t.rows.length && rows.length < 5; r++) {
        const row = t.rows[r];
        const cs = row.cells[csIdx];
        if (!cs) continue;
        rows.push({
          call: clean(cs.innerText),
          name: row.querySelector('td.rid-name') ? clean(row.querySelector('td.rid-name').innerText) : '(keine Spalte)',
          city: row.querySelector('td.rid-city') ? clean(row.querySelector('td.rid-city').innerText) : ''
        });
      }
      out.tables.push({
        index: i,
        id: t.id || (t.closest('[id]') || {}).id || '',
        headers,
        rows: t.rows.length - 1,
        nameCells: names.length,
        filled: names.filter(td => td.innerText.trim() && td.innerText.trim() !== '…').length,
        pending: names.filter(td => td.innerText.trim() === '…').length,
        empty: names.filter(td => !td.innerText.trim()).length,
        sample: rows
      });
    });

    const cd = document.getElementById('caller-details-container');
    if (cd) {
      const first = cd.querySelector('tbody tr td');
      out.callerDetails = {
        rows: cd.querySelectorAll('tbody tr').length,
        firstCall: first ? clean(first.innerText) : '',
        photos: cd.querySelectorAll('img.rid-photo').length
      };
    }
    const live = document.getElementById('liveDetails');
    if (live) {
      const c = live.querySelector('.oc_call');
      out.live = {
        call: c ? clean(c.innerText) : '',
        photo: !!live.querySelector('img.rid-photo'),
        orangeColumns: live.querySelectorAll('.orange-column').length
      };
    }
    // Aktueller DOM-Stand (inkl. der vom Plugin eingefügten Spalten/Fotos)
    const dt = document.doctype;
    out.html = (dt ? '<!DOCTYPE ' + dt.name + (dt.publicId ? ' PUBLIC "' + dt.publicId + '"' : '') +
                (dt.systemId ? ' "' + dt.systemId + '"' : '') + '>\n' : '') +
      '<!-- WPSD RadioID Bugreport: DOM-Snapshot von ' + location.href.replace(/--/g, '- -') +
      ' am ' + new Date().toISOString() + ' -->\n' + document.documentElement.outerHTML;
    return out;
  }

  function baseCall(t) {
    const m = (t || '').toUpperCase().trim().match(/^[A-Z0-9]{3,8}/);
    return m ? m[0] : '';
  }

  async function takeSnapshot() {
    const manifest = chrome.runtime.getManifest();
    const s = {
      time: new Date(),
      ext: { name: manifest.name, version: manifest.version },
      browser: {
        ua: navigator.userAgent,
        chrome: (navigator.userAgent.match(/Chrome\/([\d.]+)/) || [])[1] || '?',
        lang: navigator.language
      },
      tab: null, plugin: {}, page: null, pageError: null, screenshot: null, shotError: null, html: null
    };

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let url = null;
    try { url = new URL(tab.url); } catch (e) { /* z.B. chrome:// */ }
    s.tab = { url: tab.url || '(unbekannt)', title: tab.title || '', status: tab.status };

    // Zustand der Erweiterung
    const origin = url && /^https?:$/.test(url.protocol) ? url.protocol + '//' + url.hostname + '/*' : null;
    const perms = await chrome.permissions.getAll();
    s.plugin.origin = origin;
    s.plugin.granted = origin ? await chrome.permissions.contains({ origins: [origin] }) : false;
    s.plugin.origins = perms.origins || [];
    try {
      s.plugin.scripts = (await chrome.scripting.getRegisteredContentScripts())
        .map(c => ({ id: c.id, matches: c.matches, persist: c.persistAcrossSessions }));
    } catch (e) { s.plugin.scripts = 'Fehler: ' + e.message; }

    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const cs = Object.entries(all).filter(([k]) => k.startsWith('cs_'));
    const qrz = Object.entries(all).filter(([k]) => k.startsWith('qrz_'));
    s.plugin.cache = {
      radioid: cs.length, radioidHits: cs.filter(([, v]) => v && v.name).length,
      qrz: qrz.length, qrzPhotos: qrz.filter(([, v]) => v && v.photo).length,
      bytes: await chrome.storage.local.getBytesInUse(null)
    };
    s.plugin.errors = (all.errlog || []).slice(-10);

    // Zustand der Seite
    if (tab.id != null && origin) {
      try {
        const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageSnapshot });
        s.page = res ? res.result : null;
        if (s.page) { s.html = s.page.html || null; delete s.page.html; }
      } catch (e) { s.pageError = e.message; }
    } else {
      s.pageError = 'Kein http(s)-Tab';
    }

    // Cache-Einträge zu den Rufzeichen auf der Seite
    if (s.page) {
      const calls = new Set();
      s.page.tables.forEach(t => t.sample.forEach(r => calls.add(baseCall(r.call))));
      if (s.page.callerDetails) calls.add(baseCall(s.page.callerDetails.firstCall));
      if (s.page.live) calls.add(baseCall(s.page.live.call));
      calls.delete('');
      s.plugin.cacheForPage = [...calls].slice(0, 12).map(c => {
        const r = all['cs_' + c], p = all['qrz_' + c];
        return {
          call: c,
          radioid: r ? (r.name ? 'Name ✓' : 'nicht gefunden') + ', ' + Math.round((now - r.t) / 3600000) + ' h alt' : '—',
          qrz: p ? (p.photo ? 'Foto ✓' : 'kein Foto') + ', ' + Math.round((now - p.t) / 3600000) + ' h alt' : '—'
        };
      });
    }

    // Screenshot des sichtbaren Bereichs (activeTab genügt, solange das Popup offen ist)
    try {
      s.screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 70 });
    } catch (e) { s.shotError = e.message; }

    return s;
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function stamp(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
           pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function pageKind(s) {
    if (!s.page) return 'unbekannte Seite';
    if (s.page.live) return 'Live Caller';
    if (s.page.isWPSD) return 'Dashboard';
    return 'keine WPSD-Seite';
  }

  function reportText(s) {
    const L = [];
    const yn = b => (b ? 'ja' : 'nein');
    L.push('=== Erweiterung ===');
    L.push(`${s.ext.name} ${s.ext.version}, Chrome ${s.browser.chrome}, ${s.browser.lang}`);
    L.push('Zeitpunkt: ' + stamp(s.time));
    L.push('Freigeschaltet für diese Adresse: ' + yn(s.plugin.granted) + (s.plugin.origin ? ' (' + s.plugin.origin + ')' : ''));
    L.push('Freigeschaltete Adressen: ' + (s.plugin.origins.join(', ') || '—'));
    L.push('Registrierte Scripts: ' + (Array.isArray(s.plugin.scripts)
      ? (s.plugin.scripts.map(c => c.id + ' → ' + c.matches.join(', ')).join('; ') || '—')
      : s.plugin.scripts));
    const c = s.plugin.cache;
    L.push(`Cache: radioid ${c.radioid} (${c.radioidHits} mit Name), qrz ${c.qrz} (${c.qrzPhotos} mit Foto), ${Math.round(c.bytes / 1024)} KB`);
    if (s.plugin.errors.length) {
      L.push('Letzte Fehler:');
      s.plugin.errors.forEach(e => L.push(`  ${stamp(new Date(e.t))} ${e.where} ${e.call}: ${e.msg}`));
    } else {
      L.push('Letzte Fehler: keine');
    }

    L.push('', '=== Seite ===');
    L.push('URL: ' + s.tab.url);
    L.push('Titel: ' + s.tab.title);
    if (s.pageError) L.push('Seite nicht lesbar: ' + s.pageError);
    const p = s.page;
    if (p) {
      L.push(`Typ: ${pageKind(s)}, readyState ${p.readyState}, Fenster ${p.viewport}`);
      L.push(`WPSD erkannt: ${p.isWPSD === null ? 'detect.js nicht geladen' : yn(p.isWPSD)}` +
             ` (wpsd-css ${yn(p.signals.wpsdCss)}, wpsd.radio-Link ${yn(p.signals.wpsdLink)},` +
             ` #liveDetails ${yn(p.signals.liveDetails)}, live-caller.css ${yn(p.signals.liveCss)})`);
      L.push('Content-Script aktiv: ' + yn(p.contentActive));
      if (!p.tables.length) L.push('Tabellen mit CALLSIGN: keine');
      p.tables.forEach(t => {
        L.push(`Tabelle #${t.index}${t.id ? ' (' + t.id + ')' : ''}: ${t.rows} Zeilen, ` +
               `Namen ${t.filled} gefüllt / ${t.pending} ladend / ${t.empty} leer (von ${t.nameCells})`);
        L.push('  Spalten: ' + t.headers.join(' | '));
        t.sample.forEach(r => L.push(`  ${r.call} → ${r.name || '(leer)'}${r.city ? ', ' + r.city : ''}`));
      });
      if (p.callerDetails) {
        L.push(`Caller Details: ${p.callerDetails.rows} Zeile(n), erstes Rufzeichen "${p.callerDetails.firstCall}", Fotos ${p.callerDetails.photos}`);
      }
      if (p.live) {
        L.push(`Live Caller: Rufzeichen "${p.live.call}", Foto ${yn(p.live.photo)}, orange-column ${p.live.orangeColumns}`);
      }
    }
    if (s.plugin.cacheForPage && s.plugin.cacheForPage.length) {
      L.push('Cache zu Rufzeichen auf der Seite:');
      s.plugin.cacheForPage.forEach(e => L.push(`  ${e.call}: radioid ${e.radioid}; qrz ${e.qrz}`));
    }
    L.push('Screenshot: ' + (s.screenshot ? 'erstellt' : 'fehlgeschlagen (' + s.shotError + ')'));
    L.push('Seiten-HTML: ' + (s.html ? 'erfasst (' + Math.round(s.html.length / 1024) + ' KB)' : 'nicht verfügbar'));
    L.push('', 'User-Agent: ' + s.browser.ua);
    return L.join('\n');
  }

  function subject(desc, s) {
    const first = desc.split('\n').find(l => l.trim()) || '';
    let short = first.trim().replace(/\s+/g, ' ');
    if (short.length > 60) short = short.slice(0, 57).trimEnd() + '…';
    const flags = [pageKind(s)];
    if (!s.plugin.granted) flags.push('nicht freigeschaltet');
    else if (s.page && !s.page.contentActive) flags.push('Script inaktiv');
    if (s.plugin.errors.length) flags.push(s.plugin.errors.length + ' Fehler im Log');
    return `[WPSD RadioID ${s.ext.version}] Bug: ${short} (${flags.join(', ')})`;
  }

  function openMail(subj, body) {
    const a = document.createElement('a');
    a.href = 'mailto:' + MAIL_TO + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
    a.click();
  }

  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PASTE_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘V' : 'Strg+V';
  const MAX_HTML = 400 * 1024; // Seiten-HTML in der Mail begrenzen

  // Screenshot verkleinern, damit die Mail nicht unnötig groß wird
  function shrink(dataUrl, maxW = 1400) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const f = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * f);
        c.height = Math.round(img.height * f);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve({ url: c.toDataURL('image/jpeg', 0.75), w: c.width });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  // Bericht + Screenshot + Seiten-HTML als formatierten Inhalt in die Zwischenablage.
  // Beim Einfügen in die Mail landet der Screenshot als Bild direkt im Text.
  async function copyToClipboard(s, report) {
    let page = s.html || '';
    if (page.length > MAX_HTML) page = page.slice(0, MAX_HTML) + '\n[… gekürzt, Seite war ' + Math.round(s.html.length / 1024) + ' KB groß]';
    const shot = s.screenshot ? await shrink(s.screenshot) : null;

    const pre = 'font-family:ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;';
    const html =
      '<div style="font-family:-apple-system,Segoe UI,sans-serif">' +
      '<p><b>— Bugreport (automatisch erfasst) —</b></p>' +
      (shot ? '<p><b>Screenshot:</b><br><img src="' + shot.url + '" width="' + Math.min(shot.w, 800) +
              '" style="max-width:100%;border:1px solid #ccc" alt="Screenshot"></p>' : '') +
      '<p><b>Zustand:</b></p><pre style="' + pre + 'font-size:12px">' + esc(report) + '</pre>' +
      (page ? '<p><b>Seiten-HTML:</b></p><pre style="' + pre + 'font-size:10px;color:#555">' + esc(page) + '</pre>' : '') +
      '</div>';
    const plain = '— Bugreport (automatisch erfasst) —\n\n' + report +
      (page ? '\n\n=== Seiten-HTML ===\n' + page : '');

    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' })
    })]);
  }

  $('bugKey').textContent = PASTE_KEY;

  $('bugStart').onclick = async () => {
    bar.hidden = true;
    box.hidden = false;
    form.hidden = true;
    status.textContent = 'Erfasse Zustand von Seite und Erweiterung …';
    try {
      snap = await takeSnapshot();
    } catch (e) {
      status.textContent = 'Snapshot fehlgeschlagen: ' + e.message;
      return;
    }
    status.textContent = 'Zustand erfasst um ' + stamp(snap.time).slice(11) + '.';
    preview.textContent = reportText(snap);
    shotImg.hidden = !snap.screenshot;
    if (snap.screenshot) shotImg.src = snap.screenshot;
    form.hidden = false;
    text.focus();
  };

  $('bugCancel').onclick = () => {
    snap = null;
    box.hidden = true;
    bar.hidden = false;
  };

  $('bugSend').onclick = async () => {
    const desc = text.value.trim();
    if (!desc) {
      text.placeholder = 'Bitte kurz beschreiben, was schiefgelaufen ist.';
      text.focus();
      return;
    }
    const report = reportText(snap);
    const head = 'Beschreibung:\n' + desc + '\n\n';

    // Erst kopieren (das Popup braucht dafür noch den Fokus), dann Mail öffnen
    let copied = false;
    try { await copyToClipboard(snap, report); copied = true; } catch (e) { /* Fallback unten */ }

    let body;
    if (copied) {
      body = head + '----------------------------------------\n' +
        '👉 Jetzt hier klicken und ' + PASTE_KEY + ' drücken.\n' +
        'Damit werden Bericht, Screenshot und Seiten-HTML eingefügt.\n';
    } else {
      // Zwischenablage nicht verfügbar: wenigstens den Bericht (ggf. gekürzt) in die Mail
      let r = report;
      while (r.length > 200 && encodeURIComponent(head + r).length > MAX_MAILTO - 300) r = r.slice(0, Math.floor(r.length * 0.9));
      body = head + r + (r.length < report.length ? '\n[… gekürzt]' : '');
    }
    openMail(subject(desc, snap), body);

    form.hidden = true;
    status.innerHTML = copied
      ? '✓ E-Mail wurde geöffnet.<br><b>Jetzt im Mailtext ' + PASTE_KEY + ' drücken</b> – das fügt Bericht, Screenshot und Seiten-HTML ein.'
      : '✓ E-Mail wurde geöffnet (ohne Screenshot und Seiten-HTML, die Zwischenablage war nicht verfügbar).';
  };
})();
