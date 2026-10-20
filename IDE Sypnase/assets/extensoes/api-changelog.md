# Changelog da API de extensões

[Read in English](api-changelog.en.md)

Aqui ficam registradas as mudanças da API de extensões da Synapse, que é definida no arquivo synapse.d.ts. A versão da API é a mesma que o host expõe em synapse.version e que o manifesto de cada extensão compara no campo engines.synapse.

## Compatibilidade

A API segue versionamento semântico. Versões menores só adicionam coisas, e uma versão maior só pode remover o que já estava marcado como obsoleto há pelo menos uma versão maior.

O host garante suporte às duas versões maiores mais recentes, que hoje são a 2 e a 1. Extensões que pedem uma versão abaixo disso ainda instalam, mas com aviso, e podem parar de funcionar sem aviso prévio.

As APIs marcadas como obsoletas continuam funcionando durante toda essa janela. O host registra um único aviso por extensão e por API no painel de saída da extensão, e o painel de extensões em execução lista essas chamadas. Toda remoção é anunciada aqui e na [referência da API](../../docs/extensoes-api.html), junto com a versão em que ela vai acontecer.

## 2.5.0

Essa versão trouxe a função synapse.mcp.registerTool, que expõe uma função da extensão como ferramenta MCP para os agentes conectados ao relay. Ela exige a permissão mcp, e o nome público junta o publicador, o nome da extensão e o nome da ferramenta, como em ext_synapse_sort_lines__sort_text. Os metadados das ferramentas também podem ser declarados em contributes.mcpTools. Entrou também synapse.env.appRoot, com a URL base da IDE, útil para chamar endpoints da própria origem. O manifesto ganhou extensionPack e extensionDependencies, que são resolvidos e instalados em cadeia a partir do registro, além de contributes.mcpTools e da permissão network:self, que libera acesso à mesma origem da IDE. A própria IDE passou a carregar pela API pública as extensões embutidas synapse.bug-report, synapse.sort-lines e synapse.todo-highlighter.

Alguns problemas foram corrigidos. Os campos webview.nonce e webview.cspSource agora ficam disponíveis logo depois de createWebviewPanel. Antes eles chegavam vazios até o host responder, o que quebrava a CSP de quem lia o nonce na hora. Os painéis de webview e os painéis do próprio host, como os detalhes de uma extensão, não aparecem mais juntos no editor, e abrir um esconde o outro. A IDE passou a publicar SYNAPSE_VERSION, então engines.synapse deixou de recusar todos os pacotes achando que a IDE era a versão 0.0.0. As ferramentas registradas com mcp.registerTool agora chegam de verdade ao catálogo MCP da IDE, e as extensões embutidas passaram a declarar a permissão mcp que as ferramentas delas exigem.

Três funções viraram obsoletas e devem sair na versão 4.0.0. No lugar de synapse.workspace.readFile, use synapse.workspace.fs.readFile e decodifique o resultado com TextDecoder. No lugar de synapse.workspace.writeFile, use synapse.workspace.fs.writeFile passando os bytes. No lugar de synapse.workspace.findFilePaths, use synapse.workspace.findFiles junto com synapse.workspace.asRelativePath.

## 2.4.0

Entraram os testes de extensão em synapse.test, as APIs de preview e a função keybindings.bindingFor.

## 2.0.0

Primeira versão estável, com o host isolado em um Worker, permissões declarativas e webviews com CSP.
