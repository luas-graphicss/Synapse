# Changelog da API de extensões (`synapse.d.ts`)

A versão da API é a que o host expõe em `synapse.version` e a que o manifesto compara em `engines.synapse`.

## Política de compatibilidade

- Versionamento semântico: *minor* só adiciona; *major* pode remover o que estiver marcado `@deprecated` há pelo menos uma versão maior.
- Janela de suporte: o host garante as **2 versões maiores mais recentes** (hoje `2.x` e `1.x`). Extensões com `engines.synapse` abaixo disso instalam com aviso e podem parar de funcionar sem aviso prévio.
- APIs `@deprecated` continuam funcionando durante toda a janela. O host registra um aviso único por extensão e por API no painel de saída da extensão (`api.deprecated`) e o painel Extensões em execução lista as chamadas.
- Remoções são anunciadas aqui e na referência (`docs/extensoes-api.html`) com a versão em que acontecerão.

## 2.5.0

### Adicionado

- `synapse.mcp.registerTool(name, handler, options?)`: expõe uma função da extensão como ferramenta MCP para agentes conectados ao relay. Exige a permissão `mcp`; o nome público segue `ext_<publisher>_<nome>__<ferramenta>`. Metadados podem ser declarados em `contributes.mcpTools`.
- `synapse.env.appRoot`: URL base da IDE (para resolver endpoints da própria origem).
- Manifesto: `extensionPack` e `extensionDependencies` com resolução e instalação em cadeia a partir do registro; `contributes.mcpTools`; permissão `network:self` (mesma origem da IDE).
- Extensões embutidas (`builtin`): a própria IDE passa a carregar `synapse.bug-report`, `synapse.sort-lines` e `synapse.todo-highlighter` pela API pública.

### Corrigido

- `webview.nonce` e `webview.cspSource` ficam disponíveis de forma síncrona logo após `createWebviewPanel` (antes chegavam vazios até a resposta do host, quebrando a CSP de quem lia o nonce na hora).
- Painéis de webview e painéis do host (detalhes de extensão) agora são mutuamente exclusivos no editor: abrir um esconde o outro.
- `SYNAPSE_VERSION` passa a ser publicada pela IDE; `engines.synapse` deixa de rejeitar todo pacote com "esta IDE é 0.0.0".
- Ferramentas de `mcp.registerTool` chegam de fato ao catálogo MCP da IDE.
- Extensões embutidas declaram a permissão `mcp` que suas ferramentas exigem.

### Obsoleto (remoção prevista em 4.0.0)

- `synapse.workspace.readFile(path)` → use `synapse.workspace.fs.readFile(uri)` e decodifique com `TextDecoder`.
- `synapse.workspace.writeFile(path, text)` → use `synapse.workspace.fs.writeFile(uri, bytes)`.
- `synapse.workspace.findFilePaths(glob)` → use `synapse.workspace.findFiles(glob)` e `synapse.workspace.asRelativePath(uri)`.

## 2.4.0

- Testes de extensão (`synapse.test`), `preview.*`, `keybindings.bindingFor`.

## 2.0.0

- Primeira versão estável com host isolado em Worker, permissões declarativas e webviews com CSP.
