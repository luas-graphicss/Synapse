(function (root) {
    'use strict';

    const GAP = 8;
    const EDGE_MARGIN = 8;

    let container = null;
    let titleNode = null;
    let shortcutNode = null;

    function build() {
      if (container) return;
      container = document.createElement('div');
      container.className = 'hover-tooltip';
      container.setAttribute('role', 'tooltip');
      container.setAttribute('data-i18n', 'off');
      container.hidden = true;
      titleNode = document.createElement('span');
      titleNode.className = 'hover-tooltip-title';
      shortcutNode = document.createElement('span');
      shortcutNode.className = 'hover-tooltip-shortcut';
      shortcutNode.hidden = true;
      container.append(titleNode, shortcutNode);
      document.body.append(container);
    }

    function place(anchor) {
      const anchorBounds = anchor.getBoundingClientRect();
      const tooltipBounds = container.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const fitsBelow = anchorBounds.bottom + GAP + tooltipBounds.height <= viewportHeight;
      const top = fitsBelow
      ? anchorBounds.bottom + GAP
      : Math.max(EDGE_MARGIN, anchorBounds.top - GAP - tooltipBounds.height);
      const centered = anchorBounds.left + anchorBounds.width / 2 - tooltipBounds.width / 2;
      const left = Math.min(
        Math.max(EDGE_MARGIN, centered),
        viewportWidth - tooltipBounds.width - EDGE_MARGIN,
      );
      container.style.top = `${Math.round(top)}px`;
      container.style.left = `${Math.round(Math.max(EDGE_MARGIN, left))}px`;
    }

    function show(hint) {
      build();
      if (!hint?.element?.isConnected) return;
      titleNode.textContent = hint.text;
      shortcutNode.textContent = hint.shortcut || '';
      shortcutNode.hidden = !hint.shortcut;
      container.hidden = false;
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      place(hint.element);
      container.dataset.visible = 'true';
    }

    function hide() {
      if (!container || container.hidden) return;
      delete container.dataset.visible;
      container.hidden = true;
    }

    function isVisible() {
      return !!container && !container.hidden;
    }

    root.SynapseHoverTooltipView = Object.freeze({ show, hide, isVisible });
})(typeof globalThis !== 'undefined' ? globalThis : window);
