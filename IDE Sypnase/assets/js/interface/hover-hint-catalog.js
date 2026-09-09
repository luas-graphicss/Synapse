(function (root) {
    'use strict';

    const HINTS_BY_ELEMENT_ID = {
      importBtn: 'Importa uma pasta ou um arquivo .zip como projeto novo.',
      exportBtn: 'Baixa o projeto aberto como arquivo .zip.',
      tourBtn: 'Abre o passo a passo guiado da interface.',
      cmdkBtn: 'Abre a paleta de comandos com busca por acao.',
      themeBtn: 'Alterna entre os temas claro e escuro.',
      syncBtn: 'Espelha o projeto para outro aparelho, sem servidor.',
      recentBtn: 'Lista os projetos abertos recentemente.',
      lockBtn: 'Mostra as travas de arquivo e os claims dos agentes.',
      teamsBtn: 'Gerencia equipes de agentes e o escopo de arquivos.',
      modelador3dBtn: 'Abre o Blepse 3D, o modelador 3D integrado. Recurso em beta/demo.',
      iaBtn: 'Abre o chat de IA com acesso ao projeto.',
      mcpBtn: 'Configura a conexao MCP e o Relay.',
      deviceSeg: 'Troca o tamanho simulado do preview.',
      dims: 'Largura e altura atuais do preview.',
      rotateBtn: 'Gira o preview entre retrato e paisagem.',
      previewZoom: 'Ajusta o zoom do preview sem mudar o layout.',
      layoutSeg: 'Escolhe a divisao entre editor e preview.',
      reloadBtn: 'Recarrega o preview descartando o estado atual.',
      consoleBtn: 'Mostra ou esconde o console do preview.',
      termBtn: 'Mostra ou esconde o terminal do Relay.',
      popoutBtn: 'Abre o preview em uma janela separada.',
      exNewFile: 'Cria um arquivo na pasta selecionada.',
      exNewFolder: 'Cria uma pasta na pasta selecionada.',
      collapseBtn: 'Recolhe todas as pastas do explorador.',
      addBtn: 'Adiciona arquivos do computador ao projeto.',
      exProjBtn: 'Troca o projeto aberto.',
      exSearch: 'Filtra arquivos e pastas pelo nome.',
      fmtBtn: 'Formata o arquivo aberto.',
      foldBtn: 'Dobra ou desdobra todos os blocos do arquivo.',
      miniBtn: 'Mostra ou esconde o minimapa.',
      qopenBtn: 'Abre um arquivo pelo nome, sem sair do teclado.',
      findInFileBtn: 'Busca e substitui dentro do arquivo aberto.',
      histBtn: 'Mostra as versoes salvas do arquivo aberto.',
      autocompleteBtn: 'Pede sugestoes de codigo na posicao do cursor.',
      aiCompletionToggleBtn: 'Liga ou desliga o autocomplete com IA. Recurso em beta/demo.',
      cAll: 'Mostra todas as mensagens do console.',
      cErr: 'Mostra apenas os erros.',
      cWarn: 'Mostra apenas os avisos.',
      cMcp: 'Mostra apenas as chamadas MCP.',
      consoleSearch: 'Filtra as mensagens do console.',
      copyConsole: 'Copia o console para a area de transferencia.',
      clearConsole: 'Limpa as mensagens do console.',
      closeConsole: 'Fecha o painel do console.',
      termCwd: 'Pasta em que os comandos do terminal sao executados.',
      termStop: 'Interrompe o comando em execucao.',
      termClear: 'Limpa a saida do terminal.',
      termClose: 'Fecha o painel do terminal.',
      termIn: 'Digite um comando e pressione Enter para executar.',
      stDot: 'Estado da conexao com o Relay.',
      stProject: 'Projeto aberto no momento.',
      stContext: 'Tamanho do contexto enviado aos agentes.',
      stFiles: 'Quantidade de arquivos do projeto.',
    };

    function hintFor(element) {
      if (!element || !element.id) return '';
      return HINTS_BY_ELEMENT_ID[element.id] || '';
    }

    root.SynapseHoverHintCatalog = Object.freeze({ hintFor });
})(typeof globalThis !== 'undefined' ? globalThis : window);
