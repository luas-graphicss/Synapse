# Relatar bug

Extensão que já vem embutida na Synapse IDE e substitui o antigo módulo interno de relato de bug.

Ela adiciona o comando synapse.bugReport.open, que também aparece no menu Ajuda como Relatar um bug. O comando abre um formulário em webview protegido por CSP com nonce, e o relato vai para o endpoint api/bug-report na mesma origem da IDE, usando a permissão network:self. Se o servidor não responder, a extensão abre o seu cliente de e-mail com o texto já preenchido, e aí é só enviar.

Agentes conectados pelo MCP contam com a ferramenta draft, que monta o texto do relato sem enviar nada.
