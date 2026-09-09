'use strict';

const ORIGENS_DE_SCRIPT_PERMITIDAS = Object.freeze([
    'https://esm.sh',
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
    'https://cdnjs.cloudflare.com',
]);

const SCRIPT_LOAD_TIMEOUT_MS = 20000;

const MAPA_DE_ESCAPE = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
});

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (caractere) => MAPA_DE_ESCAPE[caractere]);
    }

    function sanitizarUrl(url, alternativa = 'about:blank') {
      return SynapseUrlPolicy.resourceUrl(url, alternativa);
    }

    function sanitizarUrlDeNavegacao(url, alternativa = 'about:blank') {
      return SynapseUrlPolicy.navigationUrl(url, alternativa);
    }

    function abrirJanelaSegura(url, alvo = '_blank', caracteristicas = '') {
      const destino = sanitizarUrlDeNavegacao(url, '');
      if (!destino) return null;
      const partes = [caracteristicas, 'noopener', 'noreferrer'].filter(Boolean).join(',');
      return window.open(destino, alvo, partes);
    }

    function carregarScriptExterno(url, opcoes = {}) {
      const { tipo = 'text/javascript', documento = window.document } = opcoes;
      let origem;
      try {
        origem = new URL(url).origin;
      } catch {
        return Promise.reject(new Error(`URL de script inválida: ${url}`));
      }
      if (!ORIGENS_DE_SCRIPT_PERMITIDAS.includes(origem)) {
        return Promise.reject(new Error(`origem de script não permitida: ${origem}`));
      }
      return new Promise((resolver, rejeitar) => {
          const script = documento.createElement('script');
          script.src = url;
          script.type = tipo;
          script.async = true;
          script.crossOrigin = 'anonymous';
          script.referrerPolicy = 'no-referrer';
          let timeoutId = 0;
          const clearTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = 0;
          };
          script.addEventListener('load', () => {
              clearTimer();
              resolver();
          });
          script.addEventListener('error', () => {
              clearTimer();
              script.remove();
              rejeitar(new Error(`falha ao carregar script externo: ${url}`));
          });
          documento.head.append(script);
          timeoutId = setTimeout(() => {
              script.remove();
              rejeitar(new Error(`tempo esgotado ao carregar script externo: ${url}`));
            }, SCRIPT_LOAD_TIMEOUT_MS);
      });
    }

    function validarSintaxe(codigo, opcoes = {}) {
      const { assincrono = true } = opcoes;
      const corpo = assincrono ? `async function __validacao(){\n${codigo}\n}` : String(codigo);
      try {
        new Function(corpo);
        return null;
      } catch (erro) {
        return erro instanceof Error ? erro.message : String(erro);
      }
    }

    function compilarModuloIsolado(fonte, nome) {
      const modulo = { exports: {} };
      try {
        const fabrica = new Function('module', 'exports', fonte);
        fabrica(modulo, modulo.exports);
      } catch (erro) {
        registro.erro(`falha ao compilar o módulo interno "${nome}"`, erro);
        throw erro;
      }
      return modulo.exports;
    }

    function avaliarNoPreview(janela, codigo) {
      if (!janela) throw new Error('preview indisponível para avaliação');
      const fonte = String(codigo ?? '').trim();
      if (!fonte) return undefined;
      const FabricaDeFuncao = janela.Function;
      if (typeof FabricaDeFuncao !== 'function') throw new Error('janela do preview sem `Function`');
      const corpo = /\breturn\b|;|\n/.test(fonte) ? fonte : `return (${fonte});`;
      const avaliar = new FabricaDeFuncao('window', 'document', `"use strict";\n${corpo}`);
      return avaliar.call(janela, janela, janela.document);
    }

    window.escaparHtml = escaparHtml;
    window.sanitizarUrl = sanitizarUrl;
    window.sanitizarUrlDeNavegacao = sanitizarUrlDeNavegacao;
    window.abrirJanelaSegura = abrirJanelaSegura;
    window.carregarScriptExterno = carregarScriptExterno;
    window.validarSintaxe = validarSintaxe;
    window.compilarModuloIsolado = compilarModuloIsolado;
    window.avaliarNoPreview = avaliarNoPreview;
