# Marcadores TODO

Extensão embutida da Synapse IDE que destaca os marcadores TODO, FIXME, HACK, NOTE e XXX no editor ativo. A lista de palavras pode ser trocada na configuração synapse.todo.keywords.

Cada marcador também vira um diagnóstico leve no painel Problemas, e a barra de status mostra quantos marcadores existem no arquivo aberto. Clicando nesse item aparece a lista completa e dá para ir direto até cada um.

Agentes conectados pelo MCP contam com a ferramenta list_markers, que percorre o projeto usando um padrão glob e devolve todos os marcadores encontrados.
