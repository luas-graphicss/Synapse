(function () {
    'use strict';

    function hasOpenClass(panel) {
      return panel.classList.contains('open');
    }

    function isNotHidden(panel) {
      return !panel.hidden;
    }

    const SINGLE_PANELS = [
      { panelSelector: '#console', closeSelector: '#consoleBtn', isOpen: hasOpenClass },
      { panelSelector: '#termPane', closeSelector: '#termClose', isOpen: hasOpenClass },
      {
        panelSelector: '#debugPanel',
        closeSelector: '#debugPanel [data-debug-action="close"]',
        isOpen: isNotHidden,
      },
      { panelSelector: '#iaPanel', closeSelector: '#iaBtn', isOpen: isNotHidden },
    ];

    let closingPanels = false;

    function isPanelOpen(panel) {
      const element = document.querySelector(panel.panelSelector);
      return Boolean(element) && panel.isOpen(element);
    }

    function closePanel(panel) {
      const control = document.querySelector(panel.closeSelector);
      if (control) control.click();
    }

    function closeOtherPanels(openedPanel) {
      closingPanels = true;
      for (const panel of SINGLE_PANELS) {
        if (panel !== openedPanel && isPanelOpen(panel)) closePanel(panel);
      }
      closingPanels = false;
    }

    function panelFromElement(element) {
      if (!element || typeof element.matches !== 'function') return null;
      return SINGLE_PANELS.find((panel) => element.matches(panel.panelSelector)) || null;
    }

    function keepSinglePanelOpen(changes) {
      if (closingPanels) return;
      for (const change of changes) {
        const panel = panelFromElement(change.target);
        if (panel && isPanelOpen(panel)) {
          closeOtherPanels(panel);
          return;
        }
      }
    }

    function watchPanelVisibility() {
      new MutationObserver(keepSinglePanelOpen).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'hidden'],
          subtree: true,
      });
    }

    watchPanelVisibility();
})();
