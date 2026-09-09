'use strict';

const MOD3D_FUNDO_DO_PALCO = Object.freeze([0.043, 0.051, 0.071]);
const MOD3D_LUZ_DO_PALCO = Object.freeze([0.45, 0.85, 0.62]);
const MOD3D_TETO_DO_PIXEL = 2;
const MOD3D_VS_MALHA = window.SynapseMeshShaderSource.vertexSource;
const MOD3D_MAPAS_DO_MATERIAL = window.SynapseMaterialTextureMapBindings.bindings;
const MOD3D_VS_LINHA = window.SynapseLineShaderSource.vertexSource;
const MOD3D_FS_LINHA = window.SynapseLineShaderSource.fragmentSource;

function mod3dCompilarShader(gl, tipo, fonte) {
  const shader = gl.createShader(tipo);
  gl.shaderSource(shader, fonte);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const falha = gl.getShaderInfoLog(shader) || 'shader recusado';
    gl.deleteShader(shader);
    throw new Error(falha);
  }
  return shader;
}

function mod3dCriarPrograma(gl, fonteVs, fonteFs, atributos, uniformes) {
  const vs = mod3dCompilarShader(gl, gl.VERTEX_SHADER, fonteVs);
  const fs = mod3dCompilarShader(gl, gl.FRAGMENT_SHADER, fonteFs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const falha = gl.getProgramInfoLog(prog) || 'programa recusado';
    gl.deleteProgram(prog);
    throw new Error(falha);
  }
  const mapa = { prog: prog, atributos: {}, uniformes: {} };
  (atributos || []).forEach(function (nome) {
      mapa.atributos[nome] = gl.getAttribLocation(prog, nome);
  });
  (uniformes || []).forEach(function (nome) {
      mapa.uniformes[nome] = gl.getUniformLocation(prog, nome);
  });
  return mapa;
}

function mod3dContextoGL(canvas) {
  const factory = window.SynapseWebglContextFactory;
  if (!factory) return null;
  return factory.createContext(canvas).context;
}

function meshShaderOptionsFor(gl) {
  const isWebgl2 =
  typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  if (isWebgl2) return { withNormalMapping: true, withDerivativesExtension: false };
  const hasDerivatives = Boolean(gl.getExtension('OES_standard_derivatives'));
  return { withNormalMapping: hasDerivatives, withDerivativesExtension: hasDerivatives };
}

function mod3dCriarRenderizador(canvas) {
  const pecas = new Map();
  const imagens = new Map();
  const tamanho = { largura: 1, altura: 1, pixel: 1 };
  let gl = null;
  let malha = null;
  let linha = null;
  let branca = null;
  let perdido = false;
  let motivo = '';
  let aoMudar = null;

  function avisar() {
    if (typeof aoMudar === 'function') aoMudar();
  }

  function descartarBuffers() {
    pecas.forEach(function (peca) {
        peca.buffers = null;
    });
    imagens.forEach(function (entrada) {
        entrada.tex = null;
    });
    branca = null;
  }

  function potenciaDeDois(valor) {
    return valor > 0 && (valor & (valor - 1)) === 0;
  }

  function criarTexturaBranca() {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  function subirTextura(imagem) {
    if (!gl || !imagem) return null;
    const largura = imagem.width || imagem.videoWidth || 0;
    const altura = imagem.height || imagem.videoHeight || 0;
    const repete = potenciaDeDois(largura) && potenciaDeDois(altura);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imagem);
    } catch (erro) {
      if (typeof ignorarErro === 'function') ignorarErro(erro, 'modelador3d:textura');
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.deleteTexture(tex);
      return null;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const borda = repete ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, borda);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, borda);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (repete) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    return tex;
  }

  function texturaDoMaterial(caminho) {
    if (!caminho || !gl) return null;
    const entrada = imagens.get(caminho);
    if (!entrada) return null;
    if (!entrada.tex) entrada.tex = subirTextura(entrada.imagem);
    return entrada.tex;
  }

  function definirTextura(caminho, imagem) {
    if (!caminho) return false;
    const antiga = imagens.get(caminho);
    if (antiga && antiga.tex && gl) gl.deleteTexture(antiga.tex);
    if (!imagem) {
      imagens.delete(caminho);
      avisar();
      return true;
    }
    imagens.set(caminho, { imagem: imagem, tex: null });
    avisar();
    return true;
  }

  function montar() {
    gl = mod3dContextoGL(canvas);
    if (!gl) {
      motivo = 'sem-webgl';
      return false;
    }
    try {
      malha = mod3dCriarPrograma(
        gl,
        MOD3D_VS_MALHA,
        window.SynapseMeshShaderSource.createFragmentSource(meshShaderOptionsFor(gl)),
        window.SynapseMeshShaderSource.attributeNames,
        window.SynapseMeshShaderSource.uniformNames,
      );
      linha = mod3dCriarPrograma(
        gl,
        MOD3D_VS_LINHA,
        MOD3D_FS_LINHA,
        window.SynapseLineShaderSource.attributeNames,
        window.SynapseLineShaderSource.uniformNames,
      );
    } catch (erro) {
      if (typeof ignorarErro === 'function') ignorarErro(erro, 'modelador3d:shader');
      gl = null;
      malha = null;
      linha = null;
      motivo = 'shader';
      return false;
    }
    motivo = '';
    perdido = false;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    branca = criarTexturaBranca();
    return true;
  }

  function subirPeca(peca) {
    if (!gl || !peca.pos || !peca.pos.length) return null;
    if (peca.buffers) return peca.buffers;
    const pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.bufferData(gl.ARRAY_BUFFER, peca.pos, gl.STATIC_DRAW);
    const extra = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, extra);
    gl.bufferData(gl.ARRAY_BUFFER, peca.extra, gl.STATIC_DRAW);
    let uv = null;
    if (peca.uv && peca.uv.length === (peca.pos.length / 3) * 2) {
      uv = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uv);
      gl.bufferData(gl.ARRAY_BUFFER, peca.uv, gl.STATIC_DRAW);
    }
    let tinta = null;
    if (peca.tinta && peca.tinta.length === peca.pos.length) {
      tinta = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, tinta);
      gl.bufferData(gl.ARRAY_BUFFER, peca.tinta, gl.STATIC_DRAW);
    }
    peca.buffers = {
      pos: pos,
      extra: extra,
      uv: uv,
      tinta: tinta,
      vertices: (peca.pos.length / 3) | 0,
    };
    return peca.buffers;
  }

  function guardar(nome, tipo, dados) {
    const antiga = pecas.get(nome);
    if (antiga && antiga.buffers && gl) {
      gl.deleteBuffer(antiga.buffers.pos);
      gl.deleteBuffer(antiga.buffers.extra);
      if (antiga.buffers.uv) gl.deleteBuffer(antiga.buffers.uv);
      if (antiga.buffers.tinta) gl.deleteBuffer(antiga.buffers.tinta);
    }
    if (!dados || !dados.pos || !dados.pos.length) {
      pecas.delete(nome);
      avisar();
      return;
    }
    pecas.set(nome, {
        tipo: tipo,
        camada: dados.camada === 'gizmo' || dados.camada === 'grade' ? dados.camada : 'cena',
        pos: dados.pos,
        extra: tipo === 'malha' ? dados.nrm : dados.cores,
        uv: tipo === 'malha' ? dados.uv || null : null,
        tinta: tipo === 'malha' ? dados.tinta || null : null,
        grupos: tipo === 'malha' && Array.isArray(dados.grupos) ? dados.grupos : null,
        cor: dados.cor || [0.7, 0.75, 0.85],
        visivel: dados.visivel !== false,
        ordem: Number(dados.ordem) || 0,
        buffers: null,
    });
    avisar();
  }

  function ordenadas(tipo, camada) {
    const lista = [];
    pecas.forEach(function (peca) {
        if (peca.tipo === tipo && peca.camada === camada && peca.visivel) lista.push(peca);
    });
    lista.sort(function (a, b) {
        return a.ordem - b.ordem;
    });
    return lista;
  }

  function pedacosDaPeca(peca, buffers) {
    const lista = [];
    (peca.grupos || []).forEach(function (grupo) {
        const inicio = Math.max(0, grupo.inicio | 0);
        const conta = Math.min(buffers.vertices - inicio, Math.max(0, grupo.conta | 0));
        if (conta <= 0) return;
        lista.push({ inicio: inicio, conta: conta, material: grupo, cor: grupo.cor || peca.cor });
    });
    if (!lista.length) {
      lista.push({ inicio: 0, conta: buffers.vertices, material: null, cor: peca.cor });
    }
    return lista;
  }

  function ligarExtras(programa, buffers) {
    const uvLoc = programa.atributos.aUv;
    const tintaLoc = programa.atributos.aTinta;
    if (typeof uvLoc === 'number' && uvLoc >= 0) {
      if (buffers.uv) {
        gl.enableVertexAttribArray(uvLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv);
        gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(uvLoc);
        gl.vertexAttrib2f(uvLoc, 0, 0);
      }
    }
    if (typeof tintaLoc === 'number' && tintaLoc >= 0) {
      if (buffers.tinta) {
        gl.enableVertexAttribArray(tintaLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.tinta);
        gl.vertexAttribPointer(tintaLoc, 3, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(tintaLoc);
        gl.vertexAttrib3f(tintaLoc, 1, 1, 1);
      }
    }
  }

  function desligarExtras(programa) {
    const uvLoc = programa.atributos.aUv;
    const tintaLoc = programa.atributos.aTinta;
    if (typeof uvLoc === 'number' && uvLoc >= 0) gl.disableVertexAttribArray(uvLoc);
    if (typeof tintaLoc === 'number' && tintaLoc >= 0) gl.disableVertexAttribArray(tintaLoc);
  }

  function materialTextureMapPathFor(material, mapKey) {
    const maps = material.textureMaps || null;
    const mappedPath = maps && typeof maps[mapKey] === 'string' ? maps[mapKey] : '';
    if (mappedPath) return mappedPath;
    if (mapKey !== 'albedo') return '';
    return typeof material.textura === 'string' ? material.textura : '';
  }

  function bindMaterialTextureMaps(programa, material) {
    MOD3D_MAPAS_DO_MATERIAL.forEach(function (binding) {
        const tex = texturaDoMaterial(materialTextureMapPathFor(material, binding.key));
        gl.activeTexture(gl.TEXTURE0 + binding.unit);
        gl.bindTexture(gl.TEXTURE_2D, tex || branca);
        if (programa.uniformes[binding.samplerName]) {
          gl.uniform1i(programa.uniformes[binding.samplerName], binding.unit);
        }
        if (programa.uniformes[binding.flagName]) {
          gl.uniform1f(programa.uniformes[binding.flagName], tex ? 1 : 0);
        }
    });
    gl.activeTexture(gl.TEXTURE0);
  }

  function pintarMaterial(programa, pedaco) {
    const material = pedaco.material || {};
    if (programa.uniformes.uCor) {
      gl.uniform3fv(programa.uniformes.uCor, pedaco.cor || [0.7, 0.75, 0.85]);
    }
    const opacidade = typeof material.opacidade === 'number' ? material.opacidade : 1;
    if (programa.uniformes.uOpacidade) {
      gl.uniform1f(programa.uniformes.uOpacidade, opacidade);
    }
    if (programa.uniformes.uEmissao) {
      gl.uniform1f(programa.uniformes.uEmissao, Number(material.emissao) || 0);
    }
    if (programa.uniformes.uMetalness) {
      gl.uniform1f(
        programa.uniformes.uMetalness,
        typeof material.metal === 'number' ? material.metal : MOD3D_MATERIAL_METAL_PADRAO,
      );
    }
    if (programa.uniformes.uRoughness) {
      gl.uniform1f(
        programa.uniformes.uRoughness,
        typeof material.rugosidade === 'number'
        ? material.rugosidade
        : MOD3D_MATERIAL_RUGOSIDADE_PADRAO,
      );
    }
    bindMaterialTextureMaps(programa, material);
    if (opacidade < 1) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
  }

  function pintarOlho(programa, extras) {
    if (!programa.uniformes.uEyePosition) return;
    const olho = extras && extras.olho ? extras.olho : [0, 0, 1];
    gl.uniform3fv(programa.uniformes.uEyePosition, olho);
  }

  function pintarNeblina(programa, extras) {
    const neblina = extras && extras.neblina ? extras.neblina : null;
    if (programa.uniformes.uFogColor) {
      gl.uniform3fv(programa.uniformes.uFogColor, neblina ? neblina.color : MOD3D_FUNDO_DO_PALCO);
    }
    if (programa.uniformes.uFogCenter) {
      gl.uniform3fv(programa.uniformes.uFogCenter, neblina ? neblina.center : [0, 0, 0]);
    }
    if (programa.uniformes.uFogStart) {
      gl.uniform1f(programa.uniformes.uFogStart, neblina ? neblina.start : 0);
    }
    if (programa.uniformes.uFogEnd) {
      gl.uniform1f(programa.uniformes.uFogEnd, neblina ? neblina.end : 0);
    }
  }

  function desenharGrupo(programa, tipo, camada, proj, view, extras) {
    const lista = ordenadas(tipo, camada);
    if (!lista.length) return 0;
    const ehMalha = tipo === 'malha';
    const posLoc = programa.atributos.aPos;
    const extraLoc = ehMalha ? programa.atributos.aNormal : programa.atributos.aCor;
    gl.useProgram(programa.prog);
    gl.uniformMatrix4fv(programa.uniformes.uProj, false, proj);
    gl.uniformMatrix4fv(programa.uniformes.uView, false, view);
    if (ehMalha && programa.uniformes.uLuz) {
      gl.uniform3fv(programa.uniformes.uLuz, MOD3D_LUZ_DO_PALCO);
    }
    if (ehMalha) pintarOlho(programa, extras);
    else pintarNeblina(programa, extras);
    gl.enableVertexAttribArray(posLoc);
    gl.enableVertexAttribArray(extraLoc);
    let vertices = 0;
    lista.forEach(function (peca) {
        const buffers = subirPeca(peca);
        if (!buffers) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pos);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.extra);
        gl.vertexAttribPointer(extraLoc, 3, gl.FLOAT, false, 0, 0);
        if (!ehMalha) {
          gl.drawArrays(gl.LINES, 0, buffers.vertices);
          vertices += buffers.vertices;
          return;
        }
        ligarExtras(programa, buffers);
        pedacosDaPeca(peca, buffers).forEach(function (pedaco) {
            pintarMaterial(programa, pedaco);
            gl.drawArrays(gl.TRIANGLES, pedaco.inicio, pedaco.conta);
            vertices += pedaco.conta;
        });
        desligarExtras(programa);
        gl.disable(gl.BLEND);
    });
    gl.disableVertexAttribArray(posLoc);
    gl.disableVertexAttribArray(extraLoc);
    return vertices;
  }

  function definirTamanho(largura, altura, pixel) {
    const dpr = Math.min(MOD3D_TETO_DO_PIXEL, Math.max(1, Number(pixel) || 1));
    const l = Math.max(1, Math.round(largura * dpr));
    const a = Math.max(1, Math.round(altura * dpr));
    if (canvas.width === l && canvas.height === a && tamanho.pixel === dpr) return false;
    canvas.width = l;
    canvas.height = a;
    tamanho.largura = l;
    tamanho.altura = a;
    tamanho.pixel = dpr;
    return true;
  }

  function desenhar(quadro) {
    if (perdido || !gl) return false;
    if (gl.isContextLost && gl.isContextLost()) {
      perdido = true;
      return false;
    }
    const fundo = quadro.fundo || MOD3D_FUNDO_DO_PALCO;
    const extras = { olho: quadro.olho, neblina: quadro.neblina };
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(fundo[0], fundo[1], fundo[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    desenharGrupo(linha, 'linha', 'grade', quadro.proj, quadro.view, extras);
    desenharGrupo(linha, 'linha', 'cena', quadro.proj, quadro.view, null);
    desenharGrupo(malha, 'malha', 'cena', quadro.proj, quadro.view, extras);
    gl.disable(gl.DEPTH_TEST);
    desenharGrupo(linha, 'linha', 'gizmo', quadro.proj, quadro.view, null);
    gl.enable(gl.DEPTH_TEST);
    return true;
  }

  function contar() {
    let triangulos = 0;
    let linhas = 0;
    let bytes = 0;
    pecas.forEach(function (peca) {
        bytes += peca.pos.byteLength + (peca.extra ? peca.extra.byteLength : 0);
        if (!peca.visivel) return;
        if (peca.tipo === 'malha') triangulos += (peca.pos.length / 9) | 0;
        else linhas += (peca.pos.length / 6) | 0;
    });
    return { triangulos: triangulos, linhas: linhas, bytes: bytes, pecas: pecas.size };
  }

  function remontar() {
    descartarBuffers();
    if (gl && gl.isContextLost && gl.isContextLost()) return false;
    const certo = montar();
    avisar();
    return certo;
  }

  canvas.addEventListener('webglcontextlost', function (evento) {
      evento.preventDefault();
      perdido = true;
      motivo = 'contexto-perdido';
      descartarBuffers();
      avisar();
  });

  canvas.addEventListener('webglcontextrestored', function () {
      descartarBuffers();
      malha = null;
      linha = null;
      if (montar()) motivo = '';
      avisar();
  });

  const ligou = montar();

  return {
    pronto: () => Boolean(gl) && !perdido,
    perdido: () => perdido,
    motivo: () => motivo,
    iniciou: () => ligou,
    definirMalha: (nome, dados) => guardar(nome, 'malha', dados),
    definirLinhas: (nome, dados) => guardar(nome, 'linha', dados),
    definirTextura,
    temTextura: (caminho) => imagens.has(caminho),
    remover: (nome) => guardar(nome, 'malha', null),
    tem: (nome) => pecas.has(nome),
    definirTamanho,
    desenhar,
    contar,
    remontar,
    aoMudar: (fn) => {
      aoMudar = typeof fn === 'function' ? fn : null;
    },
    tamanho: () => ({ largura: tamanho.largura, altura: tamanho.altura, pixel: tamanho.pixel }),
  };
}
