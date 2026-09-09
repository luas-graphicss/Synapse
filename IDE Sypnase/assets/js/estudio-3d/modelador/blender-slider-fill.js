'use strict';

const BLENDER_SLIDER_FILL_PROPERTY = '--blender-slider-fill';

function blenderUpdateSliderFill(slider) {
  const field = slider.closest('.mod3d-faixa');
  if (!field) return;
  const minimum = Number(slider.min);
  const maximum = Number(slider.max);
  const start = Number.isFinite(minimum) ? minimum : 0;
  const end = Number.isFinite(maximum) ? maximum : 1;
  const span = end - start;
  const value = Number(slider.value);
  const ratio = span > 0 && Number.isFinite(value) ? (value - start) / span : 0;
  const percent = Math.max(0, Math.min(1, ratio)) * 100;
  field.style.setProperty(BLENDER_SLIDER_FILL_PROPERTY, `${percent.toFixed(2)}%`);
}

function blenderWatchSliderFill() {
  const sliders = Array.from(document.querySelectorAll('.mod3d-faixa-campo'));
  if (!sliders.length) return null;
  sliders.forEach(blenderUpdateSliderFill);
  document.addEventListener(
    'input',
    (event) => {
      const target = event.target;
      if (target && target.classList && target.classList.contains('mod3d-faixa-campo')) {
        blenderUpdateSliderFill(target);
      }
    },
    true,
  );
  const observer = new MutationObserver(() => sliders.forEach(blenderUpdateSliderFill));
  sliders.forEach((slider) => {
      const field = slider.closest('.mod3d-faixa');
      if (field) observer.observe(field, { characterData: true, childList: true, subtree: true });
  });
  return observer;
}
