(function (root) {
    'use strict';

    const CATEGORIES = [
      {
        id: 'visao-geral',
        title: 'Visão geral',
        file: 'index.html',
        group: 'Fundamentos',
        summary: 'O que a Synapse IDE é, como ela roda no navegador e do que ela é feita.',
      },
      {
        id: 'primeiros-passos',
        title: 'Primeiros passos',
        file: 'primeiros-passos.html',
        group: 'Fundamentos',
        summary: 'Abrir a IDE, criar ou importar um projeto e ver o primeiro preview rodando.',
      },
      {
        id: 'interface',
        title: 'Área de trabalho',
        file: 'interface.html',
        group: 'Fundamentos',
        summary: 'Barra superior, explorador, abas, layouts e paleta de comandos.',
      },
      {
        id: 'editor',
        title: 'Editor de código',
        file: 'editor.html',
        group: 'Ferramentas',
        summary: 'Realce de sintaxe, IntelliSense, diagnósticos, busca, formatação e navegação.',
      },
      {
        id: 'preview',
        title: 'Preview ao vivo',
        file: 'preview.html',
        group: 'Ferramentas',
        summary: 'Como o preview é montado, quando ele recompila e como ler o console.',
      },
      {
        id: 'build',
        title: 'Build e compilador',
        file: 'build.html',
        group: 'Ferramentas',
        summary: 'Perfis de build, adaptadores, WASI, CMake e leitura de diagnósticos.',
      },
      {
        id: 'blepse-3d',
        title: 'Blepse 3D',
        file: 'blepse-3d.html',
        group: 'Ferramentas',
        summary: 'O Blepse 3D, modelador da IDE: viewport, malha, materiais, UV e exportação.',
      },
      {
        id: 'ia',
        title: 'Assistente de IA',
        file: 'ia.html',
        group: 'Ferramentas',
        summary: 'Sugestões em linha, chat do workspace e o que sai do seu navegador.',
      },
      {
        id: 'terminal',
        title: 'Terminal e relay',
        file: 'terminal.html',
        group: 'Plataforma',
        summary: 'Comandos reais no disco, dev server proxy e permissões do relay.',
      },
      {
        id: 'mcp',
        title: 'MCP e agentes',
        file: 'mcp.html',
        group: 'Plataforma',
        summary: 'Como agentes externos leem e escrevem no projeto, com equipes e travas.',
      },
      {
        id: 'arquivos',
        title: 'Arquivos e persistência',
        file: 'arquivos.html',
        group: 'Plataforma',
        summary: 'Onde o projeto fica salvo, histórico de versões, snapshots e exportação.',
      },
      {
        id: 'configuracoes',
        title: 'Configurações e atalhos',
        file: 'configuracoes.html',
        group: 'Plataforma',
        summary: 'Aparência, fontes, temas de sintaxe, idiomas e o mapa de atalhos.',
      },
      {
        id: 'problemas',
        title: 'Solução de problemas',
        file: 'problemas.html',
        group: 'Suporte',
        summary: 'Sintomas comuns, mensagens de erro e o que fazer em cada caso.',
      },
      {
        id: 'atualizacoes',
        title: 'Atualizações',
        file: 'atualizacoes.html',
        group: 'Suporte',
        summary: 'O último update publicado e o que está em desenvolvimento agora.',
      },
    ];

    function list() {
      return CATEGORIES.map((category) => ({ ...category }));
    }

    function groups() {
      const names = [];
      CATEGORIES.forEach((category) => {
          if (!names.includes(category.group)) names.push(category.group);
      });
      return names;
    }

    function find(identifier) {
      const found = CATEGORIES.find((category) => category.id === identifier);
      return found ? { ...found } : null;
    }

    function neighbors(identifier) {
      const index = CATEGORIES.findIndex((category) => category.id === identifier);
      if (index < 0) return { previous: null, next: null };
      return {
        previous: index > 0 ? { ...CATEGORIES[index - 1] } : null,
        next: index < CATEGORIES.length - 1 ? { ...CATEGORIES[index + 1] } : null,
      };
    }

    root.SynapseDocsCatalog = Object.freeze({ list, groups, find, neighbors });
})(typeof globalThis !== 'undefined' ? globalThis : window);
