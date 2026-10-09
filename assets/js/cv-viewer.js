// A same-origin iframe isolates PDF.js while sharing the site's normal scroll.
const status = document.getElementById('status');
const pages = document.getElementById('pages');
let library;
let documentPDF;
let revision = 0;
let queue = Promise.resolve();
const sheets = [];

function fitFrame() {
  if (window.frameElement) {
    window.frameElement.style.height = `${Math.ceil(document.body.getBoundingClientRect().height)}px`;
  }
}
new ResizeObserver(fitFrame).observe(document.body);

function failure(error) {
  console.warn('CV reader:', error);
  status.classList.remove('loaded');
  status.textContent = 'Não foi possível carregar o currículo. Tente atualizar a página.';
  fitFrame();
}

function requestRender() {
  const requested = ++revision;
  // Serialize rendering; discard outdated work after a viewport resize.
  queue = queue.then(async () => {
    if (requested !== revision) return;
    for (const { page, sheet } of sheets) {
      const scale = Math.max(0.1, pages.clientWidth / page.getViewport({ scale: 1 }).width);
      const viewport = page.getViewport({ scale });
      const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8000000 / (viewport.width * viewport.height)));
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.width = Math.floor(viewport.width * density);
      canvas.height = Math.floor(viewport.height * density);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport,
        transform: [density, 0, 0, density, 0, 0] }).promise;
      if (requested !== revision) return;
      sheet.replaceChildren(canvas);
      sheet.style.setProperty('--total-scale-factor', scale);
      const text = document.createElement('div');
      text.className = 'textLayer';
      sheet.appendChild(text);
      await new library.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport }).render();
      const annotations = await page.getAnnotations();
      if (requested !== revision) return;
      for (const annotation of annotations) {
        if (!annotation.url || !/^(https?:|mailto:)/i.test(annotation.url)) continue;
        const rect = [...viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1]),
          ...viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3])];
        const link = document.createElement('a');
        link.className = 'pdf-link';
        link.href = annotation.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `Abrir ${annotation.url}`);
        Object.assign(link.style, { left: `${Math.min(rect[0], rect[2])}px`, top: `${Math.min(rect[1], rect[3])}px`,
          width: `${Math.abs(rect[2] - rect[0])}px`, height: `${Math.abs(rect[3] - rect[1])}px` });
        sheet.appendChild(link);
      }
      // The first page can be read while subsequent pages finish rendering.
      status.classList.add('loaded');
      fitFrame();
    }
    status.textContent = 'Currículo carregado.';
    pages.dataset.ready = 'true';
  }).catch(failure);
}

async function initialize() {
  library = await import('../pdfjs/pdf.min.mjs');
  library.GlobalWorkerOptions.workerSrc = new URL('../pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  documentPDF = await library.getDocument({
    url: new URL('../../files/cv/cv.pdf', import.meta.url).href,
    standardFontDataUrl: new URL('../pdfjs/standard_fonts/', import.meta.url).href,
    isEvalSupported: false,
    useWasm: false
  }).promise;
  for (let number = 1; number <= documentPDF.numPages; number++) {
    const page = await documentPDF.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const sheet = document.createElement('section');
    sheet.className = 'pdf-page';
    sheet.setAttribute('aria-label', `Página ${number} de ${documentPDF.numPages}`);
    // Reserve every page's space before rendering, avoiding shifts while reading.
    sheet.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    pages.appendChild(sheet);
    sheets.push({ page, sheet });
  }
  fitFrame();
  let resizeTimer;
  let lastWidth = pages.clientWidth;
  new ResizeObserver(() => {
    if (pages.clientWidth === lastWidth) return;
    lastWidth = pages.clientWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(requestRender, 120);
  }).observe(pages);
  requestRender();
}
initialize().catch(failure);
