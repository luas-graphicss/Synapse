'use strict';

const MOD3D_LADO_DO_UV = 260;
const MOD3D_GRADE_DO_UV = 8;
const MOD3D_GIRO_DO_UV = 15;
const MOD3D_ESCALA_DO_UV = 1.25;
const MOD3D_TETO_DE_FACES_NO_UV = 3000;
const MOD3D_TOQUE_DO_UV = 12;
const MOD3D_TEXTO_SEM_EDICAO_DE_UV = 'Entre no modo de edição para trabalhar o UV';
const MOD3D_TEXTO_SEM_UV_NA_MALHA = 'Projete o UV para começar';
const MOD3D_CORES_DO_UV = Object.freeze({
    fundo: '#0b0e12',
    grade: '#1b2028',
    borda: '#2a323d',
    face: '#4d5a6b',
    ilha: '#63f2a8',
    alca: '#f2c463',
});

const mod3dEditorUv = {
  painel: null,
  tela: null,
  pincel: null,
  resumo: null,
  campos: null,
  ilha: [],
  ponteiros: new Map(),
  gesto: null,
  assinatura: '',
  recado: '',
};

function mod3dAlvoDoUv(malha, dados) {
  const escolhidas = dados && dados.faces && dados.faces.size ? Array.from(dados.faces) : null;
  if (escolhidas && escolhidas.length) return escolhidas;
  return mod3dMalhaEdFacesVivas(malha);
}

function mod3dRodarUv(rotulo, faces, fn) {
  return mod3dRodarOperacaoDeMalha(rotulo, (malha, dados) => {
      const brutas = faces && faces.length ? faces : mod3dAlvoDoUv(malha, dados);
      const alvo = brutas.filter((face) => Boolean(malha.faces[face]));
      if (!alvo.length) return { mudou: false, recado: 'Nenhuma face para o UV' };
      const feito = fn(malha, alvo) || {};
      if (!feito.conta) return { mudou: false, recado: feito.recado || 'Nada mudou no UV' };
      return {
        mudou: true,
        recado: feito.recado || '',
        vertices: Array.from(dados.vertices),
        modo: dados.modo,
      };
  });
}

function mod3dProjetarUvDaSelecao(modo, faces) {
  const escolha = mod3dProjecaoDeUvSegura(modo);
  return mod3dRodarUv('Projetar UV', faces, (malha, alvo) => {
      const conta = mod3dProjetarUvNaMalha(malha, alvo, escolha);
      return { conta, recado: `UV projetado em ${conta} faces` };
  });
}

function mod3dDesdobrarUvDaSelecao(angulo, faces) {
  const limite = mod3dAnguloDaIlhaSeguro(angulo);
  return mod3dRodarUv('Desdobrar UV', faces, (malha, alvo) => {
      const feito = mod3dDesdobrarUvNaMalha(malha, alvo, limite);
      return { conta: feito.faces, recado: `${feito.ilhas} ilhas em ${feito.faces} faces` };
  });
}

function mod3dMoverUvDaSelecao(faces, du, dv) {
  return mod3dRodarUv('Mover UV', faces, (malha, alvo) => {
      const conta = mod3dMoverUvDasFaces(malha, alvo, du, dv);
      return { conta, recado: `UV movido em ${conta} faces` };
  });
}

function mod3dGirarUvDaSelecao(faces, graus) {
  return mod3dRodarUv('Girar UV', faces, (malha, alvo) => {
      const conta = mod3dGirarUvDasFaces(malha, alvo, graus);
      return { conta, recado: `UV girado em ${conta} faces` };
  });
}

function mod3dEscalarUvDaSelecao(faces, fu, fv) {
  return mod3dRodarUv('Escalar UV', faces, (malha, alvo) => {
      const conta = mod3dEscalarUvDasFaces(malha, alvo, fu, fv);
      return { conta, recado: `UV escalado em ${conta} faces` };
  });
}

function mod3dAlinharUvDaSelecao(onde, faces) {
  const escolha = mod3dAlinhamentoDeUvSeguro(onde);
  return mod3dRodarUv('Alinhar UV', faces, (malha, alvo) => {
      const conta = mod3dAlinharUvDasFaces(malha, alvo, escolha);
      return { conta, recado: `UV alinhado em ${conta} faces` };
  });
}

function mod3dLimparUvDaSelecao(faces) {
  return mod3dRodarUv('Limpar UV', faces, (malha, alvo) => {
      const conta = mod3dLimparUvDaMalha(malha, alvo);
      return { conta, recado: `UV apagado em ${conta} faces` };
  });
}

function mod3dDefinirProjecaoDoNo(no, chave) {
  if (!no) return false;
  const escolha = mod3dProjecaoDeUvSegura(chave);
  if (mod3dProjecaoDoNo(no) === escolha) return false;
  const antes = mod3dEstadoDoNo(no);
  no.projecao = escolha;
  mod3dMarcarNoSujo(no);
  const depois = mod3dEstadoDoNo(no);
  mod3dPassoDeEstados('Projeção do UV', [{ id: no.id, antes, depois }], `projecao:${no.id}`);
  mod3dCenaTocar();
  return true;
}

function mod3dGarantirUvDoNo(no) {
  if (!no || !no.edicao) return false;
  if (mod3dMalhaTemUv(no.edicao)) return false;
  const todas = mod3dMalhaEdFacesVivas(no.edicao);
  if (!todas.length) return false;
  if (mod3dNoDaEdicao() === no) {
    return mod3dProjetarUvDaSelecao(mod3dProjecaoDoNo(no), todas);
  }
  const conta = mod3dProjetarUvNaMalha(no.edicao, todas, mod3dProjecaoDoNo(no));
  if (!conta) return false;
  no.malha = null;
  mod3dMarcarNoSujo(no);
  mod3dCenaTocar();
  return true;
}

function mod3dFacesDoDesenhoDoUv(malha) {
  const selecao = mod3dFacesDaSelecao();
  if (selecao && selecao.size) return Array.from(selecao).slice(0, MOD3D_TETO_DE_FACES_NO_UV);
  return mod3dMalhaEdFacesVivas(malha).slice(0, MOD3D_TETO_DE_FACES_NO_UV);
}

function mod3dLadoDoUv() {
  const tela = mod3dEditorUv.tela;
  if (!tela) return MOD3D_LADO_DO_UV;
  return Math.max(80, tela.clientWidth || MOD3D_LADO_DO_UV);
}

function mod3dUvParaTela(par, lado) {
  return [par[0] * lado, (1 - par[1]) * lado];
}

function mod3dTelaParaUv(evento) {
  const tela = mod3dEditorUv.tela;
  if (!tela) return [0, 0];
  const caixa = tela.getBoundingClientRect();
  const lado = Math.max(1, caixa.width);
  return [(evento.clientX - caixa.left) / lado, 1 - (evento.clientY - caixa.top) / caixa.height];
}

function mod3dDentroDoPoligonoDoUv(lista, u, v) {
  let dentro = false;
  const total = lista.length / 2;
  for (let i = 0, j = total - 1; i < total; j = i++) {
    const ui = lista[i * 2];
    const vi = lista[i * 2 + 1];
    const uj = lista[j * 2];
    const vj = lista[j * 2 + 1];
    const cruza = vi > v !== vj > v;
    if (cruza && u < ((uj - ui) * (v - vi)) / (vj - vi || 0.000001) + ui) dentro = !dentro;
  }
  return dentro;
}

function mod3dFaceSobOPontoDoUv(malha, u, v) {
  const faces = mod3dFacesDoDesenhoDoUv(malha);
  for (let i = faces.length - 1; i >= 0; i--) {
    const lista = mod3dUvDaFace(malha, faces[i]);
    if (lista && mod3dDentroDoPoligonoDoUv(lista, u, v)) return faces[i];
  }
  return -1;
}

function mod3dIlhaViva(malha) {
  return mod3dEditorUv.ilha.filter((face) => Boolean(malha.faces[face]));
}

function mod3dPreviaDoUv(u, v) {
  const gesto = mod3dEditorUv.gesto;
  if (!gesto) return [u, v];
  if (gesto.modo === 'mover') return [u + gesto.du, v + gesto.dv];
  const du = u - gesto.centro[0];
  const dv = v - gesto.centro[1];
  const radianos = gesto.giro * MOD3D_GRAU_EM_RADIANO;
  const cosseno = Math.cos(radianos);
  const seno = Math.sin(radianos);
  return [
    gesto.centro[0] + (du * cosseno - dv * seno) * gesto.escala,
    gesto.centro[1] + (du * seno + dv * cosseno) * gesto.escala,
  ];
}

function mod3dDedosDoUv() {
  return Array.from(mod3dEditorUv.ponteiros.values());
}

function mod3dMedidaDosDedosDoUv() {
  const dedos = mod3dDedosDoUv();
  if (dedos.length < 2) return null;
  const du = dedos[1][0] - dedos[0][0];
  const dv = dedos[1][1] - dedos[0][1];
  return { vao: Math.hypot(du, dv), angulo: Math.atan2(dv, du) / MOD3D_GRAU_EM_RADIANO };
}

function mod3dComecarGestoDoUv(evento) {
  const malha = mod3dMalhaDaEdicao();
  if (!malha) return;
  const par = mod3dTelaParaUv(evento);
  mod3dEditorUv.ponteiros.set(evento.pointerId, par);
  if (mod3dEditorUv.ponteiros.size === 1) {
    const face = mod3dFaceSobOPontoDoUv(malha, par[0], par[1]);
    if (face >= 0) mod3dEditorUv.ilha = mod3dIlhaDeUvDaFace(malha, face);
    else mod3dEditorUv.ilha = [];
    mod3dEditorUv.gesto = mod3dEditorUv.ilha.length
    ? { modo: 'mover', inicio: par, du: 0, dv: 0 }
    : null;
    mod3dPintarEditorUv();
    return;
  }
  const medida = mod3dMedidaDosDedosDoUv();
  const caixa = mod3dCaixaDoUvDasFaces(malha, mod3dIlhaViva(malha));
  if (!medida || !caixa) return;
  mod3dEditorUv.gesto = {
    modo: 'gesto',
    centro: caixa.centro,
    vao: Math.max(medida.vao, 0.001),
    angulo: medida.angulo,
    escala: 1,
    giro: 0,
  };
  mod3dPintarEditorUv();
}

function mod3dMoverGestoDoUv(evento) {
  if (!mod3dEditorUv.ponteiros.has(evento.pointerId)) return;
  const par = mod3dTelaParaUv(evento);
  mod3dEditorUv.ponteiros.set(evento.pointerId, par);
  const gesto = mod3dEditorUv.gesto;
  if (!gesto) return;
  if (gesto.modo === 'mover') {
    gesto.du = par[0] - gesto.inicio[0];
    gesto.dv = par[1] - gesto.inicio[1];
    mod3dPintarEditorUv();
    return;
  }
  const medida = mod3dMedidaDosDedosDoUv();
  if (!medida) return;
  gesto.escala = Math.min(8, Math.max(0.125, medida.vao / gesto.vao));
  gesto.giro = medida.angulo - gesto.angulo;
  mod3dPintarEditorUv();
}

function mod3dFecharGestoDoUv(evento) {
  mod3dEditorUv.ponteiros.delete(evento.pointerId);
  const gesto = mod3dEditorUv.gesto;
  if (!gesto || mod3dEditorUv.ponteiros.size) return;
  const malha = mod3dMalhaDaEdicao();
  const ilha = malha ? mod3dIlhaViva(malha) : [];
  mod3dEditorUv.gesto = null;
  if (!ilha.length) {
    mod3dPintarEditorUv();
    return;
  }
  if (gesto.modo === 'mover') {
    if (Math.abs(gesto.du) > MOD3D_TOLERANCIA_DO_UV || Math.abs(gesto.dv) > MOD3D_TOLERANCIA_DO_UV) {
      mod3dMoverUvDaSelecao(ilha, gesto.du, gesto.dv);
    }
    mod3dPintarEditorUv();
    return;
  }
  if (Math.abs(gesto.escala - 1) > 0.01) {
    mod3dEscalarUvDaSelecao(ilha, gesto.escala, gesto.escala);
  }
  if (Math.abs(gesto.giro) > 0.5) mod3dGirarUvDaSelecao(ilha, gesto.giro);
  mod3dPintarEditorUv();
}

function mod3dPintarGradeDoUv(pincel, lado) {
  pincel.fillStyle = MOD3D_CORES_DO_UV.fundo;
  pincel.fillRect(0, 0, lado, lado);
  pincel.strokeStyle = MOD3D_CORES_DO_UV.grade;
  pincel.lineWidth = 1;
  for (let i = 1; i < MOD3D_GRADE_DO_UV; i++) {
    const passo = (i / MOD3D_GRADE_DO_UV) * lado;
    pincel.beginPath();
    pincel.moveTo(passo, 0);
    pincel.lineTo(passo, lado);
    pincel.moveTo(0, passo);
    pincel.lineTo(lado, passo);
    pincel.stroke();
  }
  pincel.strokeStyle = MOD3D_CORES_DO_UV.borda;
  pincel.strokeRect(0.5, 0.5, lado - 1, lado - 1);
}

function mod3dPintarTexturaDoUv(pincel, lado) {
  const no = mod3dNoDaEdicao() || mod3dNoSelecionado();
  if (!no) return;
  const material = mod3dMaterialDoNo(no, mod3dMaterialAtivoDoPainel(no));
  if (!material || !material.textura) return;
  const imagem = mod3dImagemDaTextura(material.textura);
  if (!imagem) return;
  pincel.globalAlpha = 0.45;
  pincel.drawImage(imagem, 0, 0, lado, lado);
  pincel.globalAlpha = 1;
}

function mod3dPintarFacesDoUv(pincel, malha, lado) {
  const faces = mod3dFacesDoDesenhoDoUv(malha);
  const ilha = new Set(mod3dIlhaViva(malha));
  faces.forEach((face) => {
      const lista = mod3dUvDaFace(malha, face);
      if (!lista) return;
      const dentro = ilha.has(face);
      pincel.beginPath();
      for (let i = 0; i < lista.length; i += 2) {
        const par = dentro ? mod3dPreviaDoUv(lista[i], lista[i + 1]) : [lista[i], lista[i + 1]];
        const ponto = mod3dUvParaTela(par, lado);
        if (i === 0) pincel.moveTo(ponto[0], ponto[1]);
        else pincel.lineTo(ponto[0], ponto[1]);
      }
      pincel.closePath();
      pincel.strokeStyle = dentro ? MOD3D_CORES_DO_UV.ilha : MOD3D_CORES_DO_UV.face;
      pincel.lineWidth = dentro ? 1.6 : 1;
      if (dentro) {
        pincel.fillStyle = 'rgba(99, 242, 168, 0.14)';
        pincel.fill();
      }
      pincel.stroke();
  });
}

function mod3dPintarTelaDoUv() {
  const tela = mod3dEditorUv.tela;
  const pincel = mod3dEditorUv.pincel;
  if (!tela || !pincel) return;
  const lado = mod3dLadoDoUv();
  const pixel = Math.min(window.devicePixelRatio || 1, MOD3D_TETO_DO_PIXEL);
  const alvo = Math.round(lado * pixel);
  if (tela.width !== alvo || tela.height !== alvo) {
    tela.width = alvo;
    tela.height = alvo;
  }
  tela.style.height = `${lado}px`;
  pincel.setTransform(pixel, 0, 0, pixel, 0, 0);
  mod3dPintarGradeDoUv(pincel, lado);
  mod3dPintarTexturaDoUv(pincel, lado);
  const malha = mod3dMalhaDaEdicao();
  if (malha) mod3dPintarFacesDoUv(pincel, malha, lado);
}

function mod3dMontarPainelDoUv() {
  const painel = mod3dNo('section', 'mod3d-painel mod3d-painel-uv');
  const titulo = mod3dNo('h2', 'mod3d-painel-titulo', mod3dTexto('UV'));
  const resumo = mod3dNo('span', 'mod3d-painel-resumo', '—');
  titulo.appendChild(resumo);
  painel.appendChild(titulo);

  const corpo = mod3dNo('div', 'mod3d-painel-corpo');
  const tela = document.createElement('canvas');
  tela.className = 'mod3d-uv-tela';
  tela.width = MOD3D_LADO_DO_UV;
  tela.height = MOD3D_LADO_DO_UV;
  corpo.appendChild(tela);

  const projecoes = mod3dNo('div', 'mod3d-ferramentas');
  const botoesDaProjecao = MOD3D_PROJECOES_DE_UV.map((modo) => {
      const botao = mod3dPainelBotao(modo.rotulo, 'Projeta o UV das faces escolhidas');
      botao.dataset.projecao = modo.chave;
      botao.addEventListener('click', () => {
          const no = mod3dNoDaEdicao();
          if (no) mod3dDefinirProjecaoDoNo(no, modo.chave);
          mod3dProjetarUvDaSelecao(modo.chave);
          mod3dPintarEditorUv();
      });
      projecoes.appendChild(botao);
      return botao;
  });
  corpo.appendChild(projecoes);

  const desdobrar = mod3dNo('div', 'mod3d-ferramentas');
  const angulo = mod3dPainelNumero(mod3dTexto('Ângulo'), 5);
  angulo.entrada.value = String(MOD3D_ANGULO_DA_ILHA_PADRAO);
  const botaoDoDesdobrar = mod3dPainelBotao('Desdobrar', 'Separa ilhas pelo ângulo entre faces');
  desdobrar.appendChild(angulo.caixa);
  desdobrar.appendChild(botaoDoDesdobrar);
  corpo.appendChild(desdobrar);

  const mover = mod3dNo('div', 'mod3d-ferramentas');
  const passos = [
    { rotulo: '←', du: -0.05, dv: 0 },
    { rotulo: '→', du: 0.05, dv: 0 },
    { rotulo: '↑', du: 0, dv: 0.05 },
    { rotulo: '↓', du: 0, dv: -0.05 },
  ];
  passos.forEach((passo) => {
      const botao = mod3dPainelBotao(passo.rotulo, 'Move a ilha escolhida');
      botao.addEventListener('click', () => {
          const malha = mod3dMalhaDaEdicao();
          mod3dMoverUvDaSelecao(malha ? mod3dIlhaViva(malha) : [], passo.du, passo.dv);
          mod3dPintarEditorUv();
      });
      mover.appendChild(botao);
  });
  corpo.appendChild(mover);

  const formas = mod3dNo('div', 'mod3d-ferramentas');
  const girar = mod3dPainelBotao(`${MOD3D_GIRO_DO_UV}°`, 'Gira a ilha escolhida');
  const girarAoContrario = mod3dPainelBotao(`-${MOD3D_GIRO_DO_UV}°`, 'Gira a ilha ao contrário');
  const crescer = mod3dPainelBotao('+', 'Aumenta a ilha escolhida');
  const encolher = mod3dPainelBotao('−', 'Diminui a ilha escolhida');
  const limpar = mod3dPainelBotao('Limpar', 'Apaga o UV das faces escolhidas');
  formas.appendChild(girarAoContrario);
  formas.appendChild(girar);
  formas.appendChild(encolher);
  formas.appendChild(crescer);
  formas.appendChild(limpar);
  corpo.appendChild(formas);

  const alinhar = mod3dNo('div', 'mod3d-linha');
  alinhar.appendChild(mod3dNo('span', 'mod3d-trio-rotulo', mod3dTexto('Alinhar')));
  const seletor = document.createElement('select');
  seletor.className = 'mod3d-seletor mod3d-seletor-curto';
  MOD3D_ALINHAMENTOS_DE_UV.forEach((item) => {
      const opcao = document.createElement('option');
      opcao.value = item.chave;
      opcao.textContent = mod3dTexto(item.rotulo);
      seletor.appendChild(opcao);
  });
  const aplicar = mod3dPainelBotao('Aplicar', 'Alinha a ilha dentro do quadro');
  alinhar.appendChild(seletor);
  alinhar.appendChild(aplicar);
  corpo.appendChild(alinhar);

  const dica = mod3dNo('p', 'mod3d-malha-dica', mod3dTexto(MOD3D_TEXTO_SEM_EDICAO_DE_UV));
  corpo.appendChild(dica);
  painel.appendChild(corpo);

  botaoDoDesdobrar.addEventListener('click', () => {
      mod3dDesdobrarUvDaSelecao(Number(angulo.entrada.value));
      mod3dPintarEditorUv();
  });
  const comIlha = (fn) => {
    const malha = mod3dMalhaDaEdicao();
    fn(malha ? mod3dIlhaViva(malha) : []);
    mod3dPintarEditorUv();
  };
  girar.addEventListener('click', () => comIlha((ilha) => mod3dGirarUvDaSelecao(ilha, MOD3D_GIRO_DO_UV)));
  girarAoContrario.addEventListener('click', () =>
    comIlha((ilha) => mod3dGirarUvDaSelecao(ilha, -MOD3D_GIRO_DO_UV)),
  );
  crescer.addEventListener('click', () =>
    comIlha((ilha) => mod3dEscalarUvDaSelecao(ilha, MOD3D_ESCALA_DO_UV, MOD3D_ESCALA_DO_UV)),
  );
  encolher.addEventListener('click', () =>
    comIlha((ilha) =>
      mod3dEscalarUvDaSelecao(ilha, 1 / MOD3D_ESCALA_DO_UV, 1 / MOD3D_ESCALA_DO_UV),
    ),
  );
  limpar.addEventListener('click', () => comIlha((ilha) => mod3dLimparUvDaSelecao(ilha)));
  aplicar.addEventListener('click', () =>
    comIlha((ilha) => mod3dAlinharUvDaSelecao(seletor.value, ilha)),
  );

  tela.addEventListener('pointerdown', (evento) => {
      evento.preventDefault();
      try {
        tela.setPointerCapture(evento.pointerId);
      } catch (erro) {
        ignorarErro(erro, 'mod3dEditorUv:captura');
      }
      mod3dComecarGestoDoUv(evento);
  });
  tela.addEventListener('pointermove', (evento) => {
      if (!mod3dEditorUv.ponteiros.size) return;
      evento.preventDefault();
      mod3dMoverGestoDoUv(evento);
  });
  tela.addEventListener('pointerup', (evento) => mod3dFecharGestoDoUv(evento));
  tela.addEventListener('pointercancel', (evento) => mod3dFecharGestoDoUv(evento));

  mod3dEditorUv.painel = painel;
  mod3dEditorUv.tela = tela;
  mod3dEditorUv.pincel = tela.getContext('2d');
  mod3dEditorUv.resumo = resumo;
  mod3dEditorUv.campos = { angulo, seletor, dica, projecoes: botoesDaProjecao, formas, mover };
  return painel;
}

function mod3dPintarEditorUv() {
  const editor = mod3dEditorUv;
  if (!editor.painel || !editor.campos) return;
  const no = mod3dNoDaEdicao();
  const malha = mod3dMalhaDaEdicao();
  if (!no || !malha) {
    editor.painel.classList.remove('on');
    editor.resumo.textContent = mod3dTexto('sem edição');
    editor.campos.dica.textContent = mod3dTexto(MOD3D_TEXTO_SEM_EDICAO_DE_UV);
    editor.ilha = [];
    editor.assinatura = '';
    mod3dPintarTelaDoUv();
    return;
  }
  editor.painel.classList.add('on');
  const projecao = mod3dProjecaoDoNo(no);
  editor.campos.projecoes.forEach((botao) => {
      botao.classList.toggle('on', botao.dataset.projecao === projecao);
  });
  const estatisticas = mod3dUvEstatisticas(malha);
  editor.resumo.textContent = `${estatisticas.comUv}/${estatisticas.faces} · ${estatisticas.ilhas} ilhas`;
  if (!estatisticas.comUv) editor.campos.dica.textContent = mod3dTexto(MOD3D_TEXTO_SEM_UV_NA_MALHA);
  else if (estatisticas.fora) {
    editor.campos.dica.textContent = `${estatisticas.fora} ${mod3dTexto('faces fora do quadro')}`;
  } else if (editor.ilha.length) {
    editor.campos.dica.textContent = `${editor.ilha.length} ${mod3dTexto('faces na ilha')}`;
  } else editor.campos.dica.textContent = mod3dTexto('Toque numa ilha para mover, girar ou escalar');
  mod3dPintarTelaDoUv();
  editor.assinatura = `${no.id}|${malha.versao}|${mod3dTexturasVersao()}`;
}
