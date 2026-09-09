(function () {
    'use strict';

    const debug = window.SynapseDebug || (window.SynapseDebug = {});

    function projectPath(value) {
      if (typeof value !== 'string' || !value || value.length > 1000) return null;
      const normalized = value.replace(/\\/g, '/');
      if (/^[a-z][a-z\d+.-]*:/i.test(normalized) || normalized.startsWith('/')) return null;
      if (/[\u0000-\u001f\u007f]/.test(normalized)) return null;
      if (normalized.split('/').some((part) => !part || part === '.' || part === '..')) return null;
      return normalized;
    }

    function isJavaScript(path) {
      return !!projectPath(path) && /\.(?:js|mjs|cjs)$/i.test(path);
    }

    function isLoopback(hostname) {
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    }

    function inspectorEndpoint(value) {
      const endpoint = new URL(String(value).trim());
      if (!['ws:', 'wss:'].includes(endpoint.protocol))
      throw new Error('Use an Inspector WebSocket URL.');
      if (endpoint.username || endpoint.password || endpoint.hash)
      throw new Error('Invalid Inspector URL.');
      if (endpoint.protocol === 'ws:' && !isLoopback(endpoint.hostname)) {
        throw new Error('Unencrypted Inspector connections must stay on localhost.');
      }
      if (endpoint.pathname === '/' || endpoint.pathname.includes('/devtools/browser/')) {
        throw new Error('Use a page or Node target, not the browser control endpoint.');
      }
      return endpoint.href;
    }

    function sourceRoot(value) {
      const text = String(value || '')
      .trim()
      .replace(/\\/g, '/');
      if (!text) throw new Error('Enter the source root URL or absolute project folder.');
      let root;
      if (text.startsWith('/') || /^[a-z]:\//i.test(text)) {
        const absolute = text.startsWith('/') ? text : '/' + text;
        root = new URL(
          'file://' +
          absolute
          .split('/')
          .map((part, index) =>
            index === 1 && /^[a-z]:$/i.test(part) ? part : encodeURIComponent(part),
          )
          .join('/'),
        );
      } else root = new URL(text);
      if (!['http:', 'https:', 'file:'].includes(root.protocol) || root.username || root.password) {
        throw new Error('The source root must use HTTP, HTTPS or an absolute file path.');
      }
      root.search = '';
      root.hash = '';
      if (!root.pathname.endsWith('/')) root.pathname += '/';
      return root.href;
    }

    function sourceUrl(root, path) {
      const normalized = projectPath(path);
      if (!normalized) throw new Error('Invalid project source path.');
      return new URL(normalized.split('/').map(encodeURIComponent).join('/'), sourceRoot(root)).href;
    }

    function relativeSource(root, value, files) {
      try {
        const base = new URL(sourceRoot(root));
        const target = new URL(value);
        if (target.protocol !== base.protocol || target.host !== base.host) return null;
        if (!target.pathname.startsWith(base.pathname)) return null;
        const path = projectPath(decodeURIComponent(target.pathname.slice(base.pathname.length)));
        return path && (!files || files.has(path)) ? path : null;
      } catch {
        return null;
      }
    }

    function breakpointPattern(root, path) {
      const escaped = sourceUrl(root, path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return `^${escaped}(?:[?#].*)?$`;
    }

    function breakpointKey(breakpoint) {
      return JSON.stringify([breakpoint.path, breakpoint.line]);
    }

    debug.paths = Object.freeze({
        projectPath,
        isJavaScript,
        isLoopback,
        inspectorEndpoint,
        sourceRoot,
        sourceUrl,
        relativeSource,
        breakpointKey,
        breakpointPattern,
    });
})();
