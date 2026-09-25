/* Responsive navigation: keep every page link in the mobile menu. */
(function () {
  var nav = document.getElementById('site-nav');
  if (!nav) return;
  var button = nav.querySelector('.nav-toggle');
  var visible = nav.querySelector('.visible-links');
  var hidden = nav.querySelector('.hidden-links');
  var links = Array.from(visible.children).filter(function (item) {
    return !item.classList.contains('persist');
  });
  var mobile = window.matchMedia('(max-width: 924px)');

  function closeMenu() {
    hidden.classList.add('hidden');
    button.classList.remove('close');
    button.setAttribute('aria-expanded', 'false');
  }

  function updateNav() {
    // Start from the original order rather than cached widths from another layout.
    links.forEach(function (item) { visible.appendChild(item); });
    button.classList.add('hidden');
    if (mobile.matches) {
      links.forEach(function (item) { hidden.appendChild(item); });
    } else if (visible.getBoundingClientRect().width > nav.clientWidth) {
      button.classList.remove('hidden');
      var available = nav.clientWidth - button.getBoundingClientRect().width - 8;
      while (visible.getBoundingClientRect().width > available) {
        var candidates = visible.querySelectorAll(':scope > li:not(.persist)');
        if (!candidates.length) break;
        hidden.insertBefore(candidates[candidates.length - 1], hidden.firstChild);
      }
    }
    button.classList.toggle('hidden', hidden.children.length === 0);
    button.setAttribute('count', hidden.children.length);
    if (!hidden.children.length) closeMenu();
  }

  button.addEventListener('click', function () {
    var open = button.getAttribute('aria-expanded') !== 'true';
    hidden.classList.toggle('hidden', !open);
    button.classList.toggle('close', open);
    button.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function (event) {
    if (!nav.contains(event.target)) closeMenu();
  });
  nav.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeMenu(); button.focus(); }
  });
  hidden.addEventListener('click', function (event) {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('site:navigated', function () { closeMenu(); updateNav(); });
  window.addEventListener('resize', updateNav);
  window.addEventListener('pageshow', function () { closeMenu(); updateNav(); });
  if (document.fonts) document.fonts.ready.then(updateNav);

  var masthead = document.querySelector('.masthead');
  function updateHeaderHeight() {
    document.documentElement.style.setProperty('--masthead-height', masthead.getBoundingClientRect().height + 'px');
  }
  if (window.ResizeObserver) new ResizeObserver(updateHeaderHeight).observe(masthead);
  else window.addEventListener('resize', updateHeaderHeight);
  updateNav();
  updateHeaderHeight();
})();
