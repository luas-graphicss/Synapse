(function installToolDurabilityPolicy(root) {
    'use strict';

    const readOnlyTools = new Set([
        'read_file',
        'read_files',
        'list_files',
        'search',
        'outline',
        'check_syntax',
        'project_status',
        'list_projects',
        'list_versions',
        'read_version',
        'diff_file',
        'list_snapshots',
        'diff_snapshot',
        'call_status',
        'command_output',
        'dev_server_status',
        'console_logs',
        'query_dom',
        'ui_map',
        'agent_activity',
        'list_agents',
        'read_messages',
        'team_status',
        'team_list',
        'team_globals',
        'review_list',
        'review_get',
        'review_deps',
        'storage_health',
    ]);

    function requiresFlush(params) {
      const name = root.SynapseMcpResolveToolName?.({ params }) || params?.name;
      return !readOnlyTools.has(name);
    }

    root.SynapseMcpToolDurability = Object.freeze({ requiresFlush });
})(globalThis);
