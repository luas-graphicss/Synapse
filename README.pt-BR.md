# Synapse

[Read in English](README.md)

O Synapse é um editor de código para projetos web que roda inteiro no navegador. Você abre a página, cria ou importa um projeto e já começa a trabalhar, com o explorador de arquivos, o editor, o preview ao vivo e um terminal na mesma tela. Não tem conta nem cadastro. Os projetos ficam salvos no próprio navegador, então nada sai da sua máquina a não ser que você exporte ou conecte algum serviço externo.

O editor tem realce de sintaxe, dobra de código, minimapa, busca, atalhos de teclado e histórico de versões. O preview atualiza enquanto você digita, simula dispositivos diferentes, muda o zoom, recarrega ou abre em outra aba, e mostra os erros de execução da página. O terminal roda comandos dentro da pasta do projeto com saída em tempo real e processos em segundo plano, e a parte de build instala dependências, roda scripts do npm, sobe servidor de desenvolvimento e compila até com CMake. Dá para importar arquivos ZIP ou pastas inteiras e exportar o projeto quando quiser.

Além do básico, tem algumas partes maiores. O Blepse 3D é um estúdio de modelagem dentro do editor, onde você cria modelos, exporta em GLB e usa direto no projeto. Tem um assistente de IA que funciona com vários provedores, lê os arquivos do projeto e sugere edições. E tem um sistema de extensões com API própria, permissões, webviews e um pequeno registro de pacotes, além de três extensões que já vêm com o editor, que são o formulário de relato de bug, o ordenador de linhas e o destacador de TODO.

Uma das partes principais é o conector MCP. Dentro do editor você gera um endereço privado, e qualquer agente que fale MCP consegue usar esse endereço para abrir arquivos, editar código, usar o terminal e olhar o preview do projeto que está aberto no seu navegador. Agentes que só têm terminal podem abrir o mesmo endereço e recebem as instruções junto com um cliente de linha de comando pronto em Python, Node ou Bash. A conexão passa por um relay pequeno que roda no Cloudflare Workers.

## Como usar

O jeito mais rápido é abrir a versão publicada em https://sypnase-live-preview.vercel.app e criar um projeto na tela inicial. A documentação completa está nas [páginas de documentação](IDE%20Sypnase/docs), que também ficam publicadas no mesmo site.

Para rodar por conta própria, sirva a pasta IDE Sypnase com qualquer servidor de arquivos estáticos. O editor, o preview e o estúdio 3D funcionam assim. O assistente de IA, o relato de bug e a integração com o Notion usam as funções serverless da pasta api, então para isso o projeto precisa rodar na Vercel ou localmente com o vercel dev. O relay do MCP é um Worker separado do Cloudflare, configurado nos arquivos do Wrangler que ficam na raiz da pasta da IDE, e pode ser publicado com o próprio Wrangler.

As mudanças da API de extensões ficam registradas no [changelog da API](IDE%20Sypnase/assets/extensoes/api-changelog.md), e cada extensão embutida tem seu próprio README e CHANGELOG na [pasta de extensões embutidas](IDE%20Sypnase/assets/extensoes/embutidas).

## Tempo de desenvolvimento

O Synapse levou cerca de sete meses e meio para chegar nessa versão, e o projeto está completo na forma atual.

## Licença

GNU General Public License versão 3. O texto completo está no arquivo LICENSE.
