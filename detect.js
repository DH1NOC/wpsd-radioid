// Erkennt WPSD-Seiten am Inhalt (nicht an der Adresse).
// Dashboard/Admin binden "wpsd-css" ein und verlinken wpsd.radio,
// die Live-Caller-Seite bindet "live-caller.css" ein und hat "WPSD" im Titel.
globalThis.ridIsWPSD = function () {
  if (document.querySelector('link[rel="stylesheet"][href*="wpsd-css"]')) return true;
  if (document.querySelector('a[href*="wpsd.radio"]')) return true;
  if (/\bWPSD\b/.test(document.title) &&
      document.querySelector('#liveDetails, link[rel="stylesheet"][href*="live-caller.css"]')) return true;
  return false;
};
// Rückgabewert für chrome.scripting.executeScript (Popup)
ridIsWPSD();
