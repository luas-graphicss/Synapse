(function (root) {
    'use strict';

    const AI_CHAT_PHRASES = {
      Assistente: ['Assistant', 'Asistente', '助手'],
      'Conecte seu modelo': ['Connect your model', 'Conecta tu modelo', '连接你的模型'],
      'Interromper tarefa': ['Stop task', 'Detener la tarea', '停止任务'],
      'Restaurar chat': ['Restore chat', 'Restaurar el chat', '恢复聊天'],
      'Nova conversa': ['New conversation', 'Nueva conversación', '新对话'],
      'Mais opções': ['More options', 'Más opciones', '更多选项'],
      'Conexões e permissões': ['Connections and permissions', 'Conexiones y permisos', '连接与权限'],
      'Histórico de conversas': [
        'Conversation history',
        'Historial de conversaciones',
        '对话历史',
      ],
      'Encaixar / flutuar': ['Dock / float', 'Anclar / flotar', '停靠 / 浮动'],
      Minimizar: ['Minimize', 'Minimizar', '最小化'],
      'Fechar chat': ['Close chat', 'Cerrar el chat', '关闭聊天'],
      'Áreas do assistente': ['Assistant areas', 'Áreas del asistente', '助手区域'],
      Conversa: ['Conversation', 'Conversación', '对话'],
      'Uso e créditos': ['Usage and credits', 'Uso y créditos', '用量与额度'],
      'Mensagem para o assistente': [
        'Message for the assistant',
        'Mensaje para el asistente',
        '发送给助手的消息',
      ],
      'O que vamos construir?': ['What are we building?', '¿Qué vamos a construir?', '我们要构建什么？'],
      'Trocar conexão e modelo': [
        'Switch connection and model',
        'Cambiar de conexión y modelo',
        '切换连接和模型',
      ],
      'Conectar modelo': ['Connect model', 'Conectar modelo', '连接模型'],
      'Configurar raciocínio': [
        'Configure reasoning',
        'Configurar el razonamiento',
        '配置推理',
      ],
      'Enviar mensagem': ['Send message', 'Enviar mensaje', '发送消息'],
      'Enviar (Enter)': ['Send (Enter)', 'Enviar (Enter)', '发送（Enter）'],
      'Enter envia · Shift+Enter cria nova linha': [
        'Enter sends · Shift+Enter adds a new line',
        'Enter envía · Shift+Enter crea una nueva línea',
        'Enter 发送 · Shift+Enter 换行',
      ],
      'Política de aprovação': ['Approval policy', 'Política de aprobación', '审批策略'],
      Aprovação: ['Approval', 'Aprobación', '审批'],
      'Nenhum projeto': ['No project', 'Ningún proyecto', '没有项目'],
      'Nenhum arquivo aberto': ['No file open', 'Ningún archivo abierto', '没有打开的文件'],
      'Terminal disponível': ['Terminal available', 'Terminal disponible', '终端可用'],
      'Sem terminal conectado': ['No terminal connected', 'Sin terminal conectada', '未连接终端'],
      'escolher modelo': ['choose model', 'elegir modelo', '选择模型'],
      'conectar IA': ['connect AI', 'conectar IA', '连接 AI'],
      'sem IA conectada': ['no AI connected', 'sin IA conectada', '未连接 AI'],
      Interromper: ['Stop', 'Detener', '停止'],
      'Raciocínio obrigatório neste modelo. Abrir configuração de esforço.': [
        'Reasoning is required by this model. Open the effort setting.',
        'Este modelo exige razonamiento. Abrir la configuración de esfuerzo.',
        '此模型必须使用推理。打开强度设置。',
      ],
      'Ativar ou desativar o raciocínio': [
        'Turn reasoning on or off',
        'Activar o desactivar el razonamiento',
        '开启或关闭推理',
      ],
      'Thinking obrigatório': ['Thinking required', 'Thinking obligatorio', '必须使用 Thinking'],
      'Thinking ativo': ['Thinking on', 'Thinking activo', 'Thinking 已开启'],
      'Tokens: aguardando a API': [
        'Tokens: waiting for the API',
        'Tokens: esperando la API',
        '令牌：等待 API',
      ],
      'Tokens não informados pela API': [
        'Tokens not reported by the API',
        'Tokens no informados por la API',
        'API 未返回令牌数',
      ],
      'Contagem atualizada quando o provedor envia uso. Alguns modelos informam tokens somente no fim.': [
        'The count updates when the provider reports usage. Some models only report tokens at the end.',
        'El recuento se actualiza cuando el proveedor informa el uso. Algunos modelos solo informan tokens al final.',
        '当服务商上报用量时更新计数。有些模型只在结束时报告令牌数。',
      ],
      'Falando com o agente do Notion': [
        'Talking to the Notion agent',
        'Hablando con el agente de Notion',
        '正在与 Notion 代理对话',
      ],
      'Pronto para trabalhar': ['Ready to work', 'Listo para trabajar', '准备开始'],
      'Conecte sua IA': ['Connect your AI', 'Conecta tu IA', '连接你的 AI'],
      'Este chat conversa com um agente do seu Notion pelo token, sem MCP. Ele responde por texto e usa as ferramentas dele dentro do Notion; para editar os arquivos do projeto, use uma conexao com chave propria.':
      [
        'This chat talks to an agent in your Notion through the token, without MCP. It answers with text and uses its own tools inside Notion; to edit the project files, use a connection with your own key.',
        'Este chat habla con un agente de tu Notion mediante el token, sin MCP. Responde con texto y usa sus propias herramientas dentro de Notion; para editar los archivos del proyecto, usa una conexión con tu propia clave.',
        '此聊天通过令牌与你 Notion 中的代理对话，不使用 MCP。它以文本回复并在 Notion 内使用自己的工具；若要编辑项目文件，请使用带有你自己密钥的连接。',
      ],
      'Peça uma mudança, investigue um problema ou explore seu projeto. Você controla o modelo e as permissões.':
      [
        'Ask for a change, investigate a problem or explore your project. You control the model and the permissions.',
        'Pide un cambio, investiga un problema o explora tu proyecto. Tú controlas el modelo y los permisos.',
        '请求修改、排查问题或浏览你的项目。模型和权限都由你控制。',
      ],
      'Use seu provedor favorito ou um modelo local. Adicione uma conexão para começar.': [
        'Use your favorite provider or a local model. Add a connection to get started.',
        'Usa tu proveedor favorito o un modelo local. Agrega una conexión para empezar.',
        '使用你喜欢的服务商或本地模型。添加一个连接即可开始。',
      ],
      'Adicionar conexao de IA': ['Add AI connection', 'Agregar conexión de IA', '添加 AI 连接'],
      'Resumir o que tem no meu Notion sobre este projeto': [
        'Summarize what my Notion has about this project',
        'Resumir lo que hay en mi Notion sobre este proyecto',
        '总结我的 Notion 中关于这个项目的内容',
      ],
      'Criar uma pagina no Notion com o plano desta semana': [
        'Create a Notion page with this week plan',
        'Crear una página en Notion con el plan de esta semana',
        '在 Notion 中创建一个页面，写上本周计划',
      ],
      'Listar minhas tarefas pendentes e as prioridades': [
        'List my pending tasks and priorities',
        'Listar mis tareas pendientes y las prioridades',
        '列出我的待办任务和优先级',
      ],
      'Mapear o projeto e listar o que da para melhorar': [
        'Map the project and list what can be improved',
        'Mapear el proyecto y listar lo que se puede mejorar',
        '梳理项目并列出可以改进的地方',
      ],
      'Criar uma landing page responsiva com tema escuro': [
        'Create a responsive landing page with a dark theme',
        'Crear una landing page adaptable con tema oscuro',
        '创建一个深色主题的自适应落地页',
      ],
      'Rodar um teste de interacao e me mostrar o screenshot': [
        'Run an interaction test and show me the screenshot',
        'Ejecutar una prueba de interacción y mostrarme la captura',
        '运行一次交互测试并给我看截图',
      ],
      Enviar: ['Send', 'Enviar', '发送'],
      'Nova linha': ['New line', 'Nueva línea', '换行'],
      'Abrir/fechar': ['Open/close', 'Abrir/cerrar', '打开/关闭'],
      'Permissao necessaria': ['Permission needed', 'Permiso necesario', '需要授权'],
      'Vai executar um comando real na sua maquina.': [
        'This will run a real command on your machine.',
        'Va a ejecutar un comando real en tu máquina.',
        '这会在你的电脑上执行真实命令。',
      ],
      'Acao destrutiva: pode apagar ou sobrescrever conteudo.': [
        'Destructive action: it can delete or overwrite content.',
        'Acción destructiva: puede borrar o sobrescribir contenido.',
        '破坏性操作：可能删除或覆盖内容。',
      ],
      'Acao de escrita no projeto.': [
        'Write action on the project.',
        'Acción de escritura en el proyecto.',
        '对项目的写入操作。',
      ],
      'sem argumentos': ['no arguments', 'sin argumentos', '无参数'],
      Permitir: ['Allow', 'Permitir', '允许'],
      'Sempre nesta sessao': ['Always in this session', 'Siempre en esta sesión', '本次会话始终允许'],
      Recusar: ['Decline', 'Rechazar', '拒绝'],
      entrada: ['input', 'entrada', '输入'],
      saida: ['output', 'salida', '输出'],
    };

    root.SynapsePhraseRegistration.register(AI_CHAT_PHRASES);
})(typeof globalThis !== 'undefined' ? globalThis : window);
