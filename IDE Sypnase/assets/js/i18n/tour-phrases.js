(function (root) {
    'use strict';

    const TOUR_PHRASES = {
      Synapse: ['Synapse', 'Synapse', 'Synapse'],
      'Bem-vindo ao Synapse': ['Welcome to Synapse', 'Bienvenido a Synapse', '欢迎使用 Synapse'],
      'Um passeio curto pelo site: editor, preview ao vivo, terminal no seu computador e os agentes de IA trabalhando dentro do projeto.':
      [
        'A short tour of the site: editor, live preview, a terminal on your computer and AI agents working inside the project.',
        'Un recorrido corto por el sitio: editor, preview en vivo, terminal en tu computadora y los agentes de IA trabajando dentro del proyecto.',
        '快速浏览本站：编辑器、实时预览、你电脑上的终端，以及在项目中工作的 AI 代理。',
      ],
      Entrada: ['Import', 'Entrada', '导入'],
      'Importe um .zip, uma pasta do computador, um index.html solto ou carregue o exemplo pronto. Arrastar arquivos para qualquer canto da tela também funciona.':
      [
        'Import a .zip, a folder from your computer, a standalone index.html, or load the ready-made example. Dragging files anywhere on the screen works too.',
        'Importa un .zip, una carpeta de tu computadora, un index.html suelto o carga el ejemplo listo. Arrastrar archivos a cualquier parte de la pantalla también funciona.',
        '导入 .zip、电脑上的文件夹、单个 index.html，或加载现成示例。把文件拖到屏幕任意位置也可以。',
      ],
      'Cada projeto aberto vira uma aba. Troque de contexto sem perder nada: tudo fica salvo no navegador e o X ainda deixa um backup em Recentes.':
      [
        'Every open project becomes a tab. Switch context without losing anything: everything is saved in the browser, and closing still leaves a backup in Recent.',
        'Cada proyecto abierto se convierte en una pestaña. Cambia de contexto sin perder nada: todo queda guardado en el navegador y la X aún deja una copia en Recientes.',
        '每个打开的项目都是一个标签页。切换上下文不会丢失任何内容：一切都保存在浏览器中，关闭时还会在“最近”留下备份。',
      ],
      Explorador: ['Explorer', 'Explorador', '资源管理器'],
      'A árvore do projeto. Um clique abre no editor, o botão direito renomeia, duplica ou apaga, e o + importa mais arquivos.':
      [
        'The project tree. One click opens a file in the editor, right-click renames, duplicates or deletes, and + imports more files.',
        'El árbol del proyecto. Un clic abre en el editor, el clic derecho renombra, duplica o borra, y el + importa más archivos.',
        '项目树。单击在编辑器中打开，右键可重命名、复制或删除，+ 可导入更多文件。',
      ],
      'Menu do projeto': ['Project menu', 'Menú del proyecto', '项目菜单'],
      'Renomeie o projeto, crie um novo, edite os arquivos globais e a memória que os agentes leem antes de trabalhar.':
      [
        'Rename the project, create a new one, edit the global files and the memory agents read before they start working.',
        'Renombra el proyecto, crea uno nuevo, edita los archivos globales y la memoria que los agentes leen antes de trabajar.',
        '重命名项目、新建项目、编辑全局文件以及代理开始工作前读取的记忆。',
      ],
      'Código': ['Code', 'Código', '代码'],
      Editor: ['Editor', 'Editor', '编辑器'],
      'Destaque de sintaxe, números de linha, minimapa, dobra de código, busca em todos os arquivos e formatador. Cada gravação cria um ponto no histórico.':
      [
        'Syntax highlighting, line numbers, minimap, code folding, search across all files and a formatter. Every save creates a point in the history.',
        'Resaltado de sintaxis, números de línea, minimapa, plegado de código, búsqueda en todos los archivos y formateador. Cada guardado crea un punto en el historial.',
        '语法高亮、行号、缩略图、代码折叠、全文件搜索和格式化。每次保存都会在历史中留下一个节点。',
      ],
      'Versões': ['Versions', 'Versiones', '版本'],
      'Histórico do arquivo': ['File history', 'Historial del archivo', '文件历史'],
      'Toda gravação guarda a versão anterior. Compare com o que estava antes e restaure o arquivo quando precisar.':
      [
        'Every save keeps the previous version. Compare it with what was there before and restore the file whenever you need.',
        'Cada guardado conserva la versión anterior. Compárala con lo que había antes y restaura el archivo cuando lo necesites.',
        '每次保存都会保留上一个版本。可与之前的内容对比，并在需要时还原文件。',
      ],
      Resultado: ['Result', 'Resultado', '结果'],
      'O preview se reconstrói a cada tecla: HTML, CSS, JS, módulos e imagens resolvidos na hora, sem servidor e sem recarregar na mão.':
      [
        'The preview rebuilds on every keystroke: HTML, CSS, JS, modules and images resolved instantly, with no server and no manual reload.',
        'El preview se reconstruye con cada tecla: HTML, CSS, JS, módulos e imágenes resueltos al instante, sin servidor y sin recargar a mano.',
        '预览随每次按键重新构建：HTML、CSS、JS、模块和图片即时解析，无需服务器，也无需手动刷新。',
      ],
      Telas: ['Screens', 'Pantallas', '屏幕'],
      'Celular, tablet, desktop': ['Phone, tablet, desktop', 'Móvil, tablet, escritorio', '手机、平板、桌面'],
      'Troque o tamanho do preview, defina uma medida livre ou gire a tela para conferir cada breakpoint.':
      [
        'Change the preview size, set a custom measurement or rotate the screen to check every breakpoint.',
        'Cambia el tamaño del preview, define una medida libre o gira la pantalla para revisar cada breakpoint.',
        '更改预览尺寸、设置自定义尺寸或旋转屏幕，逐一检查每个断点。',
      ],
      Layout: ['Layout', 'Diseño', '布局'],
      'Código e preview lado a lado, um sobre o outro ou só um dos dois em tela cheia. As divisórias entre os painéis são arrastáveis.':
      [
        'Code and preview side by side, stacked, or just one of them in full screen. The dividers between panels are draggable.',
        'Código y preview lado a lado, uno sobre el otro o solo uno de ellos en pantalla completa. Las divisiones entre paneles se pueden arrastrar.',
        '代码与预览可并排、上下排列，或只全屏显示其中一个。面板之间的分隔条可拖动。',
      ],
      Janela: ['Window', 'Ventana', '窗口'],
      'Abre o preview numa aba separada e sincronizada com o editor. Bom para outro monitor ou para o celular.':
      [
        'Opens the preview in a separate tab synced with the editor. Great for a second monitor or for your phone.',
        'Abre el preview en una pestaña aparte y sincronizada con el editor. Ideal para otro monitor o para el móvil.',
        '在与编辑器同步的独立标签页中打开预览。适合第二台显示器或手机。',
      ],
      'Depuração': ['Debugging', 'Depuración', '调试'],
      'Console e rede': ['Console and network', 'Consola y red', '控制台与网络'],
      'Terminal e dev server': ['Terminal and dev server', 'Terminal y dev server', '终端与开发服务器'],
      'Um terminal real no seu computador pelo relay: npm install, build, git. Projetos com build próprio sobem no dev server de verdade e o preview passa a mostrar ele, com hot reload.':
      [
        'A real terminal on your computer through the relay: npm install, build, git. Projects with their own build start a real dev server and the preview switches to it, with hot reload.',
        'Una terminal real en tu computadora a través del relay: npm install, build, git. Los proyectos con su propio build levantan un dev server real y el preview pasa a mostrarlo, con hot reload.',
        '通过 relay 在你的电脑上使用真实终端：npm install、build、git。带有自有构建的项目会启动真正的开发服务器，预览随之切换，并支持热更新。',
      ],
      'Abra e digite: abrir arquivo, trocar tema, exportar, ativar MCP. Todo comando do site está a uma busca de distância.':
      [
        'Open it and type: open a file, switch theme, export, enable MCP. Every command in the site is one search away.',
        'Ábrela y escribe: abrir archivo, cambiar tema, exportar, activar MCP. Todos los comandos del sitio están a una búsqueda de distancia.',
        '打开后直接输入：打开文件、切换主题、导出、启用 MCP。站点的每个命令都只需一次搜索。',
      ],
      'IA dentro do editor': ['AI inside the editor', 'IA dentro del editor', '编辑器内的 AI'],
      'Conecte a sua própria IA e converse sobre o projeto sem sair da aba: explicar um arquivo, gerar um trecho, entender um erro.':
      [
        'Connect your own AI and talk about the project without leaving the tab: explain a file, generate a snippet, understand an error.',
        'Conecta tu propia IA y conversa sobre el proyecto sin salir de la pestaña: explicar un archivo, generar un fragmento, entender un error.',
        '连接你自己的 AI，在同一标签页内讨论项目：解释文件、生成代码片段、理解报错。',
      ],
      'Integração': ['Integration', 'Integración', '集成'],
      'MCP: o agente entra no projeto': [
        'MCP: the agent joins the project',
        'MCP: el agente entra en el proyecto',
        'MCP：让代理进入项目',
      ],
      'Ative o MCP, copie a URL gerada e cole no conector do Notion. O agente lê e edita arquivos, roda comandos, tira screenshot do preview e testa a interface — em vários projetos ao mesmo tempo, com o site sempre no controle.':
      [
        'Enable MCP, copy the generated URL and paste it into the Notion connector. The agent reads and edits files, runs commands, takes preview screenshots and tests the interface — across several projects at once, with the site always in control.',
        'Activa el MCP, copia la URL generada y pégala en el conector de Notion. El agente lee y edita archivos, ejecuta comandos, toma capturas del preview y prueba la interfaz — en varios proyectos a la vez, con el sitio siempre en control.',
        '启用 MCP，复制生成的 URL 并粘贴到 Notion 连接器中。代理可以读写文件、执行命令、截取预览截图并测试界面——可同时处理多个项目，且始终由站点掌控。',
      ],
      Equipe: ['Team', 'Equipo', '团队'],
      'Vários agentes juntos': ['Several agents together', 'Varios agentes juntos', '多个代理协作'],
      'Cada agente tem nome, caixa de mensagens e reserva automática de projeto: eles se avisam, dividem tarefas e não pisam no trabalho do outro.':
      [
        'Each agent has a name, a message inbox and automatic project reservation: they notify each other, split tasks and never step on each other work.',
        'Cada agente tiene nombre, bandeja de mensajes y reserva automática de proyecto: se avisan entre sí, reparten tareas y no pisan el trabajo del otro.',
        '每个代理都有名字、消息收件箱和自动项目占用：它们互相通知、分配任务，不会覆盖彼此的工作。',
      ],
      '3D': ['3D', '3D', '3D'],
      'Abre o modelador em outra aba, com o documento salvo dentro do projeto: primitivas, malha editável, material, UV e exportação em .glb. Atalhos no estilo Blender e camada de toque no celular.':
      [
        'Opens the modeler in another tab, with the document saved inside the project: primitives, editable mesh, material, UV and .glb export. Blender-style shortcuts and a touch layer on mobile.',
        'Abre el modelador en otra pestaña, con el documento guardado dentro del proyecto: primitivas, malla editable, material, UV y exportación en .glb. Atajos al estilo Blender y capa táctil en el móvil.',
        '在另一个标签页打开建模器，文档保存在项目内：基础体、可编辑网格、材质、UV 以及 .glb 导出。提供 Blender 风格快捷键和移动端触控层。',
      ],
      Dispositivos: ['Devices', 'Dispositivos', '设备'],
      Recuperar: ['Recover', 'Recuperar', '恢复'],
      Ajustes: ['Settings', 'Ajustes', '设置'],
      'Configurações da IDE': ['IDE settings', 'Configuración del IDE', 'IDE 设置'],
      'As preferências do editor, do preview e das integrações ficam reunidas neste painel.': [
        'The editor, preview and integration preferences are all gathered in this panel.',
        'Las preferencias del editor, del preview y de las integraciones están reunidas en este panel.',
        '编辑器、预览和集成的偏好设置都集中在此面板中。',
      ],
      'Aparência': ['Appearance', 'Apariencia', '外观'],
      'Temas prontos e um seletor de cor livre — o site inteiro se repinta na hora.': [
        'Ready-made themes and a free color picker — the whole site repaints instantly.',
        'Temas listos y un selector de color libre — todo el sitio se repinta al instante.',
        '现成主题加自由取色器——整个站点即时换色。',
      ],
      'Saída': ['Output', 'Salida', '输出'],
      Estado: ['Status', 'Estado', '状态'],
      'Conexão, projeto ativo, contexto e contagem de arquivos ficam aqui embaixo. Se algo travar, é o primeiro lugar para olhar.':
      [
        'Connection, active project, context and file count live down here. If something freezes, this is the first place to look.',
        'Conexión, proyecto activo, contexto y conteo de archivos están aquí abajo. Si algo se traba, es el primer lugar para mirar.',
        '连接、当前项目、上下文和文件数量都显示在下方。如果出现卡顿，这里是第一个要看的地方。',
      ],
    };

    root.SynapsePhraseRegistration.register(TOUR_PHRASES);
})(typeof globalThis !== 'undefined' ? globalThis : window);
