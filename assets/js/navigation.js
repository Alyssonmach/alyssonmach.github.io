/* Progressive navigation: retain the header and matching author profile. */
(function () {
  if (!window.fetch || !window.AbortController) return;
  const main = document.getElementById('main');
  if (!main || !main.parentElement.matches('.site__content')) return;

  let pending;
  let currentURL = location.href;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const status = document.createElement('div');
  status.className = 'sr-only';
  status.setAttribute('role', 'status');
  document.body.appendChild(status);
  history.replaceState({ ...history.state, partialNavigation: true, scroll: [scrollX, scrollY] }, '', location.href);
  history.scrollRestoration = 'manual';

  // Small, short-lived in-memory cache; shared requests avoid duplicate downloads.
  const pageCache = new Map();
  const CACHE_LIMIT = 8;
  const CACHE_TTL = 120000;
  const progress = document.createElement('div');
  progress.className = 'navigation-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.querySelector('.masthead').appendChild(progress);

  function requestPage(url) {
    const key = new URL(url);
    key.hash = '';
    const href = key.href;
    const cached = pageCache.get(href);
    if (cached && Date.now() - cached.created < CACHE_TTL) {
      pageCache.delete(href);
      pageCache.set(href, cached);
      return cached.promise;
    }
    const controller = new AbortController();
    const entry = { created: Date.now() };
    const timeout = setTimeout(() => controller.abort(), 8000);
    entry.promise = fetch(href, { signal: controller.signal, headers: { Accept: 'text/html' } })
      .then(async response => {
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || response.redirected) throw Error('Full navigation required');
        return response.text();
      }).catch(error => {
        if (pageCache.get(href) === entry) pageCache.delete(href);
        throw error;
      }).finally(() => clearTimeout(timeout));
    pageCache.set(href, entry);
    if (pageCache.size > CACHE_LIMIT) pageCache.delete(pageCache.keys().next().value);
    return entry.promise;
  }

  function readPage(url, signal) {
    return new Promise((resolve, reject) => {
      const abort = () => reject(new Error('Navigation cancelled'));
      if (signal.aborted) { abort(); return; }
      signal.addEventListener('abort', abort, { once: true });
      requestPage(url).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  // Prefetch only menu destinations the visitor is about to use.
  let intentTimer;
  let prefetching = 0;
  function prefetch(link) {
    const connection = navigator.connection;
    if (!link || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '') || prefetching >= 2) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.search || (url.pathname === location.pathname) ||
        link.hasAttribute('download') || link.hasAttribute('data-no-partial') || (link.target && link.target !== '_self')) return;
    prefetching++;
    requestPage(url.href).catch(() => {}).finally(() => prefetching--);
  }
  document.querySelector('#site-nav').addEventListener('pointerover', event => {
    clearTimeout(intentTimer);
    const link = event.target.closest('a[href]');
    intentTimer = setTimeout(() => prefetch(link), 90);
  });
  document.querySelector('#site-nav').addEventListener('pointerleave', () => clearTimeout(intentTimer));
  ['focusin', 'pointerdown'].forEach(type => document.querySelector('#site-nav').addEventListener(type, event => {
    prefetch(event.target.closest('a[href]'));
  }));

  function saveScroll() {
    history.replaceState({ ...history.state, partialNavigation: true, scroll: [scrollX, scrollY] }, '', location.href);
  }

  function scripts(doc) {
    return Array.from(doc.querySelectorAll('script:not([type="application/ld+json"]):not([data-content-resource])'))
      .map(node => node.getAttribute('src') || node.textContent).join('\n');
  }

  function compatible(doc) {
    const next = doc.getElementById('main');
    if (!next || !next.parentElement.matches('.site__content') ||
        next.parentElement.children.length !== 1 || main.parentElement.children.length !== 1 ||
        doc.body.className !== document.body.className || next.querySelector('script')) return false;
    const sidebar = main.querySelector(':scope > .sidebar');
    const nextSidebar = next.querySelector(':scope > .sidebar');
    const styles = root => Array.from(root.querySelectorAll('link[rel="stylesheet"]'))
      .map(node => node.getAttribute('href')).filter(href => !/academicons|fontawesome/.test(href)).join();
    return (sidebar?.outerHTML || '') === (nextSidebar?.outerHTML || '') &&
      styles(doc) === styles(document) && scripts(doc) === scripts(document);
  }

  function syncHead(doc) {
    document.title = doc.title;
    const selector = 'meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], script[type="application/ld+json"]';
    document.head.querySelectorAll(selector).forEach(node => node.remove());
    doc.head.querySelectorAll(selector).forEach(node => document.head.appendChild(node.cloneNode(true)));
  }

  function syncMenu(doc) {
    const selected = new Set(Array.from(doc.querySelectorAll('#site-nav .selected a')).map(a => a.getAttribute('href')));
    document.querySelectorAll('#site-nav .masthead__menu-item').forEach(item => {
      const link = item.querySelector('a');
      const active = link && selected.has(link.getAttribute('href'));
      item.classList.toggle('selected', !!active);
      if (link) {
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    });
    document.dispatchEvent(new Event('site:navigated'));
  }

  async function navigate(url, state, focusHeading = false) {
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), 10000);
    main.setAttribute('aria-busy', 'true');
    progress.removeAttribute('data-loading');
    const loadingTimer = setTimeout(() => {
      if (pending !== controller) return;
      progress.setAttribute('data-loading', 'true');
      status.textContent = 'Carregando…';
    }, 180);
    try {
      const html = await readPage(url, controller.signal);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (pending !== controller) return;
      if (!compatible(doc)) throw Error('Full navigation required');
      const next = doc.getElementById('main');
      main.querySelectorAll('.js-plotly-plot').forEach(chart => window.Plotly?.purge(chart));
      // Only content siblings change; the profile and masthead keep their DOM nodes.
      Array.from(main.children).filter(node => !node.matches('.sidebar')).forEach(node => node.remove());
      Array.from(next.children).filter(node => !node.matches('.sidebar')).forEach(node => {
        main.appendChild(node);
        if (!reducedMotion.matches && node.animate) node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
      });
      if (!state) history.pushState({ partialNavigation: true, scroll: [0, 0] }, '', url);
      currentURL = location.href;
      syncHead(doc);
      syncMenu(doc);
      document.dispatchEvent(new CustomEvent('site:content', { detail: { root: main } }));
      const heading = main.querySelector('.page__title, article h1, .archive h1');
      // Move focus into the new content only for keyboard/assistive activation.
      // Pointer navigation should not highlight the heading automatically.
      if (heading && focusHeading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
      const hash = new URL(url).hash;
      const target = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
      const point = state?.scroll || (target ? [0, target.getBoundingClientRect().top + scrollY - document.querySelector('.masthead').offsetHeight - 12] : [0, 0]);
      // Override the site's smooth scrolling only for this history/navigation jump.
      const previous = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(point[0], point[1]);
      document.documentElement.style.scrollBehavior = previous;
      status.textContent = document.title;
    } catch (error) {
      if (pending === controller) location.assign(url);
    } finally {
      clearTimeout(timeout);
      clearTimeout(loadingTimer);
      if (pending === controller) {
        pending = null; main.removeAttribute('aria-busy'); progress.removeAttribute('data-loading');
      }
    }
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute('download') || (link.target && link.target !== '_self') || link.hasAttribute('data-no-partial')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || /\.[^/]+$/.test(url.pathname) && !/\.html?$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      pending?.abort(); pending = null; main.removeAttribute('aria-busy'); progress.removeAttribute('data-loading'); status.textContent = '';
      return;
    }
    event.preventDefault();
    saveScroll();
    navigate(url.href, undefined, event.detail === 0);
  });

  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (!pending && currentURL === location.href) saveScroll();
    }, 200);
  }, { passive: true });

  window.addEventListener('popstate', event => {
    const previous = new URL(currentURL);
    if (previous.pathname === location.pathname && previous.search === location.search) {
      pending?.abort(); pending = null; main.removeAttribute('aria-busy'); progress.removeAttribute('data-loading'); status.textContent = '';
      currentURL = location.href;
      if (event.state?.scroll) window.scrollTo(...event.state.scroll);
      return;
    }
    navigate(location.href, event.state || { scroll: [0, 0] });
  });
})();
