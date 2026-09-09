const TOUR_STEPS = [
  { screen: 'intro' },
  {
    target: '#importBtn',
    menu: '#importMenu',
    label: 'Entrada',
    title: 'Traga seu projeto',
    text:
    'Importe um .zip, uma pasta do computador, um index.html solto ou carregue o exemplo ' +
    'pronto. Arrastar arquivos para qualquer canto da tela também funciona.',
  },
  {
    target: '#tabs',
    label: 'Projetos',
    title: 'Abas de projeto',
    text:
    'Cada projeto aberto vira uma aba. Troque de contexto sem perder nada: tudo fica salvo ' +
    'no navegador e o X ainda deixa um backup em Recentes.',
  },
  {
    target: '#explorer',
    label: 'Arquivos',
    title: 'Explorador',
    text:
    'A árvore do projeto. Um clique abre no editor, o botão direito renomeia, duplica ou ' +
    'apaga, e o + importa mais arquivos.',
  },
  {
    target: '#exProjBtn',
    label: 'Projeto',
    title: 'Menu do projeto',
    text:
    'Renomeie o projeto, crie um novo, edite os arquivos globais e a memória que os agentes ' +
    'leem antes de trabalhar.',
  },
  {
    target: '#editorPane',
    label: 'Código',
    title: 'Editor',
    text:
    'Destaque de sintaxe, números de linha, minimapa, dobra de código, busca em todos os ' +
    'arquivos e formatador. Cada gravação cria um ponto no histórico.',
    keys: ['Ctrl', 'S'],
  },
  {
    target: '#histBtn',
    label: 'Versões',
    title: 'Histórico do arquivo',
    text:
    'Toda gravação guarda a versão anterior. Compare com o que estava antes e restaure o ' +
    'arquivo quando precisar.',
    keys: ['Ctrl', 'H'],
  },
  {
    target: '#previewPane',
    label: 'Resultado',
    title: 'Preview ao vivo',
    text:
    'O preview se reconstrói a cada tecla: HTML, CSS, JS, módulos e imagens resolvidos na ' +
    'hora, sem servidor e sem recarregar na mão.',
  },
  {
    target: '#deviceSeg',
    label: 'Telas',
    title: 'Celular, tablet, desktop',
    text:
    'Troque o tamanho do preview, defina uma medida livre ou gire a tela para conferir cada ' +
    'breakpoint.',
  },
  {
    target: '#layoutSeg',
    label: 'Layout',
    title: 'Divida a tela',
    text:
    'Código e preview lado a lado, um sobre o outro ou só um dos dois em tela cheia. As ' +
    'divisórias entre os painéis são arrastáveis.',
  },
  {
    target: '#popoutBtn',
    label: 'Janela',
    title: 'Preview em outra aba',
    text:
    'Abre o preview numa aba separada e sincronizada com o editor. Bom para outro monitor ' +
    'ou para o celular.',
  },
  {
    target: '#consoleBtn',
    label: 'Depuração',
    title: 'Console e rede',
    text:
    'Erros, logs, avisos e requisições do seu projeto aparecem aqui dentro, sem precisar ' +
    'abrir o F12 do navegador.',
  },
  {
    target: '#termBtn',
    label: 'Terminal',
    title: 'Terminal e dev server',
    text:
    'Um terminal real no seu computador pelo relay: npm install, build, git. Projetos com ' +
    'build próprio sobem no dev server de verdade e o preview passa a mostrar ele, com ' +
    'hot reload.',
  },
  {
    target: '#cmdkBtn',
    label: 'Atalhos',
    title: 'Paleta de comandos',
    text:
    'Abra e digite: abrir arquivo, trocar tema, exportar, ativar MCP. Todo comando do site ' +
    'está a uma busca de distância.',
    keys: ['Ctrl', 'K'],
  },
  {
    target: '#iaBtn',
    label: 'Assistente',
    title: 'IA dentro do editor',
    text:
    'Conecte a sua própria IA e converse sobre o projeto sem sair da aba: explicar um ' +
    'arquivo, gerar um trecho, entender um erro.',
    keys: ['Ctrl', 'I'],
  },
  {
    target: '#mcpBtn',
    menu: '#mcpMenu',
    label: 'Integração',
    title: 'MCP: o agente entra no projeto',
    text:
    'Ative o MCP, copie a URL gerada e cole no conector do Notion. O agente lê e edita ' +
    'arquivos, roda comandos, tira screenshot do preview e testa a interface — em vários ' +
    'projetos ao mesmo tempo, com o site sempre no controle.',
  },
  {
    target: '#teamsBtn',
    menu: '#teamsMenu',
    label: 'Equipe',
    title: 'Vários agentes juntos',
    text:
    'Cada agente tem nome, caixa de mensagens e reserva automática de projeto: eles se ' +
    'avisam, dividem tarefas e não pisam no trabalho do outro.',
  },
  {
    target: '#modelador3dBtn',
    label: '3D',
    title: 'Blepse 3D',
    text:
    'Abre o modelador em outra aba, com o documento salvo dentro do projeto: primitivas, ' +
    'malha editável, material, UV e exportação em .glb. Atalhos no estilo Blender e camada ' +
    'de toque no celular.',
  },
  {
    target: '#syncBtn',
    label: 'Dispositivos',
    title: 'Espelhar projeto',
    text:
    'Gera um código secreto e leva o projeto para outro computador ou para o celular, sem ' +
    'nuvem no meio do caminho.',
  },
  {
    target: '#recentBtn',
    label: 'Recuperar',
    title: 'Recentes e backups',
    text:
    'Fechou o projeto sem querer? Ele fica aqui, com backups automáticos prontos para ' +
    'recuperar em um clique.',
  },
  {
    target: '#lockBtn',
    label: 'Privacidade',
    title: 'Trava por senha',
    text: 'Protege projetos com senha, para quem mais usa esta máquina não abrir o que não deve.',
  },
  {
    target: '#settingsBtn',
    label: 'Ajustes',
    title: 'Configurações da IDE',
    text: 'As preferências do editor, do preview e das integrações ficam reunidas neste painel.',
  },
  {
    target: '#themeBtn',
    menu: '#themeMenu',
    label: 'Aparência',
    title: 'Temas e cor de destaque',
    text: 'Temas prontos e um seletor de cor livre — o site inteiro se repinta na hora.',
  },
  {
    target: '#exportBtn',
    label: 'Saída',
    title: 'Exportar .zip',
    text:
    'Baixa o projeto inteiro com todas as edições, pronto para publicar ou continuar em ' +
    'outro editor.',
  },
  {
    target: '.statusbar',
    label: 'Estado',
    title: 'Barra de status',
    text:
    'Conexão, projeto ativo, contexto e contagem de arquivos ficam aqui embaixo. Se algo ' +
    'travar, é o primeiro lugar para olhar.',
  },
  { screen: 'outro' },
];
