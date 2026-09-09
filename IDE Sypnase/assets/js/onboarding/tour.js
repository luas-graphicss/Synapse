(function () {
    'use strict';
    const TOUR_SEEN_KEY = 'aurora.tour.visto';
    const TOUR_DONE_KEY = 'aurora.tour.done';
    const TOUR_STYLE_ELEMENT_ID = 'tourCss';
    const TOUR_FOLLOW_INTERVAL = 260;
    const TOUR_MENU_DELAY = 230;
    const TOUR_STEP_DELAY = 20;
    const TOUR_HIGHLIGHT_PADDING = 8;
    const TOUR_CARD_GAP = 18;
    const TOUR_INVITE_DELAY = 1400;
    const TOUR_TYPING_FRAME = 16;
    const TOUR_TYPING_CHUNKS = 64;

    function readFlag(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    function writeFlag(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        ignorarErro(error, 'writeFlag');
      }
    }

    function clearFlag(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        ignorarErro(error, 'clearFlag');
      }
    }

    let prefersReducedMotion = false;
    try {
      prefersReducedMotion = !!(
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    } catch (error) {
      ignorarErro(error, 'prefersReducedMotion');
    }

    function injectStyleSheet() {
      if (document.getElementById(TOUR_STYLE_ELEMENT_ID)) return;
      const style = document.createElement('style');
      style.id = TOUR_STYLE_ELEMENT_ID;
      style.textContent = TOUR_STYLE_SHEET;
      document.head.appendChild(style);
    }

    function translate(text) {
      try {
        return window.SYNAPSE_I18N && window.SYNAPSE_I18N.t ? window.SYNAPSE_I18N.t(text) : text;
      } catch (error) {
        return text;
      }
    }

    const tourState = {
      stepIndex: 0,
      running: false,
      root: null,
      card: null,
      ring: null,
      cursor: null,
      veils: [],
      hole: null,
      fullScreen: null,
      openedMenus: [],
      typingTimer: null,
      rippleTimer: null,
      followTimer: null,
      keyListener: null,
    };

    function highlightedStepCount() {
      return TOUR_STEPS.length - 2;
    }

    function findElement(selector) {
      try {
        return document.querySelector(selector);
      } catch (error) {
        return null;
      }
    }

    function isVisible(element) {
      try {
        if (!element) return false;
        const box = element.getBoundingClientRect();
        if (box.width < 4 || box.height < 4) return false;
        const style = getComputedStyle(element);
        return style.visibility !== 'hidden' && style.display !== 'none';
      } catch (error) {
        return false;
      }
    }

    function stepTarget(step) {
      if (!step || !step.target) return null;
      const element = findElement(step.target);
      return isVisible(element) ? element : null;
    }

    function cursorIcon() {
      return (
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="#eef2f6" stroke="#0d1117" ' +
        'stroke-width="1.2"><path d="M5 2.5l13.2 8.1-5.6.9 3.2 6.4-2.6 1.3-3.2-6.4-3.6 4.3z"/></svg>'
      );
    }

    function brandMark() {
      return (
        '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" ' +
        'aria-label="Synapse">' +
        '<rect x="2" y="2" width="60" height="60" rx="14" fill="#12161c"/>' +
        '<rect x="3" y="3" width="58" height="58" rx="13" fill="none" stroke="#e2e8f0" ' +
        'stroke-opacity="0.16" stroke-width="2"/>' +
        '<path d="M20 45 C 35 45 29 19 44 19" fill="none" stroke="#c8d1dc" stroke-width="6" ' +
        'stroke-linecap="round"/>' +
        '<circle cx="20" cy="45" r="6.5" fill="#c8d1dc"/>' +
        '<circle cx="44" cy="19" r="6.5" fill="#c8d1dc"/>' +
        '<circle cx="53" cy="11" r="2.4" fill="#8b95a4"/></svg>'
      );
    }

    function checkIcon() {
      return (
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>'
      );
    }

    function buildOverlay() {
      injectStyleSheet();
      const root = document.createElement('div');
      root.className = 'tour-root';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-label', translate('Tutorial do Synapse'));
      let index;
      for (index = 0; index < 4; index++) {
        const veil = document.createElement('div');
        veil.className = 'tour-veil';
        root.appendChild(veil);
        tourState.veils.push(veil);
      }
      tourState.hole = document.createElement('div');
      tourState.hole.className = 'tour-hole';
      root.appendChild(tourState.hole);
      tourState.ring = document.createElement('div');
      tourState.ring.className = 'tour-ring';
      tourState.ring.innerHTML = '<i></i><i></i><i></i><i></i>';
      root.appendChild(tourState.ring);
      tourState.card = document.createElement('div');
      tourState.card.className = 'tour-card';
      tourState.card.innerHTML =
      '<div class="tour-kick"></div><div class="tour-h"></div>' +
      '<div class="tour-p" data-i18n="off"></div><div class="tour-keys"></div>' +
      '<div class="tour-foot"><span class="tour-n"></span>' +
      '<span class="tour-prog"><i></i></span>' +
      '<button class="tour-b" type="button" data-a="back">' +
      translate('Voltar') +
      '</button>' +
      '<button class="tour-b primary" type="button" data-a="next">' +
      translate('Avançar') +
      '</button></div>' +
      '<button class="tour-skip" type="button" data-a="exit">' +
      translate('Pular tutorial') +
      '</button>';
      root.appendChild(tourState.card);
      tourState.cursor = document.createElement('div');
      tourState.cursor.className = 'tour-cursor';
      tourState.cursor.innerHTML = cursorIcon();
      root.appendChild(tourState.cursor);
      document.body.appendChild(root);
      tourState.root = root;
      root.addEventListener(
        'click',
        function (event) {
          event.stopPropagation();
          const button = event.target.closest ? event.target.closest('[data-a]') : null;
          const action = button ? button.getAttribute('data-a') : 'next';
          if (action === 'exit') closeTour(false);
          else if (action === 'back') goToStep(tourState.stepIndex - 1);
          else goToStep(tourState.stepIndex + 1);
        },
        false,
      );
      return root;
    }

    function closeOpenedMenus() {
      let index;
      for (index = 0; index < tourState.openedMenus.length; index++) {
        try {
          tourState.openedMenus[index].classList.remove('open');
        } catch (error) {
          ignorarErro(error, 'closeOpenedMenus');
        }
      }
      tourState.openedMenus = [];
    }

    function openMenu(selector) {
      const menu = findElement(selector);
      if (!menu) return null;
      try {
        menu.classList.add('open');
        tourState.openedMenus.push(menu);
      } catch (error) {
        ignorarErro(error, 'openMenu');
      }
      return menu;
    }

    function paddedBox(element) {
      const box = element.getBoundingClientRect();
      return {
        top: Math.max(0, box.top - TOUR_HIGHLIGHT_PADDING),
        left: Math.max(0, box.left - TOUR_HIGHLIGHT_PADDING),
        width: Math.min(innerWidth, box.width + TOUR_HIGHLIGHT_PADDING * 2),
        height: Math.min(innerHeight, box.height + TOUR_HIGHLIGHT_PADDING * 2),
      };
    }

    function highlightElement(element) {
      const viewportWidth = innerWidth;
      const viewportHeight = innerHeight;
      const box = element
      ? paddedBox(element)
      : { top: viewportHeight / 2, left: viewportWidth / 2, width: 0, height: 0 };
      const veilBoxes = [
        { top: 0, left: 0, width: viewportWidth, height: box.top },
        { top: box.top, left: 0, width: box.left, height: box.height },
        {
          top: box.top,
          left: box.left + box.width,
          width: Math.max(0, viewportWidth - box.left - box.width),
          height: box.height,
        },
        {
          top: box.top + box.height,
          left: 0,
          width: viewportWidth,
          height: Math.max(0, viewportHeight - box.top - box.height),
        },
      ];
      let index;
      for (index = 0; index < 4; index++) {
        const veil = tourState.veils[index];
        const veilBox = veilBoxes[index];
        veil.style.top = veilBox.top + 'px';
        veil.style.left = veilBox.left + 'px';
        veil.style.width = veilBox.width + 'px';
        veil.style.height = veilBox.height + 'px';
        veil.style.opacity = '1';
      }
      tourState.hole.style.top = box.top + 'px';
      tourState.hole.style.left = box.left + 'px';
      tourState.hole.style.width = box.width + 'px';
      tourState.hole.style.height = box.height + 'px';
      tourState.ring.style.display = element ? 'block' : 'none';
      tourState.ring.style.top = box.top + 'px';
      tourState.ring.style.left = box.left + 'px';
      tourState.ring.style.width = box.width + 'px';
      tourState.ring.style.height = box.height + 'px';
      return box;
    }

    function placeCard(box) {
      const card = tourState.card;
      const viewportWidth = innerWidth;
      const viewportHeight = innerHeight;
      const cardWidth = card.offsetWidth || 392;
      const cardHeight = card.offsetHeight || 220;
      const fitsBelow = box.top + box.height + TOUR_CARD_GAP + cardHeight < viewportHeight - 50;
      const fitsAbove = box.top - TOUR_CARD_GAP - cardHeight > 50;
      let top;
      let left;
      if (fitsBelow) top = box.top + box.height + TOUR_CARD_GAP;
      else if (fitsAbove) top = box.top - TOUR_CARD_GAP - cardHeight;
      else
      top = Math.max(
        52,
        Math.min(viewportHeight - cardHeight - 52, box.top + box.height / 2 - cardHeight / 2),
      );
      left = box.left + box.width / 2 - cardWidth / 2;
      if (left < 12) left = 12;
      if (left + cardWidth > viewportWidth - 12) left = viewportWidth - cardWidth - 12;
      if (!fitsBelow && !fitsAbove) {
        if (box.left + box.width + TOUR_CARD_GAP + cardWidth < viewportWidth - 12)
        left = box.left + box.width + TOUR_CARD_GAP;
        else if (box.left - TOUR_CARD_GAP - cardWidth > 12)
        left = box.left - TOUR_CARD_GAP - cardWidth;
      }
      card.style.top = top + 'px';
      card.style.left = left + 'px';
    }

    function typeText(element, text) {
      if (tourState.typingTimer) {
        clearInterval(tourState.typingTimer);
        tourState.typingTimer = null;
      }
      tourState.card.classList.remove('pronto');
      if (prefersReducedMotion) {
        element.textContent = text;
        tourState.card.classList.add('pronto');
        return;
      }
      element.textContent = '';
      const total = text.length;
      const chunkSize = Math.max(1, Math.ceil(total / TOUR_TYPING_CHUNKS));
      let shown = 0;
      tourState.typingTimer = setInterval(function () {
          shown += chunkSize;
          element.textContent = text.slice(0, shown);
          if (shown >= total) {
            clearInterval(tourState.typingTimer);
            tourState.typingTimer = null;
            tourState.card.classList.add('pronto');
          }
        }, TOUR_TYPING_FRAME);
    }

    function showRipple(x, y) {
      const ripple = document.createElement('div');
      ripple.className = 'tour-ripple';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      document.body.appendChild(ripple);
      setTimeout(function () {
          try {
            ripple.remove();
          } catch (error) {
            ignorarErro(error, 'showRipple');
          }
        }, 760);
    }

    function moveCursor(box) {
      if (!tourState.cursor) return;
      if (prefersReducedMotion) {
        tourState.cursor.style.opacity = '0';
        return;
      }
      const x = box.left + Math.min(box.width - 10, Math.max(14, box.width * 0.42));
      const y = box.top + Math.min(box.height - 10, Math.max(12, box.height * 0.5));
      tourState.cursor.style.opacity = '1';
      tourState.cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (tourState.rippleTimer) clearTimeout(tourState.rippleTimer);
      tourState.rippleTimer = setTimeout(function () {
          showRipple(x, y);
        }, 820);
    }

    function clearFullScreen() {
      if (!tourState.fullScreen) return;
      try {
        tourState.fullScreen.remove();
      } catch (error) {
        ignorarErro(error, 'clearFullScreen');
      }
      tourState.fullScreen = null;
    }

    function showIntroScreen() {
      clearFullScreen();
      const screen = document.createElement('div');
      screen.className = 'tour-full';
      screen.innerHTML =
      '<div class="tour-mark">' +
      brandMark() +
      '</div><div class="tour-eyebrow">' +
      translate('Tutorial guiado') +
      '</div><h1 class="tour-t1">' +
      translate('Bem-vindo ao Synapse') +
      '</h1><p class="tour-t2">' +
      translate(
        'Um passeio curto pelo site: editor, preview ao vivo, terminal no seu computador e os agentes de IA trabalhando dentro do projeto.',
      ) +
      '</p><div class="tour-acts">' +
      '<button class="tour-b primary" type="button" data-a="next">' +
      translate('Começar') +
      '</button><button class="tour-b" type="button" data-a="exit">' +
      translate('Agora não') +
      '</button></div>' +
      '<p class="tour-t2" style="font-size:11px;opacity:.5;margin-top:20px">' +
      highlightedStepCount() +
      ' ' +
      translate('etapas · clique em qualquer lugar para avançar · Esc encerra') +
      '</p>';
      tourState.root.appendChild(screen);
      tourState.fullScreen = screen;
    }

    function showOutroScreen() {
      clearFullScreen();
      const screen = document.createElement('div');
      screen.className = 'tour-full';
      const items = [
        'Importar e exportar',
        'Editor e histórico',
        'Preview ao vivo',
        'Terminal e dev server',
        'MCP com o Notion',
        'Equipes de agentes',
        'Blepse 3D',
        'Backups automáticos',
      ].map(translate);
      const icon = checkIcon();
      let itemsHtml = '';
      let index;
      for (index = 0; index < items.length; index++)
      itemsHtml +=
      '<span class="tour-li" style="animation-delay:' +
      (0.3 + index * 0.045).toFixed(2) +
      's">' +
      icon +
      items[index] +
      '</span>';
      screen.innerHTML =
      '<div class="tour-mark">' +
      brandMark() +
      '</div><div class="tour-eyebrow">' +
      translate('Tutorial concluído') +
      '</div><h1 class="tour-t1">' +
      translate('Tudo pronto') +
      '</h1><p class="tour-t2">' +
      translate('Você já conhece o Synapse inteiro. Para repetir, use o botão ? na barra de cima.') +
      '</p><div class="tour-rule"></div><div class="tour-cols">' +
      itemsHtml +
      '</div><div class="tour-acts">' +
      '<button class="tour-b primary" type="button" data-a="next">' +
      translate('Concluir') +
      '</button></div>';
      tourState.root.appendChild(screen);
      tourState.fullScreen = screen;
    }

    function paintStep(step, index) {
      const element = stepTarget(step);
      const box = highlightElement(element);
      placeCard(box);
      moveCursor(box);
      tourState.card.classList.remove('troca');
      void tourState.card.offsetWidth;
      tourState.card.classList.add('troca');
      tourState.card.querySelector('.tour-kick').textContent = translate(step.label || 'Synapse');
      tourState.card.querySelector('.tour-h').textContent = translate(step.title || '');
      typeText(tourState.card.querySelector('.tour-p'), translate(step.text || ''));
      const keysBox = tourState.card.querySelector('.tour-keys');
      let keysHtml = '';
      if (step.keys) {
        let keyIndex;
        for (keyIndex = 0; keyIndex < step.keys.length; keyIndex++)
        keysHtml += '<span class="tour-key">' + step.keys[keyIndex] + '</span>';
      }
      keysBox.innerHTML = keysHtml;
      const total = highlightedStepCount();
      tourState.card.querySelector('.tour-n').textContent = index + '/' + total;
      tourState.card.querySelector('.tour-prog i').style.width =
      Math.round((index / total) * 100) + '%';
      tourState.card.querySelector('[data-a="back"]').style.display = index > 1 ? '' : 'none';
      tourState.card.querySelector('[data-a="next"]').textContent = translate(
        index === TOUR_STEPS.length - 2 ? 'Terminar' : 'Avançar',
      );
    }

    function goToStep(index) {
      if (!tourState.running) return;
      if (index < 0) index = 0;
      if (index >= TOUR_STEPS.length) {
        closeTour(true);
        return;
      }
      tourState.stepIndex = index;
      const step = TOUR_STEPS[index];
      closeOpenedMenus();
      if (step.screen) {
        tourState.card.style.display = 'none';
        tourState.ring.style.display = 'none';
        tourState.hole.style.display = 'none';
        let veilIndex;
        for (veilIndex = 0; veilIndex < 4; veilIndex++)
        tourState.veils[veilIndex].style.opacity = '0';
        tourState.cursor.style.opacity = '0';
        if (step.screen === 'intro') showIntroScreen();
        else showOutroScreen();
        return;
      }
      clearFullScreen();
      tourState.card.style.display = '';
      tourState.hole.style.display = '';
      if (step.menu) openMenu(step.menu);
      setTimeout(
        function () {
          if (!tourState.running || !tourState.card) return;
          paintStep(step, index);
          setTimeout(function () {
              if (!tourState.running || !tourState.card) return;
              try {
                placeCard(highlightElement(stepTarget(step)));
              } catch (error) {
                ignorarErro(error, 'goToStep');
              }
            }, 70);
        },
        step.menu ? TOUR_MENU_DELAY : TOUR_STEP_DELAY,
      );
    }

    function handleTourKey(event) {
      if (!tourState.running) return;
      const key = event.key;
      if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeTour(false);
        return;
      }
      if (key === 'Enter' || key === ' ' || key === 'ArrowRight' || key === 'PageDown') {
        event.preventDefault();
        event.stopPropagation();
        goToStep(tourState.stepIndex + 1);
        return;
      }
      if (key === 'ArrowLeft' || key === 'PageUp') {
        event.preventDefault();
        event.stopPropagation();
        goToStep(tourState.stepIndex - 1);
      }
    }

    function followCurrentTarget() {
      if (!tourState.running) return;
      const step = TOUR_STEPS[tourState.stepIndex];
      if (!step || step.screen) return;
      try {
        const element = stepTarget(step);
        if (element) placeCard(highlightElement(element));
      } catch (error) {
        ignorarErro(error, 'followCurrentTarget');
      }
    }

    function openTour() {
      if (tourState.running) return;
      try {
        tourState.running = true;
        document.body.classList.add('tour-ativo');
        buildOverlay();
        tourState.keyListener = handleTourKey;
        document.addEventListener('keydown', tourState.keyListener, true);
        tourState.followTimer = setInterval(followCurrentTarget, TOUR_FOLLOW_INTERVAL);
        goToStep(0);
      } catch (error) {
        ignorarErro(error, 'openTour');
        try {
          closeTour(false);
        } catch (closeError) {
          ignorarErro(closeError, 'openTour');
        }
      }
    }

    function closeTour(finished) {
      if (!tourState.running) return;
      tourState.running = false;
      if (tourState.typingTimer) {
        clearInterval(tourState.typingTimer);
        tourState.typingTimer = null;
      }
      if (tourState.followTimer) {
        clearInterval(tourState.followTimer);
        tourState.followTimer = null;
      }
      if (tourState.rippleTimer) {
        clearTimeout(tourState.rippleTimer);
        tourState.rippleTimer = null;
      }
      if (tourState.keyListener) {
        try {
          document.removeEventListener('keydown', tourState.keyListener, true);
        } catch (error) {
          ignorarErro(error, 'closeTour');
        }
        tourState.keyListener = null;
      }
      closeOpenedMenus();
      clearFullScreen();
      const root = tourState.root;
      if (root) {
        root.style.transition = 'opacity .4s';
        root.style.opacity = '0';
        setTimeout(function () {
            try {
              root.remove();
            } catch (error) {
              ignorarErro(error, 'closeTour');
            }
          }, 420);
      }
      tourState.root = null;
      tourState.card = null;
      tourState.ring = null;
      tourState.cursor = null;
      tourState.hole = null;
      tourState.veils = [];
      document.body.classList.remove('tour-ativo');
      if (!finished) return;
      writeFlag(TOUR_DONE_KEY, '1');
      writeFlag(TOUR_SEEN_KEY, '1');
      const button = document.getElementById('tourBtn');
      if (button) button.classList.remove('novo');
      try {
        if (typeof toast === 'function')
        toast('Tutorial concluído', 'Repita quando quiser no botão ? da barra de cima', 'ok');
      } catch (error) {
        ignorarErro(error, 'closeTour');
      }
    }

    function showInvite() {
      const container = document.getElementById('toasts');
      if (!container) return;
      if (document.querySelector('.tour-invite')) return;
      const invite = document.createElement('div');
      invite.className = 'toast tour-invite';
      invite.innerHTML =
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>' +
      '<div class="tx"><b>' +
      translate('Primeira vez por aqui?') +
      '</b><span>' +
      translate('Faça o tour guiado e conheça o site inteiro em pouco mais de um minuto.') +
      '</span><div class="ti-acts">' +
      '<button class="ti-b primary" type="button" data-ti="go">' +
      translate('Iniciar tutorial') +
      '</button><button class="ti-b" type="button" data-ti="no">' +
      translate('Ignorar') +
      '</button></div></div>';
      container.appendChild(invite);
      invite.addEventListener('click', function (event) {
          const button = event.target.closest ? event.target.closest('[data-ti]') : null;
          if (!button) return;
          event.stopPropagation();
          const wantsTour = button.getAttribute('data-ti') === 'go';
          invite.style.transition = 'opacity .3s, transform .3s';
          invite.style.opacity = '0';
          invite.style.transform = 'translateX(30px)';
          setTimeout(function () {
              try {
                invite.remove();
              } catch (error) {
                ignorarErro(error, 'showInvite');
              }
              if (wantsTour) openTour();
            }, 300);
      });
    }

    function start() {
      injectStyleSheet();
      try {
        if (window.SYNAPSE_I18N && window.SYNAPSE_I18N.on)
        window.SYNAPSE_I18N.on(function () {
            try {
              if (tourState.running) goToStep(tourState.stepIndex);
            } catch (error) {
              ignorarErro(error, 'start');
            }
        });
      } catch (error) {
        ignorarErro(error, 'start');
      }
      const button = document.getElementById('tourBtn');
      if (button) {
        if (!readFlag(TOUR_DONE_KEY)) button.classList.add('novo');
        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            openTour();
        });
      }
      document.addEventListener(
        'click',
        function (event) {
          const trigger = event.target.closest ? event.target.closest('[data-tour]') : null;
          if (!trigger) return;
          event.preventDefault();
          event.stopPropagation();
          openTour();
        },
        true,
      );
      if (!readFlag(TOUR_SEEN_KEY)) {
        writeFlag(TOUR_SEEN_KEY, '1');
        setTimeout(showInvite, TOUR_INVITE_DELAY);
      }
    }

    window.SYNAPSE_TOUR = {
      iniciar: function () {
        openTour();
        return 'tour iniciado';
      },
      sair: function () {
        closeTour(false);
        return 'tour encerrado';
      },
      convite: function () {
        showInvite();
        return 'convite exibido';
      },
      estado: function () {
        return {
          vivo: tourState.running,
          passo: tourState.stepIndex,
          total: TOUR_STEPS.length,
          jaViu: !!readFlag(TOUR_SEEN_KEY),
          concluiu: !!readFlag(TOUR_DONE_KEY),
        };
      },
      resetar: function () {
        clearFlag(TOUR_SEEN_KEY);
        clearFlag(TOUR_DONE_KEY);
        const button = document.getElementById('tourBtn');
        if (button) button.classList.add('novo');
        return 'pronto: recarregue a pagina para ver o convite de primeira vez';
      },
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
