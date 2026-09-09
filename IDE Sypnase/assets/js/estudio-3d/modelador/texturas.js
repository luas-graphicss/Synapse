'use strict';

const MOD3D_EXTENSOES_DA_TEXTURA = Object.freeze(['.png', '.jpg', '.jpeg', '.jfif', '.webp']);
const MOD3D_BLOCO_DA_TEXTURA = 1048576;
const MOD3D_TETO_DA_TEXTURA = 25165824;
const MOD3D_AVISO_DA_TEXTURA = 1572864;
const MOD3D_ESPERA_DA_TEXTURA = 60000;
const MOD3D_TETO_DAS_IMAGENS = 200;
const MOD3D_LADOS_DA_TEXTURA = Object.freeze([2048, 1024, 512, 256]);
const MOD3D_TEXTO_SEM_IMAGENS = 'Nenhuma imagem no projeto';
const MOD3D_TEXTO_SEM_TEXTURA = 'Sem textura';
const MOD3D_ERROS_DA_TEXTURA = Object.freeze({
    'sem-editor': 'O editor não respondeu',
    'sem-projeto': 'Escolha um projeto de destino',
    'sem-arquivo': 'A imagem saiu do projeto',
    'projeto-sumiu': 'O projeto saiu do editor',
    'grande-demais': 'A imagem é grande demais',
    incompleto: 'A imagem chegou incompleta',
    resumo: 'A imagem chegou corrompida',
    leitura: 'Não deu para ler a imagem',
    'sem-resposta': 'O editor demorou demais',
    falha: 'Não deu para carregar a imagem',
});

const mod3dTexturas = {
  lista: [],
  cache: new Map(),
  pedidos: new Map(),
  voos: new Map(),
  carregando: new Map(),
  versao: 0,
  recado: '',
  painel: null,
};

function mod3dTexturasVersao() {
  return mod3dTexturas.versao;
}

function mod3dTexturasTocar() {
  mod3dTexturas.versao += 1;
  if (typeof mod3dMarcarSujo === 'function') mod3dMarcarSujo();
}

function mod3dRotuloDaTextura(caminho) {
  const texto = String(caminho || '');
  if (!texto) return mod3dTexto(MOD3D_TEXTO_SEM_TEXTURA);
  const partes = texto.split('/');
  return partes[partes.length - 1] || texto;
}

function mod3dMimeDaTextura(caminho) {
  const extensao = mod3dExtensaoDoCaminho(caminho);
  if (extensao === '.png') return 'image/png';
  if (extensao === '.webp') return 'image/webp';
  if (extensao === '.jpg' || extensao === '.jpeg' || extensao === '.jfif') return 'image/jpeg';
  return 'application/octet-stream';
}

function mod3dTextoDoErroDaTextura(codigo) {
  return mod3dTexto(MOD3D_ERROS_DA_TEXTURA[codigo] || MOD3D_ERROS_DA_TEXTURA.falha);
}

function mod3dImagensDoProjetoRecebidas(dados) {
  const bruto = dados && Array.isArray(dados.lista) ? dados.lista : [];
  mod3dTexturas.lista = bruto
  .filter((item) => item && item.caminho)
  .slice(0, MOD3D_TETO_DAS_IMAGENS)
  .map((item) => ({
        caminho: String(item.caminho),
        bytes: Math.max(0, Math.trunc(Number(item.bytes) || 0)),
  }));
  mod3dTexturasTocar();
  if (typeof mod3dPintarPainelDosMateriais === 'function') mod3dPintarPainelDosMateriais();
}

function mod3dPedirImagensDoProjeto(canal, projeto) {
  if (!canal || !canal.ligado() || !projeto) return false;
  return canal.enviar('imagens-pedido', { projeto: String(projeto) });
}

function mod3dResolverTextura(id, resultado) {
  const pedido = mod3dTexturas.pedidos.get(id);
  mod3dTexturas.voos.delete(id);
  if (!pedido) return;
  mod3dTexturas.pedidos.delete(id);
  if (pedido.relogio) clearTimeout(pedido.relogio);
  pedido.resolver(resultado);
}

function mod3dAbrirTexturaEmVoo(dados) {
  const id = String(dados.pedidoId || '');
  if (!id || !mod3dTexturas.pedidos.has(id)) return;
  const tamanho = Math.trunc(Number(dados.tamanho) || 0);
  if (tamanho <= 0 || tamanho > MOD3D_TETO_DA_TEXTURA) {
    mod3dResolverTextura(id, { erro: 'grande-demais' });
    return;
  }
  try {
    mod3dTexturas.voos.set(id, {
        caminho: String(dados.caminho || ''),
        mime: String(dados.mime || ''),
        resumo: String(dados.resumo || ''),
        blocos: Math.trunc(Number(dados.blocos) || 0),
        bytes: new Uint8Array(tamanho),
        tamanho,
        escrito: 0,
        recebidos: 0,
        erro: '',
    });
  } catch (erro) {
    ignorarErro(erro, 'mod3dAbrirTexturaEmVoo');
    mod3dResolverTextura(id, { erro: 'grande-demais' });
  }
}

function mod3dBlocoDaTextura(dados) {
  const id = String(dados.pedidoId || '');
  const voo = mod3dTexturas.voos.get(id);
  if (!voo) return;
  const bloco = mod3dComoBytes(dados.dados);
  const posicao = Number(dados.inicio);
  if (!bloco || !isFinite(posicao) || posicao < 0) return;
  if (posicao + bloco.length > voo.tamanho) {
    voo.erro = 'incompleto';
    return;
  }
  voo.bytes.set(bloco, posicao);
  voo.escrito += bloco.length;
  voo.recebidos += 1;
  const pedido = mod3dTexturas.pedidos.get(id);
  if (pedido && pedido.progresso) pedido.progresso(voo.recebidos, voo.blocos);
}

function mod3dFecharTextura(dados) {
  const id = String(dados.pedidoId || '');
  const voo = mod3dTexturas.voos.get(id);
  if (!voo) return;
  if (voo.erro) {
    mod3dResolverTextura(id, { erro: voo.erro });
    return;
  }
  if (voo.escrito !== voo.tamanho || (voo.blocos && voo.recebidos !== voo.blocos)) {
    mod3dResolverTextura(id, { erro: 'incompleto' });
    return;
  }
  if (voo.resumo && mod3dResumoDosBytes(voo.bytes) !== voo.resumo) {
    mod3dResolverTextura(id, { erro: 'resumo' });
    return;
  }
  mod3dResolverTextura(id, { caminho: voo.caminho, mime: voo.mime, bytes: voo.bytes });
}

function mod3dTexturaResposta(envelope) {
  if (!envelope || !envelope.tipo) return false;
  const dados = envelope.dados || {};
  if (envelope.tipo === 'textura-inicio') {
    mod3dAbrirTexturaEmVoo(dados);
    return true;
  }
  if (envelope.tipo === 'textura-bloco') {
    mod3dBlocoDaTextura(dados);
    return true;
  }
  if (envelope.tipo === 'textura-fim') {
    mod3dFecharTextura(dados);
    return true;
  }
  if (envelope.tipo === 'textura-erro') {
    mod3dResolverTextura(String(dados.pedidoId || ''), {
        erro: String(dados.codigo || 'falha'),
        detalhe: String(dados.detalhe || ''),
    });
    return true;
  }
  return false;
}

function mod3dPedirTexturaDoProjeto(canal, pedido) {
  return new Promise((resolver) => {
      const dados = pedido || {};
      if (!canal || !canal.ligado()) {
        resolver({ erro: 'sem-editor' });
        return;
      }
      if (!dados.projeto) {
        resolver({ erro: 'sem-projeto' });
        return;
      }
      if (!dados.caminho) {
        resolver({ erro: 'sem-arquivo' });
        return;
      }
      const id = mod3dNovoId();
      mod3dTexturas.pedidos.set(id, {
          resolver,
          progresso: typeof dados.progresso === 'function' ? dados.progresso : null,
          relogio: setTimeout(
            () => mod3dResolverTextura(id, { erro: 'sem-resposta' }),
            MOD3D_ESPERA_DA_TEXTURA,
          ),
      });
      const foi = canal.enviar('textura-pedido', {
          pedidoId: id,
          projeto: String(dados.projeto),
          caminho: String(dados.caminho),
      });
      if (!foi) mod3dResolverTextura(id, { erro: 'sem-editor' });
  });
}

function mod3dTexturaEmCache(caminho) {
  if (!caminho) return null;
  return mod3dTexturas.cache.get(String(caminho)) || null;
}

function mod3dGuardarTexturaNoCache(caminho, bytes, mime, sourceProject) {
  const antiga = mod3dTexturas.cache.get(caminho);
  if (antiga && antiga.url) {
    try {
      URL.revokeObjectURL(antiga.url);
    } catch (erro) {
      ignorarErro(erro, 'mod3dGuardarTexturaNoCache');
    }
  }
  const tipo = mime || mod3dMimeDaTextura(caminho);
  const entrada = {
    project: sourceProject || (typeof mod3dDestino !== 'undefined' ? mod3dDestino : ''),
    caminho,
    bytes,
    mime: tipo,
    url: '',
    imagem: null,
    largura: 0,
    altura: 0,
  };
  try {
    entrada.url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  } catch (erro) {
    ignorarErro(erro, 'mod3dGuardarTexturaNoCache');
  }
  mod3dTexturas.cache.set(caminho, entrada);
  return entrada;
}

function mod3dPintarImagemDaTextura(entrada) {
  return new Promise((resolver) => {
      if (!entrada || !entrada.url) {
        resolver(entrada);
        return;
      }
      const imagem = new Image();
      imagem.onload = () => {
        entrada.imagem = imagem;
        entrada.largura = imagem.naturalWidth || 0;
        entrada.altura = imagem.naturalHeight || 0;
        mod3dTexturasTocar();
        resolver(entrada);
      };
      imagem.onerror = () => {
        entrada.imagem = null;
        resolver(entrada);
      };
      imagem.src = entrada.url;
  });
}

function mod3dCarregarTextura(caminho) {
  const chave = mod3dCaminhoDaTexturaSeguro(caminho);
  if (!chave) return Promise.resolve(null);
  const projeto = typeof mod3dDestino !== 'undefined' ? mod3dDestino : '';
  const pronta = mod3dTexturas.cache.get(chave);
  if (pronta && pronta.project === projeto) return Promise.resolve(pronta);
  const requestKey = `${projeto}:${chave}`;
  const emVoo = mod3dTexturas.carregando.get(requestKey);
  if (emVoo) return emVoo;
  const canal = typeof mod3dCanalDaAba !== 'undefined' ? mod3dCanalDaAba : null;
  const tarefa = mod3dPedirTexturaDoProjeto(canal, { projeto, caminho: chave })
  .then((feito) => {
      mod3dTexturas.carregando.delete(requestKey);
      if (!feito || feito.erro) {
        mod3dTexturas.recado = mod3dTextoDoErroDaTextura(feito ? feito.erro : 'falha');
        mod3dTexturasTocar();
        return null;
      }
      mod3dTexturas.recado = '';
      const entrada = mod3dGuardarTexturaNoCache(chave, feito.bytes, feito.mime, projeto);
      return mod3dPintarImagemDaTextura(entrada);
  })
  .catch((erro) => {
      ignorarErro(erro, 'mod3dCarregarTextura');
      mod3dTexturas.carregando.delete(requestKey);
      return null;
  });
  mod3dTexturas.carregando.set(requestKey, tarefa);
  return tarefa;
}

function mod3dImagemDaTextura(caminho) {
  const chave = mod3dCaminhoDaTexturaSeguro(caminho);
  if (!chave) return null;
  const entrada = mod3dTexturas.cache.get(chave);
  const sourceProject = typeof mod3dDestino !== 'undefined' ? mod3dDestino : '';
  if (entrada && entrada.project === sourceProject) return entrada.imagem;
  mod3dCarregarTextura(chave);
  return null;
}

function mod3dBytesDaTextura(caminho) {
  const entrada = mod3dTexturaEmCache(mod3dCaminhoDaTexturaSeguro(caminho));
  const sourceProject = typeof mod3dDestino !== 'undefined' ? mod3dDestino : '';
  return entrada && entrada.project === sourceProject ? entrada.bytes : null;
}

function mod3dTamanhoDaTextura(caminho) {
  const chave = mod3dCaminhoDaTexturaSeguro(caminho);
  const entrada = mod3dTexturaEmCache(chave);
  if (entrada && entrada.bytes) return entrada.bytes.length;
  for (let i = 0; i < mod3dTexturas.lista.length; i++) {
    if (mod3dTexturas.lista[i].caminho === chave) return mod3dTexturas.lista[i].bytes;
  }
  return 0;
}

function mod3dTexturaPesada(caminho, embutir) {
  if (embutir === false) return false;
  return mod3dTamanhoDaTextura(caminho) > MOD3D_AVISO_DA_TEXTURA;
}

function mod3dReduzirTextura(caminho, lado) {
  const chave = mod3dCaminhoDaTexturaSeguro(caminho);
  const alvo = Math.max(16, Math.trunc(Number(lado) || 0));
  if (!chave || !alvo) return Promise.resolve(null);
  return mod3dCarregarTextura(chave).then((entrada) => {
      if (!entrada || !entrada.imagem) return null;
      const maior = Math.max(entrada.largura, entrada.altura);
      if (!maior) return null;
      const peso = Math.min(1, alvo / maior);
      const largura = Math.max(1, Math.round(entrada.largura * peso));
      const altura = Math.max(1, Math.round(entrada.altura * peso));
      const tela = document.createElement('canvas');
      tela.width = largura;
      tela.height = altura;
      const pincel = tela.getContext('2d');
      if (!pincel) return null;
      pincel.drawImage(entrada.imagem, 0, 0, largura, altura);
      return new Promise((resolver) => {
          tela.toBlob((blob) => {
              if (!blob) {
                resolver(null);
                return;
              }
              blob
              .arrayBuffer()
              .then((buffer) => {
                  const nova = mod3dGuardarTexturaNoCache(
                    chave,
                    new Uint8Array(buffer),
                    'image/png',
                    entrada.project,
                  );
                  nova.modelerOverride = true;
                  if (typeof mod3dProjectDocument !== 'undefined' && mod3dProjectDocument) {
                    mod3dProjectDocument.changed();
                  }
                  return mod3dPintarImagemDaTextura(nova);
              })
              .then((pronta) => {
                  mod3dTexturasTocar();
                  resolver(pronta);
              })
              .catch((erro) => {
                  ignorarErro(erro, 'mod3dReduzirTextura');
                  resolver(null);
              });
            }, 'image/png');
      });
  });
}

function textureMapPathsOfMaterial(material) {
  if (typeof materialTextureMapPaths === 'function') return materialTextureMapPaths(material);
  const caminho = mod3dCaminhoDaTexturaSeguro(material ? material.textura : '');
  return caminho ? [caminho] : [];
}

function mod3dCaminhosDasTexturasDaCena() {
  const saida = [];
  mod3dGrafo.nos.forEach((no) => {
      if (!Array.isArray(no.materiais)) return;
      no.materiais.forEach((material) => {
          textureMapPathsOfMaterial(material).forEach((caminho) => {
              if (caminho && saida.indexOf(caminho) < 0) saida.push(caminho);
          });
      });
  });
  return saida;
}

function mod3dGarantirTexturasDaCena() {
  const caminhos = mod3dCaminhosDasTexturasDaCena();
  if (!caminhos.length) return Promise.resolve([]);
  return Promise.all(caminhos.map((caminho) => mod3dCarregarTextura(caminho)));
}

function mod3dMontarPainelDasTexturas() {
  const caixa = mod3dNo('div', 'mod3d-textura');
  const linha = mod3dNo('div', 'mod3d-linha');
  const rotulo = mod3dNo('label', 'mod3d-entrada-rotulo', mod3dTexto('Textura'));
  rotulo.setAttribute('for', 'mod3dTexturaDoMaterial');
  const seletor = document.createElement('select');
  seletor.id = 'mod3dTexturaDoMaterial';
  seletor.className = 'mod3d-seletor mod3d-seletor-curto';
  const atualizar = mod3dPainelBotao('Buscar imagens', 'Pede a lista de imagens do projeto');
  linha.appendChild(rotulo);
  linha.appendChild(seletor);
  linha.appendChild(atualizar);
  caixa.appendChild(linha);

  const marca = mod3dNo('label', 'mod3d-check');
  const embutir = document.createElement('input');
  embutir.type = 'checkbox';
  embutir.id = 'mod3dEmbutirTextura';
  marca.setAttribute('for', 'mod3dEmbutirTextura');
  marca.appendChild(embutir);
  marca.appendChild(mod3dNo('span', '', mod3dTexto('Embutir a imagem no arquivo')));
  caixa.appendChild(marca);

  const reduzir = mod3dNo('div', 'mod3d-ferramentas');
  reduzir.appendChild(mod3dNo('span', 'mod3d-trio-rotulo', mod3dTexto('Reduzir para')));
  MOD3D_LADOS_DA_TEXTURA.forEach((lado) => {
      const botao = mod3dPainelBotao(`${lado}px`, 'Reamostra a imagem antes de embutir');
      botao.dataset.lado = String(lado);
      botao.addEventListener('click', () => {
          const no = mod3dNoDaEdicao() || mod3dNoSelecionado();
          if (!no) return;
          const material = mod3dMaterialDoNo(no, mod3dMaterialAtivoDoPainel(no));
          if (!material.textura) return;
          mod3dReduzirTextura(material.textura, lado).then(() => {
              if (typeof mod3dPintarPainelDosMateriais === 'function') mod3dPintarPainelDosMateriais();
          });
      });
      reduzir.appendChild(botao);
  });
  caixa.appendChild(reduzir);

  const aviso = mod3dNo('p', 'mod3d-malha-recado', '');
  caixa.appendChild(aviso);

  seletor.addEventListener('change', () => {
      const no = mod3dNoDaEdicao() || mod3dNoSelecionado();
      if (!no) return;
      mod3dDefinirCampoDoMaterial(no, mod3dMaterialAtivoDoPainel(no), 'textura', seletor.value);
      if (seletor.value) {
        mod3dCarregarTextura(seletor.value);
        if (typeof mod3dGarantirUvDoNo === 'function') mod3dGarantirUvDoNo(no);
      }
      mod3dPintarPainelDosMateriais();
  });
  embutir.addEventListener('change', () => {
      const no = mod3dNoDaEdicao() || mod3dNoSelecionado();
      if (!no) return;
      mod3dDefinirCampoDoMaterial(no, mod3dMaterialAtivoDoPainel(no), 'embutir', embutir.checked);
      mod3dPintarPainelDosMateriais();
  });
  atualizar.addEventListener('click', () => {
      const canal = typeof mod3dCanalDaAba !== 'undefined' ? mod3dCanalDaAba : null;
      const projeto = typeof mod3dDestino !== 'undefined' ? mod3dDestino : '';
      mod3dPedirImagensDoProjeto(canal, projeto);
  });

  mod3dTexturas.painel = { caixa, seletor, embutir, aviso, atualizar, assinatura: '' };
  return mod3dTexturas.painel;
}

function mod3dPintarOpcoesDasTexturas(seletor, escolhido) {
  seletor.textContent = '';
  const vazio = document.createElement('option');
  vazio.value = '';
  vazio.textContent = mod3dTexto(MOD3D_TEXTO_SEM_TEXTURA);
  seletor.appendChild(vazio);
  const caminhos = mod3dTexturas.lista.map((item) => item.caminho);
  if (escolhido && caminhos.indexOf(escolhido) < 0) caminhos.push(escolhido);
  caminhos.forEach((caminho) => {
      const opcao = document.createElement('option');
      opcao.value = caminho;
      opcao.textContent = mod3dRotuloDaTextura(caminho);
      opcao.title = caminho;
      seletor.appendChild(opcao);
  });
  seletor.value = escolhido || '';
}

function mod3dPintarPainelDasTexturas(material) {
  const painel = mod3dTexturas.painel;
  if (!painel) return;
  if (!material) {
    painel.caixa.classList.remove('on');
    painel.seletor.disabled = true;
    painel.embutir.disabled = true;
    painel.aviso.textContent = '';
    return;
  }
  painel.caixa.classList.add('on');
  painel.seletor.disabled = false;
  painel.embutir.disabled = !material.textura;
  const assinatura = [
    material.textura,
    material.embutir ? 1 : 0,
    mod3dTexturas.lista.length,
    mod3dTexturas.versao,
  ].join('|');
  if (assinatura === painel.assinatura) return;
  painel.assinatura = assinatura;
  mod3dPintarOpcoesDasTexturas(painel.seletor, material.textura);
  painel.embutir.checked = material.embutir !== false;
  if (mod3dTexturas.recado) {
    painel.aviso.textContent = mod3dTexturas.recado;
    return;
  }
  if (!mod3dTexturas.lista.length && !material.textura) {
    painel.aviso.textContent = mod3dTexto(MOD3D_TEXTO_SEM_IMAGENS);
    return;
  }
  if (!material.textura) {
    painel.aviso.textContent = '';
    return;
  }
  const tamanho = mod3dTamanhoDaTextura(material.textura);
  const entrada = mod3dTexturaEmCache(material.textura);
  const medida = entrada && entrada.largura ? `${entrada.largura}×${entrada.altura} · ` : '';
  if (mod3dTexturaPesada(material.textura, material.embutir)) {
    painel.aviso.textContent = `${medida}${mod3dTamanhoLegivel(tamanho)} · ${mod3dTexto('imagem pesada para embutir')}`;
    return;
  }
  painel.aviso.textContent = `${medida}${mod3dTamanhoLegivel(tamanho)}`;
}
