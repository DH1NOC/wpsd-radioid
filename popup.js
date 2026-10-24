// Popup am Erweiterungs-Symbol: prüft die aktuelle Seite auf WPSD und schaltet
// die Erweiterung für genau diese Adresse frei (oder wieder ab).
const msg = document.getElementById('msg');
const btnOn = document.getElementById('enable');
const btnOff = document.getElementById('disable');

function show(html, on = false, off = false) {
  msg.innerHTML = html;
  btnOn.hidden = !on;
  btnOff.hidden = !off;
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let url;
  try { url = new URL(tab.url); } catch (e) { url = null; }
  if (!url || !/^https?:$/.test(url.protocol)) {
    show('Auf dieser Seite nicht nutzbar. Bitte ein WPSD-Dashboard öffnen.');
    return;
  }
  // Muster ohne Port – gilt für alle Ports dieses Hosts
  const origin = url.protocol + '//' + url.hostname + '/*';
  const host = '<span class="host">' + esc(url.hostname) + '</span>';

  if (await chrome.permissions.contains({ origins: [origin] })) {
    show('<span class="ok">✓ Aktiv</span> auf ' + host + '.', false, true);
  } else {
    // Seiteninhalt prüfen (möglich dank activeTab, solange das Popup offen ist)
    let isWPSD = false;
    try {
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['detect.js'] });
      isWPSD = !!(res && res.result);
    } catch (e) { /* kein Zugriff */ }
    if (isWPSD) {
      show('WPSD-Dashboard erkannt auf ' + host + '.', true);
    } else {
      show('<span class="warn">Keine WPSD-Seite erkannt</span> auf ' + host + '.');
    }
  }

  btnOn.onclick = async () => {
    // Chrome fragt einmalig nach Zugriff auf genau diese Adresse.
    // Das Registrieren und Einfügen übernimmt background.js (permissions.onAdded).
    const ok = await chrome.permissions.request({ origins: [origin] });
    show(ok ? '<span class="ok">✓ Aktiviert</span> für ' + host + '.' : 'Nicht aktiviert.', !ok, ok);
  };
  btnOff.onclick = async () => {
    await chrome.permissions.remove({ origins: [origin] });
    show('Deaktiviert für ' + host + '. Seite neu laden, um die Anzeige zu entfernen.', true);
  };
})();
