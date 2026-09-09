(function (root) {
    'use strict';

    const OVERLAY_ID = 'docsViewer';
    const FRAME_SELECTOR = '.docs-viewer-frame';
    const TITLE_TEXT = 'Documentação da IDE';
    const CLOSE_TEXT = 'Fechar';

    function createBar() {
      const bar = root.document.createElement('div');
      bar.className = 'docs-viewer-bar';
      const title = root.document.createElement('span');
      title.className = 'docs-viewer-title';
      title.textContent = TITLE_TEXT;
      const closeButton = root.document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'docs-viewer-close';
      closeButton.textContent = CLOSE_TEXT;
      closeButton.addEventListener('click', hide);
      bar.appendChild(title);
      bar.appendChild(closeButton);
      return bar;
    }

    function createOverlay() {
      const overlay = root.document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.className = 'docs-viewer';
      overlay.hidden = true;
      const frame = root.document.createElement('iframe');
      frame.className = 'docs-viewer-frame';
      frame.setAttribute('title', TITLE_TEXT);
      overlay.appendChild(createBar());
      overlay.appendChild(frame);
      root.document.body.appendChild(overlay);
      return overlay;
    }

    function overlayElement() {
      return root.document.getElementById(OVERLAY_ID) || createOverlay();
    }

    function frameElement() {
      return overlayElement().querySelector(FRAME_SELECTOR);
    }

    function show(documentHtml) {
      const overlay = overlayElement();
      overlay.querySelector(FRAME_SELECTOR).srcdoc = documentHtml;
      overlay.hidden = false;
    }

    function hide() {
      const overlay = root.document.getElementById(OVERLAY_ID);
      if (!overlay) return;
      overlay.hidden = true;
      overlay.querySelector(FRAME_SELECTOR).srcdoc = '';
    }

    root.SynapseDocsViewerOverlay = Object.freeze({ frameElement, show, hide });
})(typeof globalThis !== 'undefined' ? globalThis : window);
