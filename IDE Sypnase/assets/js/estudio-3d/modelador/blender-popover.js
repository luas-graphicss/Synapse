'use strict';

function blenderCreatePopover(iconName, label) {
  const anchor = document.createElement('div');
  anchor.className = 'blender-popover-anchor';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'blender-popover-trigger';
  trigger.title = label;
  trigger.setAttribute('aria-label', label);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.appendChild(blenderIconSvg(iconName));
  const body = document.createElement('div');
  body.className = 'blender-popover';
  body.hidden = true;
  const closePopover = () => {
    if (body.hidden) return;
    body.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };
  trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const shouldOpen = body.hidden;
      body.hidden = !shouldOpen;
      trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  });
  document.addEventListener('pointerdown', (event) => {
      if (!anchor.contains(event.target)) closePopover();
  });
  document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePopover();
  });
  anchor.appendChild(trigger);
  anchor.appendChild(body);
  return { anchor, trigger, body, close: closePopover };
}
