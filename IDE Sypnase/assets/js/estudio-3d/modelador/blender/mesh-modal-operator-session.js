'use strict';

const BLENDER_MESH_MODAL_PRECISION_FACTOR = 0.1;

function blenderCreateMeshModalSession(definition, pointer) {
  const start = pointer ? { x: pointer.x, y: pointer.y } : { x: 0, y: 0 };
  return {
    definition,
    startPointer: { x: start.x, y: start.y },
    pointer: { x: start.x, y: start.y },
    anchored: false,
    precision: false,
    snap: false,
    typedText: '',
    segments: definition.startSegments,
  };
}

function blenderMeshModalClampValue(definition, value) {
  if (!isFinite(value)) return definition.startValue;
  return Math.min(definition.maximumValue, Math.max(definition.minimumValue, value));
}

function blenderMeshModalClampSegments(segments) {
  const rounded = Math.round(Number(segments));
  if (!isFinite(rounded)) return BLENDER_MESH_MODAL_SEGMENT_LIMITS.minimum;
  return Math.min(
    BLENDER_MESH_MODAL_SEGMENT_LIMITS.maximum,
    Math.max(BLENDER_MESH_MODAL_SEGMENT_LIMITS.minimum, rounded),
  );
}

function blenderMeshModalSnapValue(definition, value) {
  if (!definition.snapStep) return value;
  return Math.round(value / definition.snapStep) * definition.snapStep;
}

function blenderMeshModalTypedNumber(session) {
  if (!session.typedText.length) return null;
  const value = Number(session.typedText);
  return isFinite(value) ? value : null;
}

function blenderMeshModalPointerValue(session) {
  const definition = session.definition;
  const movedRight = session.pointer.x - session.startPointer.x;
  const movedUp = session.startPointer.y - session.pointer.y;
  const step = definition.unitsPerPixel * (session.precision ? BLENDER_MESH_MODAL_PRECISION_FACTOR : 1);
  const moved = definition.startValue + (movedRight + movedUp) * step;
  const value = session.snap ? blenderMeshModalSnapValue(definition, moved) : moved;
  return blenderMeshModalClampValue(definition, value);
}

function blenderMeshModalSessionValue(session) {
  if (session.definition.typedSetsSegments) return blenderMeshModalPointerValue(session);
  const typed = blenderMeshModalTypedNumber(session);
  if (typed === null) return blenderMeshModalPointerValue(session);
  return blenderMeshModalClampValue(session.definition, typed);
}

function blenderMeshModalSessionSegments(session) {
  if (!session.definition.usesSegments) return 1;
  if (session.definition.typedSetsSegments) {
    const typed = blenderMeshModalTypedNumber(session);
    if (typed !== null) return blenderMeshModalClampSegments(typed);
  }
  return blenderMeshModalClampSegments(session.segments);
}

function blenderMeshModalSessionMovePointer(session, pointer) {
  if (!pointer) return false;
  if (!session.anchored) {
    session.anchored = true;
    session.startPointer.x = pointer.x;
    session.startPointer.y = pointer.y;
  }
  session.pointer.x = pointer.x;
  session.pointer.y = pointer.y;
  return true;
}

function blenderMeshModalSessionSetPrecision(session, precision) {
  session.precision = precision === true;
  return session.precision;
}

function blenderMeshModalSessionSetSnap(session, snap) {
  session.snap = snap === true;
  return session.snap;
}

function blenderMeshModalSessionChangeSegments(session, delta) {
  if (!session.definition.usesSegments) return false;
  const next = blenderMeshModalClampSegments(blenderMeshModalSessionSegments(session) + delta);
  session.typedText = '';
  if (next === session.segments) return false;
  session.segments = next;
  return true;
}

function blenderMeshModalSessionTypeKey(session, key) {
  if (key === 'Backspace') {
    session.typedText = session.typedText.slice(0, -1);
    return true;
  }
  const character = key === ',' ? '.' : key;
  if (character === '.' && session.typedText.indexOf('.') !== -1) return false;
  if (character === '-') {
    const negative = session.typedText.charAt(0) === '-';
    session.typedText = negative ? session.typedText.slice(1) : `-${session.typedText}`;
    return true;
  }
  session.typedText = `${session.typedText}${character}`;
  return true;
}
