/* ============================================================
   InstaBuilt — floating pages menu toggle (shared by all pages)
   ============================================================ */
(function () {
  'use strict';
  var toggle = document.getElementById('side-nav-toggle');
  var panel = document.getElementById('side-nav-panel');
  var close = document.getElementById('side-nav-close');
  var backdrop = document.getElementById('side-nav-backdrop');
  if (!toggle || !panel) return;

  function openNav() { panel.classList.add('open'); if (backdrop) backdrop.classList.add('open'); }
  function closeNav() { panel.classList.remove('open'); if (backdrop) backdrop.classList.remove('open'); }

  toggle.addEventListener('click', function (e) { e.stopPropagation(); openNav(); });
  if (close) close.addEventListener('click', closeNav);
  if (backdrop) backdrop.addEventListener('click', closeNav);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });

  // highlight the link for the current page (only real .html links)
  var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  panel.querySelectorAll('a').forEach(function (a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    var idx = href.indexOf('.html');
    var hFile = idx === -1 ? null : href.slice(0, idx + 5);
    if (hFile === file) a.classList.add('active');
  });
})();
