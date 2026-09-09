'use strict';
(function synapseRelayUrlPresentation() {
    const hiddenHostLabel = 'relay-oculto';

    function defaultRelayHost() {
      const endpoint = window.SynapseRelayDefaultEndpoint;
      return endpoint ? endpoint.defaultRelayHost() : '';
    }

    function defaultRelayOrigin() {
      const endpoint = window.SynapseRelayDefaultEndpoint;
      return endpoint ? endpoint.defaultRelayOrigin() : '';
    }

    function withoutTrailingSlashes(text) {
      return String(text || '').replace(/\/+$/, '');
    }

    function isDefaultRelay(text) {
      const origin = defaultRelayOrigin();
      return !!origin && withoutTrailingSlashes(text) === origin;
    }

    function maskRelayHost(text) {
      const host = defaultRelayHost();
      const value = String(text || '');
      if (!host) return value;
      return value.split(host).join(hiddenHostLabel);
    }

    function editableRelayValue(text) {
      return isDefaultRelay(text) ? '' : String(text || '');
    }

    window.SynapseRelayUrlPresentation = Object.freeze({
        hiddenHostLabel: hiddenHostLabel,
        isDefaultRelay: isDefaultRelay,
        maskRelayHost: maskRelayHost,
        editableRelayValue: editableRelayValue,
    });
})();
