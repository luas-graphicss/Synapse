'use strict';

const MODELER_PERFORMANCE_BUDGET = Object.freeze({
    tabReadyMs: 2500,
    frameMs: 33,
    peakMemoryMb: 512,
    exportMs: 5000,
});
const MODELER_PERFORMANCE_FRAME_SAMPLES = 45;
const MODELER_PERFORMANCE_BYTES_IN_MEGABYTE = 1048576;

const modelerPerformanceMeasurements = {
  tabReadyMs: 0,
  frameMs: 0,
  peakMemoryMb: 0,
  exportMs: 0,
};

function modelerPerformanceNow() {
  try {
    if (window.performance && typeof window.performance.now === 'function') {
      return window.performance.now();
    }
  } catch (erro) {
    ignorarErro(erro, 'modelador3d:desempenho:relogio');
  }
  return Date.now();
}

function modelerPerformanceMemoryMb() {
  try {
    const memory = window.performance && window.performance.memory;
    if (!memory || typeof memory.usedJSHeapSize !== 'number') return 0;
    return Math.round(memory.usedJSHeapSize / MODELER_PERFORMANCE_BYTES_IN_MEGABYTE);
  } catch (erro) {
    ignorarErro(erro, 'modelador3d:desempenho:memoria');
    return 0;
  }
}

function modelerPerformanceRecordMemory() {
  const current = modelerPerformanceMemoryMb();
  if (current > modelerPerformanceMeasurements.peakMemoryMb) {
    modelerPerformanceMeasurements.peakMemoryMb = current;
  }
  return modelerPerformanceMeasurements.peakMemoryMb;
}

function modelerPerformanceMarkTabReady() {
  if (modelerPerformanceMeasurements.tabReadyMs > 0) {
    return modelerPerformanceMeasurements.tabReadyMs;
  }
  modelerPerformanceMeasurements.tabReadyMs = Math.round(modelerPerformanceNow());
  modelerPerformanceRecordMemory();
  return modelerPerformanceMeasurements.tabReadyMs;
}

function modelerPerformanceSampleFrameMs() {
  return new Promise((resolve) => {
      if (typeof window.requestAnimationFrame !== 'function') {
        resolve(modelerPerformanceMeasurements.frameMs);
        return;
      }
      let remaining = MODELER_PERFORMANCE_FRAME_SAMPLES;
      let previous = modelerPerformanceNow();
      let total = 0;
      const measureFrame = () => {
        const current = modelerPerformanceNow();
        total += current - previous;
        previous = current;
        remaining -= 1;
        if (remaining > 0) {
          window.requestAnimationFrame(measureFrame);
          return;
        }
        const average = total / MODELER_PERFORMANCE_FRAME_SAMPLES;
        modelerPerformanceMeasurements.frameMs = Math.round(average * 100) / 100;
        modelerPerformanceRecordMemory();
        resolve(modelerPerformanceMeasurements.frameMs);
      };
      window.requestAnimationFrame(measureFrame);
  });
}

async function modelerPerformanceTimeExport(action) {
  const started = modelerPerformanceNow();
  try {
    return await action();
  } finally {
    modelerPerformanceMeasurements.exportMs = Math.round(modelerPerformanceNow() - started);
    modelerPerformanceRecordMemory();
  }
}

function modelerPerformanceReport() {
  modelerPerformanceRecordMemory();
  const measurements = { ...modelerPerformanceMeasurements };
  const overBudget = Object.keys(MODELER_PERFORMANCE_BUDGET).filter(
    (name) => measurements[name] > MODELER_PERFORMANCE_BUDGET[name],
  );
  return {
    measurements,
    budget: MODELER_PERFORMANCE_BUDGET,
    overBudget,
    withinBudget: overBudget.length === 0,
  };
}

window.MOD3D_PERFORMANCE = {
  budget: MODELER_PERFORMANCE_BUDGET,
  report: modelerPerformanceReport,
  markTabReady: modelerPerformanceMarkTabReady,
  sampleFrameMs: modelerPerformanceSampleFrameMs,
  timeExport: modelerPerformanceTimeExport,
};
