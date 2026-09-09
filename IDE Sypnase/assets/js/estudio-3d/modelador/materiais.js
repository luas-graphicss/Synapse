'use strict';

const MOD3D_TETO_DE_MATERIAIS = 12;
const MOD3D_NOME_DO_MATERIAL_MAXIMO = 40;
const MOD3D_MATERIAL_METAL_PADRAO = 0.05;
const MOD3D_MATERIAL_RUGOSIDADE_PADRAO = 0.7;
const MOD3D_CORES_DOS_MATERIAIS = Object.freeze([
    Object.freeze([0.62, 0.68, 0.82]),
    Object.freeze([0.84, 0.66, 0.58]),
    Object.freeze([0.6, 0.8, 0.68]),
    Object.freeze([0.82, 0.76, 0.56]),
    Object.freeze([0.72, 0.62, 0.86]),
    Object.freeze([0.58, 0.78, 0.84]),
]);
const MOD3D_FAIXAS_DO_MATERIAL = Object.freeze([
    Object.freeze({ chave: 'metal', rotulo: 'Metalicidade' }),
    Object.freeze({ chave: 'rugosidade', rotulo: 'Rugosidade' }),
    Object.freeze({ chave: 'emissao', rotulo: 'Emissão' }),
    Object.freeze({ chave: 'opacidade', rotulo: 'Opacidade' }),
]);
const MOD3D_TEXTO_SEM_MATERIAL = 'Escolha um objeto para editar materiais';
const MOD3D_TEXTO_SEM_FACES = 'Selecione faces no modo de edição para atribuir';

function mod3dPesoDoMaterial(valor, padrao) {
  const numero = Number(valor);
  if (!isFinite(numero)) return padrao;
  return Math.min(1, Math.max(0, Math.round(numero * 1000) / 1000));
}

function mod3dNomeDoMaterialSeguro(bruto, padrao) {
  const texto = String(bruto === undefined || bruto === null ? '' : bruto)
  .replace(/\s+/g, ' ')
  .trim();
  if (!texto) return padrao;
  return texto.slice(0, MOD3D_NOME_DO_MATERIAL_MAXIMO);
}

function mod3dParDoMaterial(bruto, padrao) {
  const lista = Array.isArray(bruto) ? bruto : [];
  const saida = [];
  for (let i = 0; i < 2; i++) {
    const numero = Number(lista[i]);
    saida.push(isFinite(numero) ? Math.min(64, Math.max(-64, numero)) : padrao[i]);
  }
  return saida;
}

function mod3dCaminhoDaTexturaSeguro(bruto) {
  const texto = String(bruto === undefined || bruto === null ? '' : bruto).trim();
  if (!texto || texto.length > 400) return '';
  if (texto.indexOf('..') >= 0) return '';
  return texto.replace(/^\/+/, '');
}

function safeTextureMapsOfMaterial(source) {
  if (typeof safeMaterialTextureMaps === 'function') {
    return safeMaterialTextureMaps(source.textureMaps, source.textura);
  }
  return { albedo: mod3dCaminhoDaTexturaSeguro(source.textura) };
}

function textureMapsSignatureOf(maps) {
  if (!maps) return '';
  return Object.keys(maps)
  .sort()
  .map((key) => `${key}=${maps[key]}`)
  .join(',');
}

function textureMapKeyForMaterialField(field) {
  if (typeof materialTextureMapKeyFromField !== 'function') return '';
  return materialTextureMapKeyFromField(field);
}

function setMaterialTextureMapPath(material, mapKey, value) {
  const path = mod3dCaminhoDaTexturaSeguro(value);
  if (!material.textureMaps) material.textureMaps = {};
  material.textureMaps[mapKey] = path;
  if (mapKey === 'albedo') material.textura = path;
}

function mod3dMaterialSeguro(bruto, ordem) {
  const dados = bruto && typeof bruto === 'object' ? bruto : {};
  const indice = Math.max(0, Math.trunc(Number(ordem) || 0));
  const padrao = MOD3D_CORES_DOS_MATERIAIS[indice % MOD3D_CORES_DOS_MATERIAIS.length];
  const mapas = safeTextureMapsOfMaterial(dados);
  return {
    nome: mod3dNomeDoMaterialSeguro(dados.nome, `Material ${indice + 1}`),
    cor: mod3dTrioSeguro(dados.cor, padrao.slice(), 0, 1),
    opacidade: mod3dPesoDoMaterial(dados.opacidade === undefined ? 1 : dados.opacidade, 1),
    metal: mod3dPesoDoMaterial(dados.metal, MOD3D_MATERIAL_METAL_PADRAO),
    rugosidade: mod3dPesoDoMaterial(dados.rugosidade, MOD3D_MATERIAL_RUGOSIDADE_PADRAO),
    emissao: mod3dPesoDoMaterial(dados.emissao, 0),
    faceDupla: dados.faceDupla === true,
    textura: mapas.albedo,
    textureMaps: mapas,
    embutir: dados.embutir !== false,
    repetir: mod3dParDoMaterial(dados.repetir, [1, 1]),
    deslocar: mod3dParDoMaterial(dados.deslocar, [0, 0]),
  };
}

function mod3dMateriaisSeguros(bruto) {
  const lista = Array.isArray(bruto) ? bruto : [];
  const saida = [];
  for (let i = 0; i < Math.min(lista.length, MOD3D_TETO_DE_MATERIAIS); i++) {
    saida.push(mod3dMaterialSeguro(lista[i], i));
  }
  return saida;
}

function mod3dClonarMateriais(lista) {
  return mod3dMateriaisSeguros(lista).map((material) => ({
        nome: material.nome,
        cor: material.cor.slice(),
        opacidade: material.opacidade,
        metal: material.metal,
        rugosidade: material.rugosidade,
        emissao: material.emissao,
        faceDupla: material.faceDupla,
        textura: material.textura,
        textureMaps: Object.assign({}, material.textureMaps),
        embutir: material.embutir,
        repetir: material.repetir.slice(),
        deslocar: material.deslocar.slice(),
  }));
}

function mod3dMateriaisDoNo(no) {
  if (!no) return [];
  if (!Array.isArray(no.materiais)) no.materiais = [];
  if (!no.materiais.length) {
    no.materiais.push(mod3dMaterialSeguro({ nome: 'Material 1', cor: no.cor.slice() }, 0));
  }
  return no.materiais;
}

function mod3dMaterialDoNo(no, indice) {
  const lista = mod3dMateriaisDoNo(no);
  const ordem = Math.max(0, Math.min(lista.length - 1, Math.trunc(Number(indice) || 0)));
  return lista[ordem];
}

function mod3dProjecaoDoNo(no) {
  if (!no) return MOD3D_PROJECAO_PADRAO;
  no.projecao = mod3dProjecaoDeUvSegura(no.projecao);
  return no.projecao;
}

function mod3dMaterialDaFaceNaMalha(malha, face) {
  if (!malha || !Array.isArray(malha.mat)) return 0;
  const valor = Math.trunc(Number(malha.mat[face]) || 0);
  return valor > 0 ? valor : 0;
}

function mod3dDefinirMaterialDaFace(malha, face, indice) {
  if (!malha || !malha.faces[face]) return false;
  mod3dMalhaEdMatGarantido(malha);
  malha.mat[face] = Math.max(0, Math.trunc(Number(indice) || 0));
  return true;
}

function mod3dGruposDeMaterialDaMalha(malha) {
  const mapa = new Map();
  if (!malha) return mapa;
  mod3dMalhaEdFacesVivas(malha).forEach((face) => {
      const indice = mod3dMaterialDaFaceNaMalha(malha, face);
      if (!mapa.has(indice)) mapa.set(indice, []);
      mapa.get(indice).push(face);
  });
  return mapa;
}

function mod3dContarFacesDoMaterial(malha, indice) {
  if (!malha) return 0;
  let conta = 0;
  mod3dMalhaEdFacesVivas(malha).forEach((face) => {
      if (mod3dMaterialDaFaceNaMalha(malha, face) === indice) conta += 1;
  });
  return conta;
}

function mod3dTrocarMateriaisDoNo(no, lista, rotulo, chave) {
  if (!no) return false;
  const antes = mod3dEstadoDoNo(no);
  no.materiais = mod3dMateriaisSeguros(lista);
  if (!no.materiais.length) mod3dMateriaisDoNo(no);
  mod3dMarcarNoSujo(no);
  const depois = mod3dEstadoDoNo(no);
  mod3dPassoDeEstados(rotulo, [{ id: no.id, antes, depois }], chave);
  mod3dCenaTocar();
  return true;
}

function mod3dAdicionarMaterialNoNo(no) {
  if (!no) return -1;
  const lista = mod3dClonarMateriais(mod3dMateriaisDoNo(no));
  if (lista.length >= MOD3D_TETO_DE_MATERIAIS) return -1;
  lista.push(mod3dMaterialSeguro({}, lista.length));
  mod3dTrocarMateriaisDoNo(no, lista, 'Novo material');
  return no.materiais.length - 1;
}

function mod3dRemoverMaterialDoNo(no, indice) {
  if (!no) return false;
  const lista = mod3dClonarMateriais(mod3dMateriaisDoNo(no));
  const ordem = Math.trunc(Number(indice) || 0);
  if (lista.length < 2 || ordem < 0 || ordem >= lista.length) return false;
  lista.splice(ordem, 1);
  if (no.edicao) {
    mod3dMalhaEdMatGarantido(no.edicao);
    for (let face = 0; face < no.edicao.faces.length; face++) {
      const atual = mod3dMaterialDaFaceNaMalha(no.edicao, face);
      if (atual === ordem) no.edicao.mat[face] = 0;
      else if (atual > ordem) no.edicao.mat[face] = atual - 1;
    }
    mod3dMalhaEdTocar(no.edicao);
    no.malha = null;
  }
  mod3dTrocarMateriaisDoNo(no, lista, 'Remover material');
  return true;
}

function mod3dDefinirCampoDoMaterial(no, indice, campo, valor) {
  if (!no) return false;
  const lista = mod3dClonarMateriais(mod3dMateriaisDoNo(no));
  const ordem = Math.trunc(Number(indice) || 0);
  if (ordem < 0 || ordem >= lista.length) return false;
  const material = lista[ordem];
  if (campo === 'nome') material.nome = mod3dNomeDoMaterialSeguro(valor, material.nome);
  else if (campo === 'cor') material.cor = mod3dTrioSeguro(valor, material.cor, 0, 1);
  else if (campo === 'faceDupla') material.faceDupla = valor === true;
  else if (campo === 'embutir') material.embutir = valor !== false;
  else if (campo === 'textura') setMaterialTextureMapPath(material, 'albedo', valor);
  else if (campo === 'repetir') material.repetir = mod3dParDoMaterial(valor, material.repetir);
  else if (campo === 'deslocar') material.deslocar = mod3dParDoMaterial(valor, material.deslocar);
  else if (campo === 'metal' || campo === 'rugosidade' || campo === 'emissao') {
    material[campo] = mod3dPesoDoMaterial(valor, material[campo]);
  } else if (campo === 'opacidade') material.opacidade = mod3dPesoDoMaterial(valor, 1);
  else if (textureMapKeyForMaterialField(campo)) {
    setMaterialTextureMapPath(material, textureMapKeyForMaterialField(campo), valor);
  } else return false;
  return mod3dTrocarMateriaisDoNo(no, lista, 'Editar material', `material:${no.id}:${campo}`);
}

function mod3dAtribuirMaterialNasFaces(indice) {
  const ordem = Math.max(0, Math.trunc(Number(indice) || 0));
  return mod3dRodarOperacaoDeMalha('Atribuir material', (malha, dados) => {
      const faces = Array.from(dados && dados.faces ? dados.faces : []);
      if (!faces.length) return { mudou: false, recado: MOD3D_TEXTO_SEM_FACES };
      mod3dMalhaEdMatGarantido(malha);
      let conta = 0;
      faces.forEach((face) => {
          if (!malha.faces[face]) return;
          if (mod3dMaterialDaFaceNaMalha(malha, face) === ordem) return;
          malha.mat[face] = ordem;
          conta += 1;
      });
      if (!conta) return { mudou: false, recado: 'As faces já usam esse material' };
      return {
        mudou: true,
        recado: `${conta} faces com o material ${ordem + 1}`,
        vertices: Array.from(dados.vertices),
        modo: dados.modo,
      };
  });
}

function mod3dMalhaTemCores(malha) {
  return Boolean(malha && Array.isArray(malha.cores) && malha.cores.length);
}

function mod3dCorDoVerticeNaMalha(malha, vertice) {
  if (!mod3dMalhaTemCores(malha)) return null;
  const base = vertice * 3;
  if (base + 2 >= malha.cores.length) return null;
  return [malha.cores[base], malha.cores[base + 1], malha.cores[base + 2]];
}

function mod3dPintarVerticesDaSelecao(cor) {
  const trio = mod3dTrioSeguro(cor, [1, 1, 1], 0, 1);
  return mod3dRodarOperacaoDeMalha('Pintar vértices', (malha, dados) => {
      const vertices = Array.from(dados && dados.vertices ? dados.vertices : []);
      if (!vertices.length) return { mudou: false, recado: 'Selecione vértices para pintar' };
      mod3dMalhaEdCoresGarantidas(malha);
      vertices.forEach((vertice) => {
          const base = vertice * 3;
          if (base + 2 >= malha.cores.length) return;
          malha.cores[base] = trio[0];
          malha.cores[base + 1] = trio[1];
          malha.cores[base + 2] = trio[2];
      });
      return {
        mudou: true,
        recado: `${vertices.length} vértices pintados`,
        vertices,
        modo: dados.modo,
      };
  });
}

function mod3dLimparCoresDosVertices() {
  return mod3dRodarOperacaoDeMalha('Limpar cor dos vértices', (malha) => {
      if (!mod3dMalhaTemCores(malha)) return { mudou: false, recado: 'Sem cor por vértice' };
      malha.cores = null;
      return { mudou: true, recado: 'Cor por vértice removida' };
  });
}

function mod3dMaterialDoPalco(material) {
  const seguro = mod3dMaterialSeguro(material, 0);
  return {
    cor: seguro.cor.slice(),
    opacidade: seguro.opacidade,
    metal: seguro.metal,
    rugosidade: seguro.rugosidade,
    emissao: seguro.emissao,
    faceDupla: seguro.faceDupla,
    textura: seguro.textura,
    textureMaps: Object.assign({}, seguro.textureMaps),
    repetir: seguro.repetir.slice(),
    deslocar: seguro.deslocar.slice(),
  };
}

function mod3dMaterialGltf(material, indiceDaTextura) {
  const seguro = mod3dMaterialSeguro(material, 0);
  const pbr = {
    baseColorFactor: [
      mod3dNumeroDoGltf(seguro.cor[0]),
      mod3dNumeroDoGltf(seguro.cor[1]),
      mod3dNumeroDoGltf(seguro.cor[2]),
      mod3dNumeroDoGltf(seguro.opacidade),
    ],
    metallicFactor: mod3dNumeroDoGltf(seguro.metal),
    roughnessFactor: mod3dNumeroDoGltf(seguro.rugosidade),
  };
  if (typeof indiceDaTextura === 'number' && indiceDaTextura >= 0) {
    pbr.baseColorTexture = { index: indiceDaTextura, texCoord: 0 };
  }
  const saida = {
    name: seguro.nome,
    pbrMetallicRoughness: pbr,
    alphaMode: seguro.opacidade < 1 ? 'BLEND' : 'OPAQUE',
  };
  if (seguro.faceDupla) saida.doubleSided = true;
  if (seguro.emissao > 0) {
    saida.emissiveFactor = [
      mod3dNumeroDoGltf(seguro.cor[0] * seguro.emissao),
      mod3dNumeroDoGltf(seguro.cor[1] * seguro.emissao),
      mod3dNumeroDoGltf(seguro.cor[2] * seguro.emissao),
    ];
  }
  return saida;
}

function mod3dAssinaturaDoMaterial(material) {
  const seguro = mod3dMaterialSeguro(material, 0);
  return [
    seguro.cor.join(','),
    seguro.opacidade,
    seguro.metal,
    seguro.rugosidade,
    seguro.emissao,
    seguro.faceDupla ? 1 : 0,
    seguro.textura,
    textureMapsSignatureOf(seguro.textureMaps),
    seguro.repetir.join(','),
    seguro.deslocar.join(','),
  ].join('|');
}

function mod3dAssinaturaDosMateriais(no) {
  if (!no) return '';
  return mod3dMateriaisDoNo(no)
  .map((material) => mod3dAssinaturaDoMaterial(material))
  .concat([mod3dProjecaoDoNo(no)])
  .join(';');
}

function mod3dHexDoTrio(cor) {
  const parte = (valor) => {
    const inteiro = Math.round(Math.min(1, Math.max(0, Number(valor) || 0)) * 255);
    return inteiro.toString(16).padStart(2, '0');
  };
  return `#${parte(cor[0])}${parte(cor[1])}${parte(cor[2])}`;
}

function mod3dTrioDoHex(hex) {
  const texto = String(hex || '').replace('#', '');
  if (texto.length !== 6) return [1, 1, 1];
  const ler = (inicio) => {
    const valor = parseInt(texto.slice(inicio, inicio + 2), 16);
    return isFinite(valor) ? valor / 255 : 1;
  };
  return [ler(0), ler(2), ler(4)];
}

const mod3dPainelDosMateriais = {
  caixa: null,
  corpo: null,
  resumo: null,
  fatias: null,
  campos: null,
  ativo: 0,
  assinatura: '',
};

function mod3dMaterialAtivoDoPainel(no) {
  const lista = mod3dMateriaisDoNo(no);
  if (mod3dPainelDosMateriais.ativo >= lista.length) mod3dPainelDosMateriais.ativo = 0;
  return mod3dPainelDosMateriais.ativo;
}

function mod3dFaixaDoMaterial(chave, rotulo) {
  const caixa = mod3dNo('label', 'mod3d-faixa');
  caixa.appendChild(mod3dNo('span', 'mod3d-faixa-rotulo', rotulo));
  const entrada = document.createElement('input');
  entrada.type = 'range';
  entrada.className = 'mod3d-faixa-campo';
  entrada.min = '0';
  entrada.max = '1';
  entrada.step = '0.01';
  entrada.value = '0';
  entrada.dataset.campo = chave;
  const valor = mod3dNo('span', 'mod3d-faixa-valor', '0');
  caixa.appendChild(entrada);
  caixa.appendChild(valor);
  return { caixa, entrada, valor };
}

function mod3dParDoPainelDeMaterial(rotulo, chave, passo) {
  const linha = mod3dNo('div', 'mod3d-linha mod3d-linha-uv');
  linha.appendChild(mod3dNo('span', 'mod3d-trio-rotulo', rotulo));
  const entradas = [];
  ['U', 'V'].forEach((eixo, indice) => {
      const numero = mod3dPainelNumero(eixo, passo);
      numero.entrada.dataset.campo = chave;
      numero.entrada.dataset.indice = String(indice);
      linha.appendChild(numero.caixa);
      entradas.push(numero.entrada);
  });
  return { linha, entradas };
}

function mod3dMontarPainelDosMateriais() {
  const painel = mod3dNo('section', 'mod3d-painel mod3d-painel-material');
  const titulo = mod3dNo('h2', 'mod3d-painel-titulo', mod3dTexto('Materiais'));
  const resumo = mod3dNo('span', 'mod3d-painel-resumo', '—');
  titulo.appendChild(resumo);
  painel.appendChild(titulo);

  const corpo = mod3dNo('div', 'mod3d-painel-corpo');
  const fatias = mod3dNo('div', 'mod3d-fatias');
  corpo.appendChild(fatias);

  const acoes = mod3dNo('div', 'mod3d-ferramentas');
  const novo = mod3dPainelBotao('Novo material', 'Cria um material neste objeto');
  const apagar = mod3dPainelBotao('Remover', 'Remove o material escolhido');
  const atribuir = mod3dPainelBotao('Aplicar nas faces', 'Usa o material nas faces selecionadas');
  acoes.appendChild(novo);
  acoes.appendChild(apagar);
  acoes.appendChild(atribuir);
  corpo.appendChild(acoes);

  const identidade = mod3dNo('div', 'mod3d-linha');
  const caixaDoNome = mod3dNo('div', 'mod3d-campo-entrada');
  const rotuloDoNome = mod3dNo('label', 'mod3d-entrada-rotulo', mod3dTexto('Nome do material'));
  rotuloDoNome.setAttribute('for', 'mod3dNomeDoMaterial');
  const nome = document.createElement('input');
  nome.id = 'mod3dNomeDoMaterial';
  nome.className = 'mod3d-entrada';
  nome.type = 'text';
  nome.spellcheck = false;
  caixaDoNome.appendChild(rotuloDoNome);
  caixaDoNome.appendChild(nome);
  const caixaDaCor = mod3dNo('label', 'mod3d-cor');
  caixaDaCor.appendChild(mod3dNo('span', 'mod3d-entrada-rotulo', mod3dTexto('Cor base')));
  const cor = document.createElement('input');
  cor.type = 'color';
  cor.className = 'mod3d-cor-campo';
  caixaDaCor.appendChild(cor);
  identidade.appendChild(caixaDoNome);
  identidade.appendChild(caixaDaCor);
  corpo.appendChild(identidade);

  const faixas = {};
  MOD3D_FAIXAS_DO_MATERIAL.forEach((campo) => {
      const faixa = mod3dFaixaDoMaterial(campo.chave, mod3dTexto(campo.rotulo));
      faixas[campo.chave] = faixa;
      corpo.appendChild(faixa.caixa);
  });

  const marcaDaFace = mod3dNo('label', 'mod3d-check');
  const faceDupla = document.createElement('input');
  faceDupla.type = 'checkbox';
  faceDupla.id = 'mod3dFaceDupla';
  marcaDaFace.setAttribute('for', 'mod3dFaceDupla');
  marcaDaFace.appendChild(faceDupla);
  marcaDaFace.appendChild(mod3dNo('span', '', mod3dTexto('Face dupla')));
  corpo.appendChild(marcaDaFace);

  const textura = mod3dMontarPainelDasTexturas();
  corpo.appendChild(textura.caixa);
  corpo.appendChild(buildMaterialTextureMapPanel());

  const repetir = mod3dParDoPainelDeMaterial(mod3dTexto('Repetir'), 'repetir', 0.1);
  const deslocar = mod3dParDoPainelDeMaterial(mod3dTexto('Deslocar'), 'deslocar', 0.05);
  corpo.appendChild(repetir.linha);
  corpo.appendChild(deslocar.linha);

  const vertices = mod3dNo('div', 'mod3d-ferramentas');
  const pintar = mod3dPainelBotao('Pintar vértices', 'Aplica a cor base nos vértices escolhidos');
  const limparCores = mod3dPainelBotao('Limpar cor', 'Remove a cor por vértice da malha');
  vertices.appendChild(pintar);
  vertices.appendChild(limparCores);
  corpo.appendChild(vertices);

  const dica = mod3dNo('p', 'mod3d-malha-dica', mod3dTexto(MOD3D_TEXTO_SEM_MATERIAL));
  corpo.appendChild(dica);
  painel.appendChild(corpo);

  mod3dPainelDosMateriais.caixa = painel;
  mod3dPainelDosMateriais.corpo = corpo;
  mod3dPainelDosMateriais.resumo = resumo;
  mod3dPainelDosMateriais.fatias = fatias;
  mod3dPainelDosMateriais.campos = {
    nome,
    cor,
    faixas,
    faceDupla,
    textura,
    repetir,
    deslocar,
    dica,
    novo,
    apagar,
    atribuir,
    pintar,
    limparCores,
  };

  const noDoPainel = () => mod3dNoDaEdicao() || mod3dNoSelecionado();
  const mudar = (campo, valor) => {
    const no = noDoPainel();
    if (!no) return;
    mod3dDefinirCampoDoMaterial(no, mod3dMaterialAtivoDoPainel(no), campo, valor);
    mod3dPintarPainelDosMateriais();
  };

  nome.addEventListener('change', () => mudar('nome', nome.value));
  cor.addEventListener('input', () => mudar('cor', mod3dTrioDoHex(cor.value)));
  faceDupla.addEventListener('change', () => mudar('faceDupla', faceDupla.checked));
  MOD3D_FAIXAS_DO_MATERIAL.forEach((campo) => {
      faixas[campo.chave].entrada.addEventListener('input', () => {
          mudar(campo.chave, Number(faixas[campo.chave].entrada.value));
      });
  });
  [repetir, deslocar].forEach((par) => {
      par.entradas.forEach((entrada) => {
          entrada.addEventListener('change', () => {
              const valores = par.entradas.map((cada) => Number(cada.value));
              mudar(entrada.dataset.campo, valores);
          });
      });
  });
  novo.addEventListener('click', () => {
      const no = noDoPainel();
      if (!no) return;
      const ordem = mod3dAdicionarMaterialNoNo(no);
      if (ordem >= 0) mod3dPainelDosMateriais.ativo = ordem;
      mod3dPintarPainelDosMateriais();
  });
  apagar.addEventListener('click', () => {
      const no = noDoPainel();
      if (!no) return;
      mod3dRemoverMaterialDoNo(no, mod3dMaterialAtivoDoPainel(no));
      mod3dPainelDosMateriais.ativo = 0;
      mod3dPintarPainelDosMateriais();
  });
  atribuir.addEventListener('click', () => {
      const no = mod3dNoDaEdicao();
      if (!no) return;
      mod3dAtribuirMaterialNasFaces(mod3dMaterialAtivoDoPainel(no));
      mod3dPintarPainelDosMateriais();
  });
  pintar.addEventListener('click', () => {
      const no = mod3dNoDaEdicao();
      if (!no) return;
      mod3dPintarVerticesDaSelecao(mod3dMaterialDoNo(no, mod3dMaterialAtivoDoPainel(no)).cor);
      mod3dPintarPainelDosMateriais();
  });
  limparCores.addEventListener('click', () => {
      if (!mod3dNoDaEdicao()) return;
      mod3dLimparCoresDosVertices();
      mod3dPintarPainelDosMateriais();
  });

  return painel;
}

function mod3dPintarFatiasDosMateriais(no, ativo) {
  const fatias = mod3dPainelDosMateriais.fatias;
  if (!fatias) return;
  fatias.textContent = '';
  const malha = no.edicao || null;
  mod3dMateriaisDoNo(no).forEach((material, ordem) => {
      const botao = mod3dNo('button', 'mod3d-fatia', '');
      botao.type = 'button';
      if (ordem === ativo) botao.classList.add('on');
      const amostra = mod3dNo('span', 'mod3d-fatia-cor', '');
      amostra.style.background = mod3dHexDoTrio(material.cor);
      botao.appendChild(amostra);
      botao.appendChild(mod3dNo('span', 'mod3d-fatia-nome', material.nome));
      if (malha) {
        const conta = mod3dContarFacesDoMaterial(malha, ordem);
        botao.appendChild(mod3dNo('span', 'mod3d-fatia-conta', String(conta)));
      }
      botao.title = material.textura || material.nome;
      botao.addEventListener('click', () => {
          mod3dPainelDosMateriais.ativo = ordem;
          mod3dPintarPainelDosMateriais();
      });
      fatias.appendChild(botao);
  });
}

function mod3dPintarPainelDosMateriais() {
  const painel = mod3dPainelDosMateriais;
  if (!painel.caixa || !painel.campos) return;
  const no = mod3dNoDaEdicao() || mod3dNoSelecionado();
  const campos = painel.campos;
  if (!no || no.tipo === 'grupo') {
    painel.caixa.classList.remove('on');
    painel.resumo.textContent = mod3dTexto('sem objeto');
    campos.dica.textContent = mod3dTexto(MOD3D_TEXTO_SEM_MATERIAL);
    painel.fatias.textContent = '';
    mod3dPintarPainelDasTexturas(null);
    paintMaterialTextureMapPanel(null);
    return;
  }
  painel.caixa.classList.add('on');
  const ativo = mod3dMaterialAtivoDoPainel(no);
  const material = mod3dMaterialDoNo(no, ativo);
  const emEdicao = Boolean(mod3dNoDaEdicao());
  const faces = emEdicao ? mod3dFacesDaSelecao().size : 0;
  const assinatura = [
    no.id,
    no.versao,
    ativo,
    mod3dAssinaturaDosMateriais(no),
    emEdicao ? 1 : 0,
    faces,
    mod3dTexturasVersao(),
  ].join('|');
  if (assinatura === painel.assinatura) return;
  painel.assinatura = assinatura;
  painel.resumo.textContent = `${mod3dMateriaisDoNo(no).length} · ${material.nome}`;
  mod3dPintarFatiasDosMateriais(no, ativo);
  campos.nome.value = material.nome;
  campos.cor.value = mod3dHexDoTrio(material.cor);
  MOD3D_FAIXAS_DO_MATERIAL.forEach((campo) => {
      const faixa = campos.faixas[campo.chave];
      faixa.entrada.value = String(material[campo.chave]);
      faixa.valor.textContent = material[campo.chave].toFixed(2);
  });
  campos.faceDupla.checked = material.faceDupla === true;
  campos.repetir.entradas[0].value = String(material.repetir[0]);
  campos.repetir.entradas[1].value = String(material.repetir[1]);
  campos.deslocar.entradas[0].value = String(material.deslocar[0]);
  campos.deslocar.entradas[1].value = String(material.deslocar[1]);
  campos.apagar.disabled = mod3dMateriaisDoNo(no).length < 2;
  campos.atribuir.disabled = !emEdicao || !faces;
  campos.pintar.disabled = !emEdicao;
  campos.limparCores.disabled = !emEdicao || !mod3dMalhaTemCores(no.edicao);
  campos.novo.disabled = mod3dMateriaisDoNo(no).length >= MOD3D_TETO_DE_MATERIAIS;
  if (!emEdicao) campos.dica.textContent = mod3dTexto(MOD3D_TEXTO_SEM_FACES);
  else if (!faces) campos.dica.textContent = mod3dTexto(MOD3D_TEXTO_SEM_FACES);
  else campos.dica.textContent = `${faces} ${mod3dTexto('faces escolhidas')}`;
  mod3dPintarPainelDasTexturas(material);
  paintMaterialTextureMapPanel(material);
}
