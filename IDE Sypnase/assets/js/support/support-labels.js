(function (root) {
    'use strict';

    const LABELS = {
      supportButtonText: 'Ajuda',
      supportButtonHint: 'Documentação oficial da IDE e envio de relato de bug.',
      menuHeading: 'Ajuda',
      documentationItemText: 'Documentação da IDE',
      documentationItemDetail: 'Abre aqui dentro, sobre o editor',
      bugReportItemText: 'Reportar um bug',
      bugReportItemDetail: 'Formulário enviado para a equipe',
      dialogTitle: 'Reportar um bug',
      dialogSubtitle:
      'Conte o que aconteceu com detalhe. O relato vai direto para quem cuida da IDE.',
      environmentHeading: 'Dados técnicos enviados junto',
      submitText: 'Enviar relato',
      cancelText: 'Cancelar',
      closeText: 'Fechar',
      sendingText: 'Enviando o relato...',
      deliveredText: 'Relato enviado. Obrigado por avisar.',
      missingFieldsText: 'Preencha os campos marcados antes de enviar.',
      fallbackText:
      'O envio automático falhou. Abrimos o seu programa de email com o relato pronto para enviar.',
      requiredText: 'obrigatório',
      selectPlaceholderText: 'Escolha uma opção',
    };

    root.SynapseSupportLabels = Object.freeze(LABELS);
})(typeof globalThis !== 'undefined' ? globalThis : window);
