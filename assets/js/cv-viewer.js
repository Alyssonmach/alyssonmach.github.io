// A same-origin iframe isolates PDF.js while sharing the site's normal scroll.
const statusMessage = document.getElementById('status');
const pageContainer = document.getElementById('pages');
let pdfjs;
let pdfDocument;
let renderRevision = 0;
let renderQueue = Promise.resolve();
const pageSheets = [];
function fitFrame() {
  if (window.frameElement) {
    window.frameElement.style.height = `${Math.ceil(document.body.getBoundingClientRect().height)}px`;
  }
}
new ResizeObserver(fitFrame).observe(document.body);
function showLoadError(error) {
  console.warn('CV reader:', error);
  statusMessage.classList.remove('loaded');
  statusMessage.textContent = 'Não foi possível carregar o currículo. Tente atualizar a página.';
  fitFrame();
}
function scheduleRender() {
  const requested = ++renderRevision;
  // Serialize rendering; discard outdated work after a viewport resize.
  renderQueue = renderQueue.then(async () => {
    if (requested !== renderRevision) return;
    for (const {
      page,
      sheet
    } of pageSheets) {
      const scale = Math.max(0.1, pageContainer.clientWidth / page.getViewport({
        scale: 1
      }).width);
      const viewport = page.getViewport({
        scale
      });
      const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8000000 / (viewport.width * viewport.height)));
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.width = Math.floor(viewport.width * density);
      canvas.height = Math.floor(viewport.height * density);
      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        transform: [density, 0, 0, density, 0, 0]
      }).promise;
      if (requested !== renderRevision) return;
      sheet.replaceChildren(canvas);
      sheet.style.setProperty('--total-scale-factor', scale);
      const text = document.createElement('div');
      text.className = 'textLayer';
      sheet.appendChild(text);
      await new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: text,
        viewport
      }).render();
      const annotations = await page.getAnnotations();
      if (requested !== renderRevision) return;
      for (const annotation of annotations) {
        if (!annotation.url || !/^(https?:|mailto:)/i.test(annotation.url)) continue;
        const rect = [...viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1]), ...viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3])];
        const link = document.createElement('a');
        link.className = 'pdf-link';
        link.href = annotation.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `Abrir ${annotation.url}`);
        Object.assign(link.style, {
          left: `${Math.min(rect[0], rect[2])}px`,
          top: `${Math.min(rect[1], rect[3])}px`,
          width: `${Math.abs(rect[2] - rect[0])}px`,
          height: `${Math.abs(rect[3] - rect[1])}px`
        });
        sheet.appendChild(link);
      }
      // The first page can be read while subsequent pages finish rendering.
      statusMessage.classList.add('loaded');
      fitFrame();
    }
    statusMessage.textContent = 'Currículo carregado.';
    pageContainer.dataset.ready = 'true';
  }).catch(showLoadError);
}
async function initialize() {
  pdfjs = await import('../pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  pdfDocument = await pdfjs.getDocument({
    url: new URL('../../files/CV-LaTeX/cv-llt.pdf', import.meta.url).href,
    standardFontDataUrl: new URL('../pdfjs/standard_fonts/', import.meta.url).href,
    isEvalSupported: false,
    useWasm: false
  }).promise;
  for (let number = 1; number <= pdfDocument.numPages; number++) {
    const page = await pdfDocument.getPage(number);
    const viewport = page.getViewport({
      scale: 1
    });
    const sheet = document.createElement('section');
    sheet.className = 'pdf-page';
    sheet.setAttribute('aria-label', `Página ${number} de ${pdfDocument.numPages}`);
    // Reserve every page's space before rendering, avoiding shifts while reading.
    sheet.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    pageContainer.appendChild(sheet);
    pageSheets.push({
      page,
      sheet
    });
  }
  fitFrame();
  let resizeTimer;
  let lastWidth = pageContainer.clientWidth;
  new ResizeObserver(() => {
    if (pageContainer.clientWidth === lastWidth) return;
    lastWidth = pageContainer.clientWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleRender, 120);
  }).observe(pageContainer);
  scheduleRender();
}
initialize().catch(showLoadError);
