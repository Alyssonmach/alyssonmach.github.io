function configureLinkTarget(link, baseURL) {
  const href = link.getAttribute('href');
  if (!href || href.trim().startsWith('#')) return;

  let url;
  try {
    url = new URL(href, baseURL);
  } catch {
    return;
  }
  if (!/^https?:$/.test(url.protocol)) return;

  const isExternal = url.origin !== location.origin;
  const isPDF = /\.pdf$/i.test(url.pathname) || link.getAttribute('type')?.toLowerCase() === 'application/pdf';
  if (!isExternal && !isPDF) return;

  link.setAttribute('target', '_blank');
  const relationships = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
  relationships.add('noopener');
  relationships.add('noreferrer');
  link.setAttribute('rel', Array.from(relationships).join(' '));
}

export function configureLinkTargets(root, baseURL = document.baseURI) {
  if (root.matches?.('a[href]')) configureLinkTarget(root, baseURL);
  root.querySelectorAll('a[href]').forEach(link => configureLinkTarget(link, baseURL));
}

configureLinkTargets(document);
document.addEventListener('site:content', event => configureLinkTargets(event.detail.root));

// Capture activation before partial navigation, including links added dynamically.
document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href]');
  if (link) configureLinkTarget(link, document.baseURI);
}, true);
