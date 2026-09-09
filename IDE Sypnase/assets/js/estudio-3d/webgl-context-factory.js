'use strict';

(function () {
    const CONTEXT_NAMES = Object.freeze(['webgl', 'experimental-webgl', 'webgl2']);

    const ATTRIBUTE_PROFILES = Object.freeze([
        Object.freeze({
            name: 'opaque-antialiased',
            attributes: Object.freeze({
                alpha: false,
                antialias: true,
                depth: true,
                stencil: false,
                premultipliedAlpha: false,
                powerPreference: 'default',
                failIfMajorPerformanceCaveat: false,
            }),
        }),
        Object.freeze({
            name: 'transparent-antialiased',
            attributes: Object.freeze({
                alpha: true,
                antialias: true,
                depth: true,
                failIfMajorPerformanceCaveat: false,
            }),
        }),
        Object.freeze({
            name: 'transparent-without-antialias',
            attributes: Object.freeze({
                alpha: true,
                antialias: false,
                depth: true,
                failIfMajorPerformanceCaveat: false,
            }),
        }),
        Object.freeze({
            name: 'depth-only',
            attributes: Object.freeze({ depth: true }),
        }),
        Object.freeze({
            name: 'browser-defaults',
            attributes: Object.freeze({}),
        }),
    ]);

    function requestContext(canvas, contextName, attributes) {
      try {
        return canvas.getContext(contextName, attributes) || null;
      } catch (error) {
        if (typeof ignorarErro === 'function') ignorarErro(error, 'webgl:context-factory');
        return null;
      }
    }

    function attemptsFor(requiredAttributes) {
      const attempts = [];
      ATTRIBUTE_PROFILES.forEach(function (profile) {
          CONTEXT_NAMES.forEach(function (contextName) {
              attempts.push({
                  profileName: profile.name,
                  contextName: contextName,
                  attributes: Object.assign({}, profile.attributes, requiredAttributes || {}),
              });
          });
      });
      return attempts;
    }

    function failureResult(refusedAttempts) {
      return Object.freeze({
          context: null,
          contextName: '',
          profileName: '',
          refusedAttempts: Object.freeze(refusedAttempts),
      });
    }

    function createContext(canvas, requiredAttributes) {
      if (!canvas || typeof canvas.getContext !== 'function') return failureResult([]);
      const refusedAttempts = [];
      const attempts = attemptsFor(requiredAttributes);
      for (let index = 0; index < attempts.length; index += 1) {
        const attempt = attempts[index];
        const context = requestContext(canvas, attempt.contextName, attempt.attributes);
        if (context) {
          return Object.freeze({
              context: context,
              contextName: attempt.contextName,
              profileName: attempt.profileName,
              refusedAttempts: Object.freeze(refusedAttempts),
          });
        }
        refusedAttempts.push(attempt.profileName + ' as ' + attempt.contextName);
      }
      return failureResult(refusedAttempts);
    }

    window.SynapseWebglContextFactory = Object.freeze({
        createContext: createContext,
        contextNames: CONTEXT_NAMES,
        profileNames: Object.freeze(ATTRIBUTE_PROFILES.map((profile) => profile.name)),
    });
})();
