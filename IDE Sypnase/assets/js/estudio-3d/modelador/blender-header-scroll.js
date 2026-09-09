'use strict';

const BLENDER_SCROLLABLE_HEADER_SELECTOR = '.blender-topbar, .blender-area-header';

function blenderScrollHeaderByWheel(header, event) {
  if (header.scrollWidth <= header.clientWidth) return;
  const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!amount) return;
  header.scrollLeft += amount;
  event.preventDefault();
}

function blenderWatchHeaderScroll() {
  const headers = Array.from(document.querySelectorAll(BLENDER_SCROLLABLE_HEADER_SELECTOR));
  headers.forEach((header) => {
      header.addEventListener('wheel', (event) => blenderScrollHeaderByWheel(header, event), {
          passive: false,
      });
  });
  return headers.length;
}
