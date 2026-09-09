'use strict';

function blenderMeshModalValueText(session) {
  const definition = session.definition;
  const value = blenderMeshModalSessionValue(session);
  return `${definition.valueLabel}: ${value.toFixed(definition.decimals)}`;
}

function blenderMeshModalSegmentsText(session) {
  if (!session.definition.usesSegments) return '';
  return ` | cortes: ${blenderMeshModalSessionSegments(session)}`;
}

function blenderMeshModalTypedText(session) {
  if (!session.typedText.length) return '';
  return ` | digitado: ${session.typedText}`;
}

function blenderMeshModalHintText(session) {
  const hints = ['clique ou Enter confirma', 'Esc cancela', 'Shift para ajuste fino', 'Ctrl para encaixe'];
  if (session.definition.usesSegments) hints.push('roda do mouse muda os cortes');
  return ` — ${hints.join(' · ')}`;
}

function blenderMeshModalHeaderText(session) {
  const label = session.definition.headerLabel;
  const value = blenderMeshModalValueText(session);
  const segments = blenderMeshModalSegmentsText(session);
  const typed = blenderMeshModalTypedText(session);
  return `${label}  ${value}${segments}${typed}${blenderMeshModalHintText(session)}`;
}

function blenderMeshModalMessageText(session, message) {
  return `${session.definition.headerLabel}  ${message}`;
}
