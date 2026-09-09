'use strict';

const MOD3D_TAMANHO_DO_BLOCO = 8388608;
const MOD3D_TETO_DO_ARQUIVO = 100663296;
const MOD3D_ESPERA_DA_TRAVESSIA = 60000;
const MOD3D_ESPERA_DA_RESPOSTA = 30000;
const MOD3D_EXTENSAO_DO_MODELO = '.glb';
const MOD3D_NOME_PADRAO = 'modelo.glb';
const MOD3D_TETO_DO_SUFIXO = 999;
const MOD3D_TETO_DO_NOME = 96;

const mod3dTravessias = new Map();
const mod3dPedidosDeGravacao = new Map();

function mod3dResumoDosBytes(bytes) {
  let resumo = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    resumo ^= bytes[i];
    resumo =
    (resumo +
      ((resumo << 1) + (resumo << 4) + (resumo << 7) + (resumo << 8) + (resumo << 24))) >>>
    0;
  }
  return resumo.toString(16).padStart(8, '0');
}

function mod3dTamanhoLegivel(bytes) {
  const quanto = Number(bytes) || 0;
  if (quanto < 1024) return `${quanto} B`;
  if (quanto < 1048576) return `${(quanto / 1024).toFixed(1)} KB`;
  return `${(quanto / 1048576).toFixed(2)} MB`;
}

function mod3dComoBytes(dados) {
  if (!dados) return null;
  if (dados instanceof Uint8Array) return dados;
  if (dados instanceof ArrayBuffer) return new Uint8Array(dados);
  if (dados.buffer && typeof dados.byteLength === 'number') {
    try {
      return new Uint8Array(dados.buffer, dados.byteOffset || 0, dados.byteLength);
    } catch (erro) {
      ignorarErro(erro, 'mod3dComoBytes');
      return null;
    }
  }
  return null;
}

function mod3dNomeDeArquivo(bruto) {
  let nome = String(bruto == null ? '' : bruto).trim();
  const corte = Math.max(nome.lastIndexOf('/'), nome.lastIndexOf('\\'));
  if (corte >= 0) nome = nome.slice(corte + 1);
  nome = nome
  .replace(/[\u0000-\u001f<>:"|?*]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[.\s]+/, '')
      .trim();
      if (!nome) return MOD3D_NOME_PADRAO;
      let base = nome.replace(/\.[a-z0-9]+$/i, '').trim();
      if (!base) base = 'modelo';
      if (base.length > MOD3D_TETO_DO_NOME) base = base.slice(0, MOD3D_TETO_DO_NOME).trim();
      return base + MOD3D_EXTENSAO_DO_MODELO;
    }

    function mod3dCaminhoLivre(projeto, caminho) {
      if (!projeto || !projeto.files || !projeto.files.has(caminho)) return caminho;
      const base = caminho.slice(0, caminho.length - MOD3D_EXTENSAO_DO_MODELO.length);
      for (let i = 2; i <= MOD3D_TETO_DO_SUFIXO; i++) {
        const tentativa = `${base}-${i}${MOD3D_EXTENSAO_DO_MODELO}`;
        if (!projeto.files.has(tentativa)) return tentativa;
      }
      return '';
    }

    function mod3dProjetoPorId(id) {
      if (typeof State === 'undefined' || !State || !Array.isArray(State.projects)) return null;
      const alvo = String(id || '');
      if (!alvo) return State.projects.find((projeto) => projeto.id === State.active) || null;
      return State.projects.find((projeto) => projeto.id === alvo) || null;
    }

    function mod3dTravaDoArquivo(projeto, caminho) {
      try {
        if (typeof tmBloqueioEscrita !== 'function') return null;
        return tmBloqueioEscrita(caminho, '', projeto.id) || null;
      } catch (erro) {
        ignorarErro(erro, 'mod3dTravaDoArquivo');
        return null;
      }
    }

    function mod3dDescricaoDaTrava(trava) {
      try {
        if (typeof tmLockDesc === 'function') return tmLockDesc(trava);
      } catch (erro) {
        ignorarErro(erro, 'mod3dDescricaoDaTrava');
      }
      return trava && trava.agent ? String(trava.agent) : '';
    }

    function mod3dGravarModelo(pedido) {
      const projeto = mod3dResolveOpenProject(pedido.projeto);
      if (!projeto) return { erro: 'projeto-sumiu' };
      if (
        typeof est3dPackGLB !== 'function' ||
        typeof mod3dFinalizeGlbExport !== 'function' ||
        typeof makeFileEntry !== 'function' ||
        typeof mcpAfterWrite !== 'function' ||
        typeof mcpNorm !== 'function'
      ) {
        return { erro: 'sem-porta' };
      }
      let caminho = '';
      try {
        caminho = pedido.documentToken
        ? mcpNorm(mod3dModelerProjectPath(pedido.nome, '.glb'))
        : mcpNorm(mod3dNomeDeArquivo(pedido.nome));
      } catch (erro) {
        ignorarErro(erro, 'mod3dGravarModelo');
        return { erro: 'nome-invalido' };
      }
      if (!pedido.documentToken && caminho.indexOf('/') >= 0) return { erro: 'nome-invalido' };
      if (!pedido.documentToken && projeto.files.has(caminho) && !pedido.sobrescrever) {
        const livre = mod3dCaminhoLivre(projeto, caminho);
        if (!livre) return { erro: 'nome-ocupado' };
        caminho = livre;
      }
      const trava = mod3dTravaDoArquivo(projeto, caminho);
      if (trava) return { erro: 'travado', detalhe: mod3dDescricaoDaTrava(trava) };
      let bytes = null;
      let report = null;
      try {
        const validated = mod3dFinalizeGlbExport(pedido, projeto);
        bytes = validated.bytes;
        report = validated.report;
      } catch (error) {
        registro.erro('GLB validation rejected the write', error);
        return { erro: 'invalid-glb', detalhe: error.message || String(error) };
      }
      if (pedido.documentToken) {
        try {
          return mod3dCommitModelerDocument(pedido, projeto, bytes, report);
        } catch (error) {
          return { erro: 'document-conflict', detalhe: error.message || String(error) };
        }
      }
      const sobrescrito = projeto.files.has(caminho);
      try {
        if (typeof makeSnapshot === 'function') {
          makeSnapshot(projeto, `auto: antes do Blepse 3D gravar ${caminho}`);
        }
      } catch (erro) {
        ignorarErro(erro, 'mod3dSnapshotDaGravacao');
      }
      const anterior = projeto.files.get(caminho);
      if (anterior && anterior.isText && anterior.text != null && typeof mcpHist === 'function') {
        try {
          mcpHist(anterior);
        } catch (erro) {
          ignorarErro(erro, 'mod3dHistoricoDaGravacao');
        }
      }
      projeto.files.set(caminho, makeFileEntry(caminho, bytes));
      try {
        if (typeof EST3D !== 'undefined' && EST3D && EST3D.cache) {
          EST3D.cache.delete(`${projeto.id}:${caminho}`);
        }
      } catch (erro) {
        ignorarErro(erro, 'mod3dCacheDoEstudio');
      }
      mcpAfterWrite(projeto, caminho);
      try {
        if (projeto.id === State.active && typeof openFileInEditor === 'function') {
          openFileInEditor(caminho);
        }
      } catch (erro) {
        ignorarErro(erro, 'mod3dAbrirNoEditor');
      }
      try {
        if (typeof toast === 'function') {
          toast('Blepse 3D', `${caminho} · ${mod3dTamanhoLegivel(bytes.length)}`, 'ok');
        }
      } catch (erro) {
        ignorarErro(erro, 'mod3dAvisoDaGravacao');
      }
      registro.info('modelador 3d: modelo gravado', caminho, bytes.length);
      return { caminho, tamanho: bytes.length, projeto: projeto.name, sobrescrito, report };
    }

    function mod3dEncerrarPorta(travessia) {
      if (!travessia || !travessia.porta) return;
      try {
        travessia.porta.onmessage = null;
        travessia.porta.close();
      } catch (erro) {
        ignorarErro(erro, 'mod3dEncerrarPorta');
      }
      travessia.porta = null;
    }

    function mod3dLimparTravessiasVelhas() {
      const agora = Date.now();
      mod3dTravessias.forEach((travessia, id) => {
          if (agora - travessia.quando <= MOD3D_ESPERA_DA_TRAVESSIA) return;
          mod3dEncerrarPorta(travessia);
          mod3dTravessias.delete(id);
          registro.aviso('modelador 3d: travessia abandonada', id);
      });
    }

    function mod3dResponderGravacao(travessia, tipo, dados) {
      try {
        travessia.canal.responder(travessia.via, tipo, { pedidoId: travessia.id, ...dados });
      } catch (erro) {
        ignorarErro(erro, 'mod3dResponderGravacao');
      }
    }

    function mod3dAbrirTravessia(envelope, via, portas, canal) {
      const dados = envelope.dados || {};
      const id = String(dados.pedidoId || '');
      if (!id) return;
      mod3dLimparTravessiasVelhas();
      const travessia = {
        id,
        via,
        canal,
        projeto: String(dados.projeto || ''),
        nome: String(dados.nome || MOD3D_NOME_PADRAO),
        sobrescrever: dados.sobrescrever === true,
        json: dados.json || null,
        expected: dados.expected || null,
        conversion: dados.conversion || null,
        documentToken: dados.documentToken || '',
        documentConfirmed: dados.documentConfirmed === true,
        tamanho: Number(dados.tamanho) || 0,
        blocos: Number(dados.blocos) || 0,
        resumo: String(dados.resumo || ''),
        bin: null,
        escrito: 0,
        recebidos: 0,
        quando: Date.now(),
        porta: null,
        erro: '',
      };
      mod3dTravessias.set(id, travessia);
      if (travessia.tamanho < 0 || travessia.tamanho > MOD3D_TETO_DO_ARQUIVO) {
        travessia.erro = 'grande-demais';
        return;
      }
      try {
        travessia.bin = new Uint8Array(travessia.tamanho);
      } catch (erro) {
        ignorarErro(erro, 'mod3dAbrirTravessia');
        travessia.erro = 'grande-demais';
        return;
      }
      const porta = portas && portas.length ? portas[0] : null;
      if (!porta) return;
      travessia.porta = porta;
      porta.onmessage = (evento) => mod3dPelaPorta(id, evento && evento.data);
      try {
        if (typeof porta.start === 'function') porta.start();
      } catch (erro) {
        ignorarErro(erro, 'mod3dIniciarPorta');
      }
    }

    function mod3dReceberBloco(id, inicio, dados) {
      const travessia = mod3dTravessias.get(id);
      if (!travessia || travessia.erro) return;
      const bloco = mod3dComoBytes(dados);
      const posicao = Number(inicio);
      if (!bloco || !isFinite(posicao) || posicao < 0 || posicao + bloco.length > travessia.tamanho) {
        travessia.erro = 'incompleto';
        return;
      }
      travessia.bin.set(bloco, posicao);
      travessia.escrito += bloco.length;
      travessia.recebidos += 1;
      travessia.quando = Date.now();
    }

    function mod3dPelaPorta(id, mensagem) {
      if (!mensagem) return;
      if (mensagem.tipo === 'bloco') {
        mod3dReceberBloco(id, mensagem.inicio, mensagem.dados);
        return;
      }
      if (mensagem.tipo === 'fim') mod3dFecharTravessia(id);
    }

    function mod3dFecharTravessia(id) {
      const travessia = mod3dTravessias.get(id);
      if (!travessia) return;
      mod3dTravessias.delete(id);
      mod3dEncerrarPorta(travessia);
      if (travessia.erro) {
        mod3dResponderGravacao(travessia, 'gravar-erro', { codigo: travessia.erro });
        return;
      }
      if (travessia.escrito !== travessia.tamanho || travessia.recebidos !== travessia.blocos) {
        mod3dResponderGravacao(travessia, 'gravar-erro', { codigo: 'incompleto' });
        return;
      }
      if (travessia.resumo && mod3dResumoDosBytes(travessia.bin) !== travessia.resumo) {
        mod3dResponderGravacao(travessia, 'gravar-erro', { codigo: 'resumo' });
        return;
      }
      const feito = mod3dGravarModelo(travessia);
      if (feito.erro) {
        mod3dResponderGravacao(travessia, 'gravar-erro', {
            codigo: feito.erro,
            detalhe: feito.detalhe || '',
        });
        return;
      }
      mod3dResponderGravacao(travessia, 'gravar-ok', feito);
    }

    function mod3dPonteAtender(envelope, via, portas, canal) {
      if (!envelope || !canal) return false;
      const dados = envelope.dados || {};
      if (envelope.tipo === 'gravar-inicio') {
        mod3dAbrirTravessia(envelope, via, portas, canal);
        return true;
      }
      if (envelope.tipo === 'gravar-bloco') {
        mod3dReceberBloco(String(dados.pedidoId || ''), dados.inicio, dados.dados);
        return true;
      }
      if (envelope.tipo === 'gravar-fim') {
        mod3dFecharTravessia(String(dados.pedidoId || ''));
        return true;
      }
      return false;
    }

    function mod3dResolverPedido(id, resultado) {
      const pedido = mod3dPedidosDeGravacao.get(id);
      if (!pedido) return;
      mod3dPedidosDeGravacao.delete(id);
      if (pedido.relogio) clearTimeout(pedido.relogio);
      pedido.resolver(resultado);
    }

    function mod3dPonteResposta(envelope) {
      const dados = envelope && envelope.dados ? envelope.dados : {};
      const id = String(dados.pedidoId || '');
      if (!id) return false;
      if (envelope.tipo === 'gravar-ok') {
        mod3dResolverPedido(id, {
            caminho: String(dados.caminho || ''),
            tamanho: Number(dados.tamanho) || 0,
            projeto: String(dados.projeto || ''),
            sobrescrito: dados.sobrescrito === true,
            report: dados.report || null,
            binding: dados.binding || null,
            sourcePath: dados.sourcePath || '',
            backup: dados.backup || '',
            warnings: dados.warnings || [],
        });
        return true;
      }
      if (envelope.tipo === 'gravar-erro') {
        mod3dResolverPedido(id, {
            erro: String(dados.codigo || 'falha'),
            detalhe: String(dados.detalhe || ''),
        });
        return true;
      }
      return false;
    }

    function mod3dNovaLinha() {
      try {
        return new MessageChannel();
      } catch (erro) {
        ignorarErro(erro, 'mod3dNovaLinha');
        return null;
      }
    }

    function mod3dPelaLinha(linha, mensagem, transferiveis) {
      try {
        linha.port1.postMessage(mensagem, transferiveis || []);
        return true;
      } catch (erro) {
        ignorarErro(erro, 'mod3dPelaLinha');
        return false;
      }
    }

    function mod3dEnviarModelo(canal, pedido) {
      return new Promise((resolver) => {
          const dados = pedido || {};
          const bin = mod3dComoBytes(dados.bin) || new Uint8Array(0);
          if (!canal || !canal.ligado()) {
            resolver({ erro: 'sem-editor' });
            return;
          }
          if (!dados.projeto) {
            resolver({ erro: 'sem-projeto' });
            return;
          }
          if (bin.length > MOD3D_TETO_DO_ARQUIVO) {
            resolver({ erro: 'grande-demais' });
            return;
          }
          const id = mod3dNovoId();
          const blocos = Math.max(1, Math.ceil(bin.length / MOD3D_TAMANHO_DO_BLOCO));
          const avisar = typeof dados.progresso === 'function' ? dados.progresso : null;
          const linha = canal.podeTransferir() ? mod3dNovaLinha() : null;
          const abertura = {
            pedidoId: id,
            projeto: String(dados.projeto),
            nome: dados.documentToken ? String(dados.nome) : mod3dNomeDeArquivo(dados.nome),
            sobrescrever: dados.sobrescrever === true,
            json: dados.json || null,
            expected: dados.expected || null,
            conversion: dados.conversion || null,
            documentToken: dados.documentToken || '',
            documentConfirmed: dados.documentConfirmed === true,
            tamanho: bin.length,
            blocos,
            resumo: mod3dResumoDosBytes(bin),
          };
          const abriu = linha
          ? canal.enviarComPortas('gravar-inicio', abertura, [linha.port2])
          : canal.enviar('gravar-inicio', abertura);
          if (!abriu) {
            resolver({ erro: 'sem-editor' });
            return;
          }
          mod3dPedidosDeGravacao.set(id, {
              resolver,
              relogio: setTimeout(
                () => mod3dResolverPedido(id, { erro: 'sem-resposta' }),
                MOD3D_ESPERA_DA_RESPOSTA,
              ),
          });
          for (let i = 0; i < blocos; i++) {
            const inicio = i * MOD3D_TAMANHO_DO_BLOCO;
            const fatia = bin.slice(inicio, Math.min(bin.length, inicio + MOD3D_TAMANHO_DO_BLOCO));
            const foi = linha
            ? mod3dPelaLinha(linha, { tipo: 'bloco', inicio, dados: fatia }, [fatia.buffer])
            : canal.enviar('gravar-bloco', { pedidoId: id, inicio, dados: fatia });
            if (!foi) {
              mod3dResolverPedido(id, { erro: 'sem-editor' });
              return;
            }
            if (avisar) avisar(i + 1, blocos);
          }
          const fechou = linha
          ? mod3dPelaLinha(linha, { tipo: 'fim' }, [])
          : canal.enviar('gravar-fim', { pedidoId: id });
          if (!fechou) mod3dResolverPedido(id, { erro: 'sem-editor' });
      });
    }

    const MOD3D_BLOCO_DA_REFERENCIA = 4194304;
    const MOD3D_ESPERA_DA_REFERENCIA = 60000;
    const MOD3D_TETO_DA_REFERENCIA = 201326592;
    const MOD3D_EXTENSOES_DA_REFERENCIA = Object.freeze(['.glb', '.gltf', '.obj', '.stl']);
    const MOD3D_TETO_DOS_MODELOS = 200;

    const mod3dReferenciasEmVoo = new Map();
    const mod3dPedidosDaReferencia = new Map();

    function mod3dBytesDoArquivo(arquivo) {
      if (!arquivo) return 0;
      if (arquivo.data && typeof arquivo.data.length === 'number') return arquivo.data.length;
      if (typeof arquivo.size === 'number') return arquivo.size;
      if (typeof arquivo.text === 'string') return arquivo.text.length;
      return 0;
    }

    function mod3dExtensaoDoCaminho(caminho) {
      const ponto = String(caminho || '').lastIndexOf('.');
      return ponto < 0 ? '' : String(caminho).slice(ponto).toLowerCase();
    }

    const MOD3D_EXTENSOES_DA_IMAGEM = Object.freeze(['.png', '.jpg', '.jpeg', '.jfif', '.webp']);
    const MOD3D_TETO_DE_IMAGENS = 200;
    const MOD3D_BLOCO_DA_IMAGEM = 1048576;
    const MOD3D_TETO_DA_IMAGEM = 25165824;

    function mod3dImagensDoProjeto(projeto) {
      const lista = [];
      if (!projeto || !projeto.files || typeof projeto.files.forEach !== 'function') return lista;
      projeto.files.forEach((arquivo, caminho) => {
          if (MOD3D_EXTENSOES_DA_IMAGEM.indexOf(mod3dExtensaoDoCaminho(caminho)) < 0) return;
          lista.push({ caminho, bytes: mod3dBytesDoArquivo(arquivo) });
      });
      lista.sort((a, b) => a.caminho.localeCompare(b.caminho));
      return lista.slice(0, MOD3D_TETO_DE_IMAGENS);
    }

    function mod3dMimeDaImagem(caminho) {
      const extensao = mod3dExtensaoDoCaminho(caminho);
      if (extensao === '.png') return 'image/png';
      if (extensao === '.webp') return 'image/webp';
      if (extensao === '.jpg' || extensao === '.jpeg' || extensao === '.jfif') return 'image/jpeg';
      return 'application/octet-stream';
    }

    function mod3dBytesDaImagemDoProjeto(projetoId, caminho) {
      const projeto = mod3dProjetoPorId(projetoId);
      if (!projeto) return { erro: 'projeto-sumiu' };
      if (!projeto.files || !projeto.files.has(caminho)) return { erro: 'sem-arquivo' };
      if (MOD3D_EXTENSOES_DA_IMAGEM.indexOf(mod3dExtensaoDoCaminho(caminho)) < 0) {
        return { erro: 'formato' };
      }
      const arquivo = projeto.files.get(caminho);
      const bytes = mod3dComoBytes(arquivo && arquivo.data);
      if (!bytes || !bytes.length) return { erro: 'sem-arquivo' };
      if (bytes.length > MOD3D_TETO_DA_IMAGEM) return { erro: 'grande-demais' };
      return { bytes };
    }

    function mod3dModelosDoProjeto(projeto) {
      const lista = [];
      if (!projeto || !projeto.files || typeof projeto.files.forEach !== 'function') return lista;
      projeto.files.forEach((arquivo, caminho) => {
          if (MOD3D_EXTENSOES_DA_REFERENCIA.indexOf(mod3dExtensaoDoCaminho(caminho)) < 0) return;
          lista.push({ caminho, bytes: mod3dBytesDoArquivo(arquivo) });
      });
      lista.sort((a, b) => a.caminho.localeCompare(b.caminho));
      return lista.slice(0, MOD3D_TETO_DOS_MODELOS);
    }

    function mod3dTabelaDeUnidades(projeto) {
      if (typeof U3D === 'undefined' || !U3D) return null;
      try {
        if (typeof est3dStud === 'function' && projeto) est3dStud(projeto, null);
      } catch (erro) {
        ignorarErro(erro, 'mod3dTabelaDeUnidades');
      }
      const tabela = {};
      Object.keys(U3D).forEach((chave) => {
          tabela[chave] = { f: U3D[chave].f, label: U3D[chave].label };
      });
      return tabela;
    }

    function mod3dEnviarUnidades(envelope, via, canal) {
      const dados = envelope.dados || {};
      const projeto = mod3dProjetoPorId(dados.projeto);
      const tabela = mod3dTabelaDeUnidades(projeto);
      canal.responder(via, 'unidades', {
          emResposta: envelope.mid,
          tabela,
          studM: tabela && tabela.stud ? tabela.stud.f : 0,
      });
    }

    function mod3dEnviarModelos(envelope, via, canal) {
      const dados = envelope.dados || {};
      const projeto = mod3dProjetoPorId(dados.projeto);
      canal.responder(via, 'modelos', {
          emResposta: envelope.mid,
          lista: mod3dModelosDoProjeto(projeto),
      });
    }

    function mod3dEnviarImagens(envelope, via, canal) {
      const dados = envelope.dados || {};
      const projeto = mod3dProjetoPorId(dados.projeto);
      canal.responder(via, 'imagens', {
          emResposta: envelope.mid,
          lista: mod3dImagensDoProjeto(projeto),
      });
    }

    function mod3dEnviarTexturaDoProjeto(envelope, via, canal) {
      const dados = envelope.dados || {};
      const id = String(dados.pedidoId || '');
      if (!id) return;
      const caminho = String(dados.caminho || '');
      const achado = mod3dBytesDaImagemDoProjeto(dados.projeto, caminho);
      if (achado.erro) {
        canal.responder(via, 'textura-erro', { pedidoId: id, codigo: achado.erro, detalhe: '' });
        return;
      }
      const bytes = achado.bytes;
      const blocos = Math.max(1, Math.ceil(bytes.length / MOD3D_BLOCO_DA_IMAGEM));
      const abriu = canal.responder(via, 'textura-inicio', {
          pedidoId: id,
          caminho,
          mime: mod3dMimeDaImagem(caminho),
          tamanho: bytes.length,
          blocos,
          resumo: mod3dResumoDosBytes(bytes),
      });
      if (!abriu) return;
      for (let inicio = 0; inicio < bytes.length; inicio += MOD3D_BLOCO_DA_IMAGEM) {
        const fim = Math.min(bytes.length, inicio + MOD3D_BLOCO_DA_IMAGEM);
        const foi = canal.responder(via, 'textura-bloco', {
            pedidoId: id,
            inicio,
            dados: bytes.slice(inicio, fim),
        });
        if (!foi) return;
      }
      canal.responder(via, 'textura-fim', { pedidoId: id });
      registro.info('modelador 3d: textura enviada', caminho, bytes.length);
    }

    function mod3dPacoteDaReferencia(projetoId, caminho) {
      const projeto = mod3dProjetoPorId(projetoId);
      if (!projeto) return { erro: 'projeto-sumiu' };
      if (typeof est3dEffective !== 'function') return { erro: 'sem-estudio' };
      if (!projeto.files || !projeto.files.has(caminho)) return { erro: 'sem-arquivo' };
      try {
        return { projeto, efetivo: est3dEffective(projeto, caminho) };
      } catch (erro) {
        registro.aviso('modelador 3d: falha ao ler a referencia', caminho, erro);
        return { erro: 'leitura', detalhe: (erro && erro.message) || '' };
      }
    }

    function mod3dMetaDaReferencia(efetivo) {
      return {
        caminho: efetivo.path,
        ext: efetivo.ext,
        bytes: efetivo.bytes,
        triangulos: efetivo.drawnTri,
        vertices: efetivo.vertCount,
        dims: efetivo.dims,
        centro: efetivo.center,
        bboxMin: efetivo.bboxMin,
        bboxMax: efetivo.bboxMax,
        raio: efetivo.radius,
        nota: efetivo.unitNote || '',
      };
    }

    function mod3dEnviarReferencia(envelope, via, canal) {
      const dados = envelope.dados || {};
      const id = String(dados.pedidoId || '');
      if (!id) return;
      const achado = mod3dPacoteDaReferencia(dados.projeto, String(dados.caminho || ''));
      if (achado.erro) {
        canal.responder(via, 'referencia-erro', {
            pedidoId: id,
            codigo: achado.erro,
            detalhe: achado.detalhe || '',
        });
        return;
      }
      const efetivo = achado.efetivo;
      const campos = [
        { nome: 'pos', bytes: mod3dComoBytes(efetivo.pos) },
        { nome: 'nrm', bytes: mod3dComoBytes(efetivo.nrm) },
      ];
      const total = campos.reduce((soma, campo) => soma + (campo.bytes ? campo.bytes.length : 0), 0);
      if (!total || total > MOD3D_TETO_DA_REFERENCIA) {
        canal.responder(via, 'referencia-erro', { pedidoId: id, codigo: 'grande-demais' });
        return;
      }
      const trilhos = campos.map((campo) => ({
            nome: campo.nome,
            tamanho: campo.bytes.length,
            blocos: Math.max(1, Math.ceil(campo.bytes.length / MOD3D_BLOCO_DA_REFERENCIA)),
            resumo: mod3dResumoDosBytes(campo.bytes),
      }));
      const abriu = canal.responder(via, 'referencia-inicio', {
          pedidoId: id,
          meta: mod3dMetaDaReferencia(efetivo),
          campos: trilhos,
      });
      if (!abriu) return;
      const enviouTudo = campos.every((campo) => {
          for (let inicio = 0; inicio < campo.bytes.length; inicio += MOD3D_BLOCO_DA_REFERENCIA) {
            const fim = Math.min(campo.bytes.length, inicio + MOD3D_BLOCO_DA_REFERENCIA);
            const fatia = campo.bytes.slice(inicio, fim);
            const foi = canal.responder(via, 'referencia-bloco', {
                pedidoId: id,
                campo: campo.nome,
                inicio,
                dados: fatia,
            });
            if (!foi) return false;
          }
          return true;
      });
      if (!enviouTudo) return;
      canal.responder(via, 'referencia-fim', { pedidoId: id });
      registro.info('modelador 3d: referencia enviada', efetivo.path, total);
    }

    function mod3dPonteAtenderCena(envelope, via, canal) {
      if (!envelope || !canal) return false;
      if (envelope.tipo === 'unidades-pedido') {
        mod3dEnviarUnidades(envelope, via, canal);
        return true;
      }
      if (envelope.tipo === 'modelos-pedido') {
        mod3dEnviarModelos(envelope, via, canal);
        return true;
      }
      if (envelope.tipo === 'referencia-pedido') {
        mod3dEnviarReferencia(envelope, via, canal);
        return true;
      }
      if (envelope.tipo === 'imagens-pedido') {
        mod3dEnviarImagens(envelope, via, canal);
        return true;
      }
      if (envelope.tipo === 'textura-pedido') {
        mod3dEnviarTexturaDoProjeto(envelope, via, canal);
        return true;
      }
      return false;
    }

    function mod3dResolverReferencia(id, resultado) {
      const pedido = mod3dPedidosDaReferencia.get(id);
      mod3dReferenciasEmVoo.delete(id);
      if (!pedido) return;
      mod3dPedidosDaReferencia.delete(id);
      if (pedido.relogio) clearTimeout(pedido.relogio);
      pedido.resolver(resultado);
    }

    function mod3dAbrirReferencia(dados) {
      const id = String(dados.pedidoId || '');
      if (!id || !mod3dPedidosDaReferencia.has(id)) return;
      const campos = Array.isArray(dados.campos) ? dados.campos : [];
      const trilhos = {};
      let blocos = 0;
      let certo = campos.length > 0;
      campos.forEach((campo) => {
          const tamanho = Number(campo.tamanho) || 0;
          if (tamanho <= 0 || tamanho % 4 !== 0 || tamanho > MOD3D_TETO_DA_REFERENCIA) {
            certo = false;
            return;
          }
          try {
            trilhos[String(campo.nome)] = {
              bytes: new Uint8Array(tamanho),
              tamanho,
              escrito: 0,
              recebidos: 0,
              blocos: Number(campo.blocos) || 0,
              resumo: String(campo.resumo || ''),
            };
            blocos += Number(campo.blocos) || 0;
          } catch (erro) {
            ignorarErro(erro, 'mod3dAbrirReferencia');
            certo = false;
          }
      });
      if (!certo) {
        mod3dResolverReferencia(id, { erro: 'grande-demais' });
        return;
      }
      mod3dReferenciasEmVoo.set(id, {
          meta: dados.meta || {},
          trilhos,
          blocos,
          feitos: 0,
          quando: Date.now(),
      });
    }

    function mod3dBlocoDaReferencia(dados) {
      const id = String(dados.pedidoId || '');
      const voo = mod3dReferenciasEmVoo.get(id);
      if (!voo) return;
      const trilho = voo.trilhos[String(dados.campo)];
      const bloco = mod3dComoBytes(dados.dados);
      const posicao = Number(dados.inicio);
      if (!trilho || !bloco || !isFinite(posicao) || posicao < 0) return;
      if (posicao + bloco.length > trilho.tamanho) {
        voo.erro = 'incompleto';
        return;
      }
      trilho.bytes.set(bloco, posicao);
      trilho.escrito += bloco.length;
      trilho.recebidos += 1;
      voo.feitos += 1;
      voo.quando = Date.now();
      const pedido = mod3dPedidosDaReferencia.get(id);
      if (pedido && pedido.progresso) pedido.progresso(voo.feitos, voo.blocos);
    }

    function mod3dFecharReferencia(dados) {
      const id = String(dados.pedidoId || '');
      const voo = mod3dReferenciasEmVoo.get(id);
      if (!voo) return;
      if (voo.erro) {
        mod3dResolverReferencia(id, { erro: voo.erro });
        return;
      }
      const nomes = Object.keys(voo.trilhos);
      const inteiro = nomes.every((nome) => {
          const trilho = voo.trilhos[nome];
          if (trilho.escrito !== trilho.tamanho) return false;
          if (trilho.blocos && trilho.recebidos !== trilho.blocos) return false;
          return true;
      });
      if (!inteiro) {
        mod3dResolverReferencia(id, { erro: 'incompleto' });
        return;
      }
      const intacto = nomes.every((nome) => {
          const trilho = voo.trilhos[nome];
          return !trilho.resumo || mod3dResumoDosBytes(trilho.bytes) === trilho.resumo;
      });
      if (!intacto) {
        mod3dResolverReferencia(id, { erro: 'resumo' });
        return;
      }
      const pos = voo.trilhos.pos ? new Float32Array(voo.trilhos.pos.bytes.buffer) : null;
      const nrm = voo.trilhos.nrm ? new Float32Array(voo.trilhos.nrm.bytes.buffer) : null;
      if (!pos || !nrm || pos.length !== nrm.length) {
        mod3dResolverReferencia(id, { erro: 'incompleto' });
        return;
      }
      mod3dResolverReferencia(id, { meta: voo.meta, pos, nrm });
    }

    function mod3dReferenciaResposta(envelope) {
      if (!envelope || !envelope.tipo) return false;
      const dados = envelope.dados || {};
      if (envelope.tipo === 'referencia-inicio') {
        mod3dAbrirReferencia(dados);
        return true;
      }
      if (envelope.tipo === 'referencia-bloco') {
        mod3dBlocoDaReferencia(dados);
        return true;
      }
      if (envelope.tipo === 'referencia-fim') {
        mod3dFecharReferencia(dados);
        return true;
      }
      if (envelope.tipo === 'referencia-erro') {
        mod3dResolverReferencia(String(dados.pedidoId || ''), {
            erro: String(dados.codigo || 'falha'),
            detalhe: String(dados.detalhe || ''),
        });
        return true;
      }
      return false;
    }

    function mod3dPedirReferencia(canal, pedido) {
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
          mod3dPedidosDaReferencia.set(id, {
              resolver,
              progresso: typeof dados.progresso === 'function' ? dados.progresso : null,
              relogio: setTimeout(
                () => mod3dResolverReferencia(id, { erro: 'sem-resposta' }),
                MOD3D_ESPERA_DA_REFERENCIA,
              ),
          });
          const foi = canal.enviar('referencia-pedido', {
              pedidoId: id,
              projeto: String(dados.projeto),
              caminho: String(dados.caminho),
          });
          if (!foi) mod3dResolverReferencia(id, { erro: 'sem-editor' });
      });
    }
