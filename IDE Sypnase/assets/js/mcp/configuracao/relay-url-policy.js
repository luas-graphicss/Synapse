'use strict';
(function auroraRelayUrlPolicy() {
    const maximumRelayUrlLength = 300;
    const localHostNames = ['localhost', '127.0.0.1', '[::1]'];

    function safeRelayUrl(text) {
      const cleaned = String(text || '')
      .trim()
      .replace(/\/+$/, '');
      if (!cleaned || cleaned.length > maximumRelayUrlLength) return '';
      const checked = window.SynapseUrlPolicy.navigationUrl(cleaned, '');
      if (!checked) return '';
      let parsed = null;
      try {
        parsed = new URL(checked);
      } catch (e) {
        ignorarErro(e, 'safeRelayUrl');
        return '';
      }
      if (parsed.username || parsed.password) return '';
      const isLocalHost = localHostNames.includes(parsed.hostname);
      if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalHost)) return '';
      return (parsed.origin + parsed.pathname).replace(/\/+$/, '');
    }

    window.SynapseRelayUrlPolicy = Object.freeze({ safeRelayUrl });
})();
