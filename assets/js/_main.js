/* Initialize optional diagrams on both full and partial page loads. */
'use strict';
const PLOTLY_URL = 'https://cdn.jsdelivr.net/npm/plotly.js@3.6.0/dist/plotly.min.js';
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
let plotlyReady;
let mermaidReady;

function loadPlotly() {
  if (window.Plotly) return Promise.resolve(window.Plotly);
  if (!plotlyReady) {
    plotlyReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PLOTLY_URL;
      script.dataset.contentResource = 'true';
      script.onload = () => resolve(window.Plotly);
      script.onerror = () => { script.remove(); plotlyReady = null; reject(new Error('Unable to load Plotly')); };
      document.head.appendChild(script);
    });
  }
  return plotlyReady;
}

async function initializeContent(root) {
  const plots = Array.from(root.querySelectorAll('pre > code.language-plotly:not([data-rendered])'));
  if (plots.length) {
    try {
      const plotly = await loadPlotly();
      for (const element of plots) {
        if (!element.isConnected || element.dataset.rendered) continue;
        let chart;
        try {
          const data = JSON.parse(element.textContent);
          const layout = { ...data.layout, template: data.layout?.template || plotlyLightLayout };
          chart = document.createElement('div');
          element.parentElement.after(chart);
          await plotly.newPlot(chart, data.data, layout, { responsive: true });
          element.dataset.rendered = 'true';
          element.parentElement.classList.add('hidden');
        } catch (error) {
          chart?.remove();
          console.warn('Unable to render chart', error);
        }
      }
    } catch (error) { console.warn(error); }
  }
  const diagrams = Array.from(root.querySelectorAll('code.language-mermaid:not([data-processed])'));
  if (diagrams.length) {
    try {
      if (!mermaidReady) mermaidReady = import(MERMAID_URL).then(module => {
        module.default.initialize({ startOnLoad: false, theme: 'default' });
        return module.default;
      }).catch(error => { mermaidReady = null; throw error; });
      const mermaid = await mermaidReady;
      await mermaid.run({ nodes: diagrams.filter(node => node.isConnected) });
    } catch (error) { console.warn('Unable to render diagram', error); }
  }
}

document.addEventListener('site:content', event => initializeContent(event.detail.root));
// Defer until all constants in this module (including the Plotly template) exist.
Promise.resolve().then(() => initializeContent(document));
