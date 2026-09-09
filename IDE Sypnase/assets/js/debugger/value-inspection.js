(function () {
    'use strict';

    const debug = window.SynapseDebug;

    function describe(value) {
      if (!value) return 'unavailable';
      if (value.unserializableValue !== undefined) return String(value.unserializableValue);
      if (value.type === 'undefined') return 'undefined';
      if (value.subtype === 'null') return 'null';
      if (value.type === 'string')
      return JSON.stringify(value.value ?? value.description ?? '').slice(0, 2000);
      if (Object.prototype.hasOwnProperty.call(value, 'value')) return String(value.value);
      return String(
        value.description || value.className || value.subtype || value.type || 'unavailable',
      ).slice(0, 2000);
    }

    function assertPaused(session, revision) {
      if (session.state !== 'paused' || session.pauseRevision !== revision)
      throw new Error('The debug frame is no longer paused.');
    }

    async function properties(session, objectId, revision = session.pauseRevision) {
      assertPaused(session, revision);
      const result = await session.connection.request('Runtime.getProperties', {
          objectId,
          ownProperties: true,
          accessorPropertiesOnly: false,
          generatePreview: false,
      });
      assertPaused(session, revision);
      if (result.exceptionDetails)
      throw new Error(result.exceptionDetails.text || 'Cannot inspect this value.');
      return (result.result || []).slice(0, 200).map((property) => ({
            name: property.name,
            value: property.value,
            label: property.get || property.set ? '[accessor — not evaluated]' : describe(property.value),
            expandable: !!property.value?.objectId,
      }));
    }

    async function watch(
      session,
      expression,
      revision = session.pauseRevision,
      objectGroup = 'synapse-debug-watch',
    ) {
      assertPaused(session, revision);
      const frame = session.frames[session.selectedFrame];
      if (!frame) throw new Error('Select a call frame.');
      const result = await session.connection.request('Debugger.evaluateOnCallFrame', {
          callFrameId: frame.callFrameId,
          expression,
          objectGroup,
          returnByValue: false,
          generatePreview: false,
          silent: true,
          throwOnSideEffect: true,
          timeout: 200,
      });
      assertPaused(session, revision);
      const exception = result.exceptionDetails;
      return {
        expression,
        value: exception ? null : result.result,
        error: exception
        ? exception.exception?.description || exception.text || 'Expression unavailable'
        : '',
        label: exception
        ? exception.exception?.description || exception.text || 'Expression unavailable'
        : describe(result.result),
      };
    }

    debug.inspection = Object.freeze({ describe, assertPaused, properties, watch });
})();
