'use strict';

const BLENDER_ICON_NAMESPACE = 'http://www.w3.org/2000/svg';
const BLENDER_ICON_VIEW_BOX = '0 0 16 16';
const BLENDER_ICON_PATHS = Object.freeze({
    brand: Object.freeze(['M8 2.4L13.2 5.4v5.2L8 13.6l-5.2-3V5.4z', 'M2.8 5.4L8 8.4l5.2-3', 'M8 8.4v5.2']),
    object: Object.freeze(['M8 2.4L13.2 5.4v5.2L8 13.6l-5.2-3V5.4z', 'M2.8 5.4L8 8.4l5.2-3', 'M8 8.4v5.2']),
    project: Object.freeze(['M2.4 12.4V4.6h3.8l1.3 1.7h6.1v6.1z']),
    refresh: Object.freeze(['M10.4 3.8A4.8 4.8 0 1 1 5.6 3.8', 'M3.7 4L5.6 3.8l-1.1 1.6']),
    mesh: Object.freeze(['M8 2.8L13.6 12.6H2.4z', 'M5.2 7.7h5.6', 'M5.2 7.7L8 12.6l2.8-4.9']),
    material: Object.freeze([
        'M8 2.8a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 1 0 0-10.4z',
        'M5.1 10.9a4.2 4.2 0 0 0 5.8-5.8',
    ]),
    uv: Object.freeze(['M3.2 3.2h9.6v9.6H3.2z', 'M3.2 8h9.6', 'M8 3.2v9.6']),
    output: Object.freeze(['M8 2.8v6.6', 'M5.2 6.8L8 9.6l2.8-2.8', 'M3.2 12.8h9.6']),
    move: Object.freeze([
        'M8 3.2v9.6',
        'M3.2 8h9.6',
        'M6.3 4.9L8 3.2l1.7 1.7',
        'M6.3 11.1L8 12.8l1.7-1.7',
        'M4.9 6.3L3.2 8l1.7 1.7',
        'M11.1 6.3L12.8 8l-1.7 1.7',
    ]),
    rotate: Object.freeze([
        'M5.6 3.8A4.8 4.8 0 1 0 10.4 3.8',
        'M12.3 4L10.4 3.8l1.1 1.6',
        'M7.4 7.4h1.2v1.2H7.4z',
    ]),
    scale: Object.freeze(['M4 12L12 4', 'M8.4 4H12v3.6', 'M7.6 12H4V8.4']),
    vertex: Object.freeze(['M4 4h8v8H4z', 'M7.3 7.3h1.4v1.4H7.3z']),
    edge: Object.freeze(['M5 11L11 5', 'M3.9 10.7h1.4v1.4H3.9z', 'M10.7 3.9h1.4v1.4h-1.4z']),
    face: Object.freeze(['M4 4h8v8H4z', 'M6.6 6.6h2.8v2.8H6.6z']),
    magnet: Object.freeze([
        'M3.4 12.6V7.8a4.6 4.6 0 0 1 9.2 0v4.8',
        'M6.4 12.6V7.8a1.6 1.6 0 0 1 3.2 0v4.8',
        'M3.4 10.2h3',
        'M9.6 10.2h3',
    ]),
    grid: Object.freeze([
        'M3.2 3.2h9.6v9.6H3.2z',
        'M3.2 6.4h9.6',
        'M3.2 9.6h9.6',
        'M6.4 3.2v9.6',
        'M9.6 3.2v9.6',
    ]),
    frame: Object.freeze([
        'M3.2 6.4V3.2h3.2',
        'M12.8 6.4V3.2H9.6',
        'M3.2 9.6v3.2h3.2',
        'M12.8 9.6v3.2H9.6',
    ]),
    undo: Object.freeze(['M3.4 6.4h5.6a3.2 3.2 0 0 1 0 6.4H6.2', 'M5.8 4L3.4 6.4l2.4 2.4']),
    redo: Object.freeze(['M12.6 6.4H7a3.2 3.2 0 0 0 0 6.4h2.8', 'M10.2 4l2.4 2.4-2.4 2.4']),
    duplicate: Object.freeze(['M6.4 6.4h6.4v6.4H6.4z', 'M9.6 6.4V3.2H3.2v6.4h3.2']),
    group: Object.freeze(['M3 3.4h4.2v4.2H3z', 'M8.8 8.4h4.2v4.2H8.8z', 'M7.2 5.5h3.7v2.9']),
    trash: Object.freeze(['M3.2 5h9.6', 'M6.4 5V3.2h3.2V5', 'M4.8 5l.7 7.8h5l.7-7.8']),
    plus: Object.freeze(['M8 3.2v9.6', 'M3.2 8h9.6']),
    keyboard: Object.freeze([
        'M2.6 4.8h10.8v6.4H2.6z',
        'M4.8 7.2h1',
        'M7.5 7.2h1',
        'M10.2 7.2h1',
        'M5.6 9.4h4.8',
    ]),
    panels: Object.freeze(['M2.6 3.2h10.8v9.6H2.6z', 'M9.4 3.2v9.6']),
    outliner: Object.freeze([
        'M3.2 4.6h2.4',
        'M7.6 4.6h5.2',
        'M3.2 8h2.4',
        'M7.6 8h5.2',
        'M3.2 11.4h2.4',
        'M7.6 11.4h5.2',
    ]),
    edit: Object.freeze(['M3.2 12.8l.9-2.9 6.4-6.4 2 2-6.4 6.4z', 'M9.5 4.6l2 2']),
    chevron: Object.freeze(['M4.6 6.4L8 9.8l3.4-3.4']),
    image: Object.freeze([
        'M2.6 3.8h10.8v8.4H2.6z',
        'M2.6 10L5.8 6.8l2.6 2.6 2.2-2.2 2.8 2.8',
        'M10.2 5.7h1.2v1.2h-1.2z',
    ]),
    ruler: Object.freeze(['M2.6 6.2h10.8v3.6H2.6z', 'M5.3 6.2v1.7', 'M8 6.2v2.4', 'M10.7 6.2v1.7']),
});

function blenderIconSvg(name) {
  const svg = document.createElementNS(BLENDER_ICON_NAMESPACE, 'svg');
  svg.setAttribute('class', 'blender-icon');
  svg.setAttribute('viewBox', BLENDER_ICON_VIEW_BOX);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const shapes = BLENDER_ICON_PATHS[name] || BLENDER_ICON_PATHS.object;
  shapes.forEach((shape) => {
      const path = document.createElementNS(BLENDER_ICON_NAMESPACE, 'path');
      path.setAttribute('d', shape);
      svg.appendChild(path);
  });
  return svg;
}
