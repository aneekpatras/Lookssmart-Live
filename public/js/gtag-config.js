(function () {
  var script = document.currentScript;
  var id = script && script.getAttribute('data-ga-id');
  if (id && typeof window.gtag === 'function') { window.gtag('config', id); }
})();
