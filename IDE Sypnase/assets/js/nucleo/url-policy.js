'use strict';

const SynapseUrlPolicy = (function () {
    const RESOURCE_PROTOCOLS = Object.freeze(['http:', 'https:', 'blob:']);
    const NAVIGATION_PROTOCOLS = Object.freeze(['http:', 'https:']);
    const INLINE_DATA_TYPES = Object.freeze([
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/avif',
        'image/bmp',
        'image/x-icon',
        'audio/mpeg',
        'audio/ogg',
        'audio/wav',
        'video/mp4',
        'video/webm',
        'font/woff',
        'font/woff2',
    ]);
    const MAXIMUM_URL_LENGTH = 8192;
    const PROTOCOL_RELATIVE_START = /^[\\/]{2}/;
    const INLINE_DATA_TYPE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?[;,]/i;

    function hasControlCharacters(text) {
      for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index);
        if (code <= 31 || code === 127) return true;
      }
      return false;
    }

    function cleanText(value) {
      return String(value == null ? '' : value).trim();
    }

    function isRejected(text) {
      if (!text || text.length > MAXIMUM_URL_LENGTH) return true;
      if (hasControlCharacters(text)) return true;
      return PROTOCOL_RELATIVE_START.test(text);
    }

    function isRelativeReference(text) {
      if (PROTOCOL_RELATIVE_START.test(text)) return false;
      return (
        text.startsWith('#') ||
        text.startsWith('?') ||
        text.startsWith('./') ||
        text.startsWith('../') ||
        text.startsWith('/')
      );
    }

    function inlineDataType(text) {
      const found = INLINE_DATA_TYPE.exec(text);
      return found ? String(found[1] || '').toLowerCase() : '';
    }

    function isAllowedInlineData(value) {
      return INLINE_DATA_TYPES.includes(inlineDataType(cleanText(value)));
    }

    function parseUrl(text) {
      try {
        return new URL(text, window.location.href);
      } catch (error) {
        return null;
      }
    }

    function resourceUrl(value, fallback = 'about:blank') {
      const text = cleanText(value);
      if (isRejected(text)) return fallback;
      if (isRelativeReference(text)) return parseUrl(text) ? text : fallback;
      if (/^data:/i.test(text)) return isAllowedInlineData(text) ? text : fallback;
      const parsed = parseUrl(text);
      if (!parsed) return fallback;
      return RESOURCE_PROTOCOLS.includes(parsed.protocol) ? parsed.href : fallback;
    }

    function navigationUrl(value, fallback = 'about:blank') {
      const text = cleanText(value);
      if (isRejected(text)) return fallback;
      const parsed = parseUrl(text);
      if (!parsed) return fallback;
      if (!NAVIGATION_PROTOCOLS.includes(parsed.protocol)) return fallback;
      if (isRelativeReference(text) && parsed.origin !== window.location.origin) return fallback;
      return parsed.href;
    }

    return { resourceUrl, navigationUrl, isAllowedInlineData };
})();

window.SynapseUrlPolicy = SynapseUrlPolicy;
