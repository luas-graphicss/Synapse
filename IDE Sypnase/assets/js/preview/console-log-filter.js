(function () {
    const MCP_SOURCES = ['mcp', 'diag', 'relay'];

    function isMcpLog(log) {
      if (!log) return false;
      if (log.level === 'mcp') return true;
      return MCP_SOURCES.includes(String(log.src || '').toLowerCase());
    }

    function matchesCategory(log, category) {
      if (!log) return false;
      if (!category || category === 'all') return true;
      if (category === 'mcp') return isMcpLog(log);
      return log.level === category;
    }

    function matchesSearch(log, search) {
      const term = String(search || '')
      .trim()
      .toLowerCase();
      if (!term) return true;
      return ((log.text || '') + ' ' + (log.src || '')).toLowerCase().includes(term);
    }

    function visibleLogs(logs, category, search) {
      const list = Array.isArray(logs) ? logs : [];
      return list.filter((log) => matchesCategory(log, category) && matchesSearch(log, search));
    }

    function countByCategory(logs, category) {
      const list = Array.isArray(logs) ? logs : [];
      return list.filter((log) => matchesCategory(log, category)).length;
    }

    function formatLogLine(log, formatTime) {
      const time = typeof formatTime === 'function' ? formatTime(log.t) : '';
      const level = String(log.level || 'log').toUpperCase();
      const source = log.src ? ' (' + log.src + ')' : '';
      return '[' + time + '] ' + level + ' ' + (log.text || '') + source;
    }

    function toPlainText(logs, formatTime) {
      const list = Array.isArray(logs) ? logs : [];
      return list.map((log) => formatLogLine(log, formatTime)).join('\n');
    }

    window.ConsoleLogFilter = {
      isMcpLog,
      matchesCategory,
      matchesSearch,
      visibleLogs,
      countByCategory,
      toPlainText,
    };
})();
