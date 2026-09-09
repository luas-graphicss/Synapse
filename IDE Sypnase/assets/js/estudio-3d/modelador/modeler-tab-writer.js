'use strict';

function modelerTabWriteDocument(tab, session) {
  const html = modelerTabDocumentHtml(session);
  const page = tab.document;
  page.open();
  page.write(html);
  page.close();
}
