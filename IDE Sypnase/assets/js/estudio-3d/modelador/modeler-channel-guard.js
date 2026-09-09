'use strict';

const MODELER_CHANNEL_SENDER_ROLES = Object.freeze(['editor', 'modelador']);
const MODELER_CHANNEL_TYPE_PATTERN = /^[a-z][a-z0-9-]{0,47}$/;
const MODELER_CHANNEL_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const MODELER_CHANNEL_PAYLOAD_LIMIT = 134217728;
const MODELER_CHANNEL_DEPTH_LIMIT = 24;
const MODELER_CHANNEL_SCAN_LIMIT = 2048;
const MODELER_CHANNEL_ESTIMATED_ENTRY_BYTES = 8;

function modelerChannelLooksLikeModelerMessage(value) {
  return Boolean(value) && typeof value === 'object' && value.__mod3d === true;
}

function modelerChannelIsBinaryValue(value) {
  if (value instanceof ArrayBuffer) return true;
  return typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(value);
}

function modelerChannelChildValues(value) {
  return Array.isArray(value) ? value : Object.values(value);
}

function modelerChannelValueIsTooDeep(value, depth) {
  if (!value || typeof value !== 'object' || modelerChannelIsBinaryValue(value)) return false;
  if (depth >= MODELER_CHANNEL_DEPTH_LIMIT) return true;
  const children = modelerChannelChildValues(value);
  if (children.length > MODELER_CHANNEL_SCAN_LIMIT) return false;
  return children.some((child) => modelerChannelValueIsTooDeep(child, depth + 1));
}

function modelerChannelValueSize(value, depth) {
  if (typeof value === 'string') return value.length * 2;
  if (modelerChannelIsBinaryValue(value)) return Number(value.byteLength) || 0;
  if (!value || typeof value !== 'object') return MODELER_CHANNEL_ESTIMATED_ENTRY_BYTES;
  if (depth >= MODELER_CHANNEL_DEPTH_LIMIT) return MODELER_CHANNEL_ESTIMATED_ENTRY_BYTES;
  const children = modelerChannelChildValues(value);
  if (children.length > MODELER_CHANNEL_SCAN_LIMIT) {
    return children.length * MODELER_CHANNEL_ESTIMATED_ENTRY_BYTES;
  }
  let total = MODELER_CHANNEL_ESTIMATED_ENTRY_BYTES;
  children.forEach((child) => {
      total += modelerChannelValueSize(child, depth + 1);
  });
  return total;
}

function modelerChannelMessageIsAddressedToUs(message, expected) {
  if (!modelerChannelLooksLikeModelerMessage(message)) return false;
  if (typeof message.sessao !== 'string' || message.sessao !== expected.session) return false;
  return typeof message.de === 'string' && message.de !== expected.role;
}

function modelerChannelMessageProblem(message, expected) {
  if (MODELER_CHANNEL_SENDER_ROLES.indexOf(message.de) === -1) {
    return `sender "${String(message.de)}" does not belong to the modeler channel`;
  }
  if (message.proto !== expected.protocol) {
    return `protocol ${String(message.proto)} is not the expected protocol ${String(expected.protocol)}`;
  }
  if (typeof message.mid !== 'string' || !MODELER_CHANNEL_IDENTIFIER_PATTERN.test(message.mid)) {
    return 'message identifier is missing or malformed';
  }
  if (typeof message.tipo !== 'string' || !MODELER_CHANNEL_TYPE_PATTERN.test(message.tipo)) {
    return `message type "${String(message.tipo)}" is not a valid channel type name`;
  }
  if (message.dados === undefined || message.dados === null) return null;
  if (typeof message.dados !== 'object' || Array.isArray(message.dados)) {
    return 'message payload is not a plain object';
  }
  if (modelerChannelValueIsTooDeep(message.dados, 0)) {
    return `message payload is nested deeper than ${MODELER_CHANNEL_DEPTH_LIMIT} levels`;
  }
  const payloadSize = modelerChannelValueSize(message.dados, 0);
  if (payloadSize > MODELER_CHANNEL_PAYLOAD_LIMIT) {
    return `message payload of about ${payloadSize} bytes is over the channel limit of ${MODELER_CHANNEL_PAYLOAD_LIMIT} bytes`;
  }
  return null;
}

function modelerChannelOriginIsExpected(origin) {
  if (typeof origin !== 'string') return false;
  if (origin === '' || origin === 'null') return true;
  return origin === window.location.origin;
}

function modelerChannelRecordRefusal(reason, transport) {
  if (typeof ignorarErro !== 'function') return;
  ignorarErro(
    new Error(`modeler channel refused a message: ${reason}`),
    `modelador3d:canal:${transport || 'desconhecido'}`,
  );
}
