# Bug report

Extension that ships built into the Synapse IDE and replaces the old internal bug report module.

It adds the synapse.bugReport.open command, which also appears in the Help menu as the option to report a bug. The command opens a form in a webview protected by a CSP with a nonce, and the report is sent to the api/bug-report endpoint on the same origin as the IDE, using the network:self permission. If the server does not answer, the extension opens your email client with the text already filled in, so you only need to send it.

Agents connected through MCP get the draft tool, which writes the report text without sending anything.
