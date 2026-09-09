(function (root) {
    'use strict';

    const FIELDS = [
      {
        name: 'title',
        label: 'Titulo curto',
        type: 'text',
        required: true,
        wide: true,
        placeholder: 'O preview congela quando eu troco de arquivo',
      },
      {
        name: 'area',
        label: 'Onde aconteceu',
        type: 'select',
        required: true,
        options: [
          'Editor de codigo',
          'Explorador de arquivos',
          'Preview ao vivo',
          'Build e compilador',
          'Terminal e relay',
          'Blepse 3D',
          'Assistente de IA',
          'MCP e agentes',
          'Configuracoes e temas',
          'Outro lugar',
        ],
      },
      {
        name: 'severity',
        label: 'Gravidade',
        type: 'select',
        required: true,
        options: [
          'Trava a IDE inteira',
          'Bloqueia o meu trabalho',
          'Incomoda mas da para seguir',
          'Detalhe visual',
        ],
      },
      {
        name: 'description',
        label: 'O que aconteceu',
        type: 'textarea',
        required: true,
        wide: true,
        rows: 4,
        placeholder: 'Descreva o comportamento errado e quando ele comecou.',
      },
      {
        name: 'steps',
        label: 'Passos para repetir',
        type: 'textarea',
        required: true,
        wide: true,
        rows: 4,
        placeholder: '1. Abrir o projeto\n2. Editar um arquivo grande\n3. Trocar de aba',
      },
      {
        name: 'expected',
        label: 'O que voce esperava',
        type: 'textarea',
        required: false,
        wide: true,
        rows: 2,
      },
      {
        name: 'consoleOutput',
        label: 'Erros do console',
        type: 'textarea',
        required: false,
        wide: true,
        rows: 3,
        placeholder: 'Cole aqui o que aparece no painel Console.',
      },
      {
        name: 'contact',
        label: 'Email para resposta',
        type: 'text',
        required: false,
        placeholder: 'opcional',
      },
      {
        name: 'projectName',
        label: 'Projeto em que ocorreu',
        type: 'text',
        required: false,
        placeholder: 'opcional',
      },
    ];

    function list() {
      return FIELDS.map((field) => ({ ...field }));
    }

    root.SynapseBugReportFields = Object.freeze({ list });
})(typeof globalThis !== 'undefined' ? globalThis : window);
