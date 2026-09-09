(function (root) {
    'use strict';

    const COMMAND_PALETTE_PHRASES = {
      'Importar .zip': ['Import .zip', 'Importar .zip', '导入 .zip'],
      'Importar assets (.zip)': ['Import assets (.zip)', 'Importar recursos (.zip)', '导入资源 (.zip)'],
      'Importar pasta': ['Import folder', 'Importar carpeta', '导入文件夹'],
      'Importar index.html avulso': [
        'Import standalone index.html',
        'Importar index.html suelto',
        '导入单个 index.html',
      ],
      'Carregar exemplo': ['Load sample', 'Cargar ejemplo', '加载示例'],
      'Exportar projeto (.zip)': ['Export project (.zip)', 'Exportar proyecto (.zip)', '导出项目 (.zip)'],
      'Novo arquivo': ['New file', 'Nuevo archivo', '新建文件'],
      'Nova pasta': ['New folder', 'Nueva carpeta', '新建文件夹'],
      'Alternar tema': ['Toggle theme', 'Alternar tema', '切换主题'],
      'Buscar arquivo / conteúdo': ['Find file / content', 'Buscar archivo / contenido', '查找文件 / 内容'],
      'Buscar e substituir (todos os arquivos)': [
        'Find and replace (all files)',
        'Buscar y reemplazar (todos los archivos)',
        '查找和替换（所有文件）',
      ],
      'Formatar código (arquivo atual)': [
        'Format code (current file)',
        'Formatear código (archivo actual)',
        '格式化代码（当前文件）',
      ],
      'Histórico de versões do arquivo': [
        'File version history',
        'Historial de versiones del archivo',
        '文件版本历史',
      ],
      'Proteção por senha (bloquear / proteger projetos)': [
        'Password protection (lock / protect projects)',
        'Protección por contraseña (bloquear / proteger proyectos)',
        '密码保护（锁定 / 保护项目）',
      ],
      'MCP para Notion (conectar agente de IA)': [
        'MCP for Notion (connect an AI agent)',
        'MCP para Notion (conectar un agente de IA)',
        '用于 Notion 的 MCP（连接 AI 代理）',
      ],
      'Abrir console': ['Open console', 'Abrir consola', '打开控制台'],
      'Fechar console': ['Close console', 'Cerrar consola', '关闭控制台'],
      'Abrir preview em nova aba': [
        'Open preview in a new tab',
        'Abrir la vista previa en una pestaña nueva',
        '在新标签页中打开预览',
      ],
      'Layout: Editor + Preview': [
        'Layout: Editor + Preview',
        'Diseño: Editor + Vista previa',
        '布局：编辑器 + 预览',
      ],
      'Layout: Só editor': ['Layout: Editor only', 'Diseño: Solo editor', '布局：仅编辑器'],
      'Layout: Só preview': ['Layout: Preview only', 'Diseño: Solo vista previa', '布局：仅预览'],
      'Dispositivo: Responsivo': ['Device: Responsive', 'Dispositivo: Adaptable', '设备：自适应'],
      'Dispositivo: Desktop': ['Device: Desktop', 'Dispositivo: Escritorio', '设备：桌面'],
      'Dispositivo: Tablet': ['Device: Tablet', 'Dispositivo: Tableta', '设备：平板'],
      'Dispositivo: Mobile': ['Device: Mobile', 'Dispositivo: Móvil', '设备：手机'],
      'Mostrar/ocultar Explorer': [
        'Show/hide Explorer',
        'Mostrar/ocultar el Explorador',
        '显示/隐藏资源管理器',
      ],
      'Limpar console': ['Clear console', 'Limpiar la consola', '清空控制台'],
      'Fechar projeto atual': ['Close current project', 'Cerrar el proyecto actual', '关闭当前项目'],
      'Projetos recentes e backups (recuperar projetos fechados)': [
        'Recent projects and backups (recover closed projects)',
        'Proyectos recientes y copias de seguridad (recuperar proyectos cerrados)',
        '最近的项目和备份（恢复已关闭的项目）',
      ],
      'Limpar sessão salva (remove todos os projetos)': [
        'Clear saved session (removes every project)',
        'Limpiar la sesión guardada (elimina todos los proyectos)',
        '清除已保存的会话（移除所有项目）',
      ],
      projeto: ['project', 'proyecto', '项目'],
      aparência: ['appearance', 'apariencia', '外观'],
      segurança: ['security', 'seguridad', '安全'],
      integração: ['integration', 'integración', '集成'],
      layout: ['layout', 'diseño', '布局'],
      sessão: ['session', 'sesión', '会话'],
      download: ['download', 'descarga', '下载'],
      'recuperar recentes backup restaurar': [
        'recover recent backup restore',
        'recuperar recientes copia restaurar',
        '恢复 最近 备份 还原',
      ],
    };

    root.SynapsePhraseRegistration.register(COMMAND_PALETTE_PHRASES);
})(typeof globalThis !== 'undefined' ? globalThis : window);
