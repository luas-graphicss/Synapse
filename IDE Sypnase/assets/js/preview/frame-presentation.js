(function (root) {
    'use strict';

    function create({
        getFrame,
        setFrame,
        timeoutMs = 15000,
        onExternalNavigation = () => {},
        prepareFrame = () => {},
    }) {
      let pending = null;
      let committed = null;
      let observedFrame = null;
      let sourceObserver = null;

      function cancel(reason = 'superseded') {
        if (!pending) return;
        pending.finish({ status: 'canceled', reason });
      }

      function observeSource(frame) {
        sourceObserver?.disconnect();
        observedFrame = frame;
        const view = frame.ownerDocument.defaultView;
        sourceObserver = new view.MutationObserver(() => {
            cancel('external-navigation');
            committed = null;
            onExternalNavigation();
        });
        sourceObserver.observe(frame, { attributes: true, attributeFilter: ['src', 'srcdoc'] });
      }

      function load(html, { key = null, isCurrent = () => true, force = false } = {}) {
        const previousFrame = getFrame();
        if (!previousFrame?.parentElement || !isCurrent()) {
          return Promise.resolve({ status: 'canceled', reason: 'unavailable' });
        }
        if (observedFrame !== previousFrame) observeSource(previousFrame);
        if (!force && pending?.html === html && pending.key === key && pending.isCurrent())
        return pending.promise;
        cancel();
        if (!force && committed?.html === html && committed.key === key) {
          return Promise.resolve({ status: 'unchanged', frame: previousFrame });
        }

        const documentContext = previousFrame.ownerDocument;
        const view = documentContext.defaultView;
        const nextFrame = previousFrame.cloneNode(false);
        const originalAttributes = new Map();
        for (const name of ['id', 'name', 'style', 'tabindex', 'aria-hidden', 'inert', 'loading']) {
          originalAttributes.set(name, previousFrame.getAttribute(name));
        }
        nextFrame.removeAttribute('id');
        nextFrame.removeAttribute('name');
        nextFrame.removeAttribute('src');
        nextFrame.removeAttribute('srcdoc');
        prepareFrame(nextFrame);
        nextFrame.setAttribute('aria-hidden', 'true');
        nextFrame.setAttribute('inert', '');
        nextFrame.setAttribute('tabindex', '-1');
        nextFrame.setAttribute('loading', 'eager');
        nextFrame.dataset.previewPending = 'true';
        for (const [property, value] of Object.entries({
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '100%',
              opacity: '0',
              'pointer-events': 'none',
        }))
        nextFrame.style.setProperty(property, value, 'important');

        let settle;
        let paintHandle = null;
        let timeoutHandle = null;
        let finished = false;
        let loadingComplete = false;
        const promise = new Promise((resolve) => {
            settle = resolve;
        });
        const request = { html, key, frame: nextFrame, promise, finish, isCurrent };
        pending = request;

        function current() {
          return (
            !finished &&
            pending === request &&
            getFrame() === previousFrame &&
            previousFrame.isConnected &&
            nextFrame.isConnected &&
            nextFrame.parentElement === previousFrame.parentElement &&
            isCurrent()
          );
        }

        function finish(result) {
          if (finished) return;
          finished = true;
          view.clearTimeout(timeoutHandle);
          if (paintHandle !== null) view.cancelAnimationFrame(paintHandle);
          nextFrame.removeEventListener('load', loaded);
          nextFrame.removeEventListener('error', failed);
          if (pending === request) pending = null;
          if (result.status !== 'committed') nextFrame.remove();
          settle(result);
        }

        function failed() {
          finish({ status: 'failed', reason: 'load-error' });
        }

        function commit() {
          if (!current()) {
            finish({ status: 'canceled', reason: 'stale' });
            return;
          }
          const hadFocus = documentContext.activeElement === previousFrame;
          sourceObserver?.disconnect();
          previousFrame.removeAttribute('id');
          previousFrame.removeAttribute('name');
          for (const [name, value] of originalAttributes) {
            if (value === null) nextFrame.removeAttribute(name);
            else nextFrame.setAttribute(name, value);
          }
          delete nextFrame.dataset.previewPending;
          setFrame(nextFrame);
          committed = { html, key };
          observeSource(nextFrame);
          previousFrame.remove();
          if (hadFocus) nextFrame.focus({ preventScroll: true });
          finish({ status: 'committed', frame: nextFrame });
        }

        async function loaded() {
          if (!current()) return finish({ status: 'canceled', reason: 'stale' });
          if (loadingComplete) return;
          const nextDocument = nextFrame.contentDocument;
          if (!nextDocument || !nextDocument.URL.startsWith('about:srcdoc')) return;
          loadingComplete = true;
          try {
            await nextDocument.fonts?.ready;
            if (!current()) return finish({ status: 'canceled', reason: 'stale' });
            if (committed?.key === key) {
              const previousWindow = previousFrame.contentWindow;
              nextFrame.contentWindow.scrollTo(previousWindow.scrollX, previousWindow.scrollY);
            }
            paintHandle = view.requestAnimationFrame(() => {
                paintHandle = view.requestAnimationFrame(commit);
            });
          } catch {
            failed();
          }
        }

        nextFrame.addEventListener('load', loaded);
        nextFrame.addEventListener('error', failed);
        timeoutHandle = view.setTimeout(() => {
            finish({ status: 'failed', reason: 'load-timeout' });
          }, timeoutMs);
        nextFrame.srcdoc = html;
        previousFrame.parentElement.appendChild(nextFrame);
        return promise;
      }

      function reset() {
        cancel('reset');
        committed = null;
      }

      function dispose() {
        reset();
        sourceObserver?.disconnect();
        sourceObserver = null;
        observedFrame = null;
      }

      return Object.freeze({
          load,
          cancel,
          reset,
          dispose,
          isPendingSource: (source) => !!pending && pending.frame.contentWindow === source,
      });
    }

    root.SynapsePreviewFrames = Object.freeze({ create });
})(globalThis);
