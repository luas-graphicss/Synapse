(function (root) {
    'use strict';

    const MCP_MENU_PHRASES = {
      'Modo: Local': ['Mode: Local', 'Modo: Local', '模式：本地'],
      'Modo: Nuvem': ['Mode: Cloud', 'Modo: Nube', '模式：云端'],
      'Modo local ativo': ['Local mode active', 'Modo local activo', '本地模式已启用'],
      'Modo nuvem ativo': ['Cloud mode active', 'Modo nube activo', '云端模式已启用'],
      'Informe o endereço do relay local.': [
        'Enter the local relay address.',
        'Indica la dirección del relay local.',
        '请输入本地 relay 地址。',
      ],
      'Serviço local não encontrado.': [
        'Local service not found.',
        'Servicio local no encontrado.',
        '未找到本地服务。',
      ],
      'Endereço local movido para o campo Relay local.': [
        'Local address moved to the Local relay field.',
        'Dirección local movida al campo Relay local.',
        '本地地址已移至“本地 relay”字段。',
      ],
      Conectado: ['Connected', 'Conectado', '已连接'],
      'Equipe nativa: um agente. Pode alterar qualquer arquivo.': [
        'Native team: one agent. Can change any file.',
        'Equipo nativo: un agente. Puede modificar cualquier archivo.',
        '内置团队：一个代理，可修改任意文件。',
      ],
      'Equipe nativa: administra as equipes pelo MCP.': [
        'Native team: manages teams through MCP.',
        'Equipo nativo: administra los equipos mediante MCP.',
        '内置团队：通过 MCP 管理团队。',
      ],
      'Nenhuma equipe elegivel agora.': [
        'No eligible team right now.',
        'Ningún equipo elegible ahora.',
        '当前没有符合条件的团队。',
      ],
      'Exemplo:': ['Example:', 'Ejemplo:', '示例：'],
      'Proximo:': ['Next:', 'Siguiente:', '下一个：'],
    };

    root.SynapsePhraseRegistration.register(MCP_MENU_PHRASES);
})(typeof globalThis !== 'undefined' ? globalThis : window);
