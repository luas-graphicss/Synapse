'use strict';

(function () {
    const axisLabels = ['X', 'Y', 'Z'];
    const axisColors = ['#d95a66', '#5cc785', '#5c8ff2'];
    const circleFill = 'rgba(24, 26, 33, 0.5)';
    const negativeFill = 'rgba(14, 16, 21, 0.94)';
    const labelColor = '#0d0f14';
    const highlightColor = 'rgba(255, 255, 255, 0.92)';
    const defaultSize = 76;
    const dragThresholdInPixels = 4;
    const armRatio = 0.32;
    const ballRatio = 0.115;
    const pickRatio = 0.17;

    function axisScreenEntries(viewMatrix, size) {
      const center = size / 2;
      const armLength = size * armRatio;
      const entries = [];
      for (let axis = 0; axis < 3; axis++) {
        for (let sign = 1; sign >= -1; sign -= 2) {
          entries.push({
              axis: axis,
              sign: sign,
              x: center + viewMatrix[axis * 4] * sign * armLength,
              y: center - viewMatrix[axis * 4 + 1] * sign * armLength,
              depth: viewMatrix[axis * 4 + 2] * sign,
          });
        }
      }
      entries.sort((first, second) => first.depth - second.depth);
      return entries;
    }

    function paintGizmo(context, size, entries, hoveredAxis, hoveredSign) {
      const center = size / 2;
      const ballRadius = size * ballRatio;
      context.clearRect(0, 0, size, size);
      context.beginPath();
      context.arc(center, center, size * 0.47, 0, Math.PI * 2);
      context.fillStyle = circleFill;
      context.fill();
      entries.forEach((entry) => {
          const color = axisColors[entry.axis];
          const highlighted = entry.axis === hoveredAxis && entry.sign === hoveredSign;
          if (entry.sign > 0) {
            context.beginPath();
            context.moveTo(center, center);
            context.lineTo(entry.x, entry.y);
            context.strokeStyle = color;
            context.lineWidth = Math.max(1.5, size * 0.022);
            context.lineCap = 'round';
            context.stroke();
          }
          context.beginPath();
          context.arc(entry.x, entry.y, ballRadius, 0, Math.PI * 2);
          context.fillStyle = entry.sign > 0 || highlighted ? color : negativeFill;
          context.fill();
          context.strokeStyle = color;
          context.lineWidth = Math.max(1, size * 0.016);
          context.stroke();
          if (highlighted) {
            context.beginPath();
            context.arc(entry.x, entry.y, ballRadius + size * 0.03, 0, Math.PI * 2);
            context.strokeStyle = highlightColor;
            context.lineWidth = Math.max(1, size * 0.018);
            context.stroke();
          }
          if (entry.sign > 0 || highlighted) {
            context.fillStyle = labelColor;
            context.font = '600 ' + Math.round(size * 0.16) + 'px system-ui, sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(axisLabels[entry.axis], entry.x, entry.y + size * 0.006);
          }
      });
    }

    function create(container, options) {
      if (!container || typeof document === 'undefined') return null;
      const settings = options || {};
      const size = Math.max(48, Number(settings.size) || defaultSize);
      const canvas = document.createElement('canvas');
      canvas.className = 'modeler-navigation-gizmo';
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      canvas.setAttribute('aria-label', 'Eixos da camera');
      const context = canvas.getContext('2d');
      let lastViewMatrix = null;
      let hoveredAxis = -1;
      let hoveredSign = 0;
      let activePointer = -1;
      let dragging = false;
      let startPoint = null;
      let lastPoint = null;

      function pointInCanvas(event) {
        const bounds = canvas.getBoundingClientRect();
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      }

      function render() {
        if (!context || !lastViewMatrix) return;
        const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
        const pixels = Math.round(size * ratio);
        if (canvas.width !== pixels) {
          canvas.width = pixels;
          canvas.height = pixels;
        }
        context.setTransform(canvas.width / size, 0, 0, canvas.height / size, 0, 0);
        paintGizmo(context, size, axisScreenEntries(lastViewMatrix, size), hoveredAxis, hoveredSign);
      }

      function entryAt(point) {
        if (!lastViewMatrix) return null;
        const entries = axisScreenEntries(lastViewMatrix, size).reverse();
        const limit = size * pickRatio;
        let chosen = null;
        entries.forEach((entry) => {
            if (chosen) return;
            if (Math.hypot(point.x - entry.x, point.y - entry.y) <= limit) chosen = entry;
        });
        return chosen;
      }

      function updateHover(entry) {
        const axis = entry ? entry.axis : -1;
        const sign = entry ? entry.sign : 0;
        if (axis === hoveredAxis && sign === hoveredSign) return;
        hoveredAxis = axis;
        hoveredSign = sign;
        render();
      }

      function onPointerDown(event) {
        event.preventDefault();
        event.stopPropagation();
        activePointer = event.pointerId;
        dragging = false;
        startPoint = pointInCanvas(event);
        lastPoint = startPoint;
        if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
      }

      function onPointerMove(event) {
        const point = pointInCanvas(event);
        if (activePointer !== event.pointerId) {
          updateHover(entryAt(point));
          return;
        }
        const movedX = point.x - lastPoint.x;
        const movedY = point.y - lastPoint.y;
        lastPoint = point;
        if (Math.hypot(point.x - startPoint.x, point.y - startPoint.y) > dragThresholdInPixels) dragging = true;
        if (dragging && typeof settings.onOrbit === 'function') settings.onOrbit(movedX, movedY);
      }

      function onPointerUp(event) {
        if (activePointer !== event.pointerId) return;
        const point = pointInCanvas(event);
        if (canvas.hasPointerCapture && canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
        activePointer = -1;
        if (!dragging) {
          const entry = entryAt(point);
          if (entry && typeof settings.onAxis === 'function') settings.onAxis(entry.axis, entry.sign);
        }
        dragging = false;
      }

      function onPointerLeave() {
        updateHover(null);
      }

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('pointerleave', onPointerLeave);
      canvas.addEventListener('contextmenu', (event) => event.preventDefault());
      container.appendChild(canvas);

      return {
        element: canvas,
        draw: (viewMatrix) => {
          if (!viewMatrix) return;
          lastViewMatrix = viewMatrix;
          render();
        },
        destroy: () => {
          canvas.removeEventListener('pointerdown', onPointerDown);
          canvas.removeEventListener('pointermove', onPointerMove);
          canvas.removeEventListener('pointerup', onPointerUp);
          canvas.removeEventListener('pointercancel', onPointerUp);
          canvas.removeEventListener('pointerleave', onPointerLeave);
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        },
      };
    }

    window.SynapseNavigationGizmo = Object.freeze({ create: create });
})();
