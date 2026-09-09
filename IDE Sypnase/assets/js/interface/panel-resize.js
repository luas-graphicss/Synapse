(function () {
    const MIN_PANEL_HEIGHT = 110;
    const MAX_HEIGHT_RATIO = 0.8;
    const STORAGE_PREFIX = 'synapse.panelHeight.';

    function clamp(value, min, max) {
      if (value < min) return min;
      if (value > max) return max;
      return value;
    }

    function maxPanelHeight() {
      return Math.max(MIN_PANEL_HEIGHT, Math.round(window.innerHeight * MAX_HEIGHT_RATIO));
    }

    function readSavedHeight(storageKey) {
      try {
        const saved = Number(localStorage.getItem(STORAGE_PREFIX + storageKey));
        return Number.isFinite(saved) && saved > 0 ? saved : 0;
      } catch (error) {
        return 0;
      }
    }

    function saveHeight(storageKey, height) {
      try {
        localStorage.setItem(STORAGE_PREFIX + storageKey, String(Math.round(height)));
      } catch (error) {
        return;
      }
    }

    function applyHeight(panel, height) {
      panel.style.height = Math.round(height) + 'px';
    }

    function notifyResize() {
      if (typeof window.applyDevice === 'function') window.applyDevice();
    }

    function followPanelVisibility(handle, panel) {
      function updateHandle() {
        handle.style.display = panel.classList.contains('open') ? 'block' : 'none';
      }
      updateHandle();
      new MutationObserver(updateHandle).observe(panel, {
          attributes: true,
          attributeFilter: ['class'],
      });
    }

    function makeResizable(handle, panel, storageKey) {
      if (!handle || !panel) return;
      const savedHeight = readSavedHeight(storageKey);
      if (savedHeight) applyHeight(panel, clamp(savedHeight, MIN_PANEL_HEIGHT, maxPanelHeight()));
      followPanelVisibility(handle, panel);
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', 'horizontal');
      let dragging = false;
      let startY = 0;
      let startHeight = 0;
      let pendingHeight = 0;
      const applyPendingHeight = window.SynapseFrameScheduler.create(() => {
          applyHeight(panel, pendingHeight);
          notifyResize();
      });
      handle.addEventListener('pointerdown', (event) => {
          dragging = true;
          startY = event.clientY;
          startHeight = panel.getBoundingClientRect().height;
          pendingHeight = startHeight;
          handle.classList.add('drag');
          handle.setPointerCapture(event.pointerId);
          event.preventDefault();
      });
      handle.addEventListener('pointermove', (event) => {
          if (!dragging) return;
          const moved = event.clientY - startY;
          pendingHeight = clamp(startHeight - moved, MIN_PANEL_HEIGHT, maxPanelHeight());
          applyPendingHeight();
      });
      function stopDragging(event) {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('drag');
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        applyHeight(panel, pendingHeight);
        saveHeight(storageKey, panel.getBoundingClientRect().height);
        notifyResize();
      }
      handle.addEventListener('pointerup', stopDragging);
      handle.addEventListener('pointercancel', stopDragging);
    }

    function setupBottomPanels() {
      makeResizable(document.getElementById('rz3'), document.getElementById('console'), 'console');
      makeResizable(document.getElementById('rz4'), document.getElementById('termPane'), 'terminal');
    }

    if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', setupBottomPanels);
    else setupBottomPanels();

    window.PanelResize = { makeResizable };
})();
