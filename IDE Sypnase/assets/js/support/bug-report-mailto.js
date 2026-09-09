(function (root) {
    'use strict';

    const RECIPIENT_ADDRESS = 'pedrinnieeva@gmail.com';

    function build(message) {
      const subject = encodeURIComponent(message.subject);
      const body = encodeURIComponent(message.body);
      return `mailto:${RECIPIENT_ADDRESS}?subject=${subject}&body=${body}`;
    }

    function open(message) {
      const address = build(message);
      const opened = root.open(address, '_blank');
      if (!opened) root.location.href = address;
    }

    root.SynapseBugReportMailto = Object.freeze({ recipient: RECIPIENT_ADDRESS, build, open });
})(typeof globalThis !== 'undefined' ? globalThis : window);
