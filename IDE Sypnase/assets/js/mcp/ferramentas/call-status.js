(function registerCallStatus(root) {
    'use strict';

    if (typeof MCP_TOOLS === 'undefined' || MCP_TOOLS.some((tool) => tool.name === 'call_status'))
    return;
    MCP_TOOLS.push({
        name: 'call_status',
        title: 'MCP operation status',
        desc: 'Retrieve the actual status and result of a slow operation using its operation_id and the same agent. Never repeats the original operation. Completed results are retained for up to 10 minutes, subject to memory limits.',
        schema: {
          type: 'object',
          properties: {
            operation_id: {
              type: 'string',
              description: 'Operation identifier returned by the original call.',
            },
            agent: { type: 'string', description: 'The same agent name used for the original call.' },
            project: { type: 'string', description: 'Original project name or id.' },
          },
          required: ['operation_id', 'agent'],
        },
        run: async (args) => root.SynapseMcpCallLifecycle.status(args),
    });
    if (typeof MCP_INSTRUCTIONS !== 'undefined')
    MCP_INSTRUCTIONS +=
    '\nSlow operations can return status=running with an operation_id. This is not a completed result or cancellation. Use call_status with that id and the same agent to retrieve the final result. Never blindly repeat the original mutation.';
})(window);
