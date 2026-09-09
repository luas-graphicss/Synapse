(function (root) {
    'use strict';

    const DOCS_PHRASES = {
      Fundamentos: ['Fundamentals', 'Fundamentos', '基础'],
      Ferramentas: ['Tools', 'Herramientas', '工具'],
      Plataforma: ['Platform', 'Plataforma', '平台'],
      Suporte: ['Support', 'Soporte', '支持'],
      'Visão geral': ['Overview', 'Visión general', '概览'],
      'Primeiros passos': ['Getting started', 'Primeros pasos', '入门'],
      'Área de trabalho': ['Workspace', 'Área de trabajo', '工作区'],
      'Editor de código': ['Code editor', 'Editor de código', '代码编辑器'],
      'Preview ao vivo': ['Live preview', 'Vista previa en vivo', '实时预览'],
      'Build e compilador': ['Build and compiler', 'Build y compilador', '构建与编译器'],
      'Assistente de IA': ['AI assistant', 'Asistente de IA', 'AI 助手'],
      'Terminal e relay': ['Terminal and relay', 'Terminal y relay', '终端与中继'],
      'MCP e agentes': ['MCP and agents', 'MCP y agentes', 'MCP 与代理'],
      'Arquivos e persistência': ['Files and persistence', 'Archivos y persistencia', '文件与持久化'],
      'Configurações e atalhos': ['Settings and shortcuts', 'Configuración y atajos', '设置与快捷键'],
      'Solução de problemas': ['Troubleshooting', 'Solución de problemas', '疑难解答'],
      Atualizações: ['Updates', 'Actualizaciones', '更新'],
      'Documentação oficial': ['Official documentation', 'Documentación oficial', '官方文档'],
      'Documentação da Synapse IDE': [
        'Synapse IDE documentation',
        'Documentación de Synapse IDE',
        'Synapse IDE 文档',
      ],
      'Abrir a IDE': ['Open the IDE', 'Abrir el IDE', '打开 IDE'],
      'Categorias da documentação': [
        'Documentation categories',
        'Categorías de la documentación',
        '文档分类',
      ],
      'filtrar categorias': ['filter categories', 'filtrar categorías', '筛选分类'],
      'nenhuma categoria com esse termo': [
        'no category matches this term',
        'ninguna categoría con ese término',
        '没有匹配该词的分类',
      ],
      'Nesta página': ['On this page', 'En esta página', '本页内容'],
      'categoria anterior': ['previous category', 'categoría anterior', '上一分类'],
      'próxima categoria': ['next category', 'categoría siguiente', '下一分类'],
    };

    root.SynapsePhraseRegistration.register(DOCS_PHRASES);
})(typeof globalThis !== 'undefined' ? globalThis : window);
