/*
 * Google tag loader, gated by the visitor's cookie choice. External file (the CSP allows no inline script).
 * Nothing from Google is requested until the visitor has pressed Accept in the cookie banner; Decline and
 * the browser's Do Not Track setting always win. The banner (CookieBanner.tsx) calls window.lsAnalytics.load()
 * right after Accept, and the stored choice (localStorage ls_consent_v1) loads the tag on later visits.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;

  var kind = script.getAttribute('data-kind');
  var id = script.getAttribute('data-id');
  var nonce = script.nonce || script.getAttribute('nonce') || '';
  var KEY = 'ls_consent_v1';
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  var loaded = false;

  function doNotTrack() {
    return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1';
  }

  function accepted() {
    try {
      var value = JSON.parse(window.localStorage.getItem(KEY) || 'null');
      return !!value && value.choice === 'accepted' && Date.now() - Number(value.ts) < MAX_AGE_MS;
    } catch (e) {
      return false;
    }
  }

  function addScript(src) {
    var el = document.createElement('script');
    el.async = true;
    el.src = src;
    if (nonce) el.setAttribute('nonce', nonce);
    document.head.appendChild(el);
  }

  function load() {
    if (loaded || !id || doNotTrack()) return;
    loaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());

    if (kind === 'gtm') {
      window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      addScript('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id));
    } else {
      addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
      window.gtag('config', id);
    }
  }

  window.lsAnalytics = { load: load, available: !doNotTrack() };

  if (accepted()) load();
})();
