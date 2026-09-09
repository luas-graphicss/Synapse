(function (root) {
    'use strict';

    const BADGE_CLASS = 'beta-badge';
    const BADGE_TEXT_CLASS = 'beta-badge-text';
    const HOST_CLASS = 'has-beta-badge';
    const DEFAULT_LABEL = 'Beta';

    function findBadge(host) {
      return host.querySelector('.' + BADGE_CLASS);
    }

    function createBadge(label) {
      const badge = document.createElement('span');
      badge.className = BADGE_CLASS;
      badge.setAttribute('aria-hidden', 'true');
      const labelNode = document.createElement('span');
      labelNode.className = BADGE_TEXT_CLASS;
      labelNode.textContent = label;
      badge.appendChild(labelNode);
      return badge;
    }

    function updateBadgeLabel(badge, label) {
      const labelNode = badge.querySelector('.' + BADGE_TEXT_CLASS);
      if (labelNode) labelNode.textContent = label;
      else badge.appendChild(createBadge(label).firstElementChild);
      return badge;
    }

    function attach(host, label) {
      if (!host) return null;
      const badgeLabel = label || DEFAULT_LABEL;
      host.classList.add(HOST_CLASS);
      const existing = findBadge(host);
      if (existing) return updateBadgeLabel(existing, badgeLabel);
      const badge = createBadge(badgeLabel);
      host.appendChild(badge);
      return badge;
    }

    root.SynapseBetaBadge = Object.freeze({ attach });
})(typeof globalThis !== 'undefined' ? globalThis : window);
