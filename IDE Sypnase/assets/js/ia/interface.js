'use strict';

const IA_UI = {
  painel: null,
  montado: false,
  aberto: false,
  vista: 'chat',
  bolha: null,
  cartoes: {},
  anexos: [],
  geo: null,
  edit: null,
  lista: null,
  colado: false,
  followOutput: true,
};

const IA_ICO = {
  enviar:
  '<path d="M20.6 3.4 3.9 10.3a.7.7 0 0 0 .1 1.3l6.1 1.8a.7.7 0 0 1 .5.5l1.8 6.1a.7.7 0 0 0 1.3.1z"/><path d="M20.6 3.4 10.6 13.4"/>',
  parar:
  '<circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6" rx="1.6" fill="currentColor" stroke="none"/>',
  fullscreen:
  '<path d="M8 3H5.5A2.5 2.5 0 0 0 3 5.5V8m13-5h2.5A2.5 2.5 0 0 1 21 5.5V8M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16m13 5h2.5a2.5 2.5 0 0 0 2.5-2.5V16"/>',
  fullscreenExit:
  '<path d="M3 8h2.5A2.5 2.5 0 0 0 8 5.5V3m13 5h-2.5A2.5 2.5 0 0 1 16 5.5V3M3 16h2.5A2.5 2.5 0 0 1 8 18.5V21m13-5h-2.5a2.5 2.5 0 0 0-2.5 2.5V21"/>',
  novo: '<path d="M12 5v14M5 12h14"/>',
  hist: '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="8"/>',
  cfg: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4"/>',
  docar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  min: '<path d="M5 12h14"/>',
  max: '<path d="M8 4h12v12M16 20H4V8"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  voltar: '<path d="M14 6l-6 6 6 6"/>',
  olho: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
  lapis: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
  term: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  alerta: '<path d="M12 4 2 20h20z"/><path d="M12 10v4m0 3v.5"/>',
  ok: '<path d="M5 13l4 4L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  lixo: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  chave: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v4"/>',
  raio: '<path d="M13 3 5 14h5l-1 7 8-11h-5z"/>',
  arquivo:
  '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  busca: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  camera:
  '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M9 7l1.5-3h3L15 7"/>',
  plug: '<path d="M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-12 0z"/><path d="M12 18v3"/>',
  teste: '<path d="M9 3h6M10 3v7L5 20h14l-5-10V3"/>',
  baixar: '<path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/>',
};

function iaIcone(nome, cls) {
  const d = IA_ICO[nome] || IA_ICO.raio;
  return (
    `<svg class="icon ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
  );
}

function iaEsc(texto) {
  return String(texto == null ? '' : texto)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
  }

  function iaHora(ts) {
    const d = ts ? new Date(ts) : new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function iaNum(n) {
    const v = Number(n) || 0;
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(v);
  }

  function iaLinkSeguro(url) {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) return '';
      return iaEsc(u);
    }

    function iaInline(texto) {
      let s = iaEsc(texto);
      s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
	s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
		const link = iaLinkSeguro(u);
		return link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${t}</a>` : t;
	});
	return s;
}

function iaLinguagem(marca) {
	const m = String(marca || '').toLowerCase();
	if (/^(js|javascript|jsx|ts|tsx|mjs|cjs)$/.test(m)) return 'js';
	if (/^(css|scss)$/.test(m)) return 'css';
	if (/^(json|jsonc)$/.test(m)) return 'json';
	if (/^(html|xml|svg|vue)$/.test(m)) return 'html';
	return '';
}

function iaBlocoCodigo(codigo, marca) {
	const lang = iaLinguagem(marca);
	let corpo = '';
	try {
		corpo = typeof highlight === 'function' && lang ? highlight(codigo, lang) : iaEsc(codigo);
	} catch (e) {
		ignorarErro(e, 'iaBlocoCodigo');
		corpo = iaEsc(codigo);
	}
	const rotulo = iaEsc(marca || lang || 'texto');
	return (
		`<div class="ia-code"><div class="ia-code-h"><span>${rotulo}</span><span class="sp"></span>` +
		`<button type="button" data-copiar="1">copiar</button></div><pre>${corpo}</pre></div>`
	);
}

function iaMd(texto) {
	const bruto = String(texto == null ? '' : texto);
	const partes = bruto.split(/```/);
  let fora = '';
  partes.forEach((parte, i) => {
      if (i % 2 === 1) {
        const quebra = parte.indexOf('\n');
        const marca = quebra > 0 ? parte.slice(0, quebra).trim() : '';
        const codigo = quebra > 0 ? parte.slice(quebra + 1) : parte;
        fora += iaBlocoCodigo(codigo.replace(/\n$/, ''), marca);
        return;
      }
      const linhas = parte.split('\n');
      let lista = '';
      let paragrafo = [];
      const fecharP = () => {
        if (!paragrafo.length) return;
        fora += `<p>${iaInline(paragrafo.join('\n')).replace(/\n/g, '<br>')}</p>`;
        paragrafo = [];
      };
      const fecharL = () => {
        if (!lista) return;
        fora += lista === 'ul' ? '</ul>' : '</ol>';
        lista = '';
      };
      linhas.forEach((linha) => {
          const t = linha.replace(/\s+$/, '');
          const cab = t.match(/^(#{1,4})\s+(.*)$/);
          const mar = t.match(/^\s*[-*+]\s+(.*)$/);
          const num = t.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (!t.trim()) {
          fecharP();
          fecharL();
          return;
        }
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(t)) {
          fecharP();
          fecharL();
          fora += '<hr>';
          return;
        }
        if (cab) {
          fecharP();
          fecharL();
          const n = Math.min(3, cab[1].length);
          fora += `<h${n}>${iaInline(cab[2])}</h${n}>`;
          return;
        }
        if (t.indexOf('&gt;') === 0 || t.indexOf('>') === 0) {
          fecharP();
          fecharL();
          fora += `<blockquote>${iaInline(t.replace(/^>\s?/, ''))}</blockquote>`;
          return;
        }
        if (mar) {
          fecharP();
          if (lista !== 'ul') {
            fecharL();
            fora += '<ul>';
            lista = 'ul';
          }
          fora += `<li>${iaInline(mar[1])}</li>`;
          return;
        }
        if (num) {
          fecharP();
          if (lista !== 'ol') {
            fecharL();
            fora += '<ol>';
            lista = 'ol';
          }
          fora += `<li>${iaInline(num[2])}</li>`;
          return;
        }
        fecharL();
        paragrafo.push(t);
    });
    fecharP();
    fecharL();
});
return fora || '<p></p>';
}

function iaResumoArgs(args) {
  if (!args || typeof args !== 'object') return '';
  const chaves = ['path', 'paths', 'from', 'to', 'name', 'command', 'query', 'selector', 'code'];
  for (const k of chaves) {
    if (args[k] != null && args[k] !== '') {
      const v = Array.isArray(args[k]) ? args[k].join(', ') : String(args[k]);
      return v.replace(/\s+/g, ' ').slice(0, 90);
    }
  }
  const primeira = Object.keys(args)[0];
  if (!primeira) return '';
  const v = args[primeira];
  const txt = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return `${primeira}=${txt}`.replace(/\s+/g, ' ').slice(0, 90);
}

function iaIconeClasse(classe) {
  if (classe === 'comando') return 'term';
  if (classe === 'destrutiva') return 'alerta';
  if (classe === 'escrita') return 'lapis';
  return 'olho';
}

const IA_MODOS = [
  { id: 'pedir', rot: 'Pedir', dica: 'Aprovar terminal e acoes destrutivas' },
  { id: 'leitura', rot: 'Revisar', dica: 'Aprovar tudo que escreve ou executa' },
  { id: 'tudo', rot: 'Estrito', dica: 'Aprovar cada chamada de ferramenta' },
  { id: 'auto', rot: 'Autonomo', dica: 'Executar tudo sem perguntar' },
];

function iaModoAtual() {
  iaCarregar();
  return IA_MODOS.find((m) => m.id === IA.prefs.modo) || IA_MODOS[0];
}

function iaEsqueleto() {
  const grips = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
  .map((direction) => `<div class="ia-grip ${direction}" data-dir="${direction}"></div>`)
  .join('');
  return `${grips}
<header class="ia-head" id="iaHead">
	<span class="ia-dot" id="iaDot"></span>
	<div class="ia-tt"><b>Assistente</b><span id="iaSub">Conecte seu modelo</span></div>
	<span class="sp"></span>
	<button type="button" class="ia-ico" data-ai-stop aria-label="Interromper tarefa" title="Interromper tarefa" hidden>${iaIcone('parar')}</button>
	<button type="button" class="ia-ico" data-ai-restore aria-label="Restaurar chat" title="Restaurar chat" hidden>${iaIcone('docar')}</button>
	<button type="button" class="ia-ico" data-ai-fullscreen aria-pressed="false" aria-label="Abrir em tela cheia" title="Abrir em tela cheia">${iaIcone('fullscreen')}</button>
	<button type="button" class="ia-ico" data-act="novo" aria-label="Nova conversa" title="Nova conversa">${iaIcone('novo')}</button>
	<details class="ai-panel-menu"><summary class="ia-ico" aria-label="Mais opções" title="Mais opções">${iaIcone('cfg')}</summary><div class="ai-panel-menu-items">
		<button type="button" data-act="cfg">Conexões e permissões</button>
		<button type="button" data-act="hist">Histórico de conversas</button>
		<button type="button" data-act="dock">Encaixar / flutuar</button>
		<button type="button" data-act="min">Minimizar</button>
	</div></details>
	<button type="button" class="ia-ico" data-act="fechar" aria-label="Fechar chat" title="Fechar chat">${iaIcone('fechar')}</button>
</header>
<nav class="ai-chat-tabs" role="tablist" aria-label="Áreas do assistente">
	<button type="button" id="aiTabChat" role="tab" aria-controls="iaViewChat" aria-selected="true" data-ai-tab="chat">Conversa</button>
	<button type="button" id="aiTabModel" role="tab" aria-controls="iaViewModel" aria-selected="false" tabindex="-1" data-ai-tab="model">Modelo</button>
	<button type="button" id="aiTabUsage" role="tab" aria-controls="iaViewUsage" aria-selected="false" tabindex="-1" data-ai-tab="usage">Uso e créditos</button>
</nav>
<div class="ia-ctx" id="iaCtx"></div>
<div class="ia-body">
	<div class="ia-view" id="iaViewChat" role="tabpanel" aria-labelledby="aiTabChat" tabindex="0"><div class="ia-msgs" id="iaMsgs"></div></div>
	<div class="ia-view" id="iaViewModel" role="tabpanel" aria-labelledby="aiTabModel" hidden></div>
	<div class="ia-view" id="iaViewUsage" role="tabpanel" aria-labelledby="aiTabUsage" hidden></div>
	<div class="ia-view" id="iaViewCfg" aria-label="Conexões e permissões" hidden></div>
	<div class="ia-view" id="iaViewHist" aria-label="Histórico de conversas" hidden></div>
</div>
<footer class="ia-foot">
	<div class="ai-live-status" id="iaStats" role="status" aria-live="off"></div>
	<div class="ia-anexos" id="iaAnexos" hidden></div>
	<div class="ia-comp"><label for="iaInput" class="ai-visually-hidden">Mensagem para o assistente</label><textarea id="iaInput" rows="2" spellcheck="false" placeholder="O que vamos construir?"></textarea></div>
	<div class="ia-bar">
		<button type="button" class="ia-chip" id="iaChipConn" title="Trocar conexão e modelo">${iaIcone('plug')}<b>Conectar modelo</b></button>
		<button type="button" class="ia-chip ai-thinking-toggle" id="aiThinkingToggle" aria-pressed="false" title="Configurar raciocínio" hidden>${iaIcone('raio')}<b>Thinking</b></button>
		<span class="sp"></span>
		<button type="button" class="ia-send" id="iaSend" aria-label="Enviar mensagem" title="Enviar (Enter)">${iaIcone('enviar')}</button>
	</div>
	<div class="ai-composer-hint"><span>Enter envia · Shift+Enter cria nova linha</span><button type="button" id="iaChipModo" title="Política de aprovação">Aprovação</button></div>
</footer>`;
}

function iaGeoPadrao() {
  const width = Math.min(440, Math.max(320, window.innerWidth - 40));
  const height = Math.min(600, Math.max(320, window.innerHeight - 120));
  return {
    modo: 'float',
    x: Math.max(12, window.innerWidth - width - 18),
    y: Math.max(52, window.innerHeight - height - 40),
    w: width,
    h: height,
    dockW: 400,
    min: false,
  };
}

function iaAplicarGeo() {
  const panel = IA_UI.painel;
  if (!panel) return;
  const topbar = document.querySelector('.topbar');
  const statusbar = document.querySelector('.statusbar');
  const geometry = window.SynapseChatGeometry.resolve(
    IA_UI.geo,
    { width: window.innerWidth, height: window.innerHeight },
    {
      top: topbar ? topbar.getBoundingClientRect().height : 46,
      bottom: statusbar ? statusbar.getBoundingClientRect().height : 26,
      headerHeight: Number.parseFloat(getComputedStyle(panel).getPropertyValue('--ai-header-size')) || 44,
    },
  );
  panel.classList.toggle('dock', geometry.mode === 'dock');
  panel.classList.toggle('min', geometry.minimized);
  panel.querySelector('[data-ai-restore]').hidden = !geometry.minimized;
  panel.dataset.mode = geometry.mode;
  panel.style.right = 'auto';
  panel.style.left = `${geometry.left}px`;
  panel.style.top = `${geometry.top}px`;
  panel.style.width = `${geometry.width}px`;
  panel.style.height = `${geometry.height}px`;
}

function iaGeoSalvar() {
  iaGravarJson(IA_LS.ui, IA_UI.geo);
}

function iaArrastarPainel(ev) {
  if (IA_UI.geo.modo === 'dock' || ev.button !== 0) return;
  if (ev.target.closest('button, input, select, textarea, summary, a')) return;
  const p = IA_UI.painel;
  const r = p.getBoundingClientRect();
  const dx = ev.clientX - r.left;
  const dy = ev.clientY - r.top;
  p.classList.add('arrastando');
  const applyPendingGeometry = window.SynapseFrameScheduler.create(iaAplicarGeo);
  const mover = (e) => {
    IA_UI.geo.x = e.clientX - dx;
    IA_UI.geo.y = e.clientY - dy;
    applyPendingGeometry();
  };
  const soltar = () => {
    p.classList.remove('arrastando');
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', soltar);
    iaAplicarGeo();
    iaGeoSalvar();
  };
  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerup', soltar);
}

function iaRedimensionar(ev, dir) {
  ev.preventDefault();
  ev.stopPropagation();
  const p = IA_UI.painel;
  const g = IA_UI.geo;
  const r = p.getBoundingClientRect();
  const ini = { x: ev.clientX, y: ev.clientY, w: r.width, h: r.height, l: r.left, t: r.top };
  p.classList.add('medindo');
  const applyPendingGeometry = window.SynapseFrameScheduler.create(iaAplicarGeo);
  const mover = (e) => {
    const dx = e.clientX - ini.x;
    const dy = e.clientY - ini.y;
    if (g.modo === 'dock') {
      g.dockW = Math.max(320, ini.w - dx);
      applyPendingGeometry();
      return;
    }
    if (dir.indexOf('e') >= 0) g.w = Math.max(320, ini.w + dx);
    if (dir.indexOf('s') >= 0) g.h = Math.max(260, ini.h + dy);
    if (dir.indexOf('w') >= 0) {
      g.w = Math.max(320, ini.w - dx);
      g.x = ini.l + (ini.w - g.w);
    }
    if (dir.indexOf('n') >= 0) {
      g.h = Math.max(260, ini.h - dy);
      g.y = ini.t + (ini.h - g.h);
    }
    g.min = false;
    applyPendingGeometry();
  };
  const soltar = () => {
    p.classList.remove('medindo');
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', soltar);
    iaAplicarGeo();
    iaGeoSalvar();
  };
  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerup', soltar);
}

function iaVista(name) {
  IA_UI.vista = name;
  iaFecharLista();
  const views = {
    chat: 'iaViewChat',
    model: 'iaViewModel',
    usage: 'iaViewUsage',
    cfg: 'iaViewCfg',
    hist: 'iaViewHist',
  };
  for (const [key, id] of Object.entries(views)) {
    const target = document.getElementById(id);
    if (target) target.hidden = key !== name;
  }
  for (const button of IA_UI.painel.querySelectorAll('[data-ai-tab]')) {
    const selected = button.dataset.aiTab === name;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  if (!['chat', 'model', 'usage'].includes(name)) {
    IA_UI.painel.querySelector('[data-ai-tab="chat"]').tabIndex = 0;
  }
  IA_UI.painel.querySelector('.ia-foot').hidden = name !== 'chat';
  document.getElementById('iaCtx').hidden = name !== 'chat';
  if (name === 'cfg') iaRenderCfg();
  if (name === 'hist') iaRenderHist();
  if (name === 'model') window.SynapseAIModelControlsView.render();
  if (name === 'usage') window.SynapseAIUsageView.render();
}

function iaAtualizarCtx() {
  const target = document.getElementById('iaCtx');
  if (!target) return;
  const context = iaContexto();
  const tools = iaResumoFerramentas();
  target.innerHTML = `${iaIcone('arquivo')}<strong>${iaEsc(context.projeto || 'Nenhum projeto')}</strong><span>${context.arquivos || 0} arquivos</span>`;
  target.title = `${context.aberto || 'Nenhum arquivo aberto'} · ${tools.total} ferramentas · ${context.terminal ? 'Terminal disponível' : 'Sem terminal conectado'}`;
}

function iaAtualizarBarra() {
  const conn = iaConexaoAtiva();
  const chip = document.getElementById('iaChipConn');
  const sub = document.getElementById('iaSub');
  const dot = document.getElementById('iaDot');
  const modoChip = document.getElementById('iaChipModo');
  if (chip) {
    chip.innerHTML = conn
    ? `${iaIcone('raio')}<b>${iaEsc(conn.modelo || 'escolher modelo')}</b>`
    : `${iaIcone('plug')}<b>conectar IA</b>`;
  }
  if (sub) sub.textContent = conn ? conn.nome : 'sem IA conectada';
  if (dot) {
    dot.className = `ia-dot${IA_CHAT.rodando ? ' busy' : conn ? ' on' : ''}`;
  }
  if (modoChip) {
    const modo = iaModoAtual();
    modoChip.textContent = `Aprovação: ${modo.rot}`;
    modoChip.title = modo.dica;
    modoChip.classList.toggle('auto', modo.id === 'auto');
    modoChip.classList.toggle('alerta', modo.id === 'tudo');
  }
  const env = document.getElementById('iaSend');
  if (env) {
    env.classList.toggle('parar', IA_CHAT.rodando);
    env.innerHTML = iaIcone(IA_CHAT.rodando ? 'parar' : 'enviar');
    env.title = IA_CHAT.rodando ? 'Interromper' : 'Enviar (Enter)';
  }
  const capabilities = window.SynapseAIModelCapabilities.resolve(conn);
  const thinking = document.getElementById('aiThinkingToggle');
  if (thinking) {
    thinking.hidden = !conn || capabilities.thinking === 'unsupported';
    thinking.disabled = IA_CHAT.rodando;
    thinking.setAttribute('aria-pressed', String(!!capabilities.thinkingActive));
    thinking.title = capabilities.thinkingRequired
    ? 'Raciocínio obrigatório neste modelo. Abrir configuração de esforço.'
    : 'Ativar ou desativar o raciocínio';
    thinking.querySelector('b').textContent = capabilities.thinkingRequired
    ? 'Thinking obrigatório'
    : capabilities.thinkingActive
    ? 'Thinking ativo'
    : 'Thinking';
  }
  for (const button of IA_UI.painel?.querySelectorAll(
      '[data-act="novo"], #iaChipConn, #iaChipModo',
    ) || []) {
    button.disabled = IA_CHAT.rodando;
  }
  const stop = IA_UI.painel?.querySelector('[data-ai-stop]');
  if (stop) stop.hidden = !IA_CHAT.rodando;
  if (env) {
    env.setAttribute('aria-label', IA_CHAT.rodando ? 'Interromper tarefa' : 'Enviar mensagem');
  }
  iaIndicador();
}

function iaIndicador() {
  const ind = document.getElementById('iaInd');
  if (!ind) return;
  const conn = iaConexaoAtiva();
  ind.className = `ia-ind${IA_CHAT.rodando ? ' busy' : conn ? ' on' : ''}`;
}

function iaStats(data) {
  const target = document.getElementById('iaStats');
  if (!target) return;
  const metrics = data || IA_CHAT.stats;
  if (!metrics?.passos) {
    target.textContent = '';
    target.hidden = true;
    return;
  }
  const format = window.SynapseAIReasoningView;
  target.hidden = false;
  target.textContent = `${metrics.usageReported ? `${format.number(metrics.total)} tokens${metrics.usageComplete ? '' : ' confirmados'}` : IA_CHAT.rodando ? 'Tokens: aguardando a API' : 'Tokens não informados pela API'} · ${format.duration(metrics.ms)}`;
  target.title =
  'Contagem atualizada quando o provedor envia uso. Alguns modelos informam tokens somente no fim.';
  window.SynapseAIReasoningView.tick(IA_UI.painel);
  window.SynapseAIUsageView.updateMetrics();
}

function iaRolar(forcar) {
  const v = document.getElementById('iaViewChat');
  if (!v) return;
  if (forcar || IA_UI.followOutput) {
    IA_UI.followOutput = true;
    v.scrollTop = v.scrollHeight;
  }
}

function iaVazio() {
  const temConn = iaCarregar().conexoes.length > 0;
  const ativa = typeof iaConexaoAtiva === 'function' ? iaConexaoAtiva() : null;
  const ehNotion = !!ativa && (ativa.formato === 'notion-agents' || ativa.prov === 'notion');
  const sugestoes = ehNotion
  ? [
    ['busca', 'Resumir o que tem no meu Notion sobre este projeto'],
    ['lapis', 'Criar uma pagina no Notion com o plano desta semana'],
    ['teste', 'Listar minhas tarefas pendentes e as prioridades'],
  ]
  : [
    ['busca', 'Mapear o projeto e listar o que da para melhorar'],
    ['lapis', 'Criar uma landing page responsiva com tema escuro'],
    ['teste', 'Rodar um teste de interacao e me mostrar o screenshot'],
  ];
  const botoes = sugestoes
  .map(
    ([ic, txt]) =>
    `<button type="button" data-sug="${iaEsc(txt)}">${iaIcone(ic)}<span>${iaEsc(txt)}</span></button>`,
  )
  .join('');
  return `<div class="ia-vazio">
	<h4>${ehNotion ? 'Falando com o agente do Notion' : temConn ? 'Pronto para trabalhar' : 'Conecte sua IA'}</h4>
	<p>${
		ehNotion
			? 'Este chat conversa com um agente do seu Notion pelo token, sem MCP. Ele responde por texto e usa as ferramentas dele dentro do Notion; para editar os arquivos do projeto, use uma conexao com chave propria.'
			: temConn
				? 'Peça uma mudança, investigue um problema ou explore seu projeto. Você controla o modelo e as permissões.'
				: 'Use seu provedor favorito ou um modelo local. Adicione uma conexão para começar.'
	}</p>
	${temConn ? `<div class="ia-sug">${botoes}</div>` : `<div class="ia-sug"><button type="button" data-act="cfg">${iaIcone('plug')}<span>Adicionar conexao de IA</span></button></div>`}
	<div class="ia-atalhos">
		<span>Enviar <kbd>Enter</kbd></span>
		<span>Nova linha <kbd>Shift+Enter</kbd></span>
		<span>Abrir/fechar <kbd>Ctrl+I</kbd></span>
		<span>Interromper <kbd>Esc</kbd></span>
	</div>
</div>`;
}

function iaRenderChat() {
  const alvo = document.getElementById('iaMsgs');
  if (!alvo) return;
  const conversa = IA_CHAT.conversa;
  IA_UI.cartoes = {};
  IA_UI.bolha = null;
  if (!conversa || !conversa.mensagens.length) {
    alvo.innerHTML = iaVazio();
    return;
  }
  alvo.innerHTML = '';
  conversa.mensagens.forEach((m) => {
      if (m.role === 'user') iaAddMsg('user', m.content, m.imagens);
      else if (m.role === 'summary') {
        if (m.metrics) alvo.appendChild(window.SynapseAIReasoningView.summary(m.metrics));
      } else if (m.role === 'assistant') {
        const body = iaAddMsg('ai', m.content || '');
        for (const block of m.reasoning || []) {
          window.SynapseAIReasoningView.update(body?.closest('.ia-msg'), block, true);
        }
        (m.chamadas || []).forEach((c) => iaCartaoAbrir(c.id, c.nome, c.args));
      } else if (m.role === 'tool') {
        if (!IA_UI.cartoes[m.id]) iaCartaoAbrir(m.id, m.nome, {});
        iaCartaoFechar(m.id, { ok: !m.erro, texto: m.texto, ms: m.ms, imagens: [] });
      }
  });
  iaRolar(true);
}

function iaAddMsg(papel, texto, imagens) {
  const alvo = document.getElementById('iaMsgs');
  if (!alvo) return null;
  const vazio = alvo.querySelector('.ia-vazio');
  if (vazio) alvo.innerHTML = '';
  const rotulos = { user: 'Você', ai: 'Assistente', sys: 'Sistema' };
  const no = document.createElement('div');
  no.className = 'ia-msg';
  no.dataset.role = papel;
  const figuras = (imagens || [])
  .map((i) => `<img src="data:${i.mime || 'image/png'};base64,${i.data}" alt="anexo">`)
  .join('');
  no.innerHTML =
  `<div class="ia-msg-h"><b>${rotulos[papel] || papel}</b><span class="sp"></span>` +
  `<span>${iaHora()}</span></div><div class="ia-md">${iaMd(texto)}${figuras}</div>`;
  alvo.appendChild(no);
  iaRolar(papel === 'user');
  return no.querySelector('.ia-md');
}

function iaCartaoAbrir(id, nome, args) {
  const alvo = document.getElementById('iaMsgs');
  if (!alvo) return;
  const classe = iaFerramentaClasse(nome);
  const no = document.createElement('div');
  no.className = 'ia-passo';
  no.dataset.st = 'run';
  no.dataset.id = id;
  const resumo = iaResumoArgs(args);
  no.innerHTML =
  `<button class="ia-passo-h" type="button" data-alternar="1">` +
  `<span class="ia-passo-ic"><span class="ia-spin"></span></span>` +
  `<b>${iaEsc(nome)}</b><span class="arg">${iaEsc(resumo)}</span>` +
  `<span class="ms"></span></button>` +
  `<div class="ia-passo-b" hidden><span class="rot">entrada</span>` +
  `<pre>${iaEsc(JSON.stringify(args || {}, null, 2))}</pre></div>`;
  no.dataset.classe = classe;
  alvo.appendChild(no);
  IA_UI.cartoes[id] = no;
  IA_UI.bolha = null;
  iaRolar();
}

function iaCartaoFechar(id, dados) {
  const no = IA_UI.cartoes[id];
  if (!no) return;
  no.dataset.st = dados.recusada ? 'neg' : dados.ok ? 'ok' : 'err';
  const ic = no.querySelector('.ia-passo-ic');
  const classe = no.dataset.classe || 'leitura';
  if (ic) {
    ic.innerHTML = dados.recusada
    ? iaIcone('x')
    : dados.ok
    ? iaIcone(iaIconeClasse(classe))
    : iaIcone('alerta');
  }
  const ms = no.querySelector('.ms');
  if (ms && dados.ms) ms.textContent = `${dados.ms} ms`;
  const corpo = no.querySelector('.ia-passo-b');
  if (corpo) {
    const figuras = (dados.imagens || [])
    .map((i) => `<img src="data:${i.mime || 'image/png'};base64,${i.data}" alt="saida">`)
    .join('');
    corpo.innerHTML += `<span class="rot">saida</span><pre>${iaEsc(String(dados.texto || '').slice(0, 4000))}</pre>${
			figuras
		}`;
    if (!dados.ok && !dados.recusada) corpo.hidden = false;
  }
  if ((dados.imagens || []).length) {
    const pre = document.createElement('div');
    pre.className = 'ia-msg';
    pre.dataset.role = 'ai';
    pre.innerHTML =
    `<div class="ia-msg-h"><b>${iaEsc(no.querySelector('b').textContent)}</b>` +
    `<span class="sp"></span><span>${iaHora()}</span></div><div class="ia-md">${dados.imagens
				.map((i) => `<img src="data:${i.mime || 'image/png'};base64,${i.data}" alt="preview">`)
				.join('')}</div>`;
    no.parentNode.insertBefore(pre, no.nextSibling);
  }
  iaRolar();
}

function iaCartaoPermissao(dados) {
  const alvo = document.getElementById('iaMsgs');
  if (!alvo) return;
  const no = document.createElement('div');
  no.className = 'ia-perm';
  no.dataset.perm = dados.id;
  const descricao =
  dados.classe === 'comando'
  ? 'Vai executar um comando real na sua maquina.'
  : dados.classe === 'destrutiva'
  ? 'Acao destrutiva: pode apagar ou sobrescrever conteudo.'
  : 'Acao de escrita no projeto.';
  no.innerHTML =
  `<b>${iaIcone('alerta')} Permissao necessaria</b>` +
  `<p>${iaEsc(dados.nome)} · ${iaEsc(iaResumoArgs(dados.args) || 'sem argumentos')}<br>${descricao}</p>` +
  `<div class="ia-perm-a">` +
  `<button class="ia-btn pri" data-perm="sim">Permitir</button>` +
  `<button class="ia-btn" data-perm="sempre">Sempre nesta sessao</button>` +
  `<button class="ia-btn gh" data-perm="nao">Recusar</button></div>`;
  alvo.appendChild(no);
  iaRolar(true);
}

function iaTirarPermissoes() {
  const alvo = document.getElementById('iaMsgs');
  if (!alvo) return;
  alvo.querySelectorAll('.ia-perm').forEach((n) => n.remove());
}

function iaUiEvento(event, data) {
  if (event === 'usuario') {
    iaAddMsg('user', data.texto, data.imagens);
    IA_UI.bolha = null;
    return;
  }
  if (event === 'assistente-inicio') {
    IA_UI.bolha = iaAddMsg('ai', '');
    IA_UI.buffer = '';
    const message = IA_UI.bolha?.closest('.ia-msg');
    if (message) {
      message.dataset.thinkingExpected = String(!!data.thinking);
      message.dataset.reasoningVisible = String(data.reasoningVisible !== false);
      IA_UI.bolha.textContent = 'Aguardando o modelo…';
      IA_UI.bolha.classList.add('ai-waiting');
    }
    return;
  }
  if (event === 'raciocinio' || event === 'raciocinio-fim') {
    const message = IA_UI.bolha?.closest('.ia-msg');
    window.SynapseAIReasoningView.update(message, data.block, event === 'raciocinio-fim');
    if (IA_UI.bolha?.classList.contains('ai-waiting')) IA_UI.bolha.textContent = '';
    iaRolar();
    return;
  }
  if (event === 'texto') {
    if (!IA_UI.bolha) {
      IA_UI.bolha = iaAddMsg('ai', '');
      IA_UI.buffer = '';
    }
    IA_UI.buffer += data.delta || '';
    IA_UI.bolha.classList.remove('ai-waiting');
    IA_UI.bolha.innerHTML = iaMd(IA_UI.buffer);
    iaRolar();
    return;
  }
  if (event === 'assistente-fim') {
    const message = IA_UI.bolha?.closest('.ia-msg');
    if (IA_UI.bolha) {
      IA_UI.bolha.classList.remove('ai-waiting');
      IA_UI.bolha.innerHTML = iaMd(data.texto || '');
      for (const block of data.metrics?.reasoning || []) {
        window.SynapseAIReasoningView.update(message, block, true);
      }
      if (message?.dataset.thinkingExpected === 'true' && !message.querySelector('.ai-reasoning')) {
        const notice = document.createElement('p');
        notice.className = 'ai-helper ai-reasoning-unavailable';
        notice.textContent =
        message.dataset.reasoningVisible === 'false'
        ? 'Esta API não expõe o texto do raciocínio.'
        : 'O provedor não enviou conteúdo de raciocínio para esta resposta.';
        message.insertBefore(notice, IA_UI.bolha);
      }
    }
    IA_UI.bolha = null;
    IA_UI.buffer = '';
    return;
  }
  if (event === 'task-summary') {
    document
    .getElementById('iaMsgs')
    ?.appendChild(window.SynapseAIReasoningView.summary(data.metrics));
    iaRolar();
    return;
  }
  if (event === 'ferramenta-inicio') {
    iaCartaoAbrir(data.id, data.nome, data.args);
    return;
  }
  if (event === 'ferramenta-fim') {
    iaTirarPermissoes();
    iaCartaoFechar(data.id, data);
    iaAtualizarCtx();
    return;
  }
  if (event === 'permissao') {
    iaCartaoPermissao(data);
    return;
  }
  if (event === 'stats') {
    iaStats(data);
    return;
  }
  if (event === 'estado') {
    iaAtualizarBarra();
    if (!data.rodando) {
      iaTirarPermissoes();
      iaStats();
    }
    if (IA_UI.vista === 'model') window.SynapseAIModelControlsView.render();
    if (IA_UI.vista === 'cfg') iaRenderCfg();
    return;
  }
  if (event === 'erro') {
    iaAddMsg('sys', `**Erro.** ${data.texto}`);
    if (data.abrirCfg) iaVista('cfg');
    return;
  }
  if (event === 'aviso') {
    iaAddMsg('sys', data.texto);
    return;
  }
  if (event === 'conversa') {
    iaRenderChat();
    iaStats();
    return;
  }
  if (event === 'titulo') iaRenderHistSePreciso();
}

function iaRenderHistSePreciso() {
  if (IA_UI.vista === 'hist') iaRenderHist();
}

function iaRenderHist() {
  const alvo = document.getElementById('iaViewHist');
  if (!alvo) return;
  const lista = iaHistorico();
  const atual = IA_CHAT.conversa ? IA_CHAT.conversa.id : '';
  const itens = lista
  .map((c) => {
      const quando = new Date(c.atualizada || c.criada);
      const data = `${String(quando.getDate()).padStart(2, '0')}/${String(quando.getMonth() + 1).padStart(2, '0')} ${iaHora(quando.getTime())}`;
      const n = (c.mensagens || []).filter((m) => m.role === 'user').length;
      return `<div class="ia-hist-i${c.id === atual ? ' on' : ''}" data-conv="${iaEsc(c.id)}">
			<span class="tx"><b>${iaEsc(c.titulo || 'Conversa')}</b><span>${data} · ${n} pedido(s)</span></span>
			<button class="ia-ico perigo" data-apagar="${iaEsc(c.id)}" title="Apagar">${iaIcone('lixo')}</button>
		</div>`;
  })
  .join('');
  alvo.innerHTML = `<div class="ia-hist">
		<div class="ia-sec">Conversas salvas</div>
		${itens || '<div class="ia-vazio-min">Nenhuma conversa salva ainda.</div>'}
	</div>`;
}

function iaMarcaProv(prov) {
  return iaEsc(prov.sigla || prov.nome.slice(0, 2));
}

function iaRenderCfg() {
  const alvo = document.getElementById('iaViewCfg');
  if (!alvo) return;
  iaCarregar();
  if (IA_UI.edit) {
    alvo.innerHTML = iaFormConexao(IA_UI.edit);
    const campo = alvo.querySelector('#iaFmChave') || alvo.querySelector('#iaFmNome');
    if (campo) campo.focus();
    return;
  }
  const f = iaResumoFerramentas();
  const conexoes = IA.conexoes
  .map((c) => {
      const prov = iaProvedor(c.prov);
      const temChave = !!iaChaveDe(c);
      const aviso = iaPrecisaChave(c) && !temChave ? ' · sem chave' : '';
      return `<div class="ia-conn${c.id === IA.ativa ? ' on' : ''}" data-usar="${iaEsc(c.id)}">
		<span class="ia-conn-mk">${iaMarcaProv(prov)}</span>
		<span class="ia-conn-tx"><b>${iaEsc(c.nome)}</b><span>${iaEsc(c.modelo || 'sem modelo')}${aviso}</span></span>
		<span class="ia-conn-ac">
			<button class="ia-ico" data-editar="${iaEsc(c.id)}" title="Editar">${iaIcone('lapis')}</button>
			<button class="ia-ico perigo" data-remover="${iaEsc(c.id)}" title="Remover">${iaIcone('lixo')}</button>
		</span></div>`;
  })
  .join('');
  const modos = IA_MODOS.map(
    (m) =>
    `<option value="${m.id}"${IA.prefs.modo === m.id ? ' selected' : ''}>${iaEsc(m.rot)} — ${iaEsc(m.dica)}</option>`,
  ).join('');
  const amostra = iaFerramentasBrutas()
  .slice(0, 200)
  .map((t) => {
      const cl = iaFerramentaClasse(t.name);
      return `<span class="ia-tag${cl === 'leitura' ? '' : ' w'}" title="${iaEsc(t.desc.slice(0, 160))}">${iaEsc(t.name)}</span>`;
  })
  .join('');
  alvo.innerHTML = `<div class="ia-cfg">
	<div class="ai-section-heading"><h2>Conexões e permissões</h2><button class="ia-btn" type="button" data-act="chat">Voltar</button></div>
	<fieldset class="ai-settings-fieldset"${IA_CHAT.rodando ? ' disabled' : ''}>
	<div class="ia-sec">Conexoes de IA</div>
	<div class="ia-conns">${conexoes || '<div class="ia-vazio-min">Nenhuma conexao ainda. Adicione um provedor abaixo para comecar.</div>'}</div>
	<div class="ia-row" style="margin-top:8px">
		<button class="ia-btn pri" data-nova="1">${iaIcone('novo')}Nova conexao</button>
	</div>

	<div class="ia-sec">Politica de aprovacao</div>
	<div class="ia-campo">
		<select class="ia-sel" id="iaPrefModo">${modos}</select>
		<span class="dica">Define quando a IA precisa da sua autorizacao antes de usar uma ferramenta.</span>
	</div>
	<label class="ia-chk"><input type="checkbox" id="iaPrefStream"${IA.prefs.stream !== false ? ' checked' : ''}>
		<span>Resposta em tempo real<small>Streaming token a token, como nas IDEs.</small></span></label>
	<label class="ia-chk"><input type="checkbox" id="iaPrefImg"${IA.prefs.enviarImagens !== false ? ' checked' : ''}>
		<span>Enviar screenshots para o modelo<small>Deixe ligado em modelos com visao para a IA conferir o preview.</small></span></label>
	<div class="ia-grid2">
		<div class="ia-campo"><label for="iaPrefPassos">Passos por pedido</label>
			<input class="ia-in" id="iaPrefPassos" type="number" min="1" max="60" value="${Number(IA.prefs.passos) || 24}"></div>
		<div class="ia-campo"><label for="iaPrefConj">Conjunto de ferramentas</label>
			<select class="ia-sel" id="iaPrefConj">
				<option value="completo"${iaConjunto() === 'completo' ? ' selected' : ''}>Completo (${f.total})</option>
				<option value="essencial"${iaConjunto() === 'essencial' ? ' selected' : ''}>Essencial (economiza tokens)</option>
			</select></div>
	</div>

	<details class="ai-settings-disclosure"><summary>Ferramentas disponíveis · ${f.total}</summary><div class="ia-ferramentas">${amostra}</div></details>
	<div class="ia-aviso" style="margin-top:10px">${iaIcone('alerta')}
		<span>As chaves ficam somente neste navegador (localStorage) e vao direto do seu computador
		para o provedor escolhido. Em computador compartilhado, marque <b>nao guardar chave</b>
		na conexao para manter a chave apenas na sessao atual.</span></div>
</fieldset></div>`;
}

function iaFormConexao(conn) {
  if (
    typeof iaNotionFormulario === 'function' &&
    (conn.formato === 'notion-agents' || conn.prov === 'notion')
  ) {
    return iaNotionFormulario(conn);
  }
  const prov = iaProvedor(conn.prov);
  const provs = IA_PROVEDORES.map(
    (p) =>
    `<option value="${p.id}"${p.id === conn.prov ? ' selected' : ''}>${iaEsc(p.nome)}</option>`,
  ).join('');
  const formatos = IA_FORMATOS.map(
    (x) =>
    `<option value="${x.id}"${x.id === conn.formato ? ' selected' : ''}>${iaEsc(x.nome)}</option>`,
  ).join('');
  const modelos = (IA.modelosCache[conn.id] || prov.modelos || [])
  .map((m) => `<option value="${iaEsc(m)}"></option>`)
  .join('');
  return `<div class="ia-cfg">
	<div class="ia-sec">${conn.novo ? 'Nova conexao' : 'Editar conexao'}</div>
	<div class="ia-campo"><label for="iaFmProv">Provedor</label>
		<select class="ia-sel" id="iaFmProv">${provs}</select>
		${prov.nota ? `<span class="dica">${iaEsc(prov.nota)}</span>` : ''}</div>
	<div class="ia-campo"><label for="iaFmNome">Nome da conexao</label>
		<input class="ia-in" id="iaFmNome" value="${iaEsc(conn.nome)}" placeholder="Ex.: Claude do trabalho"></div>
	<div class="ia-campo"><label for="iaFmChave">Chave de API</label>
		<div class="ia-row">
			<input class="ia-in" id="iaFmChave" type="password" autocomplete="off" spellcheck="false"
				value="${iaEsc(conn.chave || '')}" placeholder="${iaEsc(prov.dicaChave || (prov.semChave ? 'nao precisa para servidor local' : 'cole a chave'))}">
			<button class="ia-btn" data-ver="1" title="Mostrar/ocultar">${iaIcone('olho')}</button>
		</div>
		${prov.painel ? `<span class="dica">Gere em ${iaEsc(prov.painel)}</span>` : ''}</div>
	<label class="ia-chk"><input type="checkbox" id="iaFmGuardar"${conn.guardarChave !== false ? ' checked' : ''}>
		<span>Guardar chave neste navegador<small>Desmarque para manter a chave so na sessao atual.</small></span></label>
	<div class="ia-campo"><label for="iaFmModelo">Modelo</label>
		<div class="ia-row">
			<input class="ia-in" id="iaFmModelo" list="iaFmModelos" value="${iaEsc(conn.modelo || '')}"
				placeholder="nome exato do modelo" spellcheck="false">
			<datalist id="iaFmModelos">${modelos}</datalist>
			<button class="ia-btn" data-buscar-modelos="1">${iaIcone('baixar')}Buscar</button>
		</div></div>
	<div class="ia-sec">Avancado</div>
	<div class="ia-campo"><label for="iaFmBase">URL base</label>
		<input class="ia-in" id="iaFmBase" value="${iaEsc(conn.base || '')}" spellcheck="false"
			placeholder="https://api.exemplo.com/v1"></div>
	<div class="ia-campo"><label for="iaFmFormato">Formato da API</label>
		<select class="ia-sel" id="iaFmFormato">${formatos}</select></div>
	<div class="ia-grid2">
		<div class="ia-campo"><label for="iaFmTemp">Temperatura</label>
			<input class="ia-in" id="iaFmTemp" type="number" step="0.1" min="0" max="2" value="${conn.temp}"></div>
		<div class="ia-campo"><label for="iaFmMax">Tokens de saida</label>
			<input class="ia-in" id="iaFmMax" type="number" min="256" step="256" value="${conn.maxTokens}"></div>
	</div>
	<label class="ia-chk"><input type="checkbox" id="iaFmVisao"${conn.visao ? ' checked' : ''}>
		<span>Modelo aceita imagens<small>Permite mandar screenshots do preview para a IA.</small></span></label>
	<div class="ia-campo"><label for="iaFmHead">Cabecalhos extras</label>
		<input class="ia-in" id="iaFmHead" value="${iaEsc(conn.cabecalhos || '')}" spellcheck="false"
			placeholder="X-Minha-Chave: valor; Outro: valor">
		<span class="dica">Um por linha ou separados por ponto e virgula. Util para gateways proprios.</span></div>
	<div class="ia-row" style="margin-top:12px">
		<button class="ia-btn pri" data-salvar="1">${iaIcone('ok')}Salvar</button>
		<button class="ia-btn" data-testar="1">${iaIcone('teste')}Testar</button>
		<span class="sp" style="flex:1"></span>
		<button class="ia-btn gh" data-cancelar="1">Voltar</button>
	</div>
	<div class="ia-msg-st" id="iaFmSt"></div>
</div>`;
}

function iaLerForm() {
  const v = (id) => {
    const n = document.getElementById(id);
    return n ? n.value : '';
  };
  const c = (id) => {
    const n = document.getElementById(id);
    return n ? n.checked : false;
  };
  const base = IA_UI.edit || {};
  if (
    typeof iaNotionLerForm === 'function' &&
    (base.formato === 'notion-agents' || base.prov === 'notion')
  ) {
    return iaNotionLerForm(base);
  }
  return {
    id: base.id,
    prov: v('iaFmProv'),
    nome: v('iaFmNome') || iaProvedor(v('iaFmProv')).nome,
    chave: v('iaFmChave'),
    guardarChave: c('iaFmGuardar'),
    modelo: v('iaFmModelo').trim(),
    base: v('iaFmBase').trim(),
    formato: v('iaFmFormato'),
    temp: parseFloat(v('iaFmTemp')),
    maxTokens: parseInt(v('iaFmMax'), 10),
    visao: c('iaFmVisao'),
    cabecalhos: v('iaFmHead'),
    criada: base.criada,
    modelMetadata: base.modelMetadata,
    generation: window.SynapseAIGenerationSettings.normalize({
        ...base.generation,
        ...(v('iaFmModelo').trim() !== base.modelo ||
          v('iaFmProv') !== base.prov ||
          v('iaFmFormato') !== base.formato
          ? { thinking: 'auto', reasoningEffort: 'auto' }
          : {}),
    }),
  };
}

function iaFormSt(texto, tipo) {
  const n = document.getElementById('iaFmSt');
  if (!n) return;
  n.className = `ia-msg-st ${tipo || ''}`;
  n.textContent = texto;
}

async function iaAcaoBuscarModelos() {
  const dados = iaLerForm();
  iaFormSt('Buscando modelos…');
  try {
    const conn = iaNormalizarConexao(dados);
    const nomes = await iaListarModelos(conn);
    IA.modelosCache[conn.id] = nomes;
    const lista = document.getElementById('iaFmModelos');
    if (lista) {
      lista.innerHTML = nomes.map((m) => `<option value="${iaEsc(m)}"></option>`).join('');
    }
    iaFormSt(`${nomes.length} modelos disponiveis. Clique no campo Modelo para escolher.`, 'ok');
  } catch (e) {
    iaFormSt(iaErroAmigavel(e, dados), 'err');
  }
}

async function iaAcaoTestar() {
  const conn = iaNormalizarConexao(iaLerForm());
  if (!conn.modelo) {
    iaFormSt('Informe o modelo antes de testar.', 'err');
    return;
  }
  iaFormSt('Testando conexao…');
  try {
    const r = await iaTestarConexao(conn);
    iaFormSt(`Conexao OK em ${r.ms} ms · resposta: ${r.texto}`, 'ok');
  } catch (e) {
    iaFormSt(iaErroAmigavel(e, conn), 'err');
  }
}

function iaAcaoSalvar() {
  const dados = iaLerForm();
  if (!dados.modelo) {
    iaFormSt('Escolha um modelo para salvar.', 'err');
    return;
  }
  const salva = iaSalvarConexao(dados);
  window.SynapseAIUsageView.invalidate();
  iaDefinirAtiva(salva.id);
  IA_UI.edit = null;
  iaRenderCfg();
  iaAtualizarBarra();
  iaAtualizarCtx();
  if (typeof toast === 'function') toast(`IA conectada: ${salva.nome}`);
}

function iaTrocarProvedorNoForm(id) {
  const prov = iaProvedor(id);
  const atual = iaLerForm();
  IA_UI.edit = iaNormalizarConexao({
      ...atual,
      prov: prov.id,
      nome: prov.nome,
      base: prov.base,
      formato: prov.formato,
      modelo: prov.modelos[0] || '',
      visao: !!prov.visao,
  });
  IA_UI.edit.novo = atual.id ? false : true;
  iaRenderCfg();
}

function iaFecharLista() {
  if (IA_UI.lista) {
    IA_UI.lista.remove();
    IA_UI.lista = null;
  }
}

function iaAbrirListaConexoes(ancora) {
  iaFecharLista();
  iaCarregar();
  const caixa = document.createElement('div');
  caixa.className = 'ia-lista';
  const itens = IA.conexoes
  .map(
    (c) =>
    `<button type="button" data-conn="${iaEsc(c.id)}" class="${c.id === IA.ativa ? 'on' : ''}">` +
    `${iaIcone('raio')}<span class="tx"><b>${iaEsc(c.nome)}</b><small>${iaEsc(c.modelo || 'sem modelo')}</small></span></button>`,
  )
  .join('');
  caixa.innerHTML =
  `<div class="ia-lista-t">Conexoes</div>${itens || '<div class="ia-lista-t">nenhuma conexao</div>'}` +
  `<button type="button" data-nova-lista="1">${iaIcone('novo')}<span class="tx"><b>Nova conexao…</b></span></button>`;
  IA_UI.painel.appendChild(caixa);
  const r = ancora.getBoundingClientRect();
  const pr = IA_UI.painel.getBoundingClientRect();
  caixa.style.left = `${Math.max(6, r.left - pr.left)}px`;
  caixa.style.bottom = `${Math.max(6, pr.bottom - r.top + 6)}px`;
  IA_UI.lista = caixa;
}

function iaAlternarModo() {
  const i = IA_MODOS.findIndex((m) => m.id === IA.prefs.modo);
  IA.prefs.modo = IA_MODOS[(i + 1) % IA_MODOS.length].id;
  iaSalvar();
  iaAtualizarBarra();
  iaAtualizarCtx();
  if (IA_UI.vista === 'cfg') iaRenderCfg();
}

function iaAutoAltura() {
  const t = document.getElementById('iaInput');
  if (!t) return;
  t.style.height = 'auto';
  t.style.height = `${Math.min(168, Math.max(34, t.scrollHeight))}px`;
}

function iaRenderAnexos() {
  const n = document.getElementById('iaAnexos');
  if (!n) return;
  n.hidden = !IA_UI.anexos.length;
  n.innerHTML = IA_UI.anexos
  .map(
    (a, i) =>
    `<span class="ia-anexo">${iaIcone('camera')}<span>imagem ${i + 1}</span>` +
    `<button type="button" data-anexo="${i}">${iaIcone('x')}</button></span>`,
  )
  .join('');
}

function iaEnviarDoCampo() {
  const t = document.getElementById('iaInput');
  if (!t) return;
  if (IA_CHAT.rodando) {
    iaPararGeracao();
    return;
  }
  const texto = t.value;
  const imagens = IA_UI.anexos.slice();
  if (!texto.trim() && !imagens.length) return;
  t.value = '';
  IA_UI.anexos = [];
  iaRenderAnexos();
  iaAutoAltura();
  iaVista('chat');
  iaEnviar(texto, imagens);
}

function iaColarImagem(ev) {
  const itens = (ev.clipboardData && ev.clipboardData.items) || [];
  for (const item of itens) {
    if (item.type && item.type.indexOf('image/') === 0) {
      const arquivo = item.getAsFile();
      if (!arquivo) continue;
      ev.preventDefault();
      const leitor = new FileReader();
      leitor.onload = () => {
        const bruto = String(leitor.result || '');
        const corte = bruto.indexOf('base64,');
        if (corte < 0) return;
        IA_UI.anexos.push({ mime: arquivo.type, data: bruto.slice(corte + 7) });
        iaRenderAnexos();
      };
      leitor.readAsDataURL(arquivo);
      return;
    }
  }
}

function iaCliquePainel(ev) {
  const alvo = ev.target;
  if (alvo.closest('.ai-reasoning > summary')) {
    IA_UI.followOutput = false;
    return;
  }
  const tab = alvo.closest('[data-ai-tab]');
  if (tab) {
    iaVista(tab.dataset.aiTab);
    return;
  }
  if (alvo.closest('[data-ai-balance-refresh]')) {
    window.SynapseAIUsageView.refresh();
    return;
  }
  if (alvo.closest('[data-ai-model-refresh]')) {
    window.SynapseAIModelControlsView.refresh();
    return;
  }
  if (alvo.closest('#aiThinkingToggle')) {
    window.SynapseAIModelControlsView.toggle();
    return;
  }
  if (alvo.closest('[data-ai-stop]')) {
    iaPararGeracao();
    return;
  }
  if (alvo.closest('[data-ai-restore]')) {
    IA_UI.geo.min = false;
    iaAplicarGeo();
    iaGeoSalvar();
    return;
  }
  if (
    IA_CHAT.rodando &&
    alvo.closest(
      '[data-conv], [data-apagar], [data-usar], [data-editar], [data-remover], [data-salvar], [data-nova], [data-conn], #iaChipModo, #iaChipConn, [data-act="novo"]',
    )
  ) {
    return;
  }
  if (typeof iaNotionClique === 'function' && iaNotionClique(ev)) return;
  const act = alvo.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    act.closest('.ai-panel-menu')?.removeAttribute('open');
    if (a === 'chat') iaVista('chat');
    else if (a === 'fechar') iaChatFechar();
    else if (a === 'novo') {
      iaNovaConversa();
      iaVista('chat');
    } else if (a === 'cfg') iaVista(IA_UI.vista === 'cfg' ? 'chat' : 'cfg');
    else if (a === 'hist') iaVista(IA_UI.vista === 'hist' ? 'chat' : 'hist');
    else if (a === 'dock') {
      IA_UI.geo.modo = IA_UI.geo.modo === 'dock' ? 'float' : 'dock';
      IA_UI.geo.min = false;
      iaAplicarGeo();
      iaGeoSalvar();
    } else if (a === 'min') {
      IA_UI.geo.min = !IA_UI.geo.min;
      iaAplicarGeo();
      iaGeoSalvar();
    }
    return;
  }
  const sug = alvo.closest('[data-sug]');
  if (sug) {
    const campo = document.getElementById('iaInput');
    campo.value = sug.dataset.sug;
    iaAutoAltura();
    campo.focus();
    return;
  }
  const perm = alvo.closest('[data-perm]');
  if (perm && perm.dataset.perm !== undefined && perm.tagName === 'BUTTON') {
    iaResponderPermissao(perm.dataset.perm);
    iaTirarPermissoes();
    return;
  }
  if (alvo.closest('[data-alternar]')) {
    const corpo = alvo.closest('.ia-passo').querySelector('.ia-passo-b');
    if (corpo) corpo.hidden = !corpo.hidden;
    return;
  }
  if (alvo.closest('[data-copiar]')) {
    const bloco = alvo.closest('.ia-code');
    const codigo = bloco ? bloco.querySelector('pre').innerText : '';
    try {
      navigator.clipboard.writeText(codigo);
      if (typeof toast === 'function') toast('Codigo copiado');
    } catch (e) {
      ignorarErro(e, 'iaCopiar');
    }
    return;
  }
  const anexo = alvo.closest('[data-anexo]');
  if (anexo) {
    IA_UI.anexos.splice(Number(anexo.dataset.anexo), 1);
    iaRenderAnexos();
    return;
  }
  const conv = alvo.closest('[data-conv]');
  const apagar = alvo.closest('[data-apagar]');
  if (apagar) {
    iaApagarConversa(apagar.dataset.apagar);
    iaRenderHist();
    return;
  }
  if (conv) {
    iaCarregarConversa(conv.dataset.conv);
    iaVista('chat');
    return;
  }
  const editar = alvo.closest('[data-editar]');
  if (editar) {
    const c = IA.conexoes.find((x) => x.id === editar.dataset.editar);
    IA_UI.edit = c ? { ...c, chave: iaChaveDe(c) } : null;
    iaRenderCfg();
    return;
  }
  const remover = alvo.closest('[data-remover]');
  if (remover) {
    iaRemoverConexao(remover.dataset.remover);
    iaRenderCfg();
    iaAtualizarBarra();
    return;
  }
  const usar = alvo.closest('[data-usar]');
  if (usar) {
    iaDefinirAtiva(usar.dataset.usar);
    iaRenderCfg();
    iaAtualizarBarra();
    return;
  }
  if (alvo.closest('[data-nova]') || alvo.closest('[data-nova-lista]')) {
    iaFecharLista();
    IA_UI.edit = iaNormalizarConexao({ prov: 'openai' });
    IA_UI.edit.novo = true;
    iaVista('cfg');
    return;
  }
  if (alvo.closest('[data-cancelar]')) {
    IA_UI.edit = null;
    iaRenderCfg();
    return;
  }
  if (alvo.closest('[data-salvar]')) {
    iaAcaoSalvar();
    return;
  }
  if (alvo.closest('[data-testar]')) {
    iaAcaoTestar();
    return;
  }
  if (alvo.closest('[data-buscar-modelos]')) {
    iaAcaoBuscarModelos();
    return;
  }
  if (alvo.closest('[data-ver]')) {
    const campo = document.getElementById('iaFmChave');
    if (campo) campo.type = campo.type === 'password' ? 'text' : 'password';
    return;
  }
  const conn = alvo.closest('[data-conn]');
  if (conn) {
    iaDefinirAtiva(conn.dataset.conn);
    iaFecharLista();
    iaAtualizarBarra();
    iaAtualizarCtx();
    return;
  }
  if (alvo.closest('#iaChipConn')) {
    if (!iaCarregar().conexoes.length) {
      IA_UI.edit = iaNormalizarConexao({ prov: 'openai' });
      IA_UI.edit.novo = true;
      iaVista('cfg');
    } else iaAbrirListaConexoes(alvo.closest('#iaChipConn'));
    return;
  }
  if (alvo.closest('#iaChipModo')) {
    iaAlternarModo();
    return;
  }
  if (alvo.closest('#iaSend')) iaEnviarDoCampo();
}

function iaMudancaPainel(ev) {
  const id = ev.target.id;
  if (window.SynapseAIModelControlsView.change(ev)) return;
  if (IA_CHAT.rodando) return;
  if (typeof iaNotionMudanca === 'function' && iaNotionMudanca(ev)) return;
  if (id === 'iaPrefModo') {
    IA.prefs.modo = ev.target.value;
    iaSalvar();
    iaAtualizarBarra();
    iaAtualizarCtx();
    return;
  }
  if (id === 'iaPrefStream') {
    IA.prefs.stream = ev.target.checked;
    iaSalvar();
    return;
  }
  if (id === 'iaPrefImg') {
    IA.prefs.enviarImagens = ev.target.checked;
    iaSalvar();
    return;
  }
  if (id === 'iaPrefPassos') {
    IA.prefs.passos = Math.max(1, Math.min(60, Number(ev.target.value) || 24));
    iaSalvar();
    return;
  }
  if (id === 'iaPrefConj') {
    IA.prefs.conjunto = ev.target.value;
    iaSalvar();
    iaRenderCfg();
    iaAtualizarCtx();
    return;
  }
  if (id === 'iaFmProv') iaTrocarProvedorNoForm(ev.target.value);
}

function iaMontar() {
  if (IA_UI.montado) return;
  iaCarregar();
  IA_UI.geo = { ...iaGeoPadrao(), ...iaLerJson(IA_LS.ui, {}) };
  const p = document.createElement('section');
  p.className = 'ia-panel entra';
  p.id = 'iaPanel';
  p.setAttribute('role', 'complementary');
  p.setAttribute('aria-label', 'Assistente de IA');
  p.innerHTML = iaEsqueleto();
  document.body.appendChild(p);
  IA_UI.painel = p;
  IA_UI.montado = true;
  p.addEventListener('click', iaCliquePainel);
  p.addEventListener('change', iaMudancaPainel);
  p.querySelector('#iaViewChat').addEventListener('scroll', (event) => {
      const view = event.currentTarget;
      IA_UI.followOutput = view.scrollHeight - view.scrollTop - view.clientHeight < 120;
  });
  p.querySelector('.ai-chat-tabs').addEventListener('keydown', (event) => {
      const tabs = [...p.querySelectorAll('[data-ai-tab]')];
      const current = tabs.indexOf(event.target);
      if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index =
      event.key === 'Home'
      ? 0
      : event.key === 'End'
      ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      iaVista(tabs[index].dataset.aiTab);
      tabs[index].focus();
  });
  p.addEventListener('input', (e) => {
      if (e.target.id === 'iaInput') iaAutoAltura();
  });
  p.querySelector('#iaHead').addEventListener('pointerdown', iaArrastarPainel);
  p.querySelectorAll('.ia-grip').forEach((g) => {
      g.addEventListener('pointerdown', (e) => iaRedimensionar(e, g.dataset.dir));
  });
  const campo = p.querySelector('#iaInput');
  campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        iaEnviarDoCampo();
      }
  });
  campo.addEventListener('paste', iaColarImagem);
  IA_SINAIS.aoEvento = iaUiEvento;
  iaAplicarGeo();
  iaConversaAtual();
  iaRenderChat();
  iaAtualizarCtx();
  iaAtualizarBarra();
}

function iaChatAbrir() {
  iaMontar();
  IA_UI.painel.hidden = false;
  IA_UI.aberto = true;
  IA_UI.geo.min = false;
  iaAplicarGeo();
  iaAtualizarCtx();
  iaAtualizarBarra();
  const btn = document.getElementById('iaBtn');
  if (btn) btn.classList.add('on');
  if (typeof iaNotionAoAbrir === 'function') iaNotionAoAbrir();
  setTimeout(() => {
      const campo = document.getElementById('iaInput');
      if (campo) campo.focus();
    }, 40);
}

function iaChatFechar() {
  if (!IA_UI.painel) return;
  iaFecharLista();
  IA_UI.painel.hidden = true;
  IA_UI.aberto = false;
  const btn = document.getElementById('iaBtn');
  if (btn) btn.classList.remove('on');
}

function iaChatAlternar() {
  if (IA_UI.aberto) iaChatFechar();
  else iaChatAbrir();
}

function iaIniciar() {
  const btn = document.getElementById('iaBtn');
  if (btn) btn.addEventListener('click', iaChatAlternar);
  iaCarregar();
  iaIndicador();
  window.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'i') {
        e.preventDefault();
        iaChatAlternar();
        return;
      }
      if (e.key === 'Escape' && IA_UI.aberto) {
        const menu = IA_UI.painel?.querySelector('.ai-panel-menu[open]');
        if (menu) {
          menu.open = false;
          menu.querySelector('summary').focus();
          return;
        }
        if (IA_CHAT.rodando) {
          iaPararGeracao();
          return;
        }
        if (IA_UI.lista) {
          iaFecharLista();
          return;
        }
        if (document.activeElement && document.activeElement.id === 'iaInput') iaChatFechar();
      }
  });
  window.addEventListener('resize', () => {
      if (IA_UI.montado) iaAplicarGeo();
  });
  document.addEventListener('click', (e) => {
      const menu = IA_UI.painel?.querySelector('.ai-panel-menu[open]');
      if (menu && !menu.contains(e.target)) menu.open = false;
      if (!IA_UI.lista) return;
      if (!e.target.closest('.ia-lista') && !e.target.closest('#iaChipConn')) iaFecharLista();
  });
  setInterval(() => {
      if (IA_UI.aberto && IA_UI.vista === 'chat') iaAtualizarCtx();
    }, 4000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iaIniciar);
} else iaIniciar();
