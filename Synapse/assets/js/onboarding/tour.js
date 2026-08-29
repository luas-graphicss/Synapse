(function () {
	'use strict';
	const K_VISTO = 'aurora.tour.visto',
		K_DONE = 'aurora.tour.done';
	function lg(k) {
		try {
			return localStorage.getItem(k);
		} catch (e) {
			return null;
		}
	}
	function lp(k, v) {
		try {
			localStorage.setItem(k, v);
		} catch (e) {
			ignorarErro(e, 'lp');
		}
	}
	function lx(k) {
		try {
			localStorage.removeItem(k);
		} catch (e) {
			ignorarErro(e, 'lx');
		}
	}
	let RM = false;
	try {
		RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
	} catch (e) {
		ignorarErro(e, 'tour');
	}

	const CSS = [
		'.tour-root{position:fixed;inset:0;z-index:6000;font-family:var(--sans);color:var(--txt)}',
		'.tour-veil{position:fixed;background:rgba(5,7,12,.66);-webkit-backdrop-filter:blur(5px) ' +
			'saturate(.8);backdrop-filter:blur(5px) saturate(.8);transition:top .6s cubic-bezier(.2,' +
			'.85,.15,1),left .6s cubic-bezier(.2,.85,.15,1),width .6s cubic-bezier(.2,.85,.15,1),' +
			'height .6s cubic-bezier(.2,.85,.15,1),opacity .4s}',
		'.tour-hole{position:fixed;cursor:pointer;background:transparent}',
		'.tour-ring{position:fixed;border-radius:12px;pointer-events:none;transition:all .6s ' +
			'cubic-bezier(.2,.85,.15,1);box-shadow:0 0 0 2px rgba(var(--acc-rgb),.9),0 0 0 6px ' +
			'rgba(var(--acc-rgb),.16),0 0 48px 12px rgba(var(--acc-rgb),.26)}',
		".tour-ring::after{content:'';position:absolute;inset:0;border-radius:inherit;overflow:" +
			'hidden;background:linear-gradient(115deg,transparent 42%,rgba(255,255,255,.10) 50%,' +
			'transparent 58%);background-size:260% 100%;animation:tourSheen 2.8s ease-in-out ' +
			'infinite}',
		'.tour-ring i{position:absolute;width:16px;height:16px;border:2px solid var(--acc);opacity:.95;animation:tourPop .5s cubic-bezier(.2,.9,.2,1) both}',
		'.tour-ring i:nth-child(1){top:-6px;left:-6px;border-right:0;border-bottom:0;border-radius:6px 0 0 0}',
		'.tour-ring i:nth-child(2){top:-6px;right:-6px;border-left:0;border-bottom:0;border-radius:0 6px 0 0}',
		'.tour-ring i:nth-child(3){bottom:-6px;right:-6px;border-left:0;border-top:0;border-radius:0 0 6px 0}',
		'.tour-ring i:nth-child(4){bottom:-6px;left:-6px;border-right:0;border-top:0;border-radius:0 0 0 6px}',
		'.tour-card{position:fixed;width:min(430px,calc(100vw - 26px));background:' +
			'linear-gradient(180deg,rgba(23,27,37,.985),rgba(15,18,25,.985));border:1px solid ' +
			'var(--line-2);border-radius:16px;padding:17px 18px 13px;box-shadow:0 34px 90px rgba(0,0,' +
			'0,.62),0 0 0 1px rgba(var(--acc-rgb),.08);transition:top .6s cubic-bezier(.2,.85,.15,1),' +
			'left .6s cubic-bezier(.2,.85,.15,1);overflow:hidden}',
		".tour-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(var(--acc-rgb),.85),transparent)}",
		'.tour-card.troca{animation:tourCard .5s cubic-bezier(.2,.85,.15,1) both}',
		'.tour-kick{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);margin-bottom:7px}',
		".tour-kick::before{content:'';width:14px;height:2px;border-radius:2px;background:var(--acc-grad)}",
		'.tour-h{font-size:17.5px;font-weight:700;line-height:1.25;margin:0 0 7px}',
		'.tour-p{font-size:13px;line-height:1.6;color:var(--txt-2);min-height:62px}',
		".tour-p::after{content:'';display:inline-block;width:7px;height:13px;margin-left:2px;vertical-align:-2px;background:var(--acc);opacity:.85;animation:tourCaret .9s steps(1) infinite}",
		'.tour-card.pronto .tour-p::after{display:none}',
		'.tour-keys{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}',
		'.tour-key{font:700 11px/1 var(--mono);padding:5px 8px;border-radius:6px;background:var(--bg-3);border:1px solid var(--line-2);color:var(--txt-2)}',
		'.tour-foot{display:flex;align-items:center;gap:10px;margin-top:14px}',
		'.tour-n{font:700 11px var(--mono);color:var(--txt-3);flex:none}',
		'.tour-prog{flex:1;height:3px;border-radius:2px;background:var(--line);overflow:hidden}',
		'.tour-prog i{display:block;height:100%;width:0;border-radius:2px;background:var(--acc-grad);transition:width .55s cubic-bezier(.2,.85,.15,1)}',
		'.tour-b{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 15px;' +
			'border-radius:9px;font-weight:700;font-size:12.5px;border:1px solid var(--line-2);' +
			'background:var(--bg-3);color:var(--txt);cursor:pointer;transition:var(--t)}',
		'.tour-b:hover{border-color:var(--acc);transform:translateY(-1px)}',
		'.tour-b.primary{background:var(--acc-grad);border-color:transparent;color:#08111f;box-shadow:0 6px 20px rgba(var(--acc-rgb),.34)}',
		'.tour-b.primary:hover{box-shadow:0 10px 26px rgba(var(--acc-rgb),.44)}',
		'.tour-skip{position:absolute;top:14px;right:14px;font-size:11px;color:var(--txt-3);background:none;border:0;cursor:pointer;padding:4px 6px;border-radius:6px}',
		'.tour-skip:hover{color:var(--txt);background:var(--bg-3)}',
		'.tour-cursor{position:fixed;top:0;left:0;width:24px;height:24px;margin:-3px 0 0 -3px;' +
			'pointer-events:none;opacity:0;transition:transform .8s cubic-bezier(.35,0,.2,1),opacity ' +
			'.3s;z-index:6030;filter:drop-shadow(0 4px 10px rgba(0,0,0,.6))}',
		'.tour-ripple{position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:' +
			'50%;border:2px solid var(--acc);pointer-events:none;z-index:6029;animation:tourRipple ' +
			'.75s cubic-bezier(.2,.8,.2,1) forwards}',
		'.tour-full{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;' +
			'justify-content:center;text-align:center;padding:28px;background:linear-gradient(180deg,' +
			'rgba(9,11,16,.975),rgba(6,8,12,.985));-webkit-backdrop-filter:blur(10px);' +
			'backdrop-filter:blur(10px);animation:tourFade .45s ease both}',
		'.tour-mark{width:46px;height:46px;border-radius:11px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,.5);animation:tourUp .55s both}',
		'.tour-mark svg{display:block;width:100%;height:100%}',
		'.tour-eyebrow{display:inline-flex;align-items:center;gap:10px;margin-top:20px;font:700 ' +
			'10.5px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--txt-3);' +
			'animation:tourUp .55s .05s both}',
		".tour-eyebrow::before,.tour-eyebrow::after{content:'';width:20px;height:1px;background:var(--line-2)}",
		'.tour-t1{font-size:min(7vw,34px);font-weight:700;letter-spacing:-.015em;line-height:1.16;color:var(--txt);margin:13px 0 0;animation:tourUp .55s .1s cubic-bezier(.2,.85,.15,1) both}',
		'.tour-t2{font-size:13.5px;color:var(--txt-2);max-width:500px;line-height:1.68;margin:11px 0 0;animation:tourUp .55s .18s cubic-bezier(.2,.85,.15,1) both}',
		'.tour-acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:24px;animation:tourUp .55s .26s cubic-bezier(.2,.85,.15,1) both}',
		'.tour-rule{width:min(440px,74vw);height:1px;background:var(--line);margin-top:24px;animation:tourUp .55s .28s both}',
		'.tour-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 34px;margin-top:17px;text-align:left;max-width:480px}',
		'.tour-li{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--txt-2);animation:tourUp .5s both}',
		'.tour-li svg{width:13px;height:13px;flex:none;color:var(--txt-3)}',
		'.tour-invite{align-items:flex-start!important;cursor:default!important;max-width:352px!important;border-left-color:var(--acc)!important}',
		'.tour-invite .toast-bar{display:none}',
		'.tour-invite .tx b{margin-bottom:2px}',
		'.ti-acts{display:flex;gap:7px;margin-top:11px}',
		'.ti-b{height:29px;padding:0 12px;border-radius:8px;font-weight:700;font-size:11.5px;cursor:pointer;border:1px solid var(--line-2);background:var(--bg-3);color:var(--txt);transition:var(--t)}',
		'.ti-b:hover{border-color:var(--acc)}',
		'.ti-b.primary{background:var(--acc-grad);border-color:transparent;color:#08111f}',
		'.tour-btn{position:relative}',
		'.tour-btn .tour-dot{display:none;position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 2px var(--bg-1)}',
		'.tour-btn.novo .tour-dot{display:block;animation:tourPulse 1.9s ease-in-out infinite}',
		'body.tour-ativo .toasts{opacity:0;pointer-events:none}',
		'@keyframes tourSheen{0%{background-position:180% 0}55%{background-position:-80% 0}100%{background-position:-80% 0}}',
		'@keyframes tourPop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}',
		'@keyframes tourCard{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}',
		'@keyframes tourCaret{0%,49%{opacity:1}50%,100%{opacity:0}}',
		'@keyframes tourRipple{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(3.6)}}',
		'@keyframes tourFade{from{opacity:0}to{opacity:1}}',
		'@keyframes tourUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}',
		'@keyframes tourPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.55}}',
		'@media (max-width:760px){.tour-card{width:calc(100vw - 20px);left:10px!important}.tour-t1{font-size:26px}.tour-cols{grid-template-columns:1fr;gap:8px}}',
		'@media (prefers-reduced-motion:reduce){.tour-ring::after,.tour-t1,.tour-card.troca,' +
			'.tour-mark,.tour-eyebrow,.tour-li,.tour-rule{animation:none!important}.tour-veil,' +
			'.tour-ring,.tour-card,.tour-cursor{transition:none!important}.tour-p::after{display:' +
			'none}}',
	].join('\n');
	function estilo() {
		if (document.getElementById('tourCss')) return;
		const t = document.createElement('style');
		t.id = 'tourCss';
		t.textContent = CSS;
		document.head.appendChild(t);
	}

	const PASSOS = [
		{ tipo: 'intro' },
		{
			alvo: '#importBtn',
			menu: '#importMenu',
			kick: 'Comece por aqui',
			tit: 'Traga seu projeto',
			txt:
				'Todo trabalho começa neste botão: importe um .zip, uma pasta inteira do computador, um ' +
				'index.html solto — ou carregue um exemplo pronto só para experimentar. Você também pode ' +
				'arrastar arquivos para qualquer canto da tela.',
		},
		{
			alvo: '#tabs',
			kick: 'Vários projetos',
			tit: 'Abas de projeto',
			txt: 'Cada projeto aberto vira uma aba aqui. Troque de um para outro sem perder nada — o site guarda tudo sozinho no navegador. O X fecha o projeto e ainda deixa um backup em Recentes.',
		},
		{
			alvo: '#explorer',
			kick: 'Seus arquivos',
			tit: 'Explorador de arquivos',
			txt: 'A árvore do projeto. Um clique abre o arquivo no editor, o botão direito renomeia, duplica ou apaga, e o + importa mais arquivos. Pastas se expandem e a busca acha qualquer coisa em segundos.',
		},
		{
			alvo: '#editorPane',
			kick: 'Escreva',
			tit: 'Editor com tudo dentro',
			txt:
				'Destaque de sintaxe, números de linha, minimapa, dobra de código, busca e substituição ' +
				'em todos os arquivos e formatador. Cada gravação cria um ponto no histórico — dá para ' +
				'voltar no tempo quando quiser.',
			teclas: ['Ctrl', 'S'],
		},
		{
			alvo: '#previewPane',
			kick: 'Veja na hora',
			tit: 'Preview ao vivo',
			txt: 'O resultado se reconstrói a cada tecla digitada: HTML, CSS, JS, módulos e imagens resolvidos na hora, sem servidor e sem recarregar nada na mão.',
		},
		{
			alvo: '#deviceSeg',
			kick: 'Responsivo',
			tit: 'Telefone, tablet, desktop',
			txt: 'Troque o aparelho do preview com um clique, defina uma medida livre ou gire a tela. É a forma mais rápida de checar se o layout aguenta qualquer tamanho.',
		},
		{
			alvo: '#layoutSeg',
			kick: 'Do seu jeito',
			tit: 'Divida a tela',
			txt: 'Código e preview lado a lado, um em cima do outro, ou só um dos dois em tela cheia. As divisórias entre os painéis são arrastáveis.',
		},
		{
			alvo: '#popoutBtn',
			kick: 'Tela cheia',
			tit: 'Preview em outra aba',
			txt: 'Abre o preview numa aba separada e sincronizada com o editor. Ótimo para testar em tela cheia, em outro monitor ou no celular.',
		},
		{
			alvo: '#consoleBtn',
			kick: 'Depure',
			tit: 'Console embutido',
			txt: 'Erros, logs, avisos e requisições do seu projeto aparecem aqui dentro, sem precisar abrir o F12 do navegador.',
		},
		{
			alvo: '#termBtn',
			kick: 'Poder de verdade',
			tit: 'Terminal integrado',
			txt: 'Um terminal real no SEU computador, através do relay: npm install, build, git, qualquer comando. A saída volta ao vivo para o site — e os agentes de IA usam exatamente o mesmo terminal.',
		},
		{
			alvo: '#cmdkBtn',
			teclas: ['Ctrl', 'K'],
			kick: 'Atalho de tudo',
			tit: 'Paleta de comandos',
			txt: 'Aperte Ctrl+K (ou ⌘K) e digite: abrir arquivo, trocar tema, exportar, ativar MCP… todo comando do site está a uma busca de distância.',
		},
		{
			alvo: '#mcpBtn',
			menu: '#mcpMenu',
			kick: 'O coração do site',
			tit: 'MCP: seu agente de IA entra no projeto',
			txt:
				'Ative o MCP, copie a URL gerada e cole no conector do Notion. A partir daí o agente lê ' +
				'e edita seus arquivos, roda comandos no terminal, tira screenshot do preview e trabalha ' +
				'junto com você — com o site sempre mandando no que acontece.',
		},
		{
			alvo: '#teamsBtn',
			menu: '#teamsMenu',
			kick: 'Trabalho em grupo',
			tit: 'Equipes de agentes',
			txt: 'Vários agentes ao mesmo tempo, cada um com nome, caixa de mensagens e vez na fila. Eles conversam, dividem tarefas e não pisam no trabalho do outro — a estrutura aguenta 80 em paralelo.',
		},
		{
			alvo: '#syncBtn',
			kick: 'Outro aparelho',
			tit: 'Espelhar projeto',
			txt: 'Gera um código secreto e leva o projeto para outro computador ou para o celular, sem nuvem no meio do caminho.',
		},
		{
			alvo: '#recentBtn',
			kick: 'Nada se perde',
			tit: 'Recentes e backups',
			txt: 'Fechou o projeto sem querer? Ele fica aqui, com backups automáticos prontos para recuperar em um clique.',
		},
		{
			alvo: '#lockBtn',
			kick: 'Privacidade',
			tit: 'Trava por senha',
			txt: 'Protege projetos com senha, para quem mais usa esta máquina não abrir o que não deve.',
		},
		{
			alvo: '#themeBtn',
			menu: '#themeMenu',
			kick: 'Do seu gosto',
			tit: 'Temas e cor de destaque',
			txt: 'Seis temas prontos e um seletor de cor livre — o site inteiro se repinta na hora, inclusive este tutorial.',
		},
		{
			alvo: '#exportBtn',
			kick: 'Leve embora',
			tit: 'Exportar em .zip',
			txt: 'Baixa o projeto inteiro com todas as edições, pronto para publicar ou continuar em outro editor.',
		},
		{
			alvo: '.statusbar',
			kick: 'Sempre de olho',
			tit: 'Barra de status',
			txt: 'Aqui embaixo ficam o estado da conexão, o projeto ativo, o contexto e a contagem de arquivos. Se algo travar, é o primeiro lugar para olhar.',
		},
		{ tipo: 'outro' },
	];

	function T(s) {
		try {
			return window.SYNAPSE_I18N && window.SYNAPSE_I18N.t ? window.SYNAPSE_I18N.t(s) : s;
		} catch (e) {
			return s;
		}
	}
	const st = {
		i: 0,
		vivo: false,
		root: null,
		card: null,
		ring: null,
		cur: null,
		veis: [],
		hole: null,
		full: null,
		menus: [],
		tw: null,
		rp: null,
		tick: null,
		onKey: null,
	};
	function q(sel) {
		try {
			return document.querySelector(sel);
		} catch (e) {
			return null;
		}
	}
	function visivel(e) {
		try {
			if (!e) return false;
			const r = e.getBoundingClientRect();
			if (r.width < 4 || r.height < 4) return false;
			const cs = getComputedStyle(e);
			return cs.visibility !== 'hidden' && cs.display !== 'none';
		} catch (err) {
			return false;
		}
	}
	function alvoDe(p) {
		if (!p || !p.alvo) return null;
		const e = q(p.alvo);
		return visivel(e) ? e : null;
	}
	function svgCursor() {
		return '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff" stroke="#0b0d12" stroke-width="1.2"><path d="M5 2.5l13.2 8.1-5.6.9 3.2 6.4-2.6 1.3-3.2-6.4-3.6 4.3z"/></svg>';
	}

	function montar() {
		estilo();
		const r = document.createElement('div');
		r.className = 'tour-root';
		r.setAttribute('role', 'dialog');
		r.setAttribute('aria-label', T('Tutorial do Synapse'));
		let i, v;
		for (i = 0; i < 4; i++) {
			v = document.createElement('div');
			v.className = 'tour-veil';
			r.appendChild(v);
			st.veis.push(v);
		}
		st.hole = document.createElement('div');
		st.hole.className = 'tour-hole';
		r.appendChild(st.hole);
		st.ring = document.createElement('div');
		st.ring.className = 'tour-ring';
		st.ring.innerHTML = '<i></i><i></i><i></i><i></i>';
		r.appendChild(st.ring);
		st.card = document.createElement('div');
		st.card.className = 'tour-card';
		st.card.innerHTML = `<div class="tour-kick"></div><div class="tour-h"></div><div class="tour-p" data-i18n="off">\
</div><div class="tour-keys"></div><div class="tour-foot"><span class="tour-n"></span><span class="tour-prog">\
<i></i></span><button class="tour-b" type="button" data-a="voltar">${T('Voltar')}</button><button class="tour-b \
primary" type="button" data-a="proximo">${T('Avançar')}</button></div><button class="tour-skip" type="button" \
data-a="sair">${T('Pular tutorial')}</button>`;
		r.appendChild(st.card);
		st.cur = document.createElement('div');
		st.cur.className = 'tour-cursor';
		st.cur.innerHTML = svgCursor();
		r.appendChild(st.cur);
		document.body.appendChild(r);
		st.root = r;
		r.addEventListener(
			'click',
			function (ev) {
				ev.stopPropagation();
				const b = ev.target.closest ? ev.target.closest('[data-a]') : null;
				const a = b ? b.getAttribute('data-a') : 'proximo';
				if (a === 'sair') sair(false);
				else if (a === 'voltar') ir(st.i - 1);
				else ir(st.i + 1);
			},
			false,
		);
		return r;
	}

	function fecharMenus() {
		for (let i = 0; i < st.menus.length; i++) {
			try {
				st.menus[i].classList.remove('open');
			} catch (e) {
				ignorarErro(e, 'fecharMenus');
			}
		}
		st.menus = [];
	}
	function abrirMenu(sel) {
		const m = q(sel);
		if (m) {
			try {
				m.classList.add('open');
				st.menus.push(m);
			} catch (e) {
				ignorarErro(e, 'abrirMenu');
			}
		}
		return m;
	}

	function caixa(el) {
		const r = el.getBoundingClientRect();
		const pad = 8;
		return {
			t: Math.max(0, r.top - pad),
			l: Math.max(0, r.left - pad),
			w: Math.min(innerWidth, r.width + pad * 2),
			h: Math.min(innerHeight, r.height + pad * 2),
		};
	}

	function focar(el) {
		const W = innerWidth,
			H = innerHeight;
		const b = el ? caixa(el) : { t: H / 2, l: W / 2, w: 0, h: 0 };
		const pos = [
			{ t: 0, l: 0, w: W, h: b.t },
			{ t: b.t, l: 0, w: b.l, h: b.h },
			{ t: b.t, l: b.l + b.w, w: Math.max(0, W - b.l - b.w), h: b.h },
			{ t: b.t + b.h, l: 0, w: W, h: Math.max(0, H - b.t - b.h) },
		];
		for (let i = 0; i < 4; i++) {
			const v = st.veis[i],
				p = pos[i];
			v.style.top = p.t + 'px';
			v.style.left = p.l + 'px';
			v.style.width = p.w + 'px';
			v.style.height = p.h + 'px';
			v.style.opacity = '1';
		}
		st.hole.style.top = b.t + 'px';
		st.hole.style.left = b.l + 'px';
		st.hole.style.width = b.w + 'px';
		st.hole.style.height = b.h + 'px';
		st.ring.style.display = el ? 'block' : 'none';
		st.ring.style.top = b.t + 'px';
		st.ring.style.left = b.l + 'px';
		st.ring.style.width = b.w + 'px';
		st.ring.style.height = b.h + 'px';
		return b;
	}

	function porCard(b) {
		const c = st.card,
			W = innerWidth,
			H = innerHeight;
		let cw = c.offsetWidth || 420,
			ch = c.offsetHeight || 220,
			g = 18,
			t,
			l;
		if (b.t + b.h + g + ch < H - 50) t = b.t + b.h + g;
		else if (b.t - g - ch > 50) t = b.t - g - ch;
		else t = Math.max(52, Math.min(H - ch - 52, b.t + b.h / 2 - ch / 2));
		l = b.l + b.w / 2 - cw / 2;
		if (l < 12) l = 12;
		if (l + cw > W - 12) l = W - cw - 12;
		if (!(b.t + b.h + g + ch < H - 50) && !(b.t - g - ch > 50)) {
			if (b.l + b.w + g + cw < W - 12) l = b.l + b.w + g;
			else if (b.l - g - cw > 12) l = b.l - g - cw;
		}
		c.style.top = t + 'px';
		c.style.left = l + 'px';
	}

	function digitar(elx, txt) {
		if (st.tw) {
			clearInterval(st.tw);
			st.tw = null;
		}
		st.card.classList.remove('pronto');
		if (RM) {
			elx.textContent = txt;
			st.card.classList.add('pronto');
			return;
		}
		elx.textContent = '';
		let i = 0,
			n = txt.length,
			p = Math.max(1, Math.ceil(n / 64));
		st.tw = setInterval(function () {
			i += p;
			elx.textContent = txt.slice(0, i);
			if (i >= n) {
				clearInterval(st.tw);
				st.tw = null;
				st.card.classList.add('pronto');
			}
		}, 16);
	}

	function ripple(x, y) {
		const d = document.createElement('div');
		d.className = 'tour-ripple';
		d.style.left = x + 'px';
		d.style.top = y + 'px';
		document.body.appendChild(d);
		setTimeout(function () {
			try {
				d.remove();
			} catch (e) {
				ignorarErro(e, 'ripple');
			}
		}, 760);
	}
	function cursorPara(b) {
		if (!st.cur) return;
		if (RM) {
			st.cur.style.opacity = '0';
			return;
		}
		const x = b.l + Math.min(b.w - 10, Math.max(14, b.w * 0.42)),
			y = b.t + Math.min(b.h - 10, Math.max(12, b.h * 0.5));
		st.cur.style.opacity = '1';
		st.cur.style.transform = `translate(${x}px,${y}px)`;
		if (st.rp) clearTimeout(st.rp);
		st.rp = setTimeout(function () {
			ripple(x, y);
		}, 820);
	}

	function limparFull() {
		if (st.full) {
			try {
				st.full.remove();
			} catch (e) {
				ignorarErro(e, 'limparFull');
			}
			st.full = null;
		}
	}

	function marca() {
		return (
			'<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Synapse">' +
			'<defs><linearGradient id="synTourBg" x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse"><stop stop-color="#0c1430"/><stop offset="1" stop-color="#171f44"/></linearGradient>' +
			'<linearGradient id="synTourMk" x1="16" y1="48" x2="50" y2="14" gradientUnits="userSpaceOnUse"><stop stop-color="#6aa3ff"/><stop offset="1" stop-color="#8b7bff"/></linearGradient></defs>' +
			'<rect x="2" y="2" width="60" height="60" rx="14" fill="url(#synTourBg)"/>' +
			'<rect x="3" y="3" width="58" height="58" rx="13" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>' +
			'<path d="M20 45 C 35 45 29 19 44 19" fill="none" stroke="url(#synTourMk)" stroke-width="6.5" stroke-linecap="round"/>' +
			'<circle cx="20" cy="45" r="7" fill="url(#synTourMk)"/><circle cx="44" cy="19" r="7" fill="url(#synTourMk)"/>' +
			'<circle cx="53" cy="11" r="2.6" fill="#aeb9ff"/><circle cx="56.5" cy="18" r="1.8" fill="#8b7bff"/></svg>'
		);
	}
	function tique() {
		return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
	}

	function telaIntro() {
		limparFull();
		const d = document.createElement('div');
		d.className = 'tour-full';
		const total = PASSOS.length - 2;
		d.innerHTML = `<div class="tour-mark">${marca()}</div><div class="tour-eyebrow">${T('Tutorial guiado')}</div>\
<h1 class="tour-t1">${T('Bem-vindo ao Synapse')}</h1><p class="tour-t2">${T('Em pouco mais de um minuto você percorre o site inteiro: editor, preview ao vivo, terminal no seu computador e os agentes de IA trabalhando dentro do seu projeto.')}</p>\
<div class="tour-acts"><button class="tour-b primary" type="button" data-a="proximo">${T('Começar')}</button>\
<button class="tour-b" type="button" data-a="sair">${T('Agora não')}</button></div><p class="tour-t2" \
style="font-size:11px;opacity:.55;margin-top:20px">${total} ${T('etapas · clique em qualquer lugar para avançar · Esc encerra')}</p>`;
		st.root.appendChild(d);
		st.full = d;
	}

	function telaOutro() {
		limparFull();
		const d = document.createElement('div');
		d.className = 'tour-full';
		const itens = [
			'Importar e exportar',
			'Editor + histórico',
			'Preview ao vivo',
			'Terminal real',
			'MCP com o Notion',
			'Equipes de agentes',
			'Temas e atalhos',
			'Backups automáticos',
		].map(T);
		let h = '',
			t = tique();
		for (let i = 0; i < itens.length; i++)
			h += `<span class="tour-li" style="animation-delay:${(0.3 + i * 0.045).toFixed(2)}s">${t}${itens[i]}</span>`;
		d.innerHTML = `<div class="tour-mark">${marca()}</div><div class="tour-eyebrow">${T('Tutorial concluído')}</div>\
<h1 class="tour-t1">${T('Tudo pronto')}</h1><p class="tour-t2">${T('Você já conhece o Synapse inteiro. Para repetir, use o botão ? na barra de cima.')}</p>\
<div class="tour-rule"></div><div class="tour-cols">${h}</div><div class="tour-acts"><button class="tour-b \
primary" type="button" data-a="proximo">${T('Concluir')}</button></div>`;
		st.root.appendChild(d);
		st.full = d;
	}

	function ir(n) {
		if (!st.vivo) return;
		if (n < 0) n = 0;
		if (n >= PASSOS.length) {
			sair(true);
			return;
		}
		st.i = n;
		const p = PASSOS[n];
		fecharMenus();
		if (p.tipo === 'intro' || p.tipo === 'outro') {
			st.card.style.display = 'none';
			st.ring.style.display = 'none';
			st.hole.style.display = 'none';
			for (let i = 0; i < 4; i++) st.veis[i].style.opacity = '0';
			st.cur.style.opacity = '0';
			if (p.tipo === 'intro') telaIntro();
			else telaOutro();
			return;
		}
		limparFull();
		st.card.style.display = '';
		st.hole.style.display = '';
		if (p.menu) abrirMenu(p.menu);
		const passo = this;
		setTimeout(
			function () {
				const el = alvoDe(p);
				const b = focar(el);
				porCard(b);
				cursorPara(b);
				st.card.classList.remove('troca');
				void st.card.offsetWidth;
				st.card.classList.add('troca');
				st.card.querySelector('.tour-kick').textContent = T(p.kick || 'Synapse');
				st.card.querySelector('.tour-h').textContent = T(p.tit || '');
				digitar(st.card.querySelector('.tour-p'), T(p.txt || ''));
				let kb = st.card.querySelector('.tour-keys'),
					hk = '';
				if (p.teclas)
					for (let j = 0; j < p.teclas.length; j++)
						hk += `<span class="tour-key">${p.teclas[j]}</span>`;
				kb.innerHTML = hk;
				const tot = PASSOS.length - 2,
					at = n;
				st.card.querySelector('.tour-n').textContent = at + '/' + tot;
				st.card.querySelector('.tour-prog i').style.width = Math.round((at / tot) * 100) + '%';
				st.card.querySelector('[data-a="voltar"]').style.display = n > 1 ? '' : 'none';
				st.card.querySelector('[data-a="proximo"]').textContent = T(
					n === PASSOS.length - 2 ? 'Terminar' : 'Avançar',
				);
				setTimeout(function () {
					try {
						porCard(focar(alvoDe(p)));
					} catch (e) {
						ignorarErro(e, 'ir');
					}
				}, 70);
			},
			p.menu ? 230 : 20,
		);
	}

	function abrir() {
		if (st.vivo) return;
		try {
			st.vivo = true;
			document.body.classList.add('tour-ativo');
			montar();
			st.onKey = function (ev) {
				if (!st.vivo) return;
				const k = ev.key;
				if (k === 'Escape') {
					ev.preventDefault();
					ev.stopPropagation();
					sair(false);
				} else if (k === 'Enter' || k === ' ' || k === 'ArrowRight' || k === 'PageDown') {
					ev.preventDefault();
					ev.stopPropagation();
					ir(st.i + 1);
				} else if (k === 'ArrowLeft' || k === 'PageUp') {
					ev.preventDefault();
					ev.stopPropagation();
					ir(st.i - 1);
				}
			};
			document.addEventListener('keydown', st.onKey, true);
			st.tick = setInterval(function () {
				if (!st.vivo) return;
				const p = PASSOS[st.i];
				if (!p || p.tipo) return;
				try {
					const el = alvoDe(p);
					if (el) {
						const b = focar(el);
						porCard(b);
					}
				} catch (e) {
					ignorarErro(e, 'abrir');
				}
			}, 260);
			ir(0);
		} catch (e) {
			try {
				sair(false);
			} catch (e2) {
				ignorarErro(e2, 'abrir');
			}
		}
	}

	function sair(concluiu) {
		if (!st.vivo) return;
		st.vivo = false;
		if (st.tw) {
			clearInterval(st.tw);
			st.tw = null;
		}
		if (st.tick) {
			clearInterval(st.tick);
			st.tick = null;
		}
		if (st.rp) {
			clearTimeout(st.rp);
			st.rp = null;
		}
		if (st.onKey) {
			try {
				document.removeEventListener('keydown', st.onKey, true);
			} catch (e) {
				ignorarErro(e, 'sair');
			}
			st.onKey = null;
		}
		fecharMenus();
		limparFull();
		const r = st.root;
		if (r) {
			r.classList.remove('cine');
			r.style.transition = 'opacity .45s';
			r.style.opacity = '0';
			setTimeout(function () {
				try {
					r.remove();
				} catch (e) {
					ignorarErro(e, 'sair');
				}
			}, 470);
		}
		st.root = null;
		st.card = null;
		st.ring = null;
		st.cur = null;
		st.hole = null;
		st.veis = [];
		document.body.classList.remove('tour-ativo');
		if (concluiu) {
			lp(K_DONE, '1');
			lp(K_VISTO, '1');
			const bt = document.getElementById('tourBtn');
			if (bt) bt.classList.remove('novo');
			try {
				if (typeof toast === 'function')
					toast('Tutorial concluído', 'Repita quando quiser no botão ? da barra de cima', 'ok');
			} catch (e) {
				ignorarErro(e, 'sair');
			}
		}
	}

	function convite() {
		const cx = document.getElementById('toasts');
		if (!cx) return;
		if (document.querySelector('.tour-invite')) return;
		const t = document.createElement('div');
		t.className = 'toast tour-invite';
		t.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" \
stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 \
10l5.2-1.8z"/></svg><div class="tx"><b>${T('Primeira vez por aqui?')}</b><span>${T('Faça o tour guiado e conheça o site inteiro em pouco mais de um minuto.')}</span>\
<div class="ti-acts"><button class="ti-b primary" type="button" data-ti="go">${T('Iniciar tutorial')}</button>\
<button class="ti-b" type="button" data-ti="no">${T('Ignorar')}</button></div></div>`;
		cx.appendChild(t);
		t.addEventListener('click', function (ev) {
			const b = ev.target.closest ? ev.target.closest('[data-ti]') : null;
			if (!b) return;
			ev.stopPropagation();
			const quer = b.getAttribute('data-ti') === 'go';
			t.style.transition = 'opacity .3s, transform .3s';
			t.style.opacity = '0';
			t.style.transform = 'translateX(30px)';
			setTimeout(function () {
				try {
					t.remove();
				} catch (e) {
					ignorarErro(e, 'convite');
				}
				if (quer) abrir();
			}, 300);
		});
	}

	function ligar() {
		estilo();
		try {
			if (window.SYNAPSE_I18N && window.SYNAPSE_I18N.on)
				window.SYNAPSE_I18N.on(function () {
					try {
						if (st.vivo) ir(st.i);
					} catch (e) {
						ignorarErro(e, 'ligar');
					}
				});
		} catch (e) {
			ignorarErro(e, 'ligar');
		}
		const bt = document.getElementById('tourBtn');
		if (bt) {
			if (!lg(K_DONE)) bt.classList.add('novo');
			bt.addEventListener('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
				abrir();
			});
		}
		document.addEventListener(
			'click',
			function (ev) {
				const t = ev.target.closest ? ev.target.closest('[data-tour]') : null;
				if (!t) return;
				ev.preventDefault();
				ev.stopPropagation();
				abrir();
			},
			true,
		);
		if (!lg(K_VISTO)) {
			lp(K_VISTO, '1');
			setTimeout(convite, 1400);
		}
	}

	window.SYNAPSE_TOUR = {
		iniciar: function () {
			abrir();
			return 'tour iniciado';
		},
		sair: function () {
			sair(false);
			return 'tour encerrado';
		},
		convite: function () {
			convite();
			return 'convite exibido';
		},
		estado: function () {
			return {
				vivo: st.vivo,
				passo: st.i,
				total: PASSOS.length,
				jaViu: !!lg(K_VISTO),
				concluiu: !!lg(K_DONE),
			};
		},
		resetar: function () {
			lx(K_VISTO);
			lx(K_DONE);
			const b = document.getElementById('tourBtn');
			if (b) b.classList.add('novo');
			return 'pronto: recarregue a pagina para ver o convite de primeira vez';
		},
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
	else ligar();
})();
