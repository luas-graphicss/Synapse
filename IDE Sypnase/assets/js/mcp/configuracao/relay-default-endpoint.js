'use strict';
(function synapseRelayDefaultEndpoint() {
    const encodedReversedHost = 'dmVkLnNyZWtyb3cuYXZlZWlubmlyZGVwLnlhbGVyLWFyb3J1YQ==';

    function defaultRelayHost() {
      return atob(encodedReversedHost).split('').reverse().join('');
    }

    function defaultRelayOrigin() {
      return 'https://' + defaultRelayHost();
    }

    window.SynapseRelayDefaultEndpoint = Object.freeze({
        defaultRelayHost: defaultRelayHost,
        defaultRelayOrigin: defaultRelayOrigin,
    });
})();
