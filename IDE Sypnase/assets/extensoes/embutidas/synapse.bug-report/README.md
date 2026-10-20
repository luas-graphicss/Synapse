# Relatar bug

Extensão embutida da Synapse IDE que substitui o antigo módulo `assets/js/support/bug-report-*`.

- Comando `synapse.bugReport.open` (menu Ajuda → Relatar um bug).
- Formulário em webview com CSP e nonce; envio `POST api/bug-report` na mesma origem da IDE (`network:self`).
- Se o servidor não responder, abre o cliente de e-mail com o texto pronto.
- Ferramenta MCP `ext_synapse_bug_report__draft` monta o texto do relato para agentes sem enviar nada.
