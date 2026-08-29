(function () {
	'use strict';

	const D = {
		'Tutorial guiado': ['Guided tutorial', 'Tutorial guiado', '引导教程'],
		Começar: ['Start', 'Empezar', '开始'],
		'Agora não': ['Not now', 'Ahora no', '现在不要'],
		Concluir: ['Finish', 'Finalizar', '完成'],
		'Tudo pronto': ['All set', 'Todo listo', '一切就绪'],
		'Em pouco mais de um minuto você percorre o site inteiro: editor, preview ao vivo, terminal no seu computador e os agentes de IA trabalhando dentro do seu projeto.':
			[
				'In little over a minute you will go through the whole site: editor, live preview, a terminal on your own computer and the AI agents working inside your project.',
				'En poco más de un minuto recorrerás todo el sitio: editor, vista previa en vivo, terminal en tu propio ordenador y los agentes de IA trabajando dentro de tu proyecto.',
				'不到一分钟，你就能通览整个站点：编辑器、实时预览、你自己电脑上的终端，以及在项目内工作的 AI 智能体。',
			],
		'etapas · clique em qualquer lugar para avançar · Esc encerra': [
			'steps · click anywhere to advance · Esc ends it',
			'pasos · haz clic en cualquier lugar para avanzar · Esc lo cierra',
			'步 · 点击任意处继续 · 按 Esc 退出',
		],
		'Você já conhece o Synapse inteiro. Para repetir, use o botão ? na barra de cima.': [
			'You now know the whole of Synapse. To run it again, use the ? button in the top bar.',
			'Ya conoces todo Synapse. Para repetirlo, usa el botón ? de la barra superior.',
			'你已经了解了整个 Synapse。如需重看，请使用顶部工具栏的 ? 按钮。',
		],
		' - codigo ': [' - code ', ' - código ', ' - 代码 '],
		' e seus ': [' and its ', ' y sus ', ' 及其 '],
		' erros em ': [' errors in ', ' errores en ', ' 个错误，历时 '],
		'" -> raiz': ['" -> root', '" -> raíz', '" -> 根目录'],
		'$ Inicializando WebContainers…': [
			'$ Initializing WebContainers…',
			'$ Inicializando WebContainers…',
			'$ 正在初始化 WebContainers…',
		],
		'(LEIA-ME → seção PORTÃO). Custo: R$ 0 no free tier.': [
			'(README → GATEWAY section). Cost: $0 on the free tier.',
			'(LÉEME → sección PUERTA). Coste: 0 en el plan gratuito.',
			'（请阅读文件 → 网关章节）。费用：免费套餐下为 0。',
		],
		'(Node 18+) · 2) clique em': [
			'(Node 18+) · 2) click',
			'(Node 18+) · 2) haz clic en',
			'（Node 18+）· 2）点击',
		],
		'(Node 18+).': ['(Node 18+).', '(Node 18+).', '（Node 18+）。'],
		'(a leitura da pasta veio incompleta)': [
			'(the folder read came back incomplete)',
			'(la lectura de la carpeta quedó incompleta)',
			'（文件夹读取不完整）',
		],
		'(comando identico ja em execucao - reaproveitando o processo': [
			'(an identical command is already running — reusing the process',
			'(comando idéntico ya en ejecución: se reutiliza el proceso',
			'（相同命令已在运行——复用该进程',
		],
		'(compilado no navegador).': [
			'(compiled in the browser).',
			'(compilado en el navegador).',
			'（在浏览器中编译）。',
		],
		'(diretório)': ['(directory)', '(directorio)', '（目录）'],
		'(erro 1027), caso em que o encaminhador interno dos nós nem chega a rodar. Deploy:': [
			"(error 1027), in which case the nodes' internal forwarder never even runs. Deploy:",
			'(error 1027), en cuyo caso el reenviador interno de los nodos ni siquiera se ejecuta. Despliegue:',
			'（错误 1027），此时节点的内部转发器根本不会运行。部署：',
		],
		'(grafo da entrada)': ['(entry graph)', '(grafo de la entrada)', '（入口依赖图）'],
		'(nó morto antes do código rodar), preencha o portão abaixo.': [
			'(node dead before the code runs), fill in the gateway below.',
			'(nodo muerto antes de que el código se ejecute), completa la puerta de enlace abajo.',
			'（代码运行前节点已失效），请在下方填写网关。',
		],
		'(projeto inteiro)': ['(whole project)', '(todo el proyecto)', '（整个项目）'],
		'(resolvido:': ['(resolved:', '(resuelto:', '（已解析：'],
		'(scan parcial)': ['(partial scan)', '(escaneo parcial)', '（部分扫描）'],
		'(sem terminal).': ['(no terminal).', '(sin terminal).', '（无终端）。'],
		'(todas as edições incluídas).': [
			'(all edits included).',
			'(todas las ediciones incluidas).',
			'（已包含全部修改）。',
		],
		') - catalogo e executor passam a existir em todos os nos que o portao pode escolher.': [
			') — catalog and executor now exist on every node the gateway can pick.',
			') — el catálogo y el ejecutor ahora existen en todos los nodos que la puerta puede elegir.',
			'）——网关可选的每个节点上都已具备目录与执行器。',
		],
		') NAO esta na lista NODOS do portao (': [
			") is NOT in the gateway's NODES list (",
			') NO está en la lista NODOS de la puerta (',
			'）不在网关的 NODOS 列表中（',
		],
		') estava no lugar do TRANSPORTE do MCP - era por isso que o Notion via 0 ferramentas. Transporte movido para a nuvem (':
			[
				') was sitting in the MCP TRANSPORT slot — that is why Notion saw 0 tools. Transport moved to the cloud (',
				') estaba en el lugar del TRANSPORTE del MCP: por eso Notion veía 0 herramientas. Transporte movido a la nube (',
				'）占用了 MCP 传输层的位置——这就是 Notion 只看到 0 个工具的原因。传输已转到云端（',
			],
		') falhou:': [') failed:', ') falló:', '）失败：'],
		') pela MESMA URL do conector.': [
			') through the SAME connector URL.',
			') por la MISMA URL del conector.',
			'）——使用连接器的同一个网址。',
		],
		') pela MESMA URL.': [') through the SAME URL.', ') por la MISMA URL.', '）——使用同一个网址。'],
		') publicado numa': [') published on a', ') publicado en una', '）发布于'],
		') — a URL unica pode estar fora; confira o deploy do portao.': [
			') — the single URL may be down; check the gateway deployment.',
			') — la URL única puede estar caída; revisa el despliegue de la puerta.',
			'）——唯一网址可能已下线；请检查网关的部署。',
		],
		') — preview via relay:': [
			') — preview through the relay:',
			') — vista previa vía relay:',
			'）——通过 relay 预览：',
		],
		'). O Notion entra pelo portao, cai num no sem catalogo e mostra 0 ferramentas. Corrija NODOS no wrangler-portao.toml ou abra o site com ?relay=':
			[
				'). Notion comes in through the gateway, lands on a node with no catalog and shows 0 tools. Fix NODOS in wrangler-portao.toml or open the site with ?relay=',
				'). Notion entra por la puerta, cae en un nodo sin catálogo y muestra 0 herramientas. Corrige NODOS en wrangler-portao.toml o abre el sitio con ?relay=',
				'）。Notion 经网关进入后落到一个没有目录的节点，因此只显示 0 个工具。请修正 wrangler-portao.toml 中的 NODOS，或使用 ?relay= ' +
					'打开站点',
			],
		'). Rodar dois no mesmo projeto pode corromper arquivos.': [
			'). Running two on the same project can corrupt files.',
			'). Ejecutar dos en el mismo proyecto puede corromper archivos.',
			'）。在同一项目上同时运行两个可能损坏文件。',
		],
		'): esses arquivos são de build/servidor e não rodam no navegador.': [
			'): those files are build/server files and do not run in the browser.',
			'): esos archivos son de compilación/servidor y no se ejecutan en el navegador.',
			'）：这些文件属于构建/服务端，不在浏览器中运行。',
		],
		'+ Criar nova equipe': ['+ Create new team', '+ Crear nuevo equipo', '+ 新建团队'],
		', com': [', with', ', con', '，包含'],
		', copie a URL e cole no conector MCP do Notion.': [
			", copy the URL and paste it into Notion's MCP connector.",
			', copia la URL y pégala en el conector MCP de Notion.',
			'，复制该网址并粘贴到 Notion 的 MCP 连接器。',
		],
		', deps via esm.sh:': [
			', deps via esm.sh:',
			', dependencias vía esm.sh:',
			'，依赖经由 esm.sh：',
		],
		', ele mesmo encaminha cada chamada ao próximo nó ao atingir o limite de capacidade — sem trocar nada no Notion. A lista também pode ser fixada no deploy via':
			[
				', it forwards each call to the next node by itself once it reaches the capacity limit — with no changes in Notion. The list can also be pinned at deploy time via',
				', reenvía cada llamada al siguiente nodo por sí mismo al alcanzar el límite de capacidad, sin cambiar nada en Notion. La lista también puede fijarse en el despliegue con',
				'，它会在达到容量上限时自行将每个调用转发给下一个节点——无需在 Notion 中改动任何设置。该列表也可在部署时固定，方式为',
			],
		', entao roteadores por caminho caem no 404 do proprio app. Liguei a ponte de history (sem SecurityError) e comecei em':
			[
				", so path routers fall into the app's own 404. I enabled the history bridge (no SecurityError) and started at",
				', por lo que los routers por ruta caen en el 404 de la propia app. Activé el puente de history (sin SecurityError) y empecé en',
				'，因此基于路径的路由会落入应用自己的 404。已启用 history 桥接（无 SecurityError）并从此开始：',
			],
		', sem duplicar)': [', without duplicating)', ', sin duplicar)', '，不重复）'],
		'- no app, caia para modo hash quando location.protocol nao for http(s).': [
			'- in the app, fall back to hash mode when location.protocol is not http(s).',
			'- en la app, usa el modo hash cuando location.protocol no sea http(s).',
			'- 在应用中，当 location.protocol 不是 http(s) 时回退到 hash 模式。',
		],
		'. Com ele preenchido, a URL do Notion passa a ser a do portão: cada chamada entra por lá e é desviada na hora para o primeiro nó vivo —':
			[
				". Once it is filled in, the Notion URL becomes the gateway's: every call comes in there and is diverted instantly to the first live node —",
				'. Con ella completada, la URL de Notion pasa a ser la de la puerta: cada llamada entra por ahí y se desvía al instante al primer nodo vivo —',
				'。填写后，Notion 使用的网址就变成网关的：所有调用从那里进入，并立即分流到第一个存活节点—',
			],
		'. Comandos do projeto:': ['. Project commands:', '. Comandos del proyecto:', '。项目命令：'],
		'. Importe um projeto para começar — as edições aparecem aqui em tempo real.': [
			'. Import a project to start — edits show up here in real time.',
			'. Importa un proyecto para empezar: las ediciones aparecen aquí en tiempo real.',
			'。导入项目即可开始——编辑会实时显示在这里。',
		],
		'. O terminal roda um comando por vez.': [
			'. The terminal runs one command at a time.',
			'. La terminal ejecuta un comando a la vez.',
			'。终端每次只运行一个命令。',
		],
		'.zip exportado': ['.zip exported', '.zip exportado', '.zip 已导出'],
		'.zip, pasta ou index.html': [
			'.zip, folder or index.html',
			'.zip, carpeta o index.html',
			'.zip、文件夹或 index.html',
		],
		'0/1 agente(s) - 0 caminho(s)': [
			'0/1 agent(s) - 0 path(s)',
			'0/1 agente(s) - 0 ruta(s)',
			'0/1 个智能体 - 0 个路径',
		],
		'1) execute': ['1) run', '1) ejecuta', '1）运行'],
		'6 eventos gerados - veja a aba MCP do console': [
			'6 events generated - check the MCP tab in the console',
			'6 eventos generados - mira la pestaña MCP de la consola',
			'已生成 6 个事件——请查看控制台的 MCP 页签',
		],
		'6 temas + cor própria': [
			'6 themes + your own color',
			'6 temas + color propio',
			'6 种主题 + 自定义颜色',
		],
		': esses arquivos são de build/servidor e não rodam no navegador.': [
			': those files are build/server files and do not run in the browser.',
			': esos archivos son de compilación/servidor y no se ejecutan en el navegador.',
			'：这些文件属于构建/服务端，不在浏览器中运行。',
		],
		': falha ao devolver resposta': [
			': failed to return the response',
			': no se pudo devolver la respuesta',
			'：返回响应失败',
		],
		'; o transporte do MCP continua na nuvem.': [
			'; the MCP transport stays in the cloud.',
			'; el transporte del MCP sigue en la nube.',
			'；MCP 的传输仍留在云端。',
		],
		'<b>Modo celular.</b> A conexao ja vem configurada: toque em': [
			'<b>Mobile mode.</b> The connection comes ready: tap',
			'<b>Modo móvil.</b> La conexión ya viene configurada: toca',
			'<b>手机模式。</b>连接已预先配置：点击',
		],
		'? Esta ação não pode ser desfeita.': [
			'? This action cannot be undone.',
			'? Esta accion no se puede deshacer.',
			'？此操作无法撤销。',
		],
		'A URL do MCP continua a mesma - o terminal entra assim que o complemento local responder': [
			'The MCP URL stays the same — the terminal joins as soon as the local add-on answers',
			'La URL del MCP no cambia: la terminal entra en cuanto responda el complemento local',
			'MCP 网址保持不变——本地插件一响应，终端就会接入',
		],
		'A URL para o Notion está apontando para localhost — preencha a URL pública do túnel no segundo campo.':
			[
				'The URL for Notion points to localhost — fill in the public tunnel URL in the second field.',
				'La URL para Notion apunta a localhost: escribe la URL pública del túnel en el segundo campo.',
				'给 Notion 的网址指向 localhost——请在第二个字段填入隧道的公网地址。',
			],
		'A aba do site nao respondeu em': [
			'The site tab did not answer within',
			'La pestaña del sitio no respondió en',
			'站点标签页未在规定时间内响应',
		],
		'A conexão já vem pronta: toque em': [
			'The connection comes ready: tap',
			'La conexión ya viene lista: toca',
			'连接已预先配置：点击',
		],
		'A árvore do projeto. Um clique abre o arquivo no editor, o botão direito renomeia, duplica ou apaga, e o + importa mais arquivos. Pastas se expandem e a busca acha qualquer coisa em segundos.':
			[
				'The project tree. One click opens the file in the editor, right-click renames, duplicates or deletes, and + imports more files. Folders expand and search finds anything in seconds.',
				'El árbol del proyecto. Un clic abre el archivo en el editor, el clic derecho renombra, ' +
					'duplica o borra, y el + importa más archivos. Las carpetas se expanden y la búsqueda ' +
					'encuentra cualquier cosa en segundos.',
				'项目文件树。单击在编辑器中打开文件，右键可重命名、复制或删除，+ 可导入更多文件。文件夹可展开，搜索几秒就能找到任何内容。',
			],
		'ATENCAO: o no desta aba (': [
			"WARNING: this tab's node (",
			'ATENCIÓN: el nodo de esta pestaña (',
			'注意：此标签页的节点（',
		],
		ATIVADO: ['ENABLED', 'ACTIVADO', '已启用'],
		'Aba em modo leitura': [
			'Tab in read-only mode',
			'Pestana en modo lectura',
			'标签页处于只读模式',
		],
		'Aba em segundo plano: o navegador atrasou os timers em': [
			'Tab in the background: the browser delayed timers by',
			'Pestaña en segundo plano: el navegador retrasó los temporizadores en',
			'标签页在后台：浏览器将定时器延迟了',
		],
		'Aba foi descongelada pelo navegador - reconectando a ponte': [
			'The browser unfroze this tab — reconnecting the bridge',
			'El navegador descongeló la pestaña: reconectando el puente',
			'浏览器已解冻此标签页——正在重连桥接',
		],
		'Abas de projeto': ['Project tabs', 'Pestañas de proyecto', '项目标签'],
		'Aberto em nova aba': ['Opened in a new tab', 'Abierto en otra pestaña', '已在新标签页打开'],
		'Abra o arquivo baixado (ou hospede em https/localhost) — a prévia do Notion bloqueia a criptografia':
			[
				"Open the downloaded file (or host it on https/localhost) — Notion's preview blocks encryption",
				'Abre el archivo descargado (o alojalo en https/localhost): la vista previa de Notion bloquea el cifrado',
				'请打开已下载的文件（或将其托管在 https/localhost）——Notion 的预览会阻止加密',
			],
		'Abra um arquivo de texto para ver versões': [
			'Open a text file to see versions',
			'Abre un archivo de texto para ver versiones',
			'打开文本文件即可查看版本',
		],
		'Abra um arquivo primeiro': [
			'Open a file first',
			'Abre un archivo primero',
			'请先打开一个文件',
		],
		'Abre o preview numa aba separada e sincronizada com o editor. Ótimo para testar em tela cheia, em outro monitor ou no celular.':
			[
				'Opens the preview in a separate tab that stays synced with the editor. Great for testing full screen, on another monitor or on your phone.',
				'Abre la vista previa en una pestaña aparte y sincronizada con el editor. Ideal para probar a pantalla completa, en otro monitor o en el móvil.',
				'在单独标签页中打开与编辑器同步的预览。适合全屏、双屏或手机上测试。',
			],
		'Abrir preview em nova aba (sincronizado)': [
			'Open preview in a new tab (synced)',
			'Abrir la vista previa en otra pestaña (sincronizada)',
			'在新标签页打开预览（已同步）',
		],
		'Abrir um arquivo .aurora': [
			'Open an .aurora file',
			'Abrir un archivo .aurora',
			'打开 .aurora 文件',
		],
		'Aguardando projeto': ['Waiting for a project', 'Esperando un proyecto', '等待项目'],
		'Aguardando terminar:': ['Waiting for it to finish:', 'Esperando que termine:', '等待其完成：'],
		'Ainda bloqueado': ['Still locked', 'Sigue bloqueado', '仍处于锁定状态'],
		'Alistamento automatico · ligado, 1 por equipe': [
			'Automatic enlistment · on, 1 per team',
			'Alistamiento automático · activado, 1 por equipo',
			'自动招募 · 已开启，每队 1 个',
		],
		Altura: ['Height', 'Alto', '高度'],
		'Aparência atualizada': ['Appearance updated', 'Apariencia actualizada', '外观已更新'],
		'Aperte Ctrl+K (ou ⌘K) e digite: abrir arquivo, trocar tema, exportar, ativar MCP… todo comando do site está a uma busca de distância.':
			[
				'Press Ctrl+K (or ⌘K) and type: open file, change theme, export, enable MCP… every command in the site is one search away.',
				'Pulsa Ctrl+K (o ⌘K) y escribe: abrir archivo, cambiar tema, exportar, activar MCP… todos los comandos del sitio están a una búsqueda de distancia.',
				'按 Ctrl+K（或 ⌘K）并输入：打开文件、切换主题、导出、启用 MCP……站内所有命令只隔一次搜索。',
			],
		'App Synapse Relay detectado (v': [
			'Synapse Relay app detected (v',
			'App Synapse Relay detectada (v',
			'已检测到 Synapse Relay 应用（v',
		],
		'App Synapse Relay detectado.': [
			'Synapse Relay app detected.',
			'App Synapse Relay detectada.',
			'已检测到 Synapse Relay 应用。',
		],
		'App Synapse Relay nao respondeu em 127.0.0.1:8787 - inicie o relay no app (ou use um relay hospedado).':
			[
				'The Synapse Relay app did not answer on 127.0.0.1:8787 — start the relay in the app (or use a hosted relay).',
				'La app Synapse Relay no respondió en 127.0.0.1:8787: inicia el relay en la app (o usa un relay alojado).',
				'Synapse Relay 应用在 127.0.0.1:8787 未响应——请在应用中启动 relay（或使用托管的 relay）。',
			],
		'Aqui embaixo ficam o estado da conexão, o projeto ativo, o contexto e a contagem de arquivos. Se algo travar, é o primeiro lugar para olhar.':
			[
				'Down here you find the connection state, the active project, the context and the file count. If something jams, this is the first place to look.',
				'Aquí abajo están el estado de la conexión, el proyecto activo, el contexto y el recuento de archivos. Si algo se traba, es el primer lugar donde mirar.',
				'下方显示连接状态、当前项目、上下文和文件数量。一旦出现卡顶，这里是第一个该看的地方。',
			],
		'Arquivo criado': ['File created', 'Archivo creado', '文件已创建'],
		'Arquivo global nao tem dono:': [
			'Global file has no owner:',
			'El archivo global no tiene dueño:',
			'全局文件没有归属：',
		],
		'Arquivo movido': ['File moved', 'Archivo movido', '文件已移动'],
		'Arquivo muito grande': ['File too large', 'Archivo demasiado grande', '文件过大'],
		'Arquivo único': ['Single file', 'Archivo único', '单个文件'],
		Arquivos: ['Files', 'Archivos', '文件'],
		'Arquivos globais': ['Global files', 'Archivos globales', '全局文件'],
		'Arraste para girar · role o mouse para aproximar · modelo exibido sem textura': [
			'Drag to rotate · scroll to zoom · model shown without texture',
			'Arrastra para girar · usa la rueda para acercar · modelo mostrado sin textura',
			'拖动旋转 · 滚轮缩放 · 模型以无贴图方式显示',
		],
		'As equipes': ['Teams', 'Los equipos', '团队'],
		'Assets importados': ['Assets imported', 'Recursos importados', '素材已导入'],
		'Atalho de tudo': ['Shortcut to everything', 'Atajo para todo', '一键直达'],
		'Ativar MCP': ['Enable MCP', 'Activar MCP', '启用 MCP'],
		'Ativar proteção': ['Enable protection', 'Activar proteccion', '开启保护'],
		'Ative a proteção com senha primeiro': [
			'Enable password protection first',
			'Activa primero la protección con contraseña',
			'请先启用密码保护',
		],
		'Ative o MCP, copie a URL gerada e cole no conector do Notion. A partir daí o agente lê e edita seus arquivos, roda comandos no terminal, tira screenshot do preview e trabalha junto com você — com o site sempre mandando no que acontece.':
			[
				"Turn on MCP, copy the generated URL and paste it into Notion's connector. From then on " +
					'the agent reads and edits your files, runs commands in the terminal, screenshots the ' +
					'preview and works alongside you — with the site always in charge of what happens.',
				'Activa el MCP, copia la URL generada y pégala en el conector de Notion. Desde ahí el ' +
					'agente lee y edita tus archivos, ejecuta comandos en la terminal, captura la vista ' +
					'previa y trabaja contigo, con el sitio siempre al mando.',
				'启用 MCP，复制生成的网址并粘贴到 Notion 的连接器。从那一刻起，智能体就能读写你的文件、在终端执行命令、对预览截图，并与你共同工作——而且一切始终由站点做主。',
			],
		'Atividade do agente': ['Agent activity', 'Actividad del agente', '智能体活动'],
		'Atualize o conector MCP no Notion — a URL única mudou': [
			'Update the MCP connector in Notion — the single URL changed',
			'Actualiza el conector MCP en Notion: la URL única cambió',
			'请在 Notion 中更新 MCP 连接器——唯一网址已变更',
		],
		'Avançado: relay em outra máquina (túnel)': [
			'Advanced: relay on another machine (tunnel)',
			'Avanzado: relay en otra máquina (túnel)',
			'高级：relay 在其他机器上（隧道）',
		],
		Avisos: ['Warnings', 'Avisos', '警告'],
		'Babel (': ['Babel (', 'Babel (', 'Babel（'],
		'Backups automáticos': ['Automatic backups', 'Copias automáticas', '自动备份'],
		'Baixa o projeto inteiro com todas as edições, pronto para publicar ou continuar em outro editor.':
			[
				'Downloads the whole project with every edit, ready to publish or continue in another editor.',
				'Descarga el proyecto completo con todas las ediciones, listo para publicar o continuar en otro editor.',
				'下载包含所有修改的完整项目，可直接发布或在其他编辑器中继续。',
			],
		'Baixar relay.js': ['Download relay.js', 'Descargar relay.js', '下载 relay.js'],
		'Barra de status': ['Status bar', 'Barra de estado', '状态栏'],
		'Bem-vindo ao': ['Welcome to', 'Bienvenido a', '欢迎使用'],
		'Bloqueado por inatividade': [
			'Locked due to inactivity',
			'Bloqueado por inactividad',
			'因闲置而锁定',
		],
		Brilho: ['Brightness', 'Brillo', '亮度'],
		'Build web encontrado — preview direto de': [
			'Web build found — direct preview from',
			'Compilación web encontrada: vista previa directa de',
			'已找到 Web 构建——直接预览：',
		],
		'Build/Comandos': ['Build/Commands', 'Compilación/Comandos', '构建/命令'],
		'Build:': ['Build:', 'Compilación:', '构建：'],
		'Busca global': ['Global search', 'Búsqueda global', '全局搜索'],
		'Buscar arquivo (Ctrl/⌘ P)': [
			'Find file (Ctrl/⌘ P)',
			'Buscar archivo (Ctrl/⌘ P)',
			'查找文件 (Ctrl/⌘ P)',
		],
		'Buscar arquivo ou conteúdo…': [
			'Search file or content…',
			'Buscar archivo o contenido…',
			'搜索文件或内容…',
		],
		'Buscar comando…': ['Search command…', 'Buscar comando…', '搜索命令…'],
		'Buscar e substituir': ['Find and replace', 'Buscar y reemplazar', '查找并替换'],
		'Buscar em todos os arquivos…': [
			'Search in all files…',
			'Buscar en todos los archivos…',
			'在所有文件中搜索…',
		],
		'Cada projeto aberto vira uma aba aqui. Troque de um para outro sem perder nada — o site guarda tudo sozinho no navegador. O X fecha o projeto e ainda deixa um backup em Recentes.':
			[
				'Each open project becomes a tab here. Switch between them without losing anything — the ' +
					'site saves everything by itself in the browser. The X closes the project and still ' +
					'leaves a backup in Recent.',
				'Cada proyecto abierto se convierte en una pestaña aquí. Cambia de uno a otro sin perder ' +
					'nada: el sitio guarda todo solo en el navegador. La X cierra el proyecto y aún deja una ' +
					'copia en Recientes.',
				'每个打开的项目都会在这里变成一个标签。切换时不会丢失任何内容——站点会自动保存到浏览器。点 X 关闭项目，仍会在“最近”中保留备份。',
			],
		'Caminho invalido': ['Invalid path', 'Ruta no válida', '路径无效'],
		'Campo de busca vazio': ['Empty search field', 'Campo de búsqueda vacío', '搜索框为空'],
		'Carregando arquivos…': ['Loading files…', 'Cargando archivos…', '正在加载文件…'],
		'Carregar exemplo': ['Load example', 'Cargar ejemplo', '加载示例'],
		'Catalogo publicado no no de reserva': [
			'Catalog published on the backup node',
			'Catálogo publicado en el nodo de reserva',
			'目录已发布到备用节点',
		],
		Claro: ['Light', 'Claro', '浅色'],
		'Cliente MCP conectado (': [
			'MCP client connected (',
			'Cliente MCP conectado (',
			'MCP 客户端已连接（',
		],
		'Clique na imagem para alternar entre ajustar e tamanho real': [
			'Click the image to toggle between fit and full size',
			'Haz clic en la imagen para alternar entre ajustar y tamaño real',
			'点击图片可在适应与原尺寸之间切换',
		],
		'Clique no cadeado para desbloquear quando quiser': [
			'Click the padlock to unlock whenever you want',
			'Haz clic en el candado para desbloquear cuando quieras',
			'随时点击锁图标即可解锁',
		],
		'Clique para ver em tamanho real': [
			'Click to see it at full size',
			'Haz clic para verlo a tamaño real',
			'点击查看原尺寸',
		],
		'Comando na fila (': ['Command queued (', 'Comando en la cola (', '命令已入队（'],
		'Comando no projeto ativo (ex.: npm install)… Enter para executar': [
			'Command in the active project (e.g. npm install)… Enter to run',
			'Comando en el proyecto activo (ej.: npm install)… Enter para ejecutar',
			'在当前项目中执行命令（如 npm install）… 按回车运行',
		],
		'Comandos permitidos (um prefixo por linha — vazio = todos):': [
			'Allowed commands (one prefix per line — empty = all):',
			'Comandos permitidos (un prefijo por línea; vacío = todos):',
			'允许的命令（每行一个前缀；空 = 全部）：',
		],
		'Comece por aqui': ['Start here', 'Empieza aquí', '从这里开始'],
		'Como ativar:': ['How to enable:', 'Cómo activarlo:', '开启方式：'],
		'Compilador:': ['Compiler:', 'Compilador:', '编译器：'],
		'Compilando preview…': ['Compiling preview…', 'Compilando la vista previa…', '正在编译预览…'],
		'Conecta o complemento local Synapse Relay (relay.js) — terminal, disco e dev server': [
			'Connects the local Synapse Relay add-on (relay.js) — terminal, disk and dev server',
			'Conecta el complemento local Synapse Relay (relay.js): terminal, disco y servidor de desarrollo',
			'连接本地 Synapse Relay 插件（relay.js）——终端、磁盘与开发服务器',
		],
		'Conectado ao relay': ['Connected to the relay', 'Conectado al relay', '已连接到 relay'],
		'Conectado ao relay (modo compatível)': [
			'Connected to the relay (compatibility mode)',
			'Conectado al relay (modo compatible)',
			'已连接到 relay（兼容模式）',
		],
		'Conexão com o relay parou de responder — reconectando…': [
			'The relay connection stopped responding — reconnecting…',
			'La conexión con el relay dejó de responder: reconectando…',
			'relay 连接停止响应——正在重连…',
		],
		'Configurações → Conectores → Adicionar conector MCP personalizado': [
			'Settings → Connectors → Add custom MCP connector',
			'Configuración → Conectores → Añadir conector MCP personalizado',
			'设置 → 连接器 → 添加自定义 MCP 连接器',
		],
		'Configure o endereço do Synapse Relay no menu MCP (ex.: http://localhost:8787) e execute': [
			'Set the Synapse Relay address in the MCP menu (e.g. http://localhost:8787) and run',
			'Configura la dirección de Synapse Relay en el menú MCP (ej.: http://localhost:8787) y ejecuta',
			'在 MCP 菜单中设置 Synapse Relay 地址（例如 http://localhost:8787）并运行',
		],
		Conflito: ['Conflict', 'Conflicto', '冲突'],
		'Console / DevTools (saída sem F12)': [
			'Console / DevTools (output without F12)',
			'Consola / DevTools (salida sin F12)',
			'控制台 / DevTools（无需 F12）',
		],
		'Console copiado': ['Console copied', 'Consola copiada', '控制台内容已复制'],
		'Console embutido': ['Built-in console', 'Consola integrada', '内置控制台'],
		'Console vazio': ['Console is empty', 'Consola vacía', '控制台为空'],
		'Copiado!': ['Copied!', '¡Copiado!', '已复制！'],
		Copiar: ['Copy', 'Copiar', '复制'],
		'Copiar link': ['Copy link', 'Copiar enlace', '复制链接'],
		'Copiar link de download do arquivo .aurora — funciona neste navegador enquanto esta aba estiver aberta (10 min)':
			[
				'Copy the .aurora download link — it works in this browser while this tab stays open (10 min)',
				'Copiar el enlace de descarga del archivo .aurora: funciona en este navegador mientras esta pestaña esté abierta (10 min)',
				'复制 .aurora 文件的下载链接——在此浏览器中只要本标签页保持打开即可用（10 分钟）',
			],
		'Copiar tudo': ['Copy all', 'Copiar todo', '全部复制'],
		'Copie a URL e cole no conector MCP do Notion': [
			"Copy the URL and paste it into Notion's MCP connector",
			'Copia la URL y pégala en el conector MCP de Notion',
			'复制该网址并粘贴到 Notion 的 MCP 连接器',
		],
		'Copie manualmente': ['Copy it manually', 'Cópialo manualmente', '请手动复制'],
		'Cor de destaque': ['Accent color', 'Color de acento', '强调色'],
		'Cor personalizada': ['Custom color', 'Color personalizado', '自定义颜色'],
		'Crie uma senha (mín. 8 caracteres) para proteger seus projetos NESTE navegador. Sem ela não há recuperação.':
			[
				'Create a password (min. 8 characters) to protect your projects IN THIS browser. Without it there is no recovery.',
				'Crea una contrasena (min. 8 caracteres) para proteger tus proyectos EN ESTE navegador. Sin ella no hay recuperacion.',
				'请设置密码（至少 8 个字符）以保护你在本浏览器中的项目。一旦丢失将无法找回。',
			],
		'Ctrl/⌘ S': ['Ctrl/⌘ S', 'Ctrl/⌘ S', 'Ctrl/⌘ S'],
		'Código e preview lado a lado, um em cima do outro, ou só um dos dois em tela cheia. As divisórias entre os painéis são arrastáveis.':
			[
				'Code and preview side by side, one above the other, or just one of them full screen. The dividers between panels are draggable.',
				'Código y vista previa uno al lado del otro, uno encima del otro, o solo uno de los dos a pantalla completa. Las divisiones entre paneles se pueden arrastrar.',
				'代码与预览可并排、上下排列，也可只全屏显示其中一个。面板之间的分隔线可拖动。',
			],
		'Dentro de ': ['Inside ', 'Dentro de ', '位于 '],
		'Deploy removido.': ['Deployment removed.', 'Despliegue eliminado.', '部署已删除。'],
		Depure: ['Debug', 'Depura', '调试'],
		Desbloqueado: ['Unlocked', 'Desbloqueado', '已解锁'],
		Desktop: ['Desktop', 'Escritorio', '桌面'],
		'Destaque de sintaxe, números de linha, minimapa, dobra de código, busca e substituição em todos os arquivos e formatador. Cada gravação cria um ponto no histórico — dá para voltar no tempo quando quiser.':
			[
				'Syntax highlighting, line numbers, minimap, code folding, find and replace across every file, and a formatter. Each save creates a point in history — you can go back in time whenever you want.',
				'Resaltado de sintaxis, números de línea, minimapa, plegado de código, buscar y ' +
					'reemplazar en todos los archivos y formateador. Cada guardado crea un punto en el ' +
					'historial: puedes volver atrás cuando quieras.',
				'语法高亮、行号、缩略图、代码折叠、全文件查找替换以及格式化工具。每次保存都会在历史中生成一个节点——随时可以回到过去。',
			],
		'Diagnostico de rajada ligado (SYNAPSE_DIAG)': [
			'Burst diagnostics on (SYNAPSE_DIAG)',
			'Diagnóstico de ráfagas activo (SYNAPSE_DIAG)',
			'密集错误诊断已开启（SYNAPSE_DIAG）',
		],
		'Diferenciar maiúsculas/minúsculas': [
			'Match case',
			'Distinguir mayúsculas y minúsculas',
			'区分大小写',
		],
		'Digite a senha novamente para confirmar.': [
			'Type the password again to confirm.',
			'Escribe la contrasena de nuevo para confirmar.',
			'请再次输入密码以确认。',
		],
		'Digite a senha para voltar a abrir os projetos': [
			'Enter the password to open the projects again',
			'Escribe la contraseña para volver a abrir los proyectos',
			'输入密码以重新打开项目',
		],
		'Digite algo': ['Type something', 'Escribe algo', '请输入内容'],
		'Divida a tela': ['Split the screen', 'Divide la pantalla', '分割屏幕'],
		'Do seu gosto': ['To your taste', 'A tu gusto', '按你的喜好'],
		'Do seu jeito': ['Your way', 'A tu manera', '随你安排'],
		'Dobrar / desdobrar tudo': ['Fold / unfold all', 'Plegar / desplegar todo', '全部折叠 / 展开'],
		'Dobras ficam desativadas neste arquivo para manter a fluidez': [
			'Folding is disabled in this file to keep things smooth',
			'El plegado está desactivado en este archivo para mantener la fluidez',
			'为保证流畅，此文件已停用折叠',
		],
		'Dois comandos ao mesmo tempo': [
			'Two commands at the same time',
			'Dos comandos a la vez',
			'同时执行两个命令',
		],
		Duplicado: ['Duplicated', 'Duplicado', '已复制'],
		'Editor + Preview': ['Editor + Preview', 'Editor + Vista previa', '编辑器 + 预览'],
		'Editor + histórico': ['Editor + history', 'Editor + historial', '编辑器 + 历史'],
		'Editor + snapshots': ['Editor + snapshots', 'Editor + copias', '编辑器 + 快照'],
		'Editor com tudo dentro': [
			'An editor with everything inside',
			'Un editor con todo dentro',
			'功能齐全的编辑器',
		],
		'Ela foi copiada para um backup seguro — abrindo o painel de recuperação': [
			'It was copied to a safe backup — opening the recovery panel',
			'Se copió a una copia de seguridad segura: abriendo el panel de recuperación',
			'已复制到安全备份——正在打开恢复面板',
		],
		'Endereço do Synapse Relay (relay.js) —': [
			'Synapse Relay address (relay.js) —',
			'Dirección de Synapse Relay (relay.js) —',
			'Synapse Relay 地址（relay.js）—',
		],
		'Entrada corrigida:': ['Entry fixed:', 'Entrada corregida:', '入口已修正：'],
		'Entrada corrigida: o HTML nao tinha script utilizavel - injetei': [
			'Entry fixed: the HTML had no usable script — I injected',
			'Entrada corregida: el HTML no tenía un script utilizable, inyecté',
			'入口已修正：HTML 中没有可用脚本 —— 已注入',
		],
		'Entrada:': ['Entry:', 'Entrada:', '入口：'],
		'Equipes de agentes': ['Agent teams', 'Equipos de agentes', '智能体团队'],
		Erro: ['Error', 'Error', '错误'],
		'Erro ao compilar': ['Compile error', 'Error al compilar', '编译出错'],
		'Erro ao exportar': ['Error while exporting', 'Error al exportar', '导出时出错'],
		'Erro ao importar': ['Error while importing', 'Error al importar', '导入时出错'],
		'Erro no .zip': ['Error in the .zip', 'Error en el .zip', '.zip 出错'],
		Erros: ['Errors', 'Errores', '错误'],
		'Erros, logs, avisos e requisições do seu projeto aparecem aqui dentro, sem precisar abrir o F12 do navegador.':
			[
				"Errors, logs, warnings and requests from your project show up in here, with no need to open the browser's F12.",
				'Errores, registros, avisos y peticiones de tu proyecto aparecen aquí dentro, sin abrir el F12 del navegador.',
				'项目的错误、日志、警告和请求都显示在这里，无需打开浏览器的 F12。',
			],
		Escreva: ['Write', 'Escribe', '书写'],
		Escuro: ['Dark', 'Oscuro', '深色'],
		'Espelhar projeto': ['Mirror project', 'Duplicar proyecto', '镜像项目'],
		'Espelhar projeto em outro aparelho com um codigo secreto': [
			'Mirror this project to another device with a secret code',
			'Duplicar este proyecto en otro dispositivo con un código secreto',
			'用密钥把项目镜像到另一台设备',
		],
		'Essa pasta já existe no projeto': [
			'That folder already exists in the project',
			'Esa carpeta ya existe en el proyecto',
			'该文件夹已存在于项目中',
		],
		'Este arquivo nao e texto': [
			'This file is not text',
			'Este archivo no es de texto',
			'该文件不是文本文件',
		],
		'Este navegador nao suporta o Modo Servidor real — o preview continua funcionando em Runtime': [
			'This browser does not support real Server mode — the preview keeps working in Runtime',
			'Este navegador no admite el modo Servidor real: la vista previa sigue funcionando en Runtime',
			'此浏览器不支持真实服务器模式——预览将继续以运行时方式工作',
		],
		'Estrutura completa': ['Full structure', 'Estructura completa', '完整结构'],
		Evite: ['Avoid', 'Evita', '请避免'],
		'Excluir a pasta': ['Delete folder', 'Eliminar la carpeta', '删除文件夹'],
		Excluído: ['Deleted', 'Eliminado', '已删除'],
		'Explorador de arquivos': ['File explorer', 'Explorador de archivos', '文件浏览器'],
		Explorer: ['Explorer', 'Explorador', '资源管理器'],
		Exportado: ['Exported', 'Exportado', '已导出'],
		'Exportar .zip': ['Export .zip', 'Exportar .zip', '导出 .zip'],
		'Exportar em .zip': ['Export as .zip', 'Exportar en .zip', '导出为 .zip'],
		'Exportar projeto aberto como .zip (com todas as edições)': [
			'Export the open project as .zip (with every edit)',
			'Exportar el proyecto abierto como .zip (con todas las ediciones)',
			'将打开的项目导出为 .zip（包含所有修改）',
		],
		'Expressão regular': ['Regular expression', 'Expresión regular', '正则表达式'],
		'Extrai e roda o projeto': [
			'Extracts and runs the project',
			'Extrae y ejecuta el proyecto',
			'解压并运行项目',
		],
		Extraindo: ['Extracting', 'Extrayendo', '正在解压'],
		'Extraindo assets…': ['Extracting assets…', 'Extrayendo recursos…', '正在解压素材…'],
		'Failover ativo': ['Failover active', 'Failover activo', '故障转移已启用'],
		'Failover ativo: no principal': [
			'Failover active: main node',
			'Failover activo: nodo principal',
			'故障转移已启用：主节点',
		],
		'Failover ativo: no principal no limite de capacidade — o encaminhador interno do no esta desviando para o no de reserva':
			[
				"Failover active: main node at capacity — the node's internal forwarder is diverting to the backup node",
				'Failover activo: nodo principal en el límite de capacidad; el reenviador interno del nodo está desviando al nodo de reserva',
				'故障转移已启用：主节点已达容量上限——节点内部转发器正在分流到备用节点',
			],
		Falha: ['Failed', 'Falló', '失败'],
		'Falha ao baixar': ['Download failed', 'No se pudo descargar', '下载失败'],
		'Falha ao conectar:': ['Failed to connect:', 'No se pudo conectar:', '连接失败：'],
		'Falha ao copiar': ['Copy failed', 'No se pudo copiar', '复制失败'],
		'Falha ao enviar resposta ao relay': [
			'Failed to send the response to the relay',
			'No se pudo enviar la respuesta al relay',
			'向 relay 发送响应失败',
		],
		'Falha ao exportar': ['Export failed', 'No se pudo exportar', '导出失败'],
		'Falha ao extrair': ['Extraction failed', 'No se pudo extraer', '解压失败'],
		'Falha ao formatar': ['Formatting failed', 'Fallo al formatear', '格式化失败'],
		'Falha ao importar': ['Import failed', 'No se pudo importar', '导入失败'],
		'Falha ao sincronizar para o dev server:': [
			'Failed to sync to the dev server:',
			'No se pudo sincronizar con el servidor de desarrollo:',
			'同步到开发服务器失败：',
		],
		Fechar: ['Close', 'Cerrar', '关闭'],
		'Feche a outra aba/dispositivo e clique em conectar de novo aqui.': [
			'Close the other tab/device and click connect again here.',
			'Cierra la otra pestana/dispositivo y pulsa conectar de nuevo aqui.',
			'请关闭另一个标签页或设备，然后在此重新点击连接。',
		],
		'Fechou o projeto sem querer? Ele fica aqui, com backups automáticos prontos para recuperar em um clique.':
			[
				'Closed a project by accident? It stays here, with automatic backups ready to recover in one click.',
				'¿Cerraste el proyecto sin querer? Sigue aquí, con copias automáticas listas para recuperar en un clic.',
				'不小心关闭了项目？它就在这里，自动备份可一键恢复。',
			],
		'Fila deste no cheia (': [
			"This node's queue is full (",
			'La cola de este nodo está llena (',
			'该节点的队列已满（',
		],
		'Filtrar arquivos…': ['Filter files…', 'Filtrar archivos…', '筛选文件…'],
		'Filtrar por nome...': ['Filter by name...', 'Filtrar por nombre...', '按名称筛选...'],
		'Filtrar…': ['Filter…', 'Filtrar…', '筛选…'],
		'Fisica, Runtime, Design...': [
			'Physics, Runtime, Design...',
			'Física, Runtime, Diseño...',
			'物理、运行时、设计...',
		],
		Floresta: ['Forest', 'Bosque', '森林'],
		'Formatar código (Shift+Alt+F)': [
			'Format code (Shift+Alt+F)',
			'Formatear código (Shift+Alt+F)',
			'格式化代码 (Shift+Alt+F)',
		],
		'Gera nova URL e token (a antiga para de funcionar)': [
			'Generates a new URL and token (the old one stops working)',
			'Genera una URL y un token nuevos (el anterior deja de funcionar)',
			'生成新的网址和令牌（旧的将失效）',
		],
		'Gera um código secreto e leva o projeto para outro computador ou para o celular, sem nuvem no meio do caminho.':
			[
				'Generates a secret code and carries the project to another computer or to your phone, with no cloud in between.',
				'Genera un código secreto y lleva el proyecto a otro ordenador o al móvil, sin nube en medio.',
				'生成一个密钥，把项目带到另一台电脑或手机，中间不经过云端。',
			],
		'Gerando .zip…': ['Generating .zip…', 'Generando .zip…', '正在生成 .zip…'],
		'Gerar codigo aleatorio': ['Generate random code', 'Generar código aleatorio', '生成随机代码'],
		Gerenciador: ['Manager', 'Gestor', '管理者'],
		Girar: ['Rotate', 'Girar', '旋转'],
		'Gravacao confirmada no navegador.': [
			'Write confirmed in the browser.',
			'Escritura confirmada en el navegador.',
			'浏览器端写入已确认。',
		],
		'Handshake do WebSocket lento': [
			'Slow WebSocket handshake',
			'Handshake del WebSocket lento',
			'WebSocket 握手过慢',
		],
		'Histórico de versões': ['Version history', 'Historial de versiones', '版本历史'],
		'Histórico de versões (Ctrl/⌘ H)': [
			'Version history (Ctrl/⌘ H)',
			'Historial de versiones (Ctrl/⌘ H)',
			'版本历史 (Ctrl/⌘ H)',
		],
		'Histórico —': ['History —', 'Historial —', '历史 —'],
		'Há projetos recuperáveis no painel Recentes (ícone de relógio)': [
			'There are recoverable projects in the Recent panel (clock icon)',
			'Hay proyectos recuperables en el panel Recientes (icono de reloj)',
			'“最近”面板（时钟图标）中有可恢复的项目',
		],
		Idioma: ['Language', 'Idioma', '语言'],
		'Import do HTML não encontrado nos arquivos:': [
			'HTML import not found in the files:',
			'No se encontró el import del HTML en los archivos:',
			'在文件中找不到 HTML 的 import：',
		],
		'Import map do projeto inválido (mantido como está):': [
			'Project import map is invalid (kept as is):',
			'El import map del proyecto no es válido (se mantiene tal cual):',
			'项目的 import map 无效（保持原样）：',
		],
		'Import map:': ['Import map:', 'Import map:', 'Import map：'],
		Importado: ['Imported', 'Importado', '已导入'],
		'Importando…': ['Importing…', 'Importando…', '正在导入…'],
		Importar: ['Import', 'Importar', '导入'],
		'Importar .zip': ['Import .zip', 'Importar .zip', '导入 .zip'],
		'Importar assets (.zip)': [
			'Import assets (.zip)',
			'Importar recursos (.zip)',
			'导入素材 (.zip)',
		],
		'Importar e exportar': ['Import and export', 'Importar y exportar', '导入与导出'],
		'Importar pasta': ['Import folder', 'Importar carpeta', '导入文件夹'],
		'Importação (': ['Import (', 'Importación (', '导入（'],
		'Importação filtrada': ['Filtered import', 'Importación filtrada', '导入已过滤'],
		'Importe ou crie um projeto antes de adicionar assets.': [
			'Import or create a project before adding assets.',
			'Importa o crea un proyecto antes de añadir recursos.',
			'添加素材前请先导入或新建项目。',
		],
		'Importe ou crie um projeto primeiro': [
			'Import or create a project first',
			'Importa o crea un proyecto primero',
			'请先导入或新建项目',
		],
		'Importe um projeto primeiro': [
			'Import a project first',
			'Importa un proyecto primero',
			'请先导入项目',
		],
		'Imports de Node ignorados (': [
			'Node imports ignored (',
			'Imports de Node ignorados (',
			'已忽略 Node 导入（',
		],
		'Inativo — ative para gerar a URL do Notion': [
			'Inactive — turn it on to generate the Notion URL',
			'Inactivo: actívalo para generar la URL de Notion',
			'未启用——开启后将生成 Notion 网址',
		],
		'Indisponível aqui': ['Not available here', 'No disponible aquí', '此处不可用'],
		'Informe a URL pública do relay (ex.: https://meu-relay.onrender.com)': [
			'Enter the public relay URL (e.g. https://my-relay.onrender.com)',
			'Indica la URL pública del relay (ej.: https://mi-relay.onrender.com)',
			'请输入 relay 的公网地址（例如 https://my-relay.onrender.com）',
		],
		'Instala as dependencias e sobe o dev server dentro do navegador (WebContainers). Pode levar minutos.':
			[
				'Installs dependencies and starts the dev server inside the browser (WebContainers). It can take minutes.',
				'Instala las dependencias y levanta el servidor de desarrollo dentro del navegador (WebContainers). Puede tardar minutos.',
				'在浏览器内安装依赖并启动开发服务器（WebContainers）。可能需要几分钟。',
			],
		'Integrador Revisor': ['Reviewer Integrator', 'Integrador Revisor', '集成审阅'],
		'Isolamento ativo — iniciando o servidor…': [
			'Isolation active — starting the server…',
			'Aislamiento activo: iniciando el servidor…',
			'隔离已启用——正在启动服务器…',
		],
		'Ja esta formatado': ['Already formatted', 'Ya esta formateado', '已经是格式化状态'],
		'Ja existe': ['Already exists', 'Ya existe', '已存在'],
		'Ja existe algo em': ['Something already exists at', 'Ya existe algo en', '该位置已存在内容：'],
		'Ja existe um comando rodando (': [
			'A command is already running (',
			'Ya hay un comando en ejecución (',
			'已有命令正在运行（',
		],
		'Já existe': ['Already exists', 'Ya existe', '已存在'],
		'Já existe algo no destino': [
			'Something already exists at the destination',
			'Ya existe algo en el destino',
			'目标位置已存在内容',
		],
		'Já há um arquivo com esse caminho': [
			'There is already a file with that path',
			'Ya hay un archivo con esa ruta',
			'已存在同路径的文件',
		],
		'Já há um arquivo nesse caminho': [
			'There is already a file at that path',
			'Ya hay un archivo en esa ruta',
			'该路径已有文件',
		],
		'Já há uma pasta com esse nome': [
			'There is already a folder with that name',
			'Ya hay una carpeta con ese nombre',
			'已存在同名文件夹',
		],
		Largura: ['Width', 'Ancho', '宽度'],
		'Leitura hexadecimal (': ['Hex read (', 'Lectura hexadecimal (', '十六进制读取（'],
		'Lendo pasta…': ['Reading folder…', 'Leyendo carpeta…', '正在读取文件夹…'],
		'Leve embora': ['Take it with you', 'Llévatelo', '带走它'],
		Limpar: ['Clear', 'Limpiar', '清空'],
		'Link copiado': ['Link copied', 'Enlace copiado', '链接已复制'],
		'Link de download de': ['Download link for', 'Enlace de descarga de', '下载链接：'],
		'Live Preview': ['Live Preview', 'Live Preview', '实时预览'],
		'Local (desktop)': ['Local (desktop)', 'Local (escritorio)', '本地（桌面）'],
		'MCP ativado': ['MCP enabled', 'MCP activado', 'MCP 已启用'],
		'MCP ativo (Conectado — pronto para receber o agente do Notion)': [
			'MCP active (Connected — ready for the Notion agent)',
			'MCP activo (Conectado: listo para el agente de Notion)',
			'MCP 已启用（已连接——可接收 Notion 智能体）',
		],
		'MCP com o Notion': ['MCP with Notion', 'MCP con Notion', '与 Notion 的 MCP'],
		'MCP desativado': ['MCP disabled', 'MCP desactivado', 'MCP 已停用'],
		'MCP desligado nesta aba: outra aba do Synapse esta no comando. Isso evita que duas abas gravem por cima uma da outra.':
			[
				'MCP is off in this tab: another Synapse tab is in charge. This keeps two tabs from overwriting each other.',
				'MCP apagado en esta pestana: otra pestana de Synapse esta al mando. Esto evita que dos pestanas se sobrescriban.',
				'本标签页的 MCP 已关闭：另一个 Synapse 标签页正在接管。这样可避免两个标签页互相覆盖写入。',
			],
		'MCP para Notion': ['MCP for Notion', 'MCP para Notion', '面向 Notion 的 MCP'],
		'MCP: seu agente de IA entra no projeto': [
			'MCP: your AI agent joins the project',
			'MCP: tu agente de IA entra en el proyecto',
			'MCP：让你的 AI 智能体加入项目',
		],
		'Mantenha esta aba aberta': [
			'Keep this tab open',
			'Mantén esta pestaña abierta',
			'请保持此标签页打开',
		],
		Matiz: ['Hue', 'Matiz', '色相'],
		'Meia-noite': ['Midnight', 'Medianoche', '午夜'],
		'Minimapa (mostrar/ocultar)': [
			'Minimap (show/hide)',
			'Minimapa (mostrar/ocultar)',
			'缩略图（显示/隐藏）',
		],
		Mobile: ['Mobile', 'Móvil', '手机'],
		'Modo Runtime': ['Runtime mode', 'Modo Runtime', '运行时模式'],
		'Modo Servidor real indisponivel neste navegador - seguindo no Modo Runtime.': [
			'Real Server mode is unavailable in this browser — staying in Runtime mode.',
			'El modo Servidor real no está disponible en este navegador: se continúa en modo Runtime.',
			'此浏览器不支持真实服务器模式——继续使用运行时模式。',
		],
		'Modo Servidor real liberado': [
			'Real Server mode unlocked',
			'Modo Servidor real habilitado',
			'已启用真实服务器模式',
		],
		'Modo alterado': ['Mode changed', 'Modo cambiado', '模式已切换'],
		'Modo nuvem.': ['Cloud mode.', 'Modo nube.', '云端模式。'],
		'Monorepo detectado: converti dependências': [
			'Monorepo detected: I converted dependencies',
			'Monorepo detectado: convertí las dependencias',
			'检测到 monorepo：已转换依赖',
		],
		'Montando arquivos do projeto…': [
			'Assembling project files…',
			'Montando archivos del proyecto…',
			'正在组装项目文件…',
		],
		'Muitas tentativas': ['Too many attempts', 'Demasiados intentos', '尝试次数过多'],
		'Nada para abrir': ['Nothing to open', 'Nada que abrir', '没有可打开的内容'],
		'Nada para copiar': ['Nothing to copy', 'Nada que copiar', '没有可复制的内容'],
		'Nada para dobrar': ['Nothing to fold', 'Nada que plegar', '没有可折叠的内容'],
		'Nada para exportar': ['Nothing to export', 'Nada que exportar', '没有可导出的内容'],
		'Nada para formatar': ['Nothing to format', 'Nada que formatear', '没有可格式化的内容'],
		'Nada para importar': ['Nothing to import', 'Nada que importar', '没有可导入的内容'],
		'Nada reaberto': ['Nothing reopened', 'No se reabrió nada', '没有重新打开任何内容'],
		'Nada se perde': ['Nothing gets lost', 'Nada se pierde', '一切都不丢失'],
		'Nada substituido': ['Nothing replaced', 'No se reemplazó nada', '没有替换任何内容'],
		'Nao da para formatar': [
			'Cannot format this file',
			'No se puede formatear',
			'无法格式化该文件',
		],
		'Nao da para mover uma pasta para dentro dela mesma': [
			'You cannot move a folder into itself',
			'No se puede mover una carpeta dentro de sí misma',
			'无法把文件夹移动到它自身内部',
		],
		'Nenhum arquivo': ['No file', 'Ningún archivo', '没有文件'],
		'Nenhum arquivo encontrado (ou tudo foi filtrado por segurança)': [
			'No file found (or everything was filtered for safety)',
			'No se encontró ningún archivo (o todo se filtró por seguridad)',
			'未找到文件（或已因安全原因全部过滤）',
		],
		'Nenhum arquivo global neste projeto.': [
			'No global file in this project.',
			'Ningún archivo global en este proyecto.',
			'该项目没有全局文件。',
		],
		'Nenhum asset': ['No asset', 'Ningún recurso', '没有素材'],
		'Nenhum asset encontrado': ['No asset found', 'No se encontró ningún recurso', '未找到素材'],
		'Nenhum bloco indentado encontrado': [
			'No indented block found',
			'No se encontró ningún bloque indentado',
			'未找到缩进代码块',
		],
		'Nenhum comando em execucao.': [
			'No command running.',
			'Ningún comando en ejecución.',
			'没有正在运行的命令。',
		],
		'Nenhum erro de MCP registrado ainda': [
			'No MCP errors recorded yet',
			'Aún no hay errores de MCP registrados',
			'尚未记录到 MCP 错误',
		],
		'Nenhum projeto aberto': ['No project open', 'Ningún proyecto abierto', '没有打开的项目'],
		'Nenhum projeto aberto. Importe um .zip ou crie um projeto.': [
			'No project open. Import a .zip or create a project.',
			'Ningún proyecto abierto. Importa un .zip o crea un proyecto.',
			'没有打开的项目。请导入 .zip 或新建项目。',
		],
		'Nenhuma aba do Synapse esta conectada': [
			'No Synapse tab is connected',
			'Ninguna pestaña de Synapse está conectada',
			'没有已连接的 Synapse 标签页',
		],
		'Nenhuma equipe sua ainda - o site funciona como antes ate voce criar a primeira': [
			'No team of yours yet — the site works as before until you create the first one',
			'Aún no tienes equipos: el sitio funciona como antes hasta que crees el primero',
			'你还没有团队——在创建第一个之前，站点与以前一样工作',
		],
		'Nenhuma mensagem corresponde ao filtro.': [
			'No message matches the filter.',
			'Ningún mensaje coincide con el filtro.',
			'没有消息符合该筛选条件。',
		],
		'Nenhuma ocorrencia encontrada': [
			'No matches found',
			'No se encontraron coincidencias',
			'未找到匹配项',
		],
		'No Notion:': ['In Notion:', 'En Notion:', '在 Notion 中：'],
		'No de reserva': ['Backup node', 'Nodo de reserva', '备用节点'],
		'No principal recuperado': ['Main node recovered', 'Nodo principal recuperado', '主节点已恢复'],
		'No principal recuperado — operacao normal; reservas seguem de prontidao.': [
			'Main node recovered — normal operation; backups remain on standby.',
			'Nodo principal recuperado: operación normal; las reservas siguen en espera.',
			'主节点已恢复——恢复正常运行；备用节点保持待命。',
		],
		'Nome da pasta': ['Folder name', 'Nombre de la carpeta', '文件夹名称'],
		'Nome inválido': ['Invalid name', 'Nombre no válido', '名称无效'],
		'Nos do portao adotados (': [
			'Gateway nodes adopted (',
			'Nodos de la puerta adoptados (',
			'已采用网关节点（',
		],
		'Nova URL': ['New URL', 'Nueva URL', '新网址'],
		'Nova URL gerada': ['New URL generated', 'Nueva URL generada', '已生成新网址'],
		'Novo caminho da pasta': ['New folder path', 'Nueva ruta de la carpeta', '文件夹的新路径'],
		'Novo caminho do arquivo.': ['New file path.', 'Nueva ruta del archivo.', '文件的新路径。'],
		Nuvem: ['Cloud', 'Nube', '云端'],
		'Não consegui ler nenhum arquivo do que foi arrastado. Tente o botão Importar.': [
			'I could not read any of the dragged files. Try the Import button.',
			'No pude leer ninguno de los archivos arrastrados. Prueba el botón Importar.',
			'无法读取拖入的任何文件，请改用“导入”按钮。',
		],
		'Não foi possível desbloquear este registro': [
			'This record could not be unlocked',
			'No se pudo desbloquear este registro',
			'无法解锁此记录',
		],
		'Não há arquivos para exportar': [
			'There are no files to export',
			'No hay archivos para exportar',
			'没有可导出的文件',
		],
		Nórdico: ['Nordic', 'Nórdico', '北欧'],
		'Nós de reserva — failover automático em URL única (opcional)': [
			'Backup nodes — automatic failover on a single URL (optional)',
			'Nodos de reserva: failover automático con URL única (opcional)',
			'备用节点——单一网址自动切换（可选）',
		],
		'O .zip não tem arquivos suportados (glb, gltf, webp, png, jpg, jpeg, jfif, ogg, mp3, mp4, bin).':
			[
				'The .zip has no supported files (glb, gltf, webp, png, jpg, jpeg, jfif, ogg, mp3, mp4, bin).',
				'El .zip no tiene archivos compatibles (glb, gltf, webp, png, jpg, jpeg, jfif, ogg, mp3, mp4, bin).',
				'该 .zip 不包含支持的文件（glb、gltf、webp、png、jpg、jpeg、jfif、ogg、mp3、mp4、bin）。',
			],
		'O coração do site': ['The heart of the site', 'El corazón del sitio', '网站的核心'],
		'O dev server encerrou antes de ficar pronto': [
			'The dev server exited before it was ready',
			'El dev server termino antes de estar listo',
			'开发服务器在就绪前退出',
		],
		'O endereco local (': ['The local address (', 'La dirección local (', '本地地址（'],
		'O portão é um roteador minúsculo (': [
			'The gateway is a tiny router (',
			'La puerta de enlace es un router minúsculo (',
			'网关是一个极小的路由器（',
		],
		'O que esta equipe cuida': [
			'What this team takes care of',
			'De qué se encarga este equipo',
			'该团队负责的范围',
		],
		'O relay do app foi parado - MCP desativado. Toque em Iniciar relay no app.': [
			'The app relay was stopped — MCP disabled. Tap Start relay in the app.',
			'El relay de la app se detuvo: MCP desactivado. Toca Iniciar relay en la app.',
			'应用的 relay 已停止——MCP 已停用。请在应用中点击“启动 relay”。',
		],
		'O resultado se reconstrói a cada tecla digitada: HTML, CSS, JS, módulos e imagens resolvidos na hora, sem servidor e sem recarregar nada na mão.':
			[
				'The result rebuilds itself with every keystroke: HTML, CSS, JS, modules and images resolved instantly, with no server and no manual reloading.',
				'El resultado se reconstruye con cada tecla: HTML, CSS, JS, módulos e imágenes resueltos al instante, sin servidor y sin recargar nada a mano.',
				'每敲一个键，结果就重建一次：HTML、CSS、JS、模块和图片即时解析，无需服务器，也无需手动刷新。',
			],
		'O servidor não respondeu a tempo (timeout).': [
			'The server did not answer in time (timeout).',
			'El servidor no respondió a tiempo (timeout).',
			'服务器未及时响应（超时）。',
		],
		'O site esta usando o relay do proprio aparelho (127.0.0.1) e a URL do tunel do app - nao precisa de relay no Render. Os campos abaixo sao preenchidos e mantidos automaticamente.':
			[
				"The site is using this device's own relay (127.0.0.1) and the app tunnel URL - no relay on Render needed. The fields below are filled in and kept up to date automatically.",
				'El sitio esta usando el relay del propio dispositivo (127.0.0.1) y la URL del tunel de la app - no hace falta relay en Render. Los campos de abajo se rellenan y se mantienen automaticamente.',
				'站点正在使用本机自带的 relay（127.0.0.1）和应用隧道地址——无需在 Render 上部署 relay。下面的字段会自动填写并保持更新。',
			],
		'Ocultar por 10 min': ['Hide for 10 min', 'Ocultar por 10 min', '隐藏 10 分钟'],
		'Operacao invalida': ['Invalid operation', 'Operación no válida', '操作无效'],
		'Operacao normal restabelecida.': [
			'Normal operation restored.',
			'Operación normal restablecida.',
			'已恢复正常运行。',
		],
		'Os comandos rodam no SEU computador, na pasta espelhada do projeto (relay). Configure a URL do relay no menu MCP se ainda nao configurou.':
			[
				"Commands run on YOUR computer, in the project's mirrored folder (relay). Set the relay URL in the MCP menu if you have not done it yet.",
				'Los comandos se ejecutan en TU ordenador, en la carpeta espejo del proyecto (relay). Configura la URL del relay en el menú MCP si aún no lo hiciste.',
				'命令在你自己的电脑上、项目的镜像文件夹（relay）中运行。若尚未设置，请在 MCP 菜单里配置 relay 网址。',
			],
		'Os projetos deste registro já estão abertos ou o registro está vazio': [
			'The projects in this record are already open or the record is empty',
			'Los proyectos de este registro ya están abiertos o el registro está vacío',
			'该记录中的项目已打开，或该记录为空',
		],
		'Os projetos não exigem mais senha': [
			'The projects no longer require a password',
			'Los proyectos ya no piden contraseña',
			'项目不再需要密码',
		],
		'Os projetos salvos foram removidos': [
			'The saved projects were removed',
			'Se eliminaron los proyectos guardados',
			'已保存的项目已被移除',
		],
		'Ou arraste arquivos para qualquer lugar': [
			'Or drag files anywhere',
			'O arrastra archivos a cualquier parte',
			'也可以把文件拖到任意位置',
		],
		'Outra aba do Synapse esta no comando. Use o aviso no topo para assumir.': [
			'Another Synapse tab is in charge. Use the notice at the top to take over.',
			'Otra pestana de Synapse esta al mando. Usa el aviso de arriba para tomar el control.',
			'另一个 Synapse 标签页正在接管。使用顶部的提示即可接管。',
		],
		'Outro aparelho': ['Another device', 'Otro dispositivo', '另一台设备'],
		'PROTECAO DE PROJETO: o disco pediu para apagar': [
			'PROJECT PROTECTION: the disk asked to delete',
			'PROTECCIÓN DE PROYECTO: el disco pidió borrar',
			'项目保护：磁盘请求删除',
		],
		'Padrão do tema': ['Theme default', 'Predeterminado del tema', '主题默认'],
		'Paleta de comandos': ['Command palette', 'Paleta de comandos', '命令面板'],
		'Paleta de comandos (Ctrl/⌘ K)': [
			'Command palette (Ctrl/⌘ K)',
			'Paleta de comandos (Ctrl/⌘ K)',
			'命令面板 (Ctrl/⌘ K)',
		],
		'Para cobrir também o bloqueio total na borda': [
			'To also cover full blocking at the edge',
			'Para cubrir también el bloqueo total en el borde',
			'为了同时覆盖边缘的完全封锁',
		],
		'Para instalar dependencias e subir o dev server de verdade, clique em': [
			'To install dependencies and start a real dev server, click',
			'Para instalar dependencias y levantar un servidor de desarrollo real, haz clic en',
			'要真正安装依赖并启动开发服务器，请点击',
		],
		'Para rodar npm de verdade no navegador (WebContainers), o site precisa estar hospedado com headers COOP/COEP (cross-origin isolation) E rodar em Chrome/Edge/Firefox de desktop.':
			[
				'To run real npm in the browser (WebContainers), the site must be hosted with COOP/COEP headers (cross-origin isolation) AND run on desktop Chrome/Edge/Firefox.',
				'Para ejecutar npm de verdad en el navegador (WebContainers), el sitio debe estar alojado con cabeceras COOP/COEP (cross-origin isolation) Y ejecutarse en Chrome/Edge/Firefox de escritorio.',
				'要在浏览器中真正运行 npm（WebContainers），站点必须带 COOP/COEP 响应头（跨源隔离）托管，并在桌面版 Chrome/Edge/Firefox 中运行。',
			],
		'Para ver o app rodando no preview:': [
			'To see the app running in the preview:',
			'Para ver la app funcionando en la vista previa:',
			'要在预览中看到应用运行：',
		],
		'Parar comando atual': ['Stop current command', 'Detener el comando actual', '停止当前命令'],
		'Pasta criada': ['Folder created', 'Carpeta creada', '文件夹已创建'],
		'Pasta excluída': ['Folder deleted', 'Carpeta eliminada', '文件夹已删除'],
		'Pasta movida': ['Folder moved', 'Carpeta movida', '文件夹已移动'],
		'Pasta renomeada': ['Folder renamed', 'Carpeta renombrada', '文件夹已重命名'],
		'Permita pop-ups para abrir em nova aba': [
			'Allow pop-ups to open in a new tab',
			'Permite ventanas emergentes para abrir en otra pestaña',
			'请允许弹出窗口以便在新标签页打开',
		],
		'Permitir que o agente execute comandos no computador (terminal)': [
			'Allow the agent to run commands on the computer (terminal)',
			'Permitir que el agente ejecute comandos en el ordenador (terminal)',
			'允许智能体在本机执行命令（终端）',
		],
		'Planejador / Divisor': ['Planner / Splitter', 'Planificador / Divisor', '规划 / 拆分'],
		'Poder de verdade': ['Real power', 'Poder de verdad', '真正的能力'],
		'Ponte local instavel (troca WS->SSE->polling) — portao confirma principal respondendo. Sem acao necessaria.':
			[
				'Local bridge unstable (switching WS->SSE->polling) — the gateway confirms the main node is answering. No action needed.',
				'Puente local inestable (cambia WS->SSE->polling): la puerta confirma que el principal responde. No hay que hacer nada.',
				'本地桥接不稳定（WS->SSE->轮询切换）——网关确认主节点正在响应。无需操作。',
			],
		'Ponte principal sem batimento ha 45s - reconectando': [
			'Main bridge with no heartbeat for 45s — reconnecting',
			'Puente principal sin latido durante 45 s: reconectando',
			'主桥接已 45 秒无心跳——正在重连',
		],
		'Pool pronto:': ['Pool ready:', 'Grupo listo:', '连接池就绪：'],
		'Pop-up bloqueado': ['Pop-up blocked', 'Ventana emergente bloqueada', '弹出窗口被拦截'],
		'Portao desviando pela mesma URL — nenhuma acao e necessaria.': [
			'Gateway diverting through the same URL — no action needed.',
			'La puerta de enlace desvía por la misma URL: no hay que hacer nada.',
			'网关正通过同一网址分流——无需任何操作。',
		],
		'Portao sem resposta (': [
			'Gateway not responding (',
			'La puerta de enlace no responde (',
			'网关无响应（',
		],
		'Portao vivo — desviando pela MESMA URL para': [
			'Gateway alive — diverting through the SAME URL to',
			'Puerta de enlace viva: desviando por la MISMA URL hacia',
			'网关存活——通过同一个网址分流至',
		],
		'Portao vivo — servindo pelo no principal (': [
			'Gateway alive — serving through the main node (',
			'Puerta de enlace viva: sirviendo por el nodo principal (',
			'网关存活——由主节点提供服务（',
		],
		'Portão da URL única — failover total, cobre até bloqueio de borda (recomendado)': [
			'Single-URL gateway — full failover, covers even edge blocking (recommended)',
			'Puerta de enlace de URL única: failover total, cubre incluso el bloqueo en el borde (recomendado)',
			'单一网址网关——完全故障转移，甚至覆盖边缘封锁（推荐）',
		],
		'Preparando o preview do projeto…': [
			'Preparing the project preview…',
			'Preparando la vista previa del proyecto…',
			'正在准备项目预览…',
		],
		'Preview ao vivo': ['Live preview', 'Vista previa en vivo', '实时预览'],
		'Preview atualizado': ['Preview updated', 'Vista previa actualizada', '预览已更新'],
		'Preview em outra aba': [
			'Preview in another tab',
			'Vista previa en otra pestaña',
			'在另一标签页预览',
		],
		'Preview montado com sucesso ✓': [
			'Preview built successfully ✓',
			'Vista previa montada correctamente ✓',
			'预览构建成功 ✓',
		],
		'Preview no dev server (porta': [
			'Preview on the dev server (port',
			'Vista previa en el servidor de desarrollo (puerto',
			'在开发服务器上预览（端口',
		],
		'Preview responsivo': ['Responsive preview', 'Vista previa adaptable', '自适应预览'],
		Privacidade: ['Privacy', 'Privacidad', '隐私'],
		'Procurando o app Synapse Relay neste aparelho (127.0.0.1)...': [
			'Looking for the Synapse Relay app on this device (127.0.0.1)...',
			'Buscando la app Synapse Relay en este dispositivo (127.0.0.1)...',
			'正在本设备（127.0.0.1）上查找 Synapse Relay 应用...',
		],
		Projeto: ['Project', 'Proyecto', '项目'],
		'Projeto Flutter detectado (pubspec.yaml + Dart).': [
			'Flutter project detected (pubspec.yaml + Dart).',
			'Proyecto Flutter detectado (pubspec.yaml + Dart).',
			'检测到 Flutter 项目（pubspec.yaml + Dart）。',
		],
		'Projeto aberto em segundo plano — o preview será montado quando ele for ativado.': [
			'Project opened in the background — the preview will be built once it becomes active.',
			'Proyecto abierto en segundo plano: la vista previa se montará cuando se active.',
			'项目已在后台打开——激活后才会构建预览。',
		],
		'Projeto com JSX/TS — transformação automática no navegador ativada.': [
			'Project with JSX/TS — automatic in-browser transform enabled.',
			'Proyecto con JSX/TS: transformación automática en el navegador activada.',
			'项目包含 JSX/TS —— 已启用浏览器内自动转换。',
		],
		'Projeto demonstração': ['Demo project', 'Proyecto de demostración', '演示项目'],
		'Projeto grande (': ['Large project (', 'Proyecto grande (', '大型项目（'],
		'Projeto vazio': ['Empty project', 'Proyecto vacío', '项目为空'],
		'Projetos bloqueados': ['Projects locked', 'Proyectos bloqueados', '项目已锁定'],
		'Projetos recentes e backups — recuperar projetos fechados': [
			'Recent projects and backups — recover closed projects',
			'Proyectos recientes y copias de seguridad: recuperar proyectos cerrados',
			'最近项目与备份——恢复已关闭的项目',
		],
		'Promessa rejeitada (não tratada):': [
			'Unhandled promise rejection:',
			'Promesa rechazada (no tratada):',
			'未处理的 Promise 报错：',
		],
		Pronto: ['Ready', 'Listo', '就绪'],
		'Protege projetos com senha, para quem mais usa esta máquina não abrir o que não deve.': [
			'Protects projects with a password, so whoever else uses this machine cannot open what they should not.',
			'Protege proyectos con contraseña, para que quien más use esta máquina no abra lo que no debe.',
			'用密码保护项目，避免共用这台电脑的人打开不应该看的内容。',
		],
		'Proteger projetos com senha': [
			'Protect projects with a password',
			'Proteger proyectos con contraseña',
			'用密码保护项目',
		],
		'Proteção ativada': ['Protection enabled', 'Protección activada', '保护已启用'],
		'Proteção removida': ['Protection removed', 'Protección eliminada', '保护已移除'],
		RESERVAS: ['BACKUPS', 'RESERVAS', '备用'],
		'Rajada de erros de MCP: ': [
			'MCP error burst: ',
			'Ráfaga de errores de MCP: ',
			'MCP 错误密集发生：',
		],
		'React fixado em uma unica copia (': [
			'React pinned to a single copy (',
			'React fijado en una sola copia (',
			'React 已固定为单一副本（',
		],
		'Recarregar preview': ['Reload preview', 'Recargar la vista previa', '重新加载预览'],
		'Recarregue a página para tentar novamente': [
			'Reload the page to try again',
			'Recarga la página para intentarlo de nuevo',
			'请刷新页面后重试',
		],
		'Recentes e backups': ['Recent and backups', 'Recientes y copias de seguridad', '最近与备份'],
		'Recolher tudo': ['Collapse all', 'Contraer todo', '全部收起'],
		Recuperado: ['Recovered', 'Recuperado', '已恢复'],
		'Regex invalida': ['Invalid regex', 'Expresión regular no válida', '正则表达式无效'],
		'Remover este agente da equipe': [
			'Remove this agent from the team',
			'Quitar este agente del equipo',
			'将该智能体移出团队',
		],
		Renomeado: ['Renamed', 'Renombrado', '已重命名'],
		'Repita quando quiser no botão ? da barra de cima': [
			'Replay it any time from the ? button in the top bar',
			'Repítelo cuando quieras con el botón ? de la barra superior',
			'随时可通过顶栏的 ? 按钮重看',
		],
		'Reprodução local do arquivo (': [
			'Local playback of the file (',
			'Reproducción local del archivo (',
			'本地播放文件（',
		],
		Reserva: ['Backup', 'Reserva', '备用'],
		Responsivo: ['Responsive', 'Adaptable', '自适应'],
		'Restaurar esta versão': ['Restore this version', 'Restaurar esta versión', '还原此版本'],
		'Restauração parcial': ['Partial restore', 'Restauración parcial', '部分恢复'],
		'Rode com: node relay.js (Node 18+) em um host público': [
			'Run it with: node relay.js (Node 18+) on a public host',
			'Ejecútalo con: node relay.js (Node 18+) en un host público',
			'在公网主机上运行：node relay.js（Node 18+）',
		],
		Rosé: ['Rosé', 'Rosé', '玫瑰'],
		'Rotas por caminho detectadas. O preview roda em <iframe srcdoc>: location.pathname vale': [
			'Path-based routes detected. The preview runs in <iframe srcdoc>: location.pathname is',
			'Rutas por ruta detectadas. La vista previa corre en <iframe srcdoc>: location.pathname vale',
			'检测到基于路径的路由。预览运行于 <iframe srcdoc>：location.pathname 为',
		],
		'Runtime build:': ['Runtime build:', 'Compilación en runtime:', '运行时构建：'],
		'SSE TEMPORARIO; volto ao WebSocket sozinho': [
			'SSE TEMPORARILY; I will switch back to WebSocket on my own',
			'SSE TEMPORAL; vuelvo al WebSocket por mi cuenta',
			'临时使用 SSE；稍后会自动切回 WebSocket',
		],
		'Salvar arquivo .aurora para enviar por WhatsApp, AirDrop, e-mail': [
			'Save an .aurora file to send over WhatsApp, AirDrop, email',
			'Guardar un archivo .aurora para enviarlo por WhatsApp, AirDrop o correo',
			'保存 .aurora 文件，以便通过 WhatsApp、AirDrop 或邮件发送',
		],
		Saturação: ['Saturation', 'Saturación', '饱和度'],
		'Script do HTML não encontrado:': [
			'HTML script not found:',
			'No se encontró el script del HTML:',
			'找不到 HTML 的脚本：',
		],
		'Se outra aba estava no comando, ela vai para o modo leitura.': [
			'If another tab was in charge, it switches to read-only mode.',
			'Si otra pestana estaba al mando, pasa a modo lectura.',
			'如果另一个标签页原本在接管，它将切换为只读模式。',
		],
		'Seis temas prontos e um seletor de cor livre — o site inteiro se repinta na hora, inclusive este tutorial.':
			[
				'Six ready-made themes and a free color picker — the whole site repaints instantly, including this tutorial.',
				'Seis temas listos y un selector de color libre: todo el sitio se repinta al instante, incluido este tutorial.',
				'六套现成主题加上自由取色器——整个站点立即重新上色，包括本教程。',
			],
		'Selecione um arquivo no Explorer para editar': [
			'Select a file in the Explorer to edit',
			'Selecciona un archivo en el Explorador para editarlo',
			'在资源管理器中选择要编辑的文件',
		],
		'Sem build web no projeto — exibindo visão geral do app (sem erros).': [
			'No web build in the project — showing an app overview (no errors).',
			'Sin compilación web en el proyecto: se muestra una vista general de la app (sin errores).',
			'项目中没有 Web 构建——显示应用概览（无错误）。',
		],
		'Sem dobras': ['No folds', 'Sin pliegues', '没有可折叠处'],
		'Sem entrada HTML utilizável: compilei só os primeiros': [
			'No usable HTML entry: I compiled only the first',
			'Sin entrada HTML utilizable: compilé solo los primeros',
			'没有可用的 HTML 入口：仅编译了前',
		],
		'Sem histórico': ['No history', 'Sin historial', '没有历史记录'],
		'Sem index.html no projeto: montei uma pagina host para': [
			'No index.html in the project: I built a host page for',
			'Sin index.html en el proyecto: monté una página anfitriona para',
			'项目中没有 index.html：已为其构建宿主页面：',
		],
		'Sem internet: não é possível instalar dependências. Mostrando preview estático/runtime.': [
			'No internet: dependencies cannot be installed. Showing static/runtime preview.',
			'Sin internet: no se pueden instalar dependencias. Mostrando vista previa estática/runtime.',
			'无网络：无法安装依赖。显示静态/运行时预览。',
		],
		'Sem isso, uso o modo Runtime: compilo JSX/TS e resolvo dependências via esm.sh — cobre a maioria dos apps React/Vite sem build.':
			[
				'Without it I use Runtime mode: I compile JSX/TS and resolve dependencies via esm.sh — this covers most React/Vite apps with no build.',
				'Sin eso uso el modo Runtime: compilo JSX/TS y resuelvo dependencias con esm.sh, lo que cubre la mayoría de apps React/Vite sin compilación.',
				'否则我使用运行时模式：编译 JSX/TS 并通过 esm.sh 解析依赖——可覆盖大多数无需构建的 React/Vite 应用。',
			],
		'Sem mensagens neste filtro.': [
			'No messages in this filter.',
			'Sin mensajes en este filtro.',
			'该筛选条件下没有消息。',
		],
		'Sem portao a mesma URL nao tem como atender. Veja o log do MCP.': [
			'Without the gateway that same URL cannot serve. Check the MCP log.',
			'Sin la puerta de enlace esa misma URL no puede atender. Revisa el registro del MCP.',
			'没有网关，同一个网址无法提供服务。请查看 MCP 日志。',
		],
		'Sem projeto': ['No project', 'Sin proyecto', '无项目'],
		'Sem proteção': ['No protection', 'Sin protección', '未启用保护'],
		'Sem túnel:': ['No tunnel:', 'Sin túnel:', '无隧道：'],
		'Sempre de olho': ['Always watching', 'Siempre atento', '时刻在看'],
		'Senha curta': ['Password too short', 'Contraseña demasiado corta', '密码过短'],
		'Senha incorreta': ['Wrong password', 'Contraseña incorrecta', '密码不正确'],
		'Senhas diferentes': [
			'Passwords do not match',
			'Las contraseñas no coinciden',
			'两次密码不一致',
		],
		'Servidor MCP gerenciado (Cloudflare Workers) — nenhuma instalação necessária': [
			'Managed MCP server (Cloudflare Workers) — no installation required',
			'Servidor MCP gestionado (Cloudflare Workers): sin instalación',
			'托管的 MCP 服务器（Cloudflare Workers）——无需安装',
		],
		'Servidor não respondeu a tempo': [
			'Server did not answer in time',
			'El servidor no respondio a tiempo',
			'服务器未在规定时间内响应',
		],
		'Servidor pronto em': ['Server ready at', 'Servidor listo en', '服务器已就绪：'],
		'Serviço local ativo em': [
			'Local service running at',
			'Servicio local activo en',
			'本地服务运行于',
		],
		'Serviço local conectado': [
			'Local service connected',
			'Servicio local conectado',
			'本地服务已连接',
		],
		'Serviço local não encontrado — execute': [
			'Local service not found — run',
			'Servicio local no encontrado: ejecuta',
			'未找到本地服务——请运行',
		],
		'Serviço local sem resposta agora — reconectando automaticamente. A permissão de terminal continua ativa e volta a valer sozinha.':
			[
				'The local service is not responding right now — reconnecting automatically. Terminal permission stays on and comes back by itself.',
				'El servicio local no responde ahora: reconectando automáticamente. El permiso de terminal sigue activo y vuelve por sí solo.',
				'本地服务当前无响应——正在自动重连。终端权限仍然有效，会自行恢复。',
			],
		'Sessao MCP assumida em outro lugar': [
			'MCP session taken over elsewhere',
			'Sesion MCP tomada en otro lugar',
			'MCP 会话已在别处被接管',
		],
		'Sessao NAO foi salva': ['Session was NOT saved', 'La sesion NO se guardo', '会话未保存'],
		'Sessão encontrada, mas não abriu': [
			'Session found, but it did not open',
			'Sesión encontrada, pero no se abrió',
			'找到会话，但未能打开',
		],
		'Sessão limpa': ['Session cleared', 'Sesión borrada', '会话已清空'],
		'Sessão restaurada': ['Session restored', 'Sesión restaurada', '会话已恢复'],
		'Sessão vazia': ['Empty session', 'Sesión vacía', '会话为空'],
		'Seu editor com': ['Your editor with', 'Tu editor con', '你的编辑器，带'],
		'Seu navegador bloqueou a área de transferência': [
			'Your browser blocked the clipboard',
			'Tu navegador bloqueó el portapapeles',
			'你的浏览器阻止了剪贴板访问',
		],
		'Seus arquivos': ['Your files', 'Tus archivos', '你的文件'],
		'Seus projetos agora exigem senha ao abrir': [
			'Your projects now require a password to open',
			'Tus proyectos ahora piden contraseña al abrirse',
			'你的项目现在打开时需要密码',
		],
		'Sincroniza em tempo real': ['Syncs in real time', 'Sincroniza en tiempo real', '实时同步'],
		'Site estático — preview direto, sem build. Entrada:': [
			'Static site — direct preview, no build. Entry:',
			'Sitio estático: vista previa directa, sin compilación. Entrada:',
			'静态站点——直接预览，无需构建。入口：',
		],
		'Solte para importar': ['Drop to import', 'Suelta para importar', '松开即可导入'],
		'Streaming lento — polling TEMPORARIO; volto ao WebSocket sozinho': [
			'Slow streaming — TEMPORARY polling; I will return to WebSocket by myself',
			'Streaming lento: polling TEMPORAL; volveré al WebSocket por mí mismo',
			'流传输缓慢——临时改用轮询；会自行恢复 WebSocket',
		],
		'Substituicao concluida': ['Replacement done', 'Reemplazo completado', '替换完成'],
		'Substituir por…': ['Replace with…', 'Reemplazar con…', '替换为…'],
		'Substituir tudo': ['Replace all', 'Reemplazar todo', '全部替换'],
		'Synapse Relay': ['Synapse Relay', 'Synapse Relay', 'Synapse Relay'],
		'Só editor': ['Editor only', 'Solo editor', '仅编辑器'],
		'Só preview': ['Preview only', 'Solo vista previa', '仅预览'],
		Tablet: ['Tablet', 'Tablet', '平板'],
		'Tela cheia': ['Full screen', 'Pantalla completa', '全屏'],
		'Telefone, tablet, desktop': [
			'Phone, tablet, desktop',
			'Teléfono, tablet, escritorio',
			'手机、平板、桌面',
		],
		Tema: ['Theme', 'Tema', '主题'],
		'Tema e cor de destaque': ['Theme and accent color', 'Tema y color de acento', '主题与强调色'],
		'Tema:': ['Theme:', 'Tema:', '主题：'],
		'Temas e atalhos': ['Themes and shortcuts', 'Temas y atajos', '主题与快捷键'],
		'Temas e cor de destaque': [
			'Themes and accent color',
			'Temas y color de acento',
			'主题与强调色',
		],
		'Tente de novo. (Cancelar mantém os projetos bloqueados.)': [
			'Try again. (Cancel keeps the projects locked.)',
			'Intenta de nuevo. (Cancelar mantiene los proyectos bloqueados.)',
			'请重试。（取消则项目保持锁定。）',
		],
		'Tente novamente': ['Try again', 'Inténtalo de nuevo', '请重试'],
		Terminal: ['Terminal', 'Terminal', '终端'],
		'Terminal desligado - o MCP segue pela nuvem': [
			'Terminal off — MCP keeps running through the cloud',
			'Terminal apagada: el MCP sigue por la nube',
			'终端已关闭——MCP 仍通过云端运行',
		],
		'Terminal integrado': ['Built-in terminal', 'Terminal integrada', '内置终端'],
		'Terminal para o agente': [
			'Terminal for the agent',
			'Terminal para el agente',
			'给智能体的终端',
		],
		'Terminal real': ['Real terminal', 'Terminal real', '真实终端'],
		Testar: ['Test', 'Probar', '测试'],
		'Teste do diagnostico: 6 erros sinteticos': [
			'Diagnostics test: 6 synthetic errors',
			'Prueba del diagnóstico: 6 errores sintéticos',
			'诊断测试：6 个模拟错误',
		],
		'Tirar da equipe': ['Remove from team', 'Quitar del equipo', '移出团队'],
		'Todo trabalho começa neste botão: importe um .zip, uma pasta inteira do computador, um index.html solto — ou carregue um exemplo pronto só para experimentar. Você também pode arrastar arquivos para qualquer canto da tela.':
			[
				'Every job starts with this button: import a .zip, a whole folder from your computer, a ' +
					'loose index.html — or load a ready-made example just to try things out. You can also ' +
					'drag files onto any corner of the screen.',
				'Todo trabajo empieza en este botón: importa un .zip, una carpeta completa del ordenador,' +
					' un index.html suelto o carga un ejemplo listo solo para probar. También puedes ' +
					'arrastrar archivos a cualquier rincón de la pantalla.',
				'所有工作都从这个按钮开始：导入 .zip、整个本地文件夹、单独的 index.html，或直接加载现成示例试用。也可以把文件拖到屏幕的任意位置。',
			],
		'Toolchain detectada:': [
			'Toolchain detected:',
			'Cadena de herramientas detectada:',
			'检测到工具链：',
		],
		'Toque e segure no campo da URL para copiar': [
			'Touch and hold the URL field to copy',
			'Toca y mantén pulsado el campo de la URL para copiar',
			'长按网址字段即可复制',
		],
		'Trabalho em grupo': ['Teamwork', 'Trabajo en grupo', '团队合作'],
		'Traga seu projeto': ['Bring your project', 'Trae tu proyecto', '带入你的项目'],
		'Trava por senha': ['Password lock', 'Bloqueo con contraseña', '密码锁'],
		'Troque o aparelho do preview com um clique, defina uma medida livre ou gire a tela. É a forma mais rápida de checar se o layout aguenta qualquer tamanho.':
			[
				'Switch the preview device with one click, set a free size or rotate the screen. It is the fastest way to check whether the layout survives any size.',
				'Cambia el dispositivo de la vista previa con un clic, define una medida libre o gira la pantalla. Es la forma más rápida de comprobar si el diseño aguanta cualquier tamaño.',
				'一键切换预览设备、自定尺寸或旋转屏幕。这是检验布局能否适应任何尺寸的最快方式。',
			],
		Tudo: ['All', 'Todo', '全部'],
		'Tudo desdobrado': ['All unfolded', 'Todo desplegado', '已全部展开'],
		'Tudo dobrado': ['All folded', 'Todo plegado', '已全部折叠'],
		'Tutorial concluído': ['Tutorial completed', 'Tutorial completado', '教程已完成'],
		'Tutorial do Synapse': ['Synapse tutorial', 'Tutorial de Synapse', 'Synapse 教程'],
		'Tutorial do site': ['Site tutorial', 'Tutorial del sitio', '网站教程'],
		'Tutorial do site (tour guiado)': [
			'Site tutorial (guided tour)',
			'Tutorial del sitio (recorrido guiado)',
			'网站教程（引导浏览）',
		],
		'Túnel ngrok detectado': [
			'ngrok tunnel detected',
			'Tunel ngrok detectado',
			'检测到 ngrok 隧道',
		],
		'URL do relay do site (avançado — deixe como está)': [
			'Site relay URL (advanced — leave as is)',
			'URL del relay del sitio (avanzado: déjalo así)',
			'站点 relay 网址（高级——保持默认即可）',
		],
		'URL do relay inválida': ['Invalid relay URL', 'URL del relay no válida', 'relay 网址无效'],
		'URL do servidor MCP — cole no Notion': [
			'MCP server URL — paste it into Notion',
			'URL del servidor MCP: pégala en Notion',
			'MCP 服务器地址——粘贴到 Notion',
		],
		'URL pública do túnel (cloudflared/ngrok)': [
			'Public tunnel URL (cloudflared/ngrok)',
			'URL pública del túnel (cloudflared/ngrok)',
			'隧道公网地址（cloudflared/ngrok）',
		],
		'URL unica fora do ar': ['Single URL is down', 'La URL única está caída', '唯一网址已不可用'],
		'Um endereço por linha, em ordem de prioridade (publique o': [
			'One address per line, in priority order (publish the',
			'Una dirección por línea, en orden de prioridad (publica el',
			'每行一个地址，按优先级排序（请发布',
		],
		'Um terminal real no SEU computador, através do relay: npm install, build, git, qualquer comando. A saída volta ao vivo para o site — e os agentes de IA usam exatamente o mesmo terminal.':
			[
				'A real terminal on YOUR computer, through the relay: npm install, build, git, any command. The output streams back to the site live — and the AI agents use exactly the same terminal.',
				'Una terminal real en TU ordenador, a través del relay: npm install, build, git, cualquier comando. La salida vuelve en vivo al sitio, y los agentes de IA usan exactamente la misma terminal.',
				'通过 relay 在你自己的电脑上运行真实终端：npm install、build、git，任何命令都行。输出会实时回传到站点——AI 智能体用的也是同一个终端。',
			],
		'Uma ponte do pool reconectando - as outras': [
			'One bridge in the pool is reconnecting — the others',
			'Un puente del grupo está reconectando; los demás',
			'池中一条桥接正在重连——其余的',
		],
		'Usa o servidor MCP do próprio site (Cloudflare Workers). Não precisa instalar nada: ative, copie a URL e cole no Notion. O agente edita os arquivos do projeto, mas':
			[
				"Uses the site's own MCP server (Cloudflare Workers). Nothing to install: turn it on, copy the URL and paste it into Notion. The agent edits the project files, but",
				'Usa el servidor MCP del propio sitio (Cloudflare Workers). No hay que instalar nada: actívalo, copia la URL y pégala en Notion. El agente edita los archivos del proyecto, pero',
				'使用站点自带的 MCP 服务器（Cloudflare Workers）。无需安装：开启后复制网址并粘贴到 Notion。智能体可编辑项目文件，但',
			],
		'Use pelo menos 8 caracteres na senha': [
			'Use at least 8 characters in the password',
			'Usa al menos 8 caracteres en la contraseña',
			'密码至少需要 8 个字符',
		],
		'Use só quando este navegador não alcançar o PC do relay (site aberto em outro aparelho). A URL colada aqui vira o endereço do':
			[
				'Use it only when this browser cannot reach the relay PC (site open on another device). The URL pasted here becomes the address of the',
				'Úsalo solo cuando este navegador no alcance el PC del relay (sitio abierto en otro dispositivo). La URL que pegues aquí pasa a ser la dirección del',
				'仅当此浏览器无法访问 relay 所在的电脑时使用（在其他设备上打开站点）。这里粘贴的网址将作为',
			],
		'Veja na hora': ['See it instantly', 'Míralo al instante', '即时查看'],
		'Ver tutorial': ['View tutorial', 'Ver tutorial', '查看教程'],
		'Verifica se o relay responde': [
			'Checks whether the relay responds',
			'Comprueba si el relay responde',
			'检测 relay 是否响应',
		],
		'Verifique a expressao': ['Check the expression', 'Revisa la expresión', '请检查该表达式'],
		'Versão restaurada': ['Version restored', 'Versión restaurada', '版本已还原'],
		'Voce ainda nao criou nenhuma equipe.': [
			'You have not created any team yet.',
			'Aún no has creado ningún equipo.',
			'你还没有创建任何团队。',
		],
		Voltar: ['Back', 'Volver', '返回'],
		'Voltar para a lista': ['Back to the list', 'Volver a la lista', '返回列表'],
		'Voltou ao primeiro plano - reconectando…': [
			'Back in the foreground — reconnecting…',
			'Volvió al primer plano: reconectando…',
			'已回到前台——正在重连…',
		],
		'Vários agentes ao mesmo tempo, cada um com nome, caixa de mensagens e vez na fila. Eles conversam, dividem tarefas e não pisam no trabalho do outro — a estrutura aguenta 80 em paralelo.':
			[
				"Several agents at once, each with a name, a message box and a turn in the queue. They talk, split tasks and never step on each other's work — the structure handles 80 in parallel.",
				'Varios agentes a la vez, cada uno con nombre, bandeja de mensajes y turno en la cola. Hablan, se reparten tareas y no se pisan el trabajo: la estructura aguanta 80 en paralelo.',
				'可同时运行多个智能体，每个都有名字、消息箱和队列中的顺序。它们互相沟通、分配任务，不会彼此干扰——此结构可支持 80 个并行。',
			],
		'Vários projetos': ['Several projects', 'Varios proyectos', '多个项目'],
		'Watchdog: o preview demorou demais para montar (sem progresso) — exibindo o melhor resultado disponível. Veja os logs acima para o último passo.':
			[
				'Watchdog: the preview took too long to build (no progress) — showing the best result available. Check the logs above for the last step.',
				'Watchdog: la vista previa tardó demasiado en montarse (sin progreso) — se muestra el mejor resultado disponible. Revisa los registros de arriba para ver el último paso.',
				'看护程序：预览构建耗时过长（无进展）——显示当前可用的最佳结果。上方日志可查看最后一步。',
			],
		'WebContainers indisponível:': [
			'WebContainers unavailable:',
			'WebContainers no disponible:',
			'WebContainers 不可用：',
		],
		'WebContainers:': ['WebContainers:', 'WebContainers:', 'WebContainers：'],
		'WebSocket voltou a responder - recuperando o transporte rapido': [
			'WebSocket is responding again — restoring the fast transport',
			'El WebSocket volvió a responder: recuperando el transporte rápido',
			'WebSocket 恢复响应——正在恢复快速传输',
		],
		'[agente] >': ['[agent] >', '[agente] >', '[智能体] >'],
		'a URL entregue ao Notion é sempre a da nuvem (mesma capacidade do modo nuvem); o Synapse Relay acrescenta terminal, disco e dev server.':
			[
				'the URL given to Notion is always the cloud one (same capacity as cloud mode); Synapse Relay adds terminal, disk and dev server.',
				'la URL entregada a Notion es siempre la de la nube (misma capacidad que el modo nube); Synapse Relay añade terminal, disco y servidor de desarrollo.',
				'交给 Notion 的网址始终是云端的（容量与云端模式相同）；Synapse Relay 只是额外提供终端、磁盘与开发服务器。',
			],
		'aba do site desconectada': [
			'site tab disconnected',
			'pestaña del sitio desconectada',
			'站点标签页已断开',
		],
		'aba do site lenta': ['site tab too slow', 'pestaña del sitio lenta', '站点标签页响应过慢'],
		'arquivo nao era UTF-8, lido como latin1:': [
			'the file was not UTF-8, read as latin1:',
			'el archivo no era UTF-8, leído como latin1:',
			'文件不是 UTF-8，已按 latin1 读取：',
		],
		'arquivo(s)': ['file(s)', 'archivo(s)', '个文件'],
		'arquivo(s) do editor': ['file(s) from the editor', 'archivo(s) del editor', '个编辑器文件'],
		'arquivo(s) em uso nao foram atualizados no disco:': [
			'file(s) in use were not updated on disk:',
			'archivo(s) en uso no se actualizaron en el disco:',
			'正在使用的文件未在磁盘上更新：',
		],
		'arquivo(s) ignorado(s) por segurança (caminho inválido ou limite)': [
			'file(s) ignored for safety (invalid path or limit)',
			'archivo(s) ignorado(s) por seguridad (ruta no válida o límite)',
			'为安全起见已忽略的文件（路径无效或超限）',
		],
		'arquivo(s) removido(s)': ['file(s) removed', 'archivo(s) eliminado(s)', '个文件已删除'],
		'arquivo(s).': ['file(s).', 'archivo(s).', '个文件。'],
		'arquivo(s)?': ['file(s)?', 'archivo(s)?', '个文件？'],
		'arquivos): nao iniciei npm/WebContainers automaticamente - o preview do modo Runtime aparece na hora.':
			[
				'files): I did not start npm/WebContainers automatically — the Runtime-mode preview shows up right away.',
				'archivos): no inicié npm/WebContainers automáticamente; la vista previa del modo Runtime aparece al instante.',
				'个文件）：未自动启动 npm/WebContainers——运行时模式的预览会立即出现。',
			],
		'as equipes podem altera-lo (README, changelog, docs). Quem define e o agente da equipe': [
			"teams may change it (README, changelog, docs). The team's agent decides",
			'los equipos pueden cambiarlo (README, changelog, docs). Lo decide el agente del equipo',
			'团队可以修改它（README、changelog、文档）。由团队的智能体决定',
		],
		'asset(s)': ['asset(s)', 'recurso(s)', '个素材'],
		'assumiu automaticamente.': [
			'took over automatically.',
			'asumió automáticamente.',
			'已自动接管。',
		],
		ausente: ['missing', 'ausente', '缺失'],
		'aviso:': ['warning:', 'aviso:', '警告：'],
		'bloco(s)': ['block(s)', 'bloque(s)', '个块'],
		'borda ou rede': ['edge or network', 'borde o red', '边缘或网络'],
		'build pronto do projeto (o HTML da raiz aponta para um bundle que so existe depois de compilar). Edicoes em src/ so aparecem apos rodar o build; tire a pasta dist/ do zip para compilar do zero aqui.':
			[
				'prebuilt project (the root HTML points to a bundle that only exists after compiling). ' +
					'Edits in src/ only show up after running the build; remove the dist/ folder from the ' +
					'zip to compile from scratch here.',
				'build ya compilado del proyecto (el HTML de la raiz apunta a un bundle que solo existe ' +
					'tras compilar). Las ediciones en src/ solo aparecen tras ejecutar el build; quita la ' +
					'carpeta dist/ del zip para compilar desde cero aqui.',
				'项目的预编译产物（根目录 HTML 指向只有编译后才存在的 bundle）。src/ 中的修改只有运行构建后才会生效；把 dist/ 目录从 zip 中移除即可在此从零编译。',
			],
		'causa indefinida': ['undetermined cause', 'causa indefinida', '原因不明'],
		'causa principal: ': ['main cause: ', 'causa principal: ', '主要原因：'],
		'conectado (': ['connected (', 'conectado (', '已连接（'],
		'conectado (modo compativel)': [
			'connected (compatibility mode)',
			'conectado (modo compatible)',
			'已连接（兼容模式）',
		],
		'conta Cloudflare separada e grátis': [
			'a separate, free Cloudflare account',
			'una cuenta de Cloudflare aparte y gratuita',
			'单独的免费 Cloudflare 账号',
		],
		'convite exibido': ['invitation shown', 'invitación mostrada', '已显示邀请'],
		'cota do dia': ['daily quota', 'cuota del día', '每日配额'],
		'cota do dia: ': ['daily quota: ', 'cuota del día: ', '每日配额：'],
		'cota do minuto': ['per-minute quota', 'cuota del minuto', '每分钟配额'],
		'cota do minuto: ': ['per-minute quota: ', 'cuota del minuto: ', '每分钟配额：'],
		'crossOriginIsolated continua false — confira os headers e abra a URL direto numa aba': [
			'crossOriginIsolated is still false — check the headers and open the URL directly in a tab',
			'crossOriginIsolated sigue en false: revisa los encabezados y abre la URL directamente en una pestaña',
			'crossOriginIsolated 仍为 false——请检查响应头并在标签页中直接打开该网址',
		],
		desativado: ['disabled', 'desactivado', '已停用'],
		desconhecido: ['unknown', 'desconocido', '未知'],
		'do pnpm/yarn).': ['from pnpm/yarn).', 'de pnpm/yarn).', '（来自 pnpm/yarn）。'],
		'e NADA foi apagado no site. Exemplos:': [
			'and NOTHING was deleted on the site. Examples:',
			'y NADA se borro en el sitio. Ejemplos:',
			'并且站点上没有删除任何内容。示例：',
		],
		'e caracteres especiais': ['and special characters', 'y caracteres especiales', '以及特殊字符'],
		'e declarei': ['and I declared', 'y declaré', '并声明了'],
		'em outras contas). Enquanto o nó principal': [
			'in other accounts). While the main node',
			'en otras cuentas). Mientras el nodo principal',
			'（在其他账号下）。只要主节点',
		],
		'encerrou com código': ['exited with code', 'terminó con código', '退出，代码：'],
		'enquanto o agente trabalha.': [
			'while the agent works.',
			'mientras el agente trabaja.',
			'在智能体工作时。',
		],
		'entre na equipe "nome" e se registre': [
			'join the team "name" and register',
			'únete al equipo "nombre" y regístrate',
			'加入名为“name”的团队并注册',
		],
		'erro de MCP em ': ['MCP error in ', 'error de MCP en ', 'MCP 错误，工具 '],
		'erro interno do site': ['internal site error', 'error interno del sitio', '站点内部错误'],
		'eventos: ': ['events: ', 'eventos: ', '事件：'],
		'exclusao(oes) vindas do disco recusadas': [
			'deletion(s) coming from the disk were refused',
			'exclusión(es) provenientes del disco rechazadas',
			'来自磁盘的删除请求已被拒绝',
		],
		'exporte o projeto antes de fechar a aba.': [
			'export the project before closing the tab.',
			'exporta el proyecto antes de cerrar la pestana.',
			'请在关闭标签页前导出项目。',
		],
		'falha de rede': ['network failure', 'fallo de red', '网络故障'],
		'ferramenta desconhecida': ['unknown tool', 'herramienta desconocida', '未知工具'],
		'fila do no cheia': ['node queue full', 'cola del nodo llena', '节点队列已满'],
		'fila do no: ': ['node queue: ', 'cola del nodo: ', '节点队列：'],
		'glb, png, mp4… na raiz do projeto': [
			'glb, png, mp4… at the project root',
			'glb, png, mp4… en la raíz del proyecto',
			'glb、png、mp4… 位于项目根目录',
		],
		'gravacao NAO persistida': ['write NOT persisted', 'escritura NO persistida', '写入未持久化'],
		'habilita terminal, disco e dev server': [
			'enables terminal, disk and dev server',
			'habilita terminal, disco y servidor de desarrollo',
			'启用终端、磁盘与开发服务器',
		],
		'idioma: ': ['language: ', 'idioma: ', '语言：'],
		'importado —': ['imported —', 'importado —', '已导入 —'],
		'inclusive quando o nó principal é bloqueado na borda': [
			'including when the main node is blocked at the edge',
			'incluso cuando el nodo principal está bloqueado en el borde',
			'包括主节点在边缘被封锁时',
		],
		'index.html avulso': ['standalone index.html', 'index.html suelto', '单独的 index.html'],
		'lado da URL (limite)': ['URL side (limit)', 'lado de la URL (límite)', '网址侧（限额）'],
		'lado do site': ['site side', 'lado del sitio', '站点侧'],
		'limite do minuto atingido': [
			'per-minute limit reached',
			'límite del minuto alcanzado',
			'已达到每分钟限额',
		],
		'linha(s) copiada(s)': ['line(s) copied', 'línea(s) copiada(s)', '行已复制'],
		'mostrando o preview em modo Runtime.': [
			'showing the preview in Runtime mode.',
			'mostrando la vista previa en modo Runtime.',
			'预览改用 Runtime 模式显示。',
		],
		'mostrando o preview em modo Runtime. Veja o console para o log dos comandos.': [
			'showing the preview in Runtime mode. Check the console for the command log.',
			'mostrando la vista previa en modo Runtime. Mira la consola para el registro de comandos.',
			'预览改用 Runtime 模式显示。命令日志请查看控制台。',
		],
		'módulo(s)': ['module(s)', 'módulo(s)', '个模块'],
		'módulos (evita travar a página).': [
			'modules (avoids freezing the page).',
			'módulos (evita bloquear la página).',
			'个模块（避免页面卡死）。',
		],
		'na área de transferência — vale por 10 min nesta aba': [
			'in the clipboard — valid for 10 min in this tab',
			'en el portapapeles: vale por 10 min en esta pestaña',
			'已复制到剪贴板——在此标签页中 10 分钟内有效',
		],
		'nao existe - usei': ['does not exist — I used', 'no existe: usé', '不存在——已使用'],
		'nao existe no projeto - usei': [
			'does not exist in the project - I used',
			'no existe en el proyecto - use',
			'在项目中不存在——已改用',
		],
		'nao foi possivel carregar a biblioteca de conexao (sem internet?)': [
			'could not load the connection library (no internet?)',
			'no se pudo cargar la biblioteca de conexion (sin internet?)',
			'无法加载连接库（没有网络？）',
		],
		'nativa - gerenciador': ['native — manager', 'nativa: gestor', '原生——管理者'],
		'nativa - planejador': ['native — planner', 'nativa: planificador', '原生——规划者'],
		'nativa - revisor': ['native — reviewer', 'nativa: revisor', '原生——审阅者'],
		'no canto do preview.': [
			'in the preview corner.',
			'en la esquina de la vista previa.',
			'在预览区的角落。',
		],
		'no limite de capacidade': ['at capacity', 'en el límite de capacidad', '已达容量上限'],
		'no lugar.': ['instead.', 'en su lugar.', '作为替代。'],
		'no package.json raiz (o npm não entende o protocolo': [
			'in the root package.json (npm does not understand the protocol',
			'en el package.json raíz (npm no entiende el protocolo',
			'在根 package.json 中（npm 无法识别该协议',
		],
		'no(s) - capacidade para 80+ agentes': [
			'node(s) — capacity for 80+ agents',
			'nodo(s): capacidad para más de 80 agentes',
			'个节点——可支持 80+ 智能体',
		],
		'no(s) de reserva registrados no no principal — failover automatico pronto, URL unica.': [
			'backup node(s) registered on the main node — automatic failover ready, single URL.',
			'nodo(s) de reserva registrados en el nodo principal: failover automático listo, URL única.',
			'个备用节点已在主节点注册——自动故障转移就绪，单一网址。',
		],
		'não roda comandos': ['does not run commands', 'no ejecuta comandos', '不执行命令'],
		'o endereco local virou complemento (terminal e disco).': [
			'the local address became a complement (terminal and disk).',
			'la direccion local paso a ser complemento (terminal y disco).',
			'本地地址已转为补充通道（终端与磁盘）。',
		],
		'o script "': ['the script "', 'el script "', '脚本 "'],
		'ocorrencia(s) em': ['match(es) in', 'coincidencia(s) en', '处匹配，位于'],
		'para as ferramentas de visão.': [
			'for the vision tools.',
			'para las herramientas de vision.',
			'供视觉工具使用。',
		],
		'pendentes na aba: ': ['pending in the tab: ', 'pendientes en la pestaña: ', '标签页待处理：'],
		'pode incluir subpastas (ex.: assets/imagens).': [
			'may include subfolders (e.g. assets/images).',
			'puede incluir subcarpetas (ej.: assets/imagenes).',
			'可以包含子文件夹（例如 assets/images）。',
		],
		'ponte propria para react/jsx-runtime': [
			'built-in bridge for react/jsx-runtime',
			'puente propio para react/jsx-runtime',
			'内置的 react/jsx-runtime 桥接',
		],
		'pontes paralelas em': ['parallel bridges on', 'puentes paralelos en', '条并行桥接，位于'],
		'preview ao vivo': ['live preview', 'vista previa en vivo', '实时预览'],
		'projeto(s) não abriram — clique no relógio (Recentes) para recuperar': [
			'project(s) did not open — click the clock (Recent) to recover',
			'proyecto(s) no se abrieron: haz clic en el reloj (Recientes) para recuperar',
			'个项目未能打开——点击时钟（最近）进行恢复',
		],
		'projeto(s) reaberto(s)': [
			'project(s) reopened',
			'proyecto(s) reabierto(s)',
			'个项目已重新打开',
		],
		'pronto: recarregue a pagina para ver o convite de primeira vez': [
			'done: reload the page to see the first-time invitation',
			'listo: recarga la página para ver la invitación de primera vez',
			'完成：重新加载页面即可看到首次邀请',
		],
		'protecao de projeto:': ['project protection:', 'protección de proyecto:', '项目保护：'],
		'protocolo do MCP': ['MCP protocol', 'protocolo del MCP', 'MCP 协议'],
		'rajadas: ': ['bursts: ', 'ráfagas: ', '密集次数：'],
		'reconectando automaticamente; o MCP segue operando pela nuvem.': [
			'reconnecting automatically; MCP keeps working through the cloud.',
			'reconectando automaticamente; el MCP sigue operando por la nube.',
			'正在自动重连；MCP 继续通过云端运行。',
		],
		'recusadas por fila: ': ['refused by queue: ', 'rechazadas por cola: ', '因队列被拒：'],
		'relay lotado': ['relay full', 'relay saturado', 'relay 已满载'],
		'relay lotado (': ['relay full (', 'relay saturado (', 'relay 已满（'],
		'relay.js baixado': ['relay.js downloaded', 'relay.js descargado', 'relay.js 已下载'],
		's, mas o terminal agora conta o tempo fora da aba - segue rodando sem a tela aberta': [
			's, but the terminal now counts time outside the tab — it keeps running without the screen open',
			's, pero la terminal ahora cuenta el tiempo fuera de la pestaña: sigue ejecutando sin la pantalla abierta',
			'秒，但终端现在会计入离开标签页的时间——即使未打开页面也会继续运行',
		],
		'saiu com código': ['exited with code', 'salió con código', '退出，代码：'],
		'sao do site e nao podem ser apagadas (uma vaga cada). O Planejador nao altera arquivos: ele planeja o sistema e entrega um prompt por equipe para voce rodar em paralelo. Para um agente entrar, peca a ele:':
			[
				'belong to the site and cannot be deleted (one slot each). The Planner does not change ' +
					'files: it plans the system and hands over one prompt per team for you to run in ' +
					'parallel. For an agent to join, ask it to:',
				'son del sitio y no se pueden borrar (una plaza cada una). El Planificador no altera ' +
					'archivos: planifica el sistema y entrega un prompt por equipo para que lo ejecutes en ' +
					'paralelo. Para que un agente entre, pidele:',
				'属于本站点，无法删除（各占一个席位）。规划器不会修改文件：它规划系统，并为每个团队输出一段提示词，供你并行运行。要让某个代理加入，请让它：',
			],
		'seguem atendendo, sem interrupcao': [
			'keep serving, with no interruption',
			'siguen atendiendo, sin interrupción',
			'继续提供服务，不中断',
		],
		'sem batimento ha 45s — reconectando': [
			'no heartbeat for 45s — reconnecting',
			'sin latido durante 45 s: reconectando',
			'已 45 秒无心跳——正在重连',
		],
		'sem instalação · ideal para celular': [
			'no install · ideal for mobile',
			'sin instalación · ideal para móvil',
			'无需安装 · 适合手机',
		],
		'sem resposta': ['no response', 'sin respuesta', '无响应'],
		'terminal e disco disponíveis.': [
			'terminal and disk available.',
			'terminal y disco disponibles.',
			'终端与磁盘可用。',
		],
		'terminal · disco · dev server': [
			'terminal · disk · dev server',
			'terminal · disco · servidor de desarrollo',
			'终端 · 磁盘 · 开发服务器',
		],
		'tour encerrado': ['tour ended', 'recorrido finalizado', '教程已结束'],
		'tour iniciado': ['tour started', 'recorrido iniciado', '教程已开始'],
		'usando o modo compatível (polling), que passa pela página de aviso do ngrok': [
			'using compatible mode (polling), which goes through the ngrok warning page',
			'usando el modo compatible (polling), que pasa por la pagina de aviso de ngrok',
			'改用兼容模式（轮询），会经过 ngrok 的警告页',
		],
		'usando o relay do proprio aparelho:': [
			"using this device's own relay:",
			'usando el relay del propio dispositivo:',
			'正在使用本机自带的 relay：',
		],
		'worker(s) em paralelo': ['worker(s) in parallel', 'worker(s) en paralelo', '个并行 worker'],
		'· 3) marque a permissão abaixo.': [
			'· 3) tick the permission below.',
			'· 3) marca el permiso de abajo.',
			'· 3）勾选下方的权限。',
		],
		'— Execução automática de comandos —': [
			'— Automatic command execution —',
			'— Ejecución automática de comandos —',
			'—— 自动执行命令 ——',
		],
		'— confira o vercel.json na raiz do deploy e abra a URL numa aba propria': [
			'— check vercel.json at the deployment root and open the URL in its own tab',
			'— revisa el vercel.json en la raíz del despliegue y abre la URL en su propia pestaña',
			'—— 请检查部署根目录的 vercel.json，并在单独标签页中打开该网址',
		],
		'— fim (codigo': ['— end (code', '— fin (código', '—— 结束（代码'],
		'— interrompido': ['— interrupted', '— interrumpido', '—— 已中断'],
		'— o PORTAO esta desviando para o no de reserva': [
			'— the GATEWAY is diverting to the backup node',
			'— la PUERTA está desviando al nodo de reserva',
			'—— 网关正在分流到备用节点',
		],
		'— usando modo Runtime.': [
			'— using Runtime mode.',
			'— usando el modo Runtime.',
			'—— 使用运行时模式。',
		],
		'→ Build nativo (npm) precisa de um runtime Node. Veja “Executar build” abaixo.': [
			'→ A native build (npm) needs a Node runtime. See “Run build” below.',
			'→ La compilación nativa (npm) necesita un runtime de Node. Mira “Ejecutar compilación” abajo.',
			'→ 原生构建（npm）需要 Node 运行时。请看下方的“执行构建”。',
		],
		'→ cole a URL acima (o token já vai embutido nela). Depois habilite o conector no seu agente.':
			[
				'→ paste the URL above (the token is already embedded). Then enable the connector in your agent.',
				'→ pega la URL de arriba (el token ya viene incluido). Luego habilita el conector en tu agente.',
				'→ 粘贴上面的网址（令牌已内含）。然后在你的智能体中启用该连接器。',
			],
		'→ depois reimporte o .zip incluindo a pasta build/web.': [
			'→ then re-import the .zip including the build/web folder.',
			'→ luego reimporta el .zip incluyendo la carpeta build/web.',
			'→ 然后重新导入包含 build/web 文件夹的 .zip。',
		],
		'⇅ Projeto sincronizado para o dev server (hot-reload)': [
			'⇅ Project synced to the dev server (hot reload)',
			'⇅ Proyecto sincronizado con el servidor de desarrollo (hot reload)',
			'⇅ 项目已同步到开发服务器（热重载）',
		],
		'■ Dev server encerrado.': [
			'■ Dev server stopped.',
			'■ Servidor de desarrollo detenido.',
			'■ 开发服务器已停止。',
		],
		'▶  Rodar servidor real (npm)': [
			'▶  Run real server (npm)',
			'▶  Ejecutar servidor real (npm)',
			'▶  运行真实服务器（npm）',
		],
		'▶ Dev server conectado (porta': [
			'▶ Dev server connected (port',
			'▶ Servidor de desarrollo conectado (puerto',
			'▶ 开发服务器已连接（端口',
		],
		'⚙ Montando preview headless…': [
			'⚙ Building headless preview…',
			'⚙ Montando la vista previa headless…',
			'⚙ 正在构建无头预览…',
		],
		'⚙ Montando preview…': [
			'⚙ Building preview…',
			'⚙ Montando la vista previa…',
			'⚙ 正在构建预览…',
		],
		'\ud83c\udf10 Site publicado:': [
			'\ud83c\udf10 Site published:',
			'\ud83c\udf10 Sitio publicado:',
			'\ud83c\udf10 站点已发布：',
		],
		'\ud83d\udc41 Preview headless ativo (': [
			'\ud83d\udc41 Headless preview active (',
			'\ud83d\udc41 Vista previa headless activa (',
			'\ud83d\udc41 无头预览已启用（',
		],
		'\ud83d\udce6 Exportado': [
			'\ud83d\udce6 Exported',
			'\ud83d\udce6 Exportado',
			'\ud83d\udce6 已导出',
		],
	};

	const IGNORAR = [
		'+added+',
		'+alt+',
		'+base+',
		'+dest+',
		'+destDir+',
		'+dir+',
		'+entry+',
		'+fname+',
		'+ignored+',
		'+kind:',
		'+ms+',
		'+name+',
		'+newDir+',
		'+newPath+',
		'+nomeNo(on.url)+',
		'+note):',
		'+path+',
		'+recusados.slice(0,4).join(',
		'+se+',
		'+srcDir+',
		'+synth.entrySource+',
		'+vph+',
		'+(COMPL.ver||',
		'+(ignored?(',
		'+(note?(',
		'+(on.i+1)+',
		'+(urlEmergencia()||',
		')+(recusados.length>4?',
		')+(scoped?',
		')+(usedBabel?',
		').split(',
		'<div class=',
		'<div>',
		'<span class=',
		'<span id=',
		'<svg class=',
		'<svg width=',
		'body.mcp-movel label[for=',
		'window.__LP_SRC__=',
		'window.__lpVP=',
		'COOP=',
		'· COEP=',
		'Aa',
		'HJHJ88STO',
		'#termOut',
		'Synapse',
		'index.html',
		'portao.js',
		'node relay.js',
		'npx wrangler deploy -c wrangler-portao.toml',
		'mesmo worker.js',
		'no wrangler.toml.',
		'npm',
		'git',
		'node',
		'agent',
		'team_global_add',
		'team_global_remove',
		'err',
		'error',
		'esc',
		'function',
		'div',
		'dot',
		'cmd',
		'sys',
		'warn',
		'ok',
		'out',
		'run',
		'de',
		'para',
		'local',
		'preview',
		'raiz',
		'roda',
		'todas',
		'arquivos',
		'complemento',
		'use strict',
		'(prefers-reduced-motion: reduce)',
		'0 0 24 24',
		'tour-b primary',
		'ti-b primary',
		'.tour-prog i',
		'opacity .45s',
		'opacity .3s, transform .3s',
		'https://esm.sh/',
		'http://localhost:8787',
		'quando,lado,motivo,codigo,http,ferramenta,mensagem',
		'diag',
		'mcp',
		'999+',
		'MCP <span id=',
		'Gera o .zip do projeto no browser e dispara o download. Funciona sem terminal e sem relay.',
		'Remove o deploy estatico do relay.',
		'Acesse enquanto o relay rodar. Use undeploy_static para encerrar.',
		'). Preview voltou ao normal.',
		'Dev server terminou (codigo ',
		') por falta de espaco',
		'" nao esta mais disponivel.',
		'Não consegui montar o preview headless de "',
		'" (projeto vazio ou sem HTML de entrada). Use refresh_preview, confira os arquivos ou ative o projeto na tela.',
		'Preview headless indisponível para "',
		'". Tente de novo ou ative o projeto na tela.',
	];

	const EXTRA = {
		'Importar arquivo(s) para a raiz do projeto': [
			'Import file(s) into the project root',
			'Importar archivo(s) a la raíz del proyecto',
			'将文件导入项目根目录',
		],
		'Importar arquivos para a raiz': [
			'Import files into the root',
			'Importar archivos a la raíz',
			'将文件导入根目录',
		],
		'Novo arquivo (o nome se digita no proprio Explorer)': [
			'New file (type the name in the Explorer)',
			'Nuevo archivo (el nombre se escribe en el Explorador)',
			'新建文件（在资源管理器中输入名称）',
		],
		'Nova pasta (o nome se digita no proprio Explorer)': [
			'New folder (type the name in the Explorer)',
			'Nueva carpeta (el nombre se escribe en el Explorador)',
			'新建文件夹（在资源管理器中输入名称）',
		],
		'Projeto: renomear, criar novo, arquivos globais, memoria': [
			'Project: rename, create new, global files, memory',
			'Proyecto: renombrar, crear nuevo, archivos globales, memoria',
			'项目：重命名、新建、全局文件、内存',
		],
		'Novo arquivo': ['New file', 'Nuevo archivo', '新建文件'],
		'Nova pasta': ['New folder', 'Nueva carpeta', '新建文件夹'],
		'Novo projeto vazio': ['New empty project', 'Nuevo proyecto vacío', '新建空项目'],
		'MCP para Notion — deixe um agente de IA editar este projeto': [
			'MCP for Notion — let an AI agent edit this project',
			'MCP para Notion — deja que un agente de IA edite este proyecto',
			'Notion MCP — 让 AI 代理编辑此项目',
		],
		'MCP para Notion (conectar agente de IA)': [
			'MCP for Notion (connect AI agent)',
			'MCP para Notion (conectar agente de IA)',
			'Notion MCP（连接 AI 代理）',
		],
		'Transfere o projeto aberto para outro aparelho byte a byte, direto de navegador para navegador. Nada e gravado em servidor.':
			[
				'Transfers the open project to another device byte by byte, straight from browser to browser. Nothing is stored on a server.',
				'Transfiere el proyecto abierto a otro dispositivo byte a byte, directo de navegador a navegador. Nada se guarda en un servidor.',
				'将打开的项目逐字节传输到另一台设备，浏览器直连浏览器。服务器不保存任何内容。',
			],
		'A conexao e ponto a ponto (WebRTC). O codigo so serve para os dois aparelhos se encontrarem — quem souber o codigo enquanto ele estiver publicado consegue baixar o projeto, entao prefira codigos longos. Em redes moveis muito restritas a conexao direta pode falhar; nesse caso use o arquivo .aurora.':
			[
				'The connection is peer-to-peer (WebRTC). The code only helps the two devices find each ' +
					'other — anyone who knows the code while it is published can download the project, so ' +
					'prefer long codes. On very restricted mobile networks the direct connection may fail; ' +
					'in that case use the .aurora file.',
				'La conexión es punto a punto (WebRTC). El código solo sirve para que los dos ' +
					'dispositivos se encuentren — quien sepa el código mientras esté publicado puede ' +
					'descargar el proyecto, así que prefiere códigos largos. En redes móviles muy ' +
					'restringidas la conexión directa puede fallar; en ese caso usa el archivo .aurora.',
				'连接是点对点的（WebRTC）。代码只用于让两台设备互相找到——在代码发布期间，任何知道代码的人都能下载项目，因此建议使用较长的代码。在限制严格的移动网络中直连可能失败；这种情况下请使用 .aurora 文件。',
			],
		'O outro aparelho precisa estar com o codigo publicado e a aba aberta.': [
			'The other device must have the code published and the tab open.',
			'El otro dispositivo debe tener el código publicado y la pestaña abierta.',
			'另一台设备必须已发布代码并保持标签页打开。',
		],
		'Digite um codigo e clique em Publicar. Mantenha esta aba aberta.': [
			'Type a code and click Publish. Keep this tab open.',
			'Escribe un código y haz clic en Publicar. Mantén esta pestaña abierta.',
			'输入代码并点击“发布”。请保持此标签页打开。',
		],
		'Codigo recebido do outro aparelho': [
			'Code received from the other device',
			'Código recibido del otro dispositivo',
			'从另一台设备收到的代码',
		],
		'Codigo secreto desta aba': [
			'Secret code for this tab',
			'Código secreto de esta pestaña',
			'此标签页的密钥',
		],
		'Enviar deste aparelho': [
			'Send from this device',
			'Enviar desde este dispositivo',
			'从此设备发送',
		],
		'Baixar com codigo': ['Download with code', 'Descargar con código', '使用代码下载'],
		'Publicar projeto': ['Publish project', 'Publicar proyecto', '发布项目'],
		'Salvar .aurora': ['Save .aurora', 'Guardar .aurora', '保存 .aurora'],
		'Abrir .aurora': ['Open .aurora', 'Abrir .aurora', '打开 .aurora'],
		'Baixar projeto': ['Download project', 'Descargar proyecto', '下载项目'],
		'Codigo gerado. Clique em Publicar e passe': [
			'Code generated. Click Publish and share it',
			'Código generado. Haz clic en Publicar y pásalo',
			'代码已生成。点击“发布”并把它交给',
		],
		'para o outro aparelho.': ['with the other device.', 'al otro dispositivo.', '另一台设备。'],
		'Nao consegui copiar automaticamente. Selecione e copie:': [
			'Could not copy automatically. Select and copy:',
			'No se pudo copiar automáticamente. Selecciona y copia:',
			'无法自动复制。请手动选择并复制：',
		],
		'. Digite esse codigo no outro aparelho. Mantenha esta aba aberta.': [
			'. Type this code on the other device. Keep this tab open.',
			'. Escribe este código en el otro dispositivo. Mantén esta pestaña abierta.',
			'。在另一台设备上输入此代码。请保持此标签页打开。',
		],
		'espelhado com sucesso (': ['mirrored successfully (', 'reflejado con éxito (', '镜像成功（'],
		'Sessão salva no navegador': [
			'Session saved in the browser',
			'Sesión guardada en el navegador',
			'会话已保存在浏览器中',
		],
		'Backups automáticos da sessão': [
			'Automatic session backups',
			'Copias de seguridad automáticas de la sesión',
			'会话自动备份',
		],
		'Cópias da sessão inteira passam a ser guardadas automaticamente: a cada ~5 minutos de uso e sempre que algo tentar sobrescrever uma sessão que tinha projetos.':
			[
				'Copies of the whole session are now kept automatically: every ~5 minutes of use and whenever something tries to overwrite a session that had projects.',
				'Las copias de la sesión completa se guardan automáticamente: cada ~5 minutos de uso y siempre que algo intente sobrescribir una sesión que tenía proyectos.',
				'整个会话的副本将自动保存：每使用约 5 分钟一次，以及每当有操作试图覆盖含有项目的会话时。',
			],
		'Projetos que você fechar a partir de agora ficam guardados aqui por segurança (últimos': [
			'Projects you close from now on are kept here for safety (last',
			'Los proyectos que cierres desde ahora se guardan aquí por seguridad (últimos',
			'从现在起你关闭的项目会安全保存在这里（最近',
		],
		') e voltam com 1 clique.': [
			') and come back with 1 click.',
			') y vuelven con 1 clic.',
			'个），一键即可恢复。',
		],
		'Dica: para uma cópia fora do navegador use Exportar .zip. Os backups acima moram no armazenamento do navegador — se ele for limpo, eles também vão embora.':
			[
				'Tip: for a copy outside the browser use Export .zip. The backups above live in browser storage — if it is cleared, they go away too.',
				'Consejo: para una copia fuera del navegador usa Exportar .zip. Las copias de arriba viven en el almacenamiento del navegador — si se borra, también desaparecen.',
				'提示：如需浏览器之外的副本，请使用“导出 .zip”。上面的备份保存在浏览器存储中——一旦清除，它们也会消失。',
			],
		'Projetos recentes e backups': [
			'Recent projects and backups',
			'Proyectos recientes y copias de seguridad',
			'最近的项目与备份',
		],
		'Projetos recentes e backups (recuperar projetos fechados)': [
			'Recent projects and backups (recover closed projects)',
			'Proyectos recientes y copias (recuperar proyectos cerrados)',
			'最近的项目与备份（恢复已关闭的项目）',
		],
		'Liberar memoria agora': ['Free memory now', 'Liberar memoria ahora', '立即释放内存'],
		'PC fraco: corta historico, minimapa e previews em segundo plano': [
			'Low-end PC: trims history, minimap and background previews',
			'PC modesto: recorta historial, minimapa y vistas previas en segundo plano',
			'低配电脑：精简历史记录、缩略图和后台预览',
		],
		'Use a busca do Explorer para filtrar.': [
			'Use the Explorer search to filter.',
			'Usa la búsqueda del Explorador para filtrar.',
			'使用资源管理器搜索进行筛选。',
		],
		'linhas para nao travar PCs fracos).': [
			'lines so low-end PCs do not freeze).',
			'líneas para no trabar PCs modestos).',
			'行，以避免低配电脑卡顿）。',
		],
		'Tentar gravar agora': ['Try saving now', 'Intentar guardar ahora', '立即尝试保存'],
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
		'▶ Rodar servidor real (npm)': [
			'▶ Run real server (npm)',
			'▶ Ejecutar servidor real (npm)',
			'▶ 运行真实服务器 (npm)',
		],
		'Importar index.html avulso': [
			'Import a standalone index.html',
			'Importar un index.html suelto',
			'导入独立的 index.html',
		],
		'Buscar arquivo / conteúdo': [
			'Find file / content',
			'Buscar archivo / contenido',
			'查找文件/内容',
		],
		'Abrir preview em nova aba': [
			'Open preview in a new tab',
			'Abrir vista previa en una pestaña nueva',
			'在新标签页中打开预览',
		],
		'Layout: Editor + Preview': [
			'Layout: Editor + Preview',
			'Diseño: Editor + Vista previa',
			'布局：编辑器 + 预览',
		],
		'Layout: Só preview': ['Layout: Preview only', 'Diseño: Solo vista previa', '布局：仅预览'],
		'Layout: Só editor': ['Layout: Editor only', 'Diseño: Solo editor', '布局：仅编辑器'],
		'Mostrar/ocultar Explorer': [
			'Show/hide Explorer',
			'Mostrar/ocultar Explorador',
			'显示/隐藏资源管理器',
		],
		'Exportar projeto (.zip)': [
			'Export project (.zip)',
			'Exportar proyecto (.zip)',
			'导出项目 (.zip)',
		],
		'Fechar projeto atual': ['Close current project', 'Cerrar proyecto actual', '关闭当前项目'],
		'Limpar console': ['Clear console', 'Limpiar consola', '清空控制台'],
		'Abrir console': ['Open console', 'Abrir consola', '打开控制台'],
		'Alternar tema': ['Toggle theme', 'Cambiar tema', '切换主题'],
		'Bloquear agora': ['Lock now', 'Bloquear ahora', '立即锁定'],
		'Remover senha': ['Remove password', 'Quitar contraseña', '移除密码'],
		'Proteção por senha (bloquear / proteger projetos)': [
			'Password protection (lock / protect projects)',
			'Protección por contraseña (bloquear / proteger proyectos)',
			'密码保护（锁定/保护项目）',
		],
		'Limpar sessão salva (remove todos os projetos)': [
			'Clear saved session (removes all projects)',
			'Borrar sesión guardada (elimina todos los proyectos)',
			'清除已保存的会话（移除所有项目）',
		],
		'Nenhum comando encontrado': ['No commands found', 'No se encontraron comandos', '未找到命令'],
		'Tudo que não está aberto': [
			'Everything not open',
			'Todo lo que no está abierto',
			'所有未打开的内容',
		],
		'Sem resultados.': ['No results.', 'Sin resultados.', '没有结果。'],
		'Codigo formatado': ['Code formatted', 'Código formateado', '代码已格式化'],
		'Edite os arquivos à esquerda — isto atualiza na hora.': [
			'Edit the files on the left — this updates instantly.',
			'Edita los archivos de la izquierda — esto se actualiza al instante.',
			'编辑左侧的文件——这里会即时更新。',
		],
		'🔒 Sessão protegida por senha': [
			'🔒 Session protected by password',
			'🔒 Sesión protegida por contraseña',
			'🔒 会话已受密码保护',
		],
		'🕘 Projetos recentes e backups': [
			'🕘 Recent projects and backups',
			'🕘 Proyectos recientes y copias',
			'🕘 最近的项目与备份',
		],
		'Importe um .zip, pasta ou index.html.': [
			'Import a .zip, a folder or an index.html.',
			'Importa un .zip, una carpeta o un index.html.',
			'导入 .zip、文件夹或 index.html。',
		],
		'Nenhum projeto aberto.': ['No project open.', 'Ningún proyecto abierto.', '没有打开的项目。'],
		'Importar → pasta': ['Import → folder', 'Importar → carpeta', '导入 → 文件夹'],
		'Sem versões anteriores': ['No previous versions', 'Sin versiones anteriores', '没有历史版本'],
		'Nenhuma chamada ainda': ['No calls yet', 'Ninguna llamada aún', '暂无调用'],
		'Apagar equipe': ['Delete team', 'Eliminar equipo', '删除团队'],
		'Primeira vez por aqui?': ['First time here?', '¿Primera vez por aquí?', '第一次来这里？'],
		'Faça o tour guiado e conheça o site inteiro em pouco mais de um minuto.': [
			'Take the guided tour and see the whole site in just over a minute.',
			'Haz el tour guiado y conoce todo el sitio en poco más de un minuto.',
			'跟随引导教程，一分多钟了解整个网站。',
		],
		'Iniciar tutorial': ['Start tutorial', 'Iniciar tutorial', '开始教程'],
		Ignorar: ['Dismiss', 'Ignorar', '忽略'],
		'Tutorial do Synapse': ['Synapse tutorial', 'Tutorial de Synapse', 'Synapse 教程'],
		Avançar: ['Next', 'Siguiente', '下一步'],
		Voltar: ['Back', 'Atrás', '上一步'],
		Terminar: ['Finish', 'Terminar', '完成'],
		'Pular tutorial': ['Skip tutorial', 'Saltar tutorial', '跳过教程'],
		'Repita quando quiser no botão ? da barra de cima': [
			'Replay it any time from the ? button in the top bar',
			'Repítelo cuando quieras con el botón ? de la barra superior',
			'随时可通过顶部栏的 ? 按钮重看',
		],
		'Serviço local não encontrado — execute "node relay.js" na máquina de trabalho e clique em Testar. O MCP continua operando pela nuvem.':
			[
				'Local service not found — run "node relay.js" on the work machine and click Test. MCP keeps running through the cloud.',
				'Servicio local no encontrado — ejecuta "node relay.js" en la máquina de trabajo y haz clic en Probar. El MCP sigue funcionando por la nube.',
				'未找到本地服务——请在工作电脑上运行 "node relay.js" 并点击“测试”。MCP 仍通过云端运行。',
			],
		'Modo local (nuvem + complemento).': [
			'Local mode (cloud + add-on).',
			'Modo local (nube + complemento).',
			'本地模式（云端 + 附加组件）。',
		],
		'Mantenha esta aba aberta enquanto o agente trabalha.': [
			'Keep this tab open while the agent works.',
			'Mantén esta pestaña abierta mientras el agente trabaja.',
			'代理工作期间请保持此标签页打开。',
		],
		', copie a URL e cole no conector MCP do Notion. Não precisa de túnel nem de terminal.': [
			", copy the URL and paste it into Notion's MCP connector. No tunnel and no terminal needed.",
			', copia la URL y pégala en el conector MCP de Notion. No necesitas túnel ni terminal.',
			'，复制该 URL 并粘贴到 Notion 的 MCP 连接器中。无需隧道，也无需终端。',
		],
		'A conexão com o Notion é a mesma do modo nuvem - mesma URL, mesma capacidade. O': [
			'The connection to Notion is the same as cloud mode - same URL, same capacity. The',
			'La conexión con Notion es la misma del modo nube - misma URL, misma capacidad. El',
			'与 Notion 的连接和云端模式相同——同一个 URL，同样的容量。',
		],
		'complemento local': ['local add-on', 'complemento local', '本地附加组件'],
		'entra apenas como': ['only comes in as', 'solo entra como', '仅作为'],
		': é ele que dá terminal, disco e dev server.': [
			': it is what provides terminal, disk and dev server.',
			': es el que da terminal, disco y dev server.',
			'：它提供终端、磁盘和开发服务器。',
		],
		'· 3) marque a permissão do terminal. Sem túnel: a URL que vai para o Notion é sempre a da nuvem.':
			[
				'· 3) tick the terminal permission. No tunnel: the URL that goes to Notion is always the cloud one.',
				'· 3) marca el permiso del terminal. Sin túnel: la URL que va a Notion es siempre la de la nube.',
				'· 3) 勾选终端权限。无隧道：发送给 Notion 的始终是云端 URL。',
			],
		'Não precisa de túnel.': ['No tunnel needed.', 'No necesita túnel.', '无需隧道。'],
		'A conexao ja vem configurada: toque em': [
			'The connection comes ready: tap',
			'La conexión ya viene configurada: toca',
			'连接已配置好：点击',
		],
		'Depois é só clicar em': ['Then just click', 'Después solo haz clic en', '然后只需点击'],
		'Fila deste no cheia (128/128)': [
			"This node's queue is full (128/128)",
			'La cola de este nodo está llena (128/128)',
			'此节点的队列已满 (128/128)',
		],
		'A aba do site nao respondeu em 25000ms': [
			'The site tab did not respond within 25000ms',
			'La pestaña del sitio no respondió en 25000ms',
			'网站标签页在 25000 毫秒内没有响应',
		],
		'⚠️ Failover ativo: o no principal esta no limite de capacidade —': [
			'⚠️ Failover active: the main node is at its capacity limit —',
			'⚠️ Failover activo: el nodo principal está en el límite de capacidad —',
			'⚠️ 故障转移已启用：主节点已达容量上限——',
		],
		'pela mesma URL (encaminhador interno do no, que segue rodando). Nenhuma acao e necessaria.': [
			"through the same URL (the node's internal forwarder, still running). No action is needed.",
			'por la misma URL (reenviador interno del nodo, que sigue funcionando). No se necesita ninguna acción.',
			'通过同一个 URL（节点的内部转发器仍在运行）。无需任何操作。',
		],
		'pela mesma URL (verificado no portao). Nenhuma acao e necessaria.': [
			'through the same URL (checked at the gateway). No action is needed.',
			'por la misma URL (verificado en la puerta). No se necesita ninguna acción.',
			'通过同一个 URL（已在网关验证）。无需任何操作。',
		],
		'No principal indisponivel (provavel bloqueio de borda) — SEM portao, a URL unica do conector esta FORA DO AR.':
			[
				"Main node unavailable (likely edge blocking) — WITHOUT a gateway, the connector's single URL is DOWN.",
				'Nodo principal no disponible (probable bloqueo de borde) — SIN puerta, la URL única del conector está CAÍDA.',
				'主节点不可用（可能是边缘封锁）——若没有网关，连接器的唯一 URL 将无法访问。',
			],
		'O encaminhador interno mora no proprio no bloqueado e nao chega a rodar. A sessao esta preservada no no de reserva':
			[
				'The internal forwarder lives on the blocked node itself and never runs. The session is preserved on the standby node',
				'El reenviador interno vive en el propio nodo bloqueado y no llega a ejecutarse. La sesión se conserva en el nodo de reserva',
				'内部转发器位于被封锁的节点上，因此无法运行。会话已保留在备用节点上',
			],
		'Emergencia agora:': ['Emergency right now:', 'Emergencia ahora:', '紧急处理：'],
		'no menu MCP para failover automatico.': [
			'in the MCP menu for automatic failover.',
			'en el menú MCP para failover automático.',
			'在 MCP 菜单中启用自动故障转移。',
		],
		'portao esta desviando para': [
			'gateway is diverting to',
			'la puerta está desviando a',
			'网关正在转向',
		],
		'Sem portao: o failover em URL unica cobre limite de capacidade, mas NAO cobre bloqueio de borda do no principal (a URL cai junto). Publique o portao numa conta separada (wrangler-portao.toml) e cole a URL acima.':
			[
				'Without a gateway: single-URL failover covers capacity limits but does NOT cover edge ' +
					'blocking of the main node (the URL goes down with it). Publish the gateway on a ' +
					'separate account (wrangler-portao.toml) and paste the URL above.',
				'Sin puerta: el failover de URL única cubre el límite de capacidad, pero NO cubre el ' +
					'bloqueo de borde del nodo principal (la URL cae con él). Publica la puerta en una ' +
					'cuenta aparte (wrangler-portao.toml) y pega la URL arriba.',
				'无网关：单一 URL 故障转移可应对容量上限，但无法应对主节点的边缘封锁（URL 会一起失效）。请在独立账户中部署网关（wrangler-portao.toml），并将 URL 粘贴到上方。',
			],
		'tag HTML aberta': ['unclosed HTML tag', 'etiqueta HTML abierta', '未闭合的 HTML 标签'],
		': o Synapse compila JSX/TS aqui mesmo e resolve as dependências via esm.sh. Isso cobre a maioria dos apps React/Vite sem servidor nenhum.':
			[
				': Synapse compiles JSX/TS right here and resolves dependencies via esm.sh. That covers most React/Vite apps with no server at all.',
				': Synapse compila JSX/TS aquí mismo y resuelve las dependencias vía esm.sh. Eso cubre la mayoría de las apps React/Vite sin ningún servidor.',
				'：Synapse 就在这里编译 JSX/TS，并通过 esm.sh 解析依赖。这可以覆盖大多数 React/Vite 应用，完全不需要服务器。',
			],
		'já roda a maioria dos apps React/Vite compilando JSX/TS e puxando as dependências de esm.sh.':
			[
				'already runs most React/Vite apps by compiling JSX/TS and pulling dependencies from esm.sh.',
				'ya ejecuta la mayoría de las apps React/Vite compilando JSX/TS y trayendo las dependencias de esm.sh.',
				'已能运行大多数 React/Vite 应用：编译 JSX/TS 并从 esm.sh 拉取依赖。',
			],
		'não roda scripts de build (Tailwind CLI, geradores, SSR). Se o seu app depende disso, gere o':
			[
				'does not run build scripts (Tailwind CLI, generators, SSR). If your app depends on that, generate the',
				'no ejecuta scripts de build (Tailwind CLI, generadores, SSR). Si tu app depende de eso, genera el',
				'不会运行构建脚本（Tailwind CLI、生成器、SSR）。如果你的应用依赖这些，请先生成',
			],
		'Rode o build no seu terminal e importe a pasta de saída (ex.:': [
			'Run the build in your terminal and import the output folder (e.g.:',
			'Ejecuta el build en tu terminal e importa la carpeta de salida (ej.:',
			'在终端中运行构建，然后导入输出文件夹（例如：',
		],
		'Depois de gerar a pasta de saída, arraste-a aqui ou use': [
			'After generating the output folder, drag it here or use',
			'Después de generar la carpeta de salida, arrástrala aquí o usa',
			'生成输出文件夹后，将其拖到这里或使用',
		],
		'no computador e importe a pasta pronta.': [
			'on the computer and import the finished folder.',
			'en la computadora e importa la carpeta lista.',
			'在电脑上完成，然后导入生成好的文件夹。',
		],
		'Chrome, Edge ou Firefox de um computador': [
			'Chrome, Edge or Firefox on a computer',
			'Chrome, Edge o Firefox de una computadora',
			'电脑上的 Chrome、Edge 或 Firefox',
		],
		'Use exatamente o conteúdo do bloco abaixo (botão': [
			'Use exactly the contents of the block below (button',
			'Usa exactamente el contenido del bloque de abajo (botón',
			'请完全使用下方代码块的内容（按钮',
		],
		'e os headers indentados com 2 espaços.': [
			'and the headers indented with 2 spaces.',
			'y los headers indentados con 2 espacios.',
			'并将 headers 缩进 2 个空格。',
		],
		'Refaça o deploy, abra a URL': [
			'Deploy again, open the URL',
			'Vuelve a hacer el deploy, abre la URL',
			'重新部署，打开该 URL',
		],
		'no console — precisa retornar': [
			'in the console — it must return',
			'en la consola — debe retornar',
			'在控制台中——必须返回',
		],
		'dentro da pasta publicada': [
			'inside the published folder',
			'dentro de la carpeta publicada',
			'在已发布的文件夹内',
		],
		'Se o isolamento não ligar, troque': [
			'If isolation does not turn on, switch',
			'Si el aislamiento no se activa, cambia',
			'如果隔离没有启用，请更换',
		],
		'(mais rígido: recursos externos precisam mandar CORP/CORS).': [
			'(stricter: external resources must send CORP/CORS).',
			'(más estricto: los recursos externos deben enviar CORP/CORS).',
			'（更严格：外部资源必须发送 CORP/CORS）。',
		],
		'Conecte-se à internet e clique em': [
			'Connect to the internet and click',
			'Conéctate a internet y haz clic en',
			'请连接互联网并点击',
		],
		'— não precisa reimportar o projeto.': [
			'— no need to re-import the project.',
			'— no hace falta reimportar el proyecto.',
			'——无需重新导入项目。',
		],
		', em uma aba própria — nunca dentro de iframe/embed.': [
			', in its own tab — never inside an iframe/embed.',
			', en su propia pestaña — nunca dentro de un iframe/embed.',
			'，在独立标签页中——绝不要放在 iframe/embed 内。',
		],
		'Sem servidor nenhum: o': [
			'With no server at all: the',
			'Sin ningún servidor: el',
			'完全不需要服务器：',
		],
		', ou na raiz da pasta que você arrasta). Dentro de': [
			', or at the root of the folder you drag). Inside',
			', o en la raíz de la carpeta que arrastras). Dentro de',
			'，或你拖入的文件夹根目录）。在',
		],
		'Escolha qual projeto baixar. O .zip é gerado com o estado atual dos arquivos — todas as edições feitas aqui vão junto.':
			[
				'Choose which project to download. The .zip is generated with the current state of the files — every edit made here goes with it.',
				'Elige qué proyecto descargar. El .zip se genera con el estado actual de los archivos — todas las ediciones hechas aquí van incluidas.',
				'选择要下载的项目。.zip 会按文件的当前状态生成——在这里做的所有修改都会包含在内。',
			],
		'O link fica válido enquanto esta aba estiver aberta (por até 10 minutos) e só funciona neste navegador. Se salvar com nome genérico, renomeie para':
			[
				'The link stays valid while this tab is open (for up to 10 minutes) and only works in this browser. If it saves with a generic name, rename it to',
				'El enlace es válido mientras esta pestaña esté abierta (hasta 10 minutos) y solo funciona en este navegador. Si se guarda con un nombre genérico, renómbralo a',
				'该链接在此标签页打开期间有效（最多 10 分钟），且仅在此浏览器中可用。如果保存为通用名称，请将其重命名为',
			],
		'O navegador recusou iniciar o download automático. Use o link abaixo para baixar': [
			'The browser refused to start the automatic download. Use the link below to download',
			'El navegador se negó a iniciar la descarga automática. Usa el enlace de abajo para descargar',
			'浏览器拒绝自动开始下载。请使用下面的链接下载',
		],
		'Download iniciado': ['Download started', 'Descarga iniciada', '下载已开始'],
		'Exportação pronta': ['Export ready', 'Exportación lista', '导出已完成'],
		'Ver o app rodando aqui': [
			'See the app running here',
			'Ver la app funcionando aquí',
			'在这里查看运行中的应用',
		],
		'sem dependências extras': [
			'with no extra dependencies',
			'sin dependencias extra',
			'无需额外依赖',
		],
		'Dependências (pubspec.yaml)': [
			'Dependencies (pubspec.yaml)',
			'Dependencias (pubspec.yaml)',
			'依赖项 (pubspec.yaml)',
		],
		'✓ Projeto Flutter reconhecido — sem erros': [
			'✓ Flutter project recognised — no errors',
			'✓ Proyecto Flutter reconocido — sin errores',
			'✓ 已识别 Flutter 项目——无错误',
		],
		'Dart compila fora do navegador. Gere o build web e reimporte o projeto (com a pasta': [
			'Dart compiles outside the browser. Generate the web build and re-import the project (with the folder',
			'Dart compila fuera del navegador. Genera el build web y reimporta el proyecto (con la carpeta',
			'Dart 在浏览器之外编译。请生成 web 构建并重新导入项目（连同文件夹',
		],
		'Depois é só importar o .zip aqui de novo.': [
			'Then just import the .zip here again.',
			'Después solo importa el .zip aquí de nuevo.',
			'然后只需在这里重新导入 .zip。',
		],
		'e mais': ['and', 'y', '以及'],
		'O formato FBX é proprietário e exigiria uma biblioteca pesada para ler aqui dentro. Converta o modelo para':
			[
				'The FBX format is proprietary and would need a heavy library to read in here. Convert the model to',
				'El formato FBX es propietario y requeriría una biblioteca pesada para leerlo aquí dentro. Convierte el modelo a',
				'FBX 是专有格式，在这里读取需要庞大的库。请将模型转换为',
			],
		'para ver o preview 3D.': [
			'to see the 3D preview.',
			'para ver la vista previa 3D.',
			'以查看 3D 预览。',
		],
		'Dica: no Blender use Arquivo → Exportar → glTF 2.0 (.glb).': [
			'Tip: in Blender use File → Export → glTF 2.0 (.glb).',
			'Consejo: en Blender usa Archivo → Exportar → glTF 2.0 (.glb).',
			'提示：在 Blender 中选择 文件 → 导出 → glTF 2.0 (.glb)。',
		],
		'Preview de FBX não disponível offline': [
			'FBX preview not available offline',
			'Vista previa de FBX no disponible sin conexión',
			'离线状态下无法预览 FBX',
		],
		'Não foi possível exibir esta imagem': [
			'This image could not be displayed',
			'No se pudo mostrar esta imagen',
			'无法显示此图片',
		],
		'Não foi possível abrir o modelo 3D': [
			'The 3D model could not be opened',
			'No se pudo abrir el modelo 3D',
			'无法打开该 3D 模型',
		],
		'Não foi possível mostrar o preview': [
			'The preview could not be shown',
			'No se pudo mostrar la vista previa',
			'无法显示预览',
		],
		'WebGL indisponível': ['WebGL unavailable', 'WebGL no disponible', 'WebGL 不可用'],
		'Nenhuma equipe elegivel agora. Crie equipes, abra o projeto delas ou desmarque "so equipes do projeto aberto".':
			[
				'No eligible team right now. Create teams, open their project, or uncheck "only teams of the open project".',
				'Ningún equipo elegible ahora. Crea equipos, abre su proyecto o desmarca "solo equipos del proyecto abierto".',
				'目前没有符合条件的团队。请创建团队、打开其项目，或取消勾选“仅打开项目的团队”。',
			],
		'So equipes do projeto aberto': [
			'Only teams of the open project',
			'Solo equipos del proyecto abierto',
			'仅打开项目的团队',
		],
		'Nenhum projeto aberto. Abra o projeto para escolher os arquivos da equipe.': [
			"No project open. Open the project to choose the team's files.",
			'Ningún proyecto abierto. Abre el proyecto para elegir los archivos del equipo.',
			'没有打开的项目。请先打开项目以选择团队的文件。',
		],
		'Nenhum caminho ainda - o agente desta equipe nao consegue alterar nada.': [
			"No path yet - this team's agent cannot change anything.",
			'Ningún camino todavía - el agente de este equipo no puede cambiar nada.',
			'尚无路径——该团队的代理无法修改任何内容。',
		],
		'Este projeto ainda nao tem arquivos.': [
			'This project has no files yet.',
			'Este proyecto aún no tiene archivos.',
			'该项目还没有文件。',
		],
		'Nenhum agente entrou ainda.': [
			'No agent has joined yet.',
			'Ningún agente ha entrado todavía.',
			'还没有代理加入。',
		],
		'Essa equipe nao existe mais.': [
			'That team no longer exists.',
			'Ese equipo ya no existe.',
			'该团队已不存在。',
		],
		'Esta equipe nativa nao depende de lista de arquivos.': [
			'This native team does not depend on a file list.',
			'Este equipo nativo no depende de una lista de archivos.',
			'该原生团队不依赖文件列表。',
		],
		'Arquivos e pastas que esta equipe podera ALTERAR': [
			'Files and folders this team will be able to CHANGE',
			'Archivos y carpetas que este equipo podrá MODIFICAR',
			'该团队将可以修改的文件和文件夹',
		],
		'Permitir que o agente saia desta equipe': [
			'Allow the agent to leave this team',
			'Permitir que el agente salga de este equipo',
			'允许代理离开该团队',
		],
		'Desligado, quem entra fica ate voce liberar. Isso evita agente pulando de equipe no meio da tarefa.':
			[
				'When off, whoever joins stays until you release them. This stops agents from hopping between teams mid-task.',
				'Apagado, quien entra se queda hasta que lo liberes. Esto evita que un agente salte de equipo a mitad de la tarea.',
				'关闭时，加入的成员会一直留在团队，直到你允许离开。这可避免代理在任务中途换团队。',
			],
		'Marcar uma pasta cobre tudo que esta dentro dela, inclusive arquivos criados depois.': [
			'Marking a folder covers everything inside it, including files created later.',
			'Marcar una carpeta cubre todo lo que está dentro, incluidos los archivos creados después.',
			'勾选文件夹会涵盖其中的所有内容，包括之后创建的文件。',
		],
		'Caminho que ja e de outra equipe aparece travado: um arquivo so pode ter um dono.': [
			'A path that already belongs to another team shows as locked: a file can have only one owner.',
			'Un camino que ya es de otro equipo aparece bloqueado: un archivo solo puede tener un dueño.',
			'已归属其他团队的路径会显示为锁定：一个文件只能有一个归属方。',
		],
		'Tudo aqui vale na hora: nao existe botao de salvar.': [
			'Everything here applies instantly: there is no save button.',
			'Todo aquí se aplica al instante: no hay botón de guardar.',
			'这里的一切立即生效：没有保存按钮。',
		],
		'Incluir as equipes nativas (Gerenciador e Integrador Revisor)': [
			'Include the native teams (Manager and Reviewer Integrator)',
			'Incluir los equipos nativos (Gestor e Integrador Revisor)',
			'包含原生团队（管理者与集成审核者）',
		],
		'Quantos agentes por equipe': [
			'How many agents per team',
			'Cuántos agentes por equipo',
			'每个团队的代理数量',
		],
		'Prefixo do nome do agente': [
			'Agent name prefix',
			'Prefijo del nombre del agente',
			'代理名称前缀',
		],
		'Renomear quem chegar com nome ja usado (agente-fisica-2)': [
			'Rename anyone arriving with a name already in use (agent-physics-2)',
			'Renombrar a quien llegue con un nombre ya usado (agente-fisica-2)',
			'为使用了已占用名称的新成员重命名（agente-fisica-2）',
		],
		'Para um agente entrar, peca a ele:': [
			'For an agent to join, ask it to:',
			'Para que un agente entre, pídele:',
			'要让代理加入，请要求它：',
		],
		'A tela de equipes falhou ao desenhar:': [
			'The teams screen failed to render:',
			'La pantalla de equipos falló al dibujar:',
			'团队界面渲染失败：',
		],
		'O site completa TODAS as equipes ate esse numero antes de repetir. Depois que todas batem o alvo, ele continua pela equipe mais vazia: passar do alvo nesse ponto e o esperado, nao e erro.':
			[
				'The site fills ALL teams up to this number before repeating. Once they all hit the target, it continues with the emptiest team: going past the target at that point is expected, not an error.',
				'El sitio completa TODOS los equipos hasta ese número antes de repetir. Cuando todos ' +
					'alcanzan el objetivo, continúa por el equipo más vacío: pasar del objetivo en ese punto ' +
					'es lo esperado, no un error.',
				'网站会先把所有团队都补足到该数量，然后才重复分配。当所有团队都达到目标后，会继续分配给人数最少的团队：此时超出目标是正常现象，不是错误。',
			],
		'Equipe nativa: um agente so. Ele pode alterar QUALQUER arquivo para consertar incompatibilidades entre as equipes.':
			[
				'Native team: a single agent. It can change ANY file to fix incompatibilities between teams.',
				'Equipo nativo: un solo agente. Puede modificar CUALQUIER archivo para arreglar incompatibilidades entre equipos.',
				'原生团队：仅一个代理。它可以修改任何文件，以解决团队之间的不兼容问题。',
			],
		'Equipe nativa: o agente daqui administra suas equipes pelo MCP e mexe em arquivos sem dono. Preencher e opcional.':
			[
				'Native team: this agent manages your teams through MCP and touches unowned files. Filling it in is optional.',
				'Equipo nativo: el agente de aquí administra tus equipos por MCP y toca archivos sin dueño. Rellenarlo es opcional.',
				'原生团队：此处的代理通过 MCP 管理你的团队，并可修改无归属的文件。填写为可选项。',
			],
		'sao do site e nao podem ser apagadas (uma vaga cada).': [
			'belong to the site and cannot be deleted (one slot each).',
			'son del sitio y no pueden ser eliminadas (una vacante cada una).',
			'属于网站，无法删除（各有一个名额）。',
		],
		'sem dono - qualquer equipe pode alterar': [
			'unowned - any team can change it',
			'sin dueño - cualquier equipo puede modificar',
			'无归属——任何团队都可以修改',
		],
		'as equipes podem altera-lo (README, changelog, docs).': [
			'the teams can change it (README, changelog, docs).',
			'los equipos pueden modificarlo (README, changelog, docs).',
			'各团队都可以修改它（README、changelog、文档）。',
		],
		'caminhos. Use o filtro acima para achar o resto.': [
			'paths. Use the filter above to find the rest.',
			'caminos. Usa el filtro de arriba para encontrar el resto.',
			'条路径。请使用上方的筛选器查找其余内容。',
		],
		'Quem define e o agente da equipe': [
			"This is set by the team's agent",
			'Quien lo define es el agente del equipo',
			'由团队的代理来设定',
		],
		'Proximo a se alistar vai para': [
			'Next to enlist goes to',
			'El próximo en alistarse va a',
			'下一个加入的将分配到',
		],
		'e o site ja o encaixa em uma equipe, com nome novo.': [
			'and the site slots it into a team, with a new name.',
			'y el sitio ya lo encaja en un equipo, con nombre nuevo.',
			'网站会自动将其安排到某个团队，并赋予新名称。',
		],
		'; o segundo agente da mesma equipe recebe': [
			'; the second agent of the same team gets',
			'; el segundo agente del mismo equipo recibe',
			'；同一团队的第二个代理会得到',
		],
		'Arquivos ocupados (': ['Busy files (', 'Archivos ocupados (', '占用中的文件（'],
		'Agentes nesta equipe (': [
			'Agents in this team (',
			'Agentes en este equipo (',
			'该团队中的代理（',
		],
		'Arquivos que esta equipe pode alterar (': [
			'Files this team can change (',
			'Archivos que este equipo puede modificar (',
			'该团队可以修改的文件（',
		],
		aparência: ['appearance', 'apariencia', '外观'],
		integração: ['integration', 'integración', '集成'],
		segurança: ['security', 'seguridad', '安全'],
		sessão: ['session', 'sesión', '会话'],
		'recuperar recentes backup restaurar': [
			'recover recent backup restore',
			'recuperar recientes copia restaurar',
			'恢复 最近 备份 还原',
		],
		'Projetos que você fechar a partir de agora ficam guardados aqui por segurança (últimos 4) e voltam com 1 clique.':
			[
				'Projects you close from now on are kept here for safety (last 4) and come back with 1 click.',
				'Los proyectos que cierres desde ahora se guardan aquí por seguridad (últimos 4) y vuelven con 1 clic.',
				'从现在起你关闭的项目会安全保存在这里（最近 4 个），1 次点击即可恢复。',
			],
		'Aguardando...': ['Waiting...', 'Esperando...', '等待中…'],
		'Saída do programa': ['Program output', 'Salida del programa', '程序输出'],
		'Digite e pressione Enter': ['Type and press Enter', 'Escribe y pulsa Enter', '输入后按回车'],
		'Programa encerrado': ['Program finished', 'Programa finalizado', '程序已结束'],
		código: ['code', 'código', '退出码'],
		'Saída antiga removida para não travar o navegador.': [
			'Older output removed to keep the browser responsive.',
			'Salida antigua eliminada para no bloquear el navegador.',
			'已移除较早的输出，以免浏览器卡顿。',
		],
		Rodando: ['Running', 'Ejecutando', '运行中'],
		'quadros/s': ['fps', 'fps', '帧/秒'],
		'Clique no preview para o teclado e o mouse funcionarem.': [
			'Click the preview to enable keyboard and mouse.',
			'Haz clic en la vista previa para activar el teclado y el ratón.',
			'点击预览以启用键盘和鼠标。',
		],
		'O programa parou de desenhar.': [
			'The program stopped drawing.',
			'El programa dejó de dibujar.',
			'程序已停止绘制。',
		],
		'Iniciando módulo...': ['Starting module...', 'Iniciando módulo...', '正在启动模块…'],
		'Falhou ao iniciar': ['Failed to start', 'Fallo al iniciar', '启动失败'],
		'Ambiente incompativel': ['Unsupported environment', 'Entorno incompatible', '环境不兼容'],
		'Nao executavel no navegador': [
			'Cannot run in the browser',
			'No se puede ejecutar en el navegador',
			'无法在浏览器中运行',
		],
		'Precisa de build web ou Relay': [
			'Needs a web build or Relay',
			'Necesita un build web o Relay',
			'需要 web 构建或 Relay',
		],
		'Preview nativo': ['Native preview', 'Vista previa nativa', '原生预览'],
		'Toolchain nao configurado': [
			'Toolchain not configured',
			'Toolchain no configurado',
			'工具链未配置',
		],
		'Sem adaptador de compilacao': [
			'No compiler adapter',
			'Sin adaptador de compilación',
			'无编译适配器',
		],
		'Preparando o compilador...': [
			'Preparing the compiler...',
			'Preparando el compilador...',
			'正在准备编译器…',
		],
		'Compilando...': ['Compiling...', 'Compilando...', '正在编译…'],
		'Falha na compilacao': ['Build failed', 'Fallo de compilación', '编译失败'],
		'Binario invalido': ['Invalid binary', 'Binario no válido', '二进制文件无效'],
		'Executando...': ['Running...', 'Ejecutando...', '正在运行…'],
		Cancelado: ['Canceled', 'Cancelado', '已取消'],
		'Erro de compilacao': ['Compile error', 'Error de compilación', '编译错误'],
		Falhou: ['Failed', 'Falló', '失败'],
	};
	const EXTRA_IGNORAR = [
		'Rosé',
		'Synapse',
		'Synapse • Live Preview',
		'✨ Synapse Live Preview',
		'__NAME__ • Preview',
		'Aurora',
		'Notion',
		'MCP',
		'WebRTC',
		'Flutter',
		'Dart',
		'npm',
		'esm.sh',
		'index.html',
		'relay.js',
		'worker.js',
		'React/Vite',
		'Tailwind CLI',
		'https://aurora-relay.seu-nome.workers.dev',
		'pubspec.yaml',
		'wrangler-portao.toml',
	];

	for (let _ek in EXTRA) if (!(_ek in D)) D[_ek] = EXTRA[_ek];
	for (let _ei = 0; _ei < EXTRA_IGNORAR.length; _ei++) IGNORAR.push(EXTRA_IGNORAR[_ei]);

	const IDIOMAS = [
		{ c: 'pt', n: 'Português', b: 'PT' },
		{ c: 'en', n: 'English', b: 'EN' },
		{ c: 'es', n: 'Español', b: 'ES' },
		{ c: 'zh', n: '中文', b: 'ZH' },
	];
	const IDX = { en: 0, es: 1, zh: 2 };
	const K = 'aurora.idioma';

	const SKIP =
		'#codeTa,#codeHl,#editorScroll,#gutter,#minimap,#miniMap,#tree,#histPre,#frList,#langMenu,[data-i18n="off"]';
	const ATRS = [
		'title',
		'placeholder',
		'aria-label',
		'data-tip',
		'alt',
		'data-label',
		'data-titulo',
		'aria-placeholder',
	];

	function detectar() {
		try {
			let l = (navigator.languages && navigator.languages[0]) || navigator.language || '';
			l = String(l).toLowerCase();
			if (l.indexOf('pt') === 0) return 'pt';
			if (l.indexOf('es') === 0) return 'es';
			if (l.indexOf('zh') === 0) return 'zh';
		} catch (e) {
			ignorarErro(e, 'detectar');
		}
		return 'en';
	}
	function ler() {
		try {
			const v = localStorage.getItem(K);
			if (v === 'pt' || IDX[v] !== undefined) return v;
		} catch (e) {
			ignorarErro(e, 'ler');
		}
		return detectar();
	}
	let atual = ler();

	let memo = Object.create(null),
		nmemo = 0;
	const perdidos = Object.create(null),
		IGN = Object.create(null);
	for (let q = 0; q < IGNORAR.length; q++) IGN[IGNORAR[q]] = 1;
	const origT = new WeakMap(),
		origA = new WeakMap();
	const ouvintes = [];

	let RE_ENV, RE_LETRA;
	try {
		RE_ENV = new RegExp('^([^\\p{L}\\p{N}]*)([\\s\\S]*?)([^\\p{L}\\p{N}]*)$', 'u');
		RE_LETRA = new RegExp('\\p{L}', 'u');
	} catch (e) {
		RE_ENV =
			/^([^0-9A-Za-z\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff\u4e00-\u9fff]*)([\s\S]*?)([^0-9A-Za-z\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff\u4e00-\u9fff]*)$/;
		RE_LETRA = /[A-Za-z\u00c0-\u024f\u4e00-\u9fff]/;
	}
	const RE_NUM = /\d+(?:[.,]\d+)*/g;
	const RE_SEG = /([.!?\u2026]\s+|:\s+|;\s+|\n+|\s[\u00b7\u2014\u2013\u2022]\s)/;

	function limpar(s) {
		return s
			.replace(/\u00a0/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
	function semAcento(s) {
		try {
			return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
		} catch (e) {
			return s;
		}
	}
	function chave(s) {
		return semAcento(limpar(s))
			.toLowerCase()
			.replace(/[.:;!?\u2026]+$/, '');
	}

	let NORM = null,
		NUMS = null;
	function indexar() {
		if (NORM) return;
		NORM = Object.create(null);
		NUMS = Object.create(null);
		for (let k in D) {
			const n = chave(k);
			if (n && NORM[n] === undefined) NORM[n] = k;
			if (/\d/.test(k)) {
				const t = n.replace(RE_NUM, '\u0001');
				if (NUMS[t] === undefined) NUMS[t] = k;
			}
		}
	}

	function ajustar(src, out) {
		const ms = /[.:;!?\u2026]+$/.exec(src),
			mo = /[.:;!?\u2026]+$/.exec(out);
		if (ms && !mo) return out + ms[0];
		if (!ms && mo) return out.replace(/[.:;!?\u2026]+$/, '');
		return out;
	}

	function bruto(s, i) {
		let e = D[s];
		if (e && e[i]) return e[i];
		const c = limpar(s);
		if (c !== s) {
			e = D[c];
			if (e && e[i]) return e[i];
		}
		if (!c) return null;
		indexar();
		const k = NORM[chave(c)];
		if (k && D[k] && D[k][i]) return ajustar(c, D[k][i]);
		if (/\d/.test(c)) {
			const kk = NUMS[chave(c).replace(RE_NUM, '\u0001')];
			if (kk && D[kk] && D[kk][i]) {
				const alvo = D[kk][i];
				const nums = c.match(RE_NUM) || [];
				const alvoNums = alvo.match(RE_NUM) || [];
				if (nums.length && nums.length === alvoNums.length) {
					let partes = alvo.split(RE_NUM),
						out = partes[0];
					for (let z = 0; z < nums.length; z++) out += nums[z] + (partes[z + 1] || '');
					return out;
				}
			}
		}
		return null;
	}

	function envolvido(s, i) {
		const r = bruto(s, i);
		if (r !== null) return r;
		const m = RE_ENV.exec(s);
		if (!m || !m[2] || !RE_LETRA.test(m[2])) return null;
		const r2 = bruto(m[2], i);
		return r2 === null ? null : m[1] + r2 + m[3];
	}

	function porPartes(s, i) {
		const ps = s.split(RE_SEG);
		if (ps.length < 3) return null;
		let out = '',
			achou = false;
		for (let j = 0; j < ps.length; j++) {
			const p = ps[j];
			if (j % 2 === 1) {
				out += p;
				continue;
			}
			if (!p) continue;
			if (!RE_LETRA.test(p)) {
				out += p;
				continue;
			}
			const r = envolvido(p, i);
			if (r === null) return null;
			out += r;
			achou = true;
		}
		return achou ? out : null;
	}

	function ehPt(s) {
		if (/[\u00c0-\u00ff]/.test(s)) return true;
		return /(^|[^a-z])(nao|n\u00e3o|arquivo|arquivos|projeto|comando|erro|salvo|pasta|linha|aba|ferramenta|voce|equipe|senha|codigo)([^a-z]|$)/i.test(
			s,
		);
	}
	function calc(s, i) {
		let r = envolvido(s, i);
		if (r !== null) return r;
		r = porPartes(s, i);
		if (r !== null) return r;
		const c = limpar(s);
		if (c && !IGN[c] && c.length > 1 && ehPt(c)) perdidos[c] = 1;
		return s;
	}
	function tr(s) {
		if (typeof s !== 'string' || !s) return s;
		if (atual === 'pt') return s;
		const i = IDX[atual];
		if (i === undefined) return s;
		const ck = atual + '\u0001' + s;
		const c = memo[ck];
		if (c !== undefined) return c;
		const r = calc(s, i);
		if (nmemo > 12000) {
			memo = Object.create(null);
			nmemo = 0;
		}
		memo[ck] = r;
		nmemo++;
		return r;
	}

	function ehSkip(n) {
		try {
			const el = n && n.nodeType === 3 ? n.parentNode : n;
			if (!el) return true;
			const t = el.nodeName;
			if (
				t === 'SCRIPT' ||
				t === 'STYLE' ||
				t === 'TEXTAREA' ||
				t === 'IFRAME' ||
				t === 'CANVAS' ||
				t === 'PRE'
			)
				return true;
			if (el.closest && el.closest(SKIP)) return true;
		} catch (e) {
			ignorarErro(e, 'ehSkip');
		}
		return false;
	}
	function txtNo(n) {
		try {
			if (!n || n.nodeType !== 3) return;
			const v = n.nodeValue;
			if (!v || !v.trim()) return;
			if (ehSkip(n)) return;
			let o = origT.get(n);
			if (o === undefined) {
				o = v;
				origT.set(n, o);
			} else if (v !== o && v !== tr(o)) {
				if (o.indexOf(v) !== 0 && String(tr(o)).indexOf(v) !== 0) {
					o = v;
					origT.set(n, o);
				}
			}
			const nv = tr(o);
			if (nv !== n.nodeValue) n.nodeValue = nv;
		} catch (e) {
			ignorarErro(e, 'txtNo');
		}
	}
	function atrEl(el, nome) {
		try {
			if (!el || el.nodeType !== 1 || !el.getAttribute) return;
			if (ehSkip(el)) return;
			const v = el.getAttribute(nome);
			if (!v || !v.trim()) return;
			let mp = origA.get(el);
			if (!mp) {
				mp = {};
				origA.set(el, mp);
			}
			let o = mp[nome];
			if (o === undefined) {
				o = v;
				mp[nome] = o;
			} else if (v !== o && v !== tr(o)) {
				o = v;
				mp[nome] = o;
			}
			const nv = tr(o);
			if (nv !== v) el.setAttribute(nome, nv);
		} catch (e) {
			ignorarErro(e, 'atrEl');
		}
	}
	function varrer(raiz) {
		try {
			if (!raiz) return;
			if (raiz.nodeType === 3) {
				txtNo(raiz);
				return;
			}
			if (raiz.nodeType !== 1 && raiz.nodeType !== 9 && raiz.nodeType !== 11) return;
			if (raiz.nodeType === 1 && ehSkip(raiz)) return;
			let w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null),
				n,
				lista = [];
			while ((n = w.nextNode())) lista.push(n);
			for (let i = 0; i < lista.length; i++) txtNo(lista[i]);
			if (raiz.nodeType === 1 && raiz.hasAttribute)
				for (let a = 0; a < ATRS.length; a++) if (raiz.hasAttribute(ATRS[a])) atrEl(raiz, ATRS[a]);
			const els = raiz.querySelectorAll ? raiz.querySelectorAll('*') : [];
			for (let j = 0; j < els.length; j++)
				for (let b = 0; b < ATRS.length; b++)
					if (els[j].hasAttribute(ATRS[b])) atrEl(els[j], ATRS[b]);
		} catch (e) {
			ignorarErro(e, 'varrer');
		}
	}
	function varrerTudo() {
		varrer(document.documentElement || document.body);
		try {
			MO.takeRecords();
		} catch (e) {
			ignorarErro(e, 'varrerTudo');
		}
	}
	function restaurar() {
		try {
			const raiz = document.documentElement || document.body;
			let w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null),
				n;
			while ((n = w.nextNode())) {
				const o = origT.get(n);
				if (o !== undefined && n.nodeValue !== o) n.nodeValue = o;
			}
			const els = document.querySelectorAll('*');
			for (let i = 0; i < els.length; i++) {
				const mp = origA.get(els[i]);
				if (!mp) continue;
				for (let k in mp) if (els[i].getAttribute(k) !== mp[k]) els[i].setAttribute(k, mp[k]);
			}
			try {
				MO.takeRecords();
			} catch (e) {
				ignorarErro(e, 'restaurar');
			}
		} catch (e) {
			ignorarErro(e, 'restaurar');
		}
	}

	var MO = new MutationObserver(function (ms) {
		if (atual === 'pt') return;
		for (let i = 0; i < ms.length; i++) {
			const m = ms[i];
			if (m.type === 'characterData') txtNo(m.target);
			else if (m.type === 'attributes') {
				if (ATRS.includes(m.attributeName)) atrEl(m.target, m.attributeName);
			} else {
				const ad = m.addedNodes;
				for (let j = 0; j < ad.length; j++) varrer(ad[j]);
			}
		}
	});
	function ligarMO() {
		try {
			MO.observe(document.documentElement || document.body, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
				attributeFilter: ATRS,
			});
		} catch (e) {
			ignorarErro(e, 'ligarMO');
		}
	}

	function envolver1(nome, quantos) {
		try {
			const f = window[nome];
			if (typeof f !== 'function' || f.__i18n) return;
			const novo = function (a, b, c, d) {
				try {
					a = tr(a);
					if (quantos > 1) b = tr(b);
				} catch (e) {
					ignorarErro(e, 'novo');
				}
				return f.call(this, a, b, c, d);
			};
			novo.__i18n = 1;
			try {
				for (let p in f) novo[p] = f[p];
			} catch (e) {
				ignorarErro(e, 'envolver1');
			}
			window[nome] = novo;
		} catch (e) {
			ignorarErro(e, 'envolver1');
		}
	}
	function envolverEmissores() {
		envolver1('termEcho', 1);
		envolver1('toast', 2);
		try {
			if (typeof window.pushLog === 'function' && !window.pushLog.__i18n) {
				const pl = window.pushLog;
				const n3 = function (a, b, c) {
					try {
						b = tr(b);
					} catch (e) {
						ignorarErro(e, 'n3');
					}
					return pl.call(this, a, b, c);
				};
				n3.__i18n = 1;
				window.pushLog = n3;
			}
		} catch (e) {
			ignorarErro(e, 'envolverEmissores');
		}
		const nativos = ['alert', 'confirm', 'prompt'];
		for (let i = 0; i < nativos.length; i++) {
			try {
				var nm = nativos[i],
					fn = window[nm];
				if (typeof fn !== 'function' || fn.__i18n) continue;
				window[nm] = (function (fn) {
					const w = function (a, b) {
						try {
							a = tr(a);
						} catch (e) {
							ignorarErro(e, 'w');
						}
						return fn.call(window, a, b);
					};
					w.__i18n = 1;
					return w;
				})(fn);
			} catch (e) {
				ignorarErro(e, 'envolverEmissores');
			}
		}
	}

	function css() {
		if (document.getElementById('i18nCss')) return;
		const s = document.createElement('style');
		s.id = 'i18nCss';
		s.textContent = `#langBtn{position:relative}#langBtn .lbl{font-size:10px;font-weight:800;letter-spacing:.4px;\
margin-left:5px;opacity:.85}#langMenu{position:fixed;z-index:7200;min-width:190px;padding:6px;display:none;\
background:var(--bg-2,#15161a);border:1px solid var(--line,#2a2c33);border-radius:12px;box-shadow:0 \
20px 60px rgba(0,0,0,.5)}#langMenu.open{display:block;animation:i18nIn .16s ease}@keyframes i18nIn{from{opacity:0;\
transform:translateY(-6px)}to{opacity:1;transform:none}}#langMenu button{display:flex;align-items:center;\
gap:10px;width:100%;height:34px;padding:0 10px;border-radius:8px;background:transparent;border:0;color:var(--txt-2,#c8cad2);\
font-size:13px;font-weight:600;text-align:left;cursor:pointer}#langMenu button:hover{background:var(--bg-3,#1d1f25);\
color:var(--txt,#e8e9ee)}#langMenu button .cod{margin-left:auto;font-size:10.5px;font-weight:800;opacity:.6}\
#langMenu button.sel{color:var(--acc,#7aa2f7)}#langMenu button.sel .cod{opacity:1}`;
		(document.head || document.documentElement).appendChild(s);
	}
	function badge() {
		try {
			const b = document.getElementById('langBtn');
			if (!b) return;
			const l = b.querySelector('.lbl');
			for (let i = 0; i < IDIOMAS.length; i++)
				if (IDIOMAS[i].c === atual && l) l.textContent = IDIOMAS[i].b;
			const mn = document.getElementById('langMenu');
			if (mn) {
				const bs = mn.querySelectorAll('button');
				for (let j = 0; j < bs.length; j++)
					bs[j].classList.toggle('sel', bs[j].getAttribute('data-idioma') === atual);
			}
		} catch (e) {
			ignorarErro(e, 'badge');
		}
	}
	function fechar() {
		const m = document.getElementById('langMenu');
		if (m) m.classList.remove('open');
	}
	function abrir() {
		const m = document.getElementById('langMenu'),
			b = document.getElementById('langBtn');
		if (!m || !b) return;
		const r = b.getBoundingClientRect();
		m.style.top = r.bottom + 8 + 'px';
		const esq = Math.min(r.left, (window.innerWidth || 600) - 210);
		m.style.left = Math.max(8, esq) + 'px';
		m.classList.add('open');
		badge();
	}
	function montar() {
		const host = document.querySelector('.topbar-actions') || document.querySelector('.topbar');
		if (!host || document.getElementById('langBtn')) return;
		const b = document.createElement('button');
		b.id = 'langBtn';
		b.type = 'button';
		b.className = 'top-ico';
		b.setAttribute('data-i18n', 'off');
		b.setAttribute('aria-label', 'Language / Idioma');
		b.title = 'Language / Idioma';
		b.innerHTML =
			'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
			'stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3.2 ' +
			'9h17.6M3.2 15h17.6M12 3c2.6 3.2 2.6 14.8 0 18M12 3c-2.6 3.2-2.6 14.8 0 18"/></svg><span ' +
			'class="lbl">EN</span>';
		const ref = document.getElementById('tourBtn');
		if (ref && ref.parentNode === host) host.insertBefore(b, ref);
		else host.insertBefore(b, host.firstChild);
		const m = document.createElement('div');
		m.id = 'langMenu';
		m.setAttribute('data-i18n', 'off');
		m.setAttribute('role', 'menu');
		let h = '';
		for (let i = 0; i < IDIOMAS.length; i++)
			h += `<button type="button" data-idioma="${IDIOMAS[i].c}">${IDIOMAS[i].n}<span class="cod">${IDIOMAS[i].b}</span></button>`;
		m.innerHTML = h;
		document.body.appendChild(m);
		b.addEventListener('click', function (ev) {
			ev.stopPropagation();
			const ab = m.classList.contains('open');
			try {
				if (typeof fecharMenus === 'function') fecharMenus();
			} catch (e) {
				ignorarErro(e, 'montar');
			}
			if (ab) fechar();
			else abrir();
		});
		m.addEventListener('click', function (ev) {
			const t = ev.target && ev.target.closest ? ev.target.closest('button[data-idioma]') : null;
			if (!t) return;
			ev.stopPropagation();
			definir(t.getAttribute('data-idioma'));
		});
		document.addEventListener('click', function (ev) {
			if (!m.classList.contains('open')) return;
			if (
				ev.target &&
				ev.target.closest &&
				(ev.target.closest('#langMenu') || ev.target.closest('#langBtn'))
			)
				return;
			fechar();
		});
		document.addEventListener('keydown', function (ev) {
			if (ev.key === 'Escape') fechar();
		});
		window.addEventListener('resize', fechar);
		badge();
	}

	function redesenhar() {
		const fns = [
			'renderConsole',
			'mcpRenderPanel',
			'mcpRenderLog',
			'updateStatus',
			'renderTabs',
			'renderTree',
			'tmuiRender',
		];
		for (let i = 0; i < fns.length; i++) {
			try {
				if (typeof window[fns[i]] === 'function') window[fns[i]]();
			} catch (e) {
				ignorarErro(e, 'redesenhar');
			}
		}
	}
	function marcarLang() {
		try {
			document.documentElement.setAttribute(
				'lang',
				atual === 'zh' ? 'zh-CN' : atual === 'pt' ? 'pt-BR' : atual,
			);
		} catch (e) {
			ignorarErro(e, 'marcarLang');
		}
	}
	function definir(c) {
		if (c !== 'pt' && IDX[c] === undefined) return false;
		if (c === atual) {
			fechar();
			return true;
		}
		restaurar();
		atual = c;
		try {
			localStorage.setItem(K, c);
		} catch (e) {
			ignorarErro(e, 'definir');
		}
		marcarLang();
		memo = Object.create(null);
		nmemo = 0;
		if (c !== 'pt') varrerTudo();
		badge();
		redesenhar();
		if (c !== 'pt') varrerTudo();
		fechar();
		for (let i = 0; i < ouvintes.length; i++) {
			try {
				ouvintes[i](c);
			} catch (e) {
				ignorarErro(e, 'definir');
			}
		}
		try {
			document.dispatchEvent(new CustomEvent('synapse:idioma', { detail: { idioma: c } }));
		} catch (e) {
			ignorarErro(e, 'definir');
		}
		try {
			if (typeof pushLog === 'function') pushLog('sys', 'idioma: ' + c);
		} catch (e) {
			ignorarErro(e, 'definir');
		}
		return true;
	}

	function iniciar() {
		css();
		montar();
		badge();
		marcarLang();
		if (atual !== 'pt') varrerTudo();
		envolverEmissores();
	}

	marcarLang();
	ligarMO();
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
	else iniciar();
	window.addEventListener('load', function () {
		montar();
		badge();
		envolverEmissores();
		if (atual !== 'pt') varrerTudo();
	});
	setTimeout(function () {
		montar();
		badge();
		envolverEmissores();
		if (atual !== 'pt') varrerTudo();
	}, 400);
	setTimeout(function () {
		montar();
		envolverEmissores();
		if (atual !== 'pt') varrerTudo();
	}, 1500);

	window.SYNAPSE_I18N = {
		idioma: function () {
			return atual;
		},
		idiomas: IDIOMAS,
		definir: definir,
		t: tr,
		traduzir: tr,
		varrer: function () {
			varrerTudo();
			return true;
		},
		on: function (fn) {
			if (typeof fn === 'function') ouvintes.push(fn);
			return true;
		},
		faltando: function () {
			const l = [];
			for (let k in perdidos) l.push(k);
			return l.sort();
		},
		estado: function () {
			let n = 0;
			for (let k in D) n++;
			return {
				idioma: atual,
				padrao: detectar(),
				chaves: n,
				memo: nmemo,
				faltando: this.faltando().length,
			};
		},
		dic: D,
		ignorar: IGNORAR,
	};
})();
