# Arquitetura

Este documento existe porque o código não tem comentário. Se você vai mexer em alguma coisa aqui dentro, vale ler antes; muita decisão que parece estranha no código tem uma razão que só aparece quando você vê o conjunto.

## O bloco principal

O editor é uma página única. O usuário importa um `.zip` ou uma pasta, o editor lê tudo para um mapa de caminho para bytes em memória, monta o documento final e joga esse documento dentro de um `<iframe sandbox srcdoc>`. O projeto do usuário roda ali, isolado, e conversa com o editor por `postMessage` e `BroadcastChannel`. O mesmo canal alimenta a janela destacada do preview, quando o usuário abre o preview em outra janela.

Não existe bundler, não existe passo de build, não existe `import`/`export` no código do editor. O `index.html` carrega uns cinquenta e poucos arquivos na ordem certa e o editor está de pé. Isso foi escolhido de propósito: o produto tem que abrir de um host estático qualquer, de um zip baixado e até de um `file://`. A próxima seção explica o que essa escolha cobra em troca.

## Escopo global compartilhado, e por que isso não é desleixo

Os arquivos de `assets/js` são scripts clássicos e dividem um único escopo global. O `nucleo/estado.js` declara `State`, `el`, `esc` e `toast`. O núcleo do Forge declara `FORGE`. O conector declara `MCP`. Cada arquivo conta com os nomes que os anteriores criaram, e ninguém importa ninguém.

Três consequências que você precisa ter em mente:

1. A ordem das tags no `index.html` é a arquitetura. Ela está agrupada por camada, uma tag por linha, com uma linha em branco separando os grupos. `nucleo/diagnostico.js` e `nucleo/seguranca.js` vêm primeiro, sempre, porque todo o resto usa `registro`, `ignorarErro` e `escaparHtml`.
2. O contrato de cada arquivo é o conjunto de nomes que ele declara no topo. Como isso não está escrito em nenhum `export`, a lista de globais em `tools/globais-do-projeto.json` é gerada a partir das declarações de topo e alimenta a regra `no-undef` do ESLint. É o que faz o lint pegar um nome digitado errado.
3. Renomear uma global pública quebra outros arquivos em silêncio. Renomeie só com busca no projeto inteiro, e rode `npm run check` depois.

Se algum dia o produto puder ter build, migrar para módulos ES é a primeira coisa a fazer. Enquanto não puder, é assim que funciona.

## Como o preview é montado

1. Importação. O zip ou a pasta vira um mapa de arquivos virtuais em memória.
2. Detecção. `compilador/deteccao.js` e `preview/entrada-e-execucao.js` descobrem que tipo de projeto é (HTML puro, React com JSX, Flutter, C, C++, Rust) e qual arquivo é a entrada.
3. Transformação. O que precisa de compilação passa pelo Babel, baixado de uma CDN da lista permitida, ou pelas toolchains WebAssembly.
4. Reescrita de referências. `preview/reconstrucao-agrupada.js` troca `src`, `href`, `srcset`, `url()` do CSS e especificadores de `import` por URLs de blob dos arquivos virtuais, e mistura os import maps que o projeto já tinha.
5. Prelúdios. `injetarPreludios(dom, contexto)` insere os scripts do próprio editor na ordem declarada em `preludiosDoPreview`: mapa de arquivos virtuais com `fetch` virtual, captura de console, telemetria de visão, atalho de rotas de SPA, viewport emulado e, quando é Flutter, o stub de Service Worker. Todos saem marcados com `data-synapse="preludio"`, então dá para separar no DevTools o que é do editor e o que é do usuário.
6. Execução. O HTML final vai para o iframe.

O passo 5 é o único lugar do projeto que injeta script em documento alheio, e ele está concentrado em uma função justamente para ser auditável. Se você precisar de mais um prelúdio, acrescente uma entrada na tabela `preludiosDoPreview`. Não crie `<script>` na mão em outro lugar.

## Os três caminhos do mesmo protocolo

O conector MCP fala o mesmo protocolo por três caminhos diferentes, e cada arquivo de servidor existe por um motivo específico.

`worker.js` é a sessão MCP no Cloudflare Workers. O mesmo arquivo serve o nó principal e os nós de reserva, que só mudam de configuração (`wrangler-reserva.toml`).

`portao.js` é um roteador minúsculo e sem estado, publicado em outra conta Cloudflare. Ele existe por um problema chato: quando o nó principal é bloqueado na borda, por erro 1027 ou conta suspensa, nenhum código dele roda, nem para responder um redirecionamento. Se a URL única morasse lá, morreria junto. Morando em outra conta, ela sobrevive e aponta para o nó que estiver vivo.

`relay.js` é o relay local em Node. Além de repassar o protocolo, ele espelha o projeto em disco e executa comandos de verdade, devolvendo a saída e os arquivos que mudaram. É o que dá terminal real ao editor.

As rotas são `GET /bridge/:sid/:token/events` para o fluxo SSE, `POST .../poll` como alternativa por long polling quando o SSE não passa, `POST .../reply` e `POST .../sync`.

## Camadas

```
index.html                 a página e a ordem de carregamento
assets/css/                estilo por área: base, tema, celular, mcp, interface
assets/js/
  nucleo/                  diagnóstico, segurança, estado global, ícones
  i18n/                    idiomas
  editor/                  editor de código, minimapa, dobras, arrastar
  preview/                 montagem do documento do preview e execução
  compilador/              C, C++, C# e Rust para WebAssembly, mais a demo
  estudio-3d/              Forge: geração de malhas e worker próprio
  mcp/                     conector: protocolo, ferramentas, resiliência
  terminal/                terminal e fila de comandos
  equipes/                 colaboração, identidade e travas de arquivo
  versionamento/           snapshots, histórico e diff
  interface/               painéis, explorer, projeto
  arquivos/                importação, exportação, assets, persistência
  plataforma/              adaptações de celular e desktop
  sincronizacao/           P2P com PeerJS e relay pela URL
  desempenho/              render coalescido, memória, governador
worker.js portao.js relay.js   os três servidores
tools/                     utilitários de linha de comando
```

## Código que mora dentro de string

Alguns arquivos guardam código como texto, e isso confunde quem chega agora. São três casos, todos de propósito:

`estudio-3d/biblioteca-forge.js` é a biblioteca AuroraForge embutida como texto. É código de terceiro, vendorizado. Não edite, não formate e não linte.

`terminal/comandos-e-espelho.js` guarda em `RELAY_SRC` o texto do relay que o editor entrega para o usuário rodar na máquina dele. Esse texto é gerado a partir do `relay.js` do repositório por `tools/sincronizar-relay.mjs`, e `npm run check` reclama se os dois saírem de sincronia. Não edite o texto embutido na mão: mexa no `relay.js` e rode o gerador. Isso não é preciosismo. Enquanto a cópia era mantida a dedo, o escape das barras invertidas estava inconsistente e o arquivo que o usuário baixava tinha erro de sintaxe na linha 161, ou seja, não iniciava.

`preview/reconstrucao-agrupada.js` e `preview/entrada-e-execucao.js` guardam os prelúdios e o código do worker de execução. Esse código roda em outro realm, dentro do iframe ou do worker, e por isso não tem acesso a nada do editor. Não use `registro` nem `ignorarErro` lá dentro: naquele contexto esses nomes não existem.

Vale saber o que foi feito em cada um. O relay embutido é cópia gerada, então acompanha o `relay.js` e está formatado e sem comentário como o resto. A biblioteca do Forge foi indentada para dar para ler, e nada além disso, porque é código de terceiro. Os prelúdios levaram indentação e quebra de linha, mas continuam com o `var` que tinham: eles rodam em outro realm, o lint não alcança lá dentro e mexer no que está dentro da string muda o que o usuário executa. Se você buscar `var` no projeto, é aí que os resultados aparecem.

Quando uma linha dentro de um desses textos ficava comprida demais, a quebra foi feita com continuação de linha, aquela barra invertida no fim da linha. Ela não entra no valor da string, então o código entregue continua igual byte a byte, e a fonte fica legível.

## Diagnóstico

`nucleo/diagnostico.js` é o primeiro arquivo a carregar e expõe duas coisas.

`registro` tem `erro`, `aviso`, `info` e `debug`. Em produção, `debug` e `info` ficam calados; os outros dois passam. Ninguém chama `console.log` direto no código do editor.

`ignorarErro(erro, contexto)` é o lugar para onde vão os erros que a gente decide engolir. E são muitos: falha de telemetria, cache que não abriu, media que não descartou. Nenhum deles pode derrubar a edição do usuário. A diferença em relação a um `catch` vazio é que aqui o erro fica guardado com um rótulo de onde aconteceu, e `registro.falhasToleradas()` devolve as últimas cem. Com `?diagnostico=1` na URL, ou `localStorage['synapse:diagnostico'] = '1'`, tudo isso passa a aparecer no console.

## Segurança, em uma linha

Um editor com preview ao vivo precisa compilar e executar código que ele acabou de receber. Isso é o produto, não um descuido. O que muda é onde isso acontece: tudo o que carrega script externo, escapa HTML, valida sintaxe, compila módulo ou avalia código no preview passa por `nucleo/seguranca.js`, que tem uma lista fechada de origens de CDN permitidas. O `SEGURANCA.md` detalha o modelo de ameaça e as regras.

## Dívidas que a gente conhece

- O `preview/entrada-e-execucao.js` tem mais de quatro mil linhas e faz coisa demais: detecção, transformação, popout e worker. Merecia ser quebrado em quatro arquivos.
- `RELAY_SRC` deixou de ser cópia manual, mas a geração ainda é um comando que alguém precisa lembrar de rodar. O `npm run check` avisa quando esquecem; um hook de commit resolveria de vez.
- Boa parte da interface é montada com HTML dentro de template literal. Funciona, mas é fácil de errar e obriga a lembrar do `esc` em todo lugar. Construir por nós seria melhor.
- Os prelúdios do preview e a biblioteca do Forge vivem dentro de string, o que os deixa fora do lint e do formatador.
- O `no-use-before-define` do ESLint está mais frouxo do que deveria por causa das funções de topo que se chamam entre si.
- Não tem teste automatizado. O que existe hoje é verificação de formatação, lint e sintaxe, e um roteiro manual de abrir o editor, importar um zip e ver o preview subir.
