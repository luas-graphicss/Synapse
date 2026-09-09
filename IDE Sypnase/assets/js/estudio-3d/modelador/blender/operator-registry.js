'use strict';

const blenderOperatorHandlers = new Map();

function blenderRegisterOperator(operatorId, handler) {
  if (typeof operatorId !== 'string' || !operatorId.length) return false;
  if (typeof handler !== 'function') return false;
  blenderOperatorHandlers.set(operatorId, handler);
  return true;
}

function blenderHasOperator(operatorId) {
  return blenderOperatorHandlers.has(operatorId);
}

function blenderRegisteredOperatorIds() {
  return Array.from(blenderOperatorHandlers.keys()).sort();
}

function blenderRunOperator(operatorId, context) {
  const handler = blenderOperatorHandlers.get(operatorId);
  if (!handler) return false;
  try {
    return handler(context || {}) !== false;
  } catch (error) {
    ignorarErro(error, 'blenderRunOperator:' + operatorId);
    return false;
  }
}
