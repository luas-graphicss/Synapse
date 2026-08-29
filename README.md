# Synapse Live Preview

Um editor de projetos web que roda inteiro no navegador. Você abre um `.zip` ou uma pasta e o site aparece montado do lado, atualizando enquanto você digita. Junto vêm console, terminal, um compilador para WebAssembly, um estúdio 3D e um conector MCP, que serve para um agente de IA trabalhar no mesmo projeto que você.

Não existe etapa de build. O `index.html` carrega os scripts na ordem certa e é isso. Funciona em qualquer host estático e continua funcionando se você abrir o arquivo direto do disco. Essa decisão custa algumas coisas, e o `ARQUITETURA.md` conta quais.

O projeto do usuário nunca roda no mesmo escopo do editor. Ele vive dentro de um `<iframe sandbox>` e conversa com o editor por mensagem.

## Rodando

```bash
npm install
npm run dev
```

O `npm install` só baixa ferramenta de desenvolvimento: prettier, eslint e wrangler. O site em si não depende de nenhuma delas para abrir. Se preferir, sirva a pasta com qualquer servidor estático que você já use.

Para publicar, o `vercel.json` já vai com os cabeçalhos de isolamento que o WebAssembly e os workers precisam (COOP, COEP, CORP, `nosniff` e `Referrer-Policy`) e já bloqueia acesso público aos arquivos de servidor, que não têm por que ser baixáveis.

## O relay é opcional

O editor funciona sozinho. O relay entra quando você quer terminal de verdade e o projeto espelhado em disco:

```bash
PORT=8787 node relay.js
```

Ele guarda os projetos em `./aurora-projects`, ou no caminho que estiver em `AURORA_WORK`. Comandos como `npm install` e `node build.js` rodam ali e a saída volta para o terminal do editor, junto com os arquivos que mudaram.

Se o que você quer é o conector MCP na nuvem, são três publicações separadas:

```bash
npm run deploy:relay           # nó principal, worker.js
npm run deploy:relay:reserva   # nó de reserva, wrangler-reserva.toml
npm run deploy:portao          # roteador da URL única, portao.js
```

Parece exagero ter um roteador separado, mas tem motivo: quando a Cloudflare bloqueia uma conta na borda, nenhum código daquele nó roda, nem para redirecionar. O portão vive em outra conta justamente para a URL única não morrer junto.

## Comandos

- `npm run format` aplica o Prettier no projeto todo, e `npm run format:check` só confere.
- `npm run lint` roda o ESLint, `npm run lint:fix` corrige o que dá para corrigir sozinho.
- `npm run check:sintaxe` passa `node --check` em todos os `.js` e `.mjs`.
- `npm run check` faz os três de uma vez. É o que vale rodar antes de abrir um PR.
- `npm run check:waf` confere o manifesto do WAF.

## Quando algo não funciona

O editor engole muita falha de propósito, porque um erro em telemetria ou em cache não pode derrubar a edição do usuário. Só que engolir em silêncio é péssimo para depurar, então existe um modo diagnóstico.

Abra a página com `?diagnostico=1`, ou rode `localStorage['synapse:diagnostico'] = '1'` e recarregue. A partir daí, tudo o que foi ignorado aparece no console, e `registro.falhasToleradas()` devolve as últimas cem falhas com o contexto de onde aconteceram.

## Onde fica cada coisa

```
index.html            a página; a ordem dos <script> importa, veja ARQUITETURA.md
assets/css/           estilo separado por área
assets/js/            o editor, dividido por camada
worker.js             sessão MCP no Cloudflare Workers
portao.js             roteador da URL única, sem estado
relay.js              relay local com terminal e espelho em disco
tools/                utilitários de linha de comando
docs/historico/       relatórios de correções antigas, mantidos por referência
```

## Uma coisa sobre o estilo do código

O código não tem comentário nenhum, em nenhum arquivo. Isso é intencional: a explicação mora nos documentos, e o código se explica pelo nome das coisas. Se você precisar de um comentário para entender uma função, provavelmente ela precisa de um nome melhor ou de ser quebrada em duas. O `CONTRIBUINDO.md` fala mais sobre isso.

## Leitura

- `ARQUITETURA.md`: como as peças se encaixam, como o preview é montado e por que o escopo global é compartilhado.
- `SEGURANCA.md`: o que o editor precisa fazer de arriscado, como isso está contido e o que nunca deve ser feito.
- `CONTRIBUINDO.md`: padrão de código e o passo a passo antes de abrir um PR.
- `CHANGELOG.md`: o que mudou em cada versão.
