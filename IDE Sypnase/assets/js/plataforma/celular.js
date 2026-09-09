(function () {
    const root = document.documentElement;

    function isTouch() {
      try {
        if (window.matchMedia('(pointer:coarse)').matches) return true;
        if (window.matchMedia('(hover:none)').matches) return true;
      } catch (e) {
        ignorarErro(e, 'isTouch');
      }
      if (navigator.maxTouchPoints > 1) return true;
      if ('ontouchstart' in window) return true;
      return false;
    }

    function viewportW() {
      const vv = window.visualViewport;
      return Math.min(window.innerWidth || 9999, (vv && vv.width) || 9999);
    }
    function viewportH() {
      const vv = window.visualViewport;
      return (vv && vv.height) || window.innerHeight || 0;
    }

    function apply() {
      const touch = isTouch();
      const w = viewportW();

      root.classList.toggle('aurora-mobile', touch || w <= 900);
      root.classList.toggle('aurora-narrow', w <= 720);
      root.classList.toggle('aurora-touch', touch);

      const h = viewportH();
      if (h) root.style.setProperty('--app-vh', h / 100 + 'px');
    }

    function revealActiveTab() {
      const t = document.querySelector('.tabs .tab.active');
      if (t && t.scrollIntoView) {
        try {
          t.scrollIntoView({ inline: 'nearest', block: 'nearest' });
        } catch (e) {
          ignorarErro(e, 'revealActiveTab');
        }
      }
    }

    function setupDrawer() {
      const explorer = document.querySelector('.explorer');
      const toolbar = document.querySelector('.toolbar');
      if (!explorer || !toolbar) return;
      let backdrop = document.getElementById('auroraExpBackdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'auroraExpBackdrop';
        document.body.appendChild(backdrop);
      }
      let trigger = document.getElementById('auroraExpToggle');
      if (!trigger) {
        trigger = document.createElement('button');
        trigger.id = 'auroraExpToggle';
        trigger.className = 'tbtn';
        trigger.innerHTML = iconSvg('folder');
        toolbar.prepend(trigger);
      }
      if (trigger.dataset.drawerBound) return;
      trigger.dataset.drawerBound = 'true';
      trigger.type = 'button';
      trigger.title = 'Arquivos';
      trigger.setAttribute('aria-label', 'Arquivos');
      trigger.setAttribute('aria-expanded', 'false');
      explorer.id = explorer.id || 'workspaceExplorer';
      trigger.setAttribute('aria-controls', explorer.id);

      function setOpen(open, restoreFocus = false) {
        root.classList.toggle('exp-open', open);
        trigger.classList.toggle('on', open);
        trigger.setAttribute('aria-expanded', String(open));
        if (restoreFocus) trigger.focus();
      }
      trigger.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(!root.classList.contains('exp-open'));
      });
      backdrop.addEventListener('click', () => setOpen(false, true));
      explorer.addEventListener('click', (event) => {
          if (!root.classList.contains('aurora-narrow') || event.target.closest('.ex-inline')) return;
          if (event.ctrlKey || event.metaKey || event.shiftKey || window.SynapseExplorer?.selectionMode()) return;
          if (event.target.closest('.row[data-file]')) setOpen(false);
      });
      document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && root.classList.contains('exp-open')) setOpen(false, true);
      });
    }

    apply();

    window.addEventListener('resize', apply, { passive: true });
    window.addEventListener('pageshow', apply);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) apply();
    });
    window.addEventListener(
      'orientationchange',
      function () {
        apply();
        setTimeout(apply, 250);
        setTimeout(apply, 600);
        setTimeout(revealActiveTab, 650);
      },
      { passive: true },
    );

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', apply, { passive: true });
    }

    function watchTabs() {
      const tabs = document.getElementById('tabs');
      if (!tabs || !window.MutationObserver) return;
      new MutationObserver(function () {
          setTimeout(revealActiveTab, 30);
      }).observe(tabs, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class'],
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
          apply();
          watchTabs();
          setupDrawer();
      });
    } else {
      watchTabs();
      setupDrawer();
    }
})();
