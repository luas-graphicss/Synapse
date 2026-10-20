function auroraEnvInfo() {
	const ua = navigator.userAgent || '';
	const iOS =
		/iPad|iPhone|iPod/.test(ua) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	const safari =
		/Safari/.test(ua) &&
		!/Chrome|Chromium|CriOS|Edg|EdgiOS|FxiOS|OPR|SamsungBrowser|Android/.test(ua);
	let inFrame = true;
	try {
		inFrame = window.top !== window.self;
	} catch (e) {
		inFrame = true;
	}
	return {
		ua: ua,
		iOS: iOS,
		safari: safari || iOS,
		inFrame: inFrame,
		sab: typeof SharedArrayBuffer !== 'undefined',
		iso: !!window.crossOriginIsolated,
		proto: location.protocol,
		online: !!navigator.onLine,
		host: location.host,
	};
}
function auroraServerSupport() {
	const e = auroraEnvInfo();
	if (e.iso && e.sab)
		return {
			ok: true,
			fixable: false,
			env: e,
			why: 'Isolamento de origem cruzada ativo — o Modo Servidor real esta disponivel.',
		};
	if (e.iOS)
		return {
			ok: false,
			fixable: false,
			env: e,
			why:
				'Voce esta no iPhone/iPad. O Modo Servidor real (npm dentro do navegador, via ' +
				'WebContainers) nao funciona no iOS/iPadOS: o Safari nao implementa o COEP ' +
				'"credentialless" e o WebContainers nao suporta esse sistema. Os headers do seu deploy ' +
				'nao tem culpa — eles estao sendo enviados; o navegador e que nao liga o isolamento.',
		};
	if (e.safari)
		return {
			ok: false,
			fixable: false,
			env: e,
			why:
				'Voce esta no Safari. Ele nao implementa o COEP "credentialless", entao ' +
				'crossOriginIsolated fica false mesmo com os headers corretos no servidor. Use Chrome, ' +
				'Edge ou Firefox no desktop se quiser o npm real.',
		};
	if (e.inFrame)
		return {
			ok: false,
			fixable: false,
			env: e,
			why: 'A pagina esta dentro de um iframe/embed. O isolamento praticamente nunca liga assim — abra a URL do site direto em uma aba do navegador.',
		};
	if (e.proto === 'file:')
		return {
			ok: false,
			fixable: true,
			env: e,
			why: 'Voce abriu o arquivo direto do disco (file://). Headers nao existem nesse modo: sirva por http/https (o server.py incluido no zip ja faz isso).',
		};
	if (!e.sab)
		return {
			ok: false,
			fixable: true,
			env: e,
			why: 'SharedArrayBuffer indisponivel — o navegador so libera esse recurso com COOP/COEP corretos na resposta HTTP desta pagina.',
		};
	return {
		ok: false,
		fixable: true,
		env: e,
		why:
			'A pagina foi servida, mas os headers COOP/COEP nao chegaram ao navegador. Quase sempre ' +
			'e o arquivo de configuracao no lugar errado (na Vercel, o vercel.json precisa estar na ' +
			'RAIZ do deploy, nao dentro de dist/).',
	};
}
function auroraShouldBlock(detect) {
	try {
		if (!detect || detect.type !== 'build') return false;
		if (!navigator.onLine) return true;
		if (window.crossOriginIsolated) return false;
		return !!auroraServerSupport().fixable;
	} catch (e) {
		return false;
	}
}
function auroraHeaderProbe() {
	try {
		return fetch(location.href, { method: 'HEAD', cache: 'no-store' })
			.then(function (r) {
				return {
					coop: r.headers.get('cross-origin-opener-policy'),
					coep: r.headers.get('cross-origin-embedder-policy'),
					corp: r.headers.get('cross-origin-resource-policy'),
				};
			})
			.catch(function () {
				return null;
			});
	} catch (e) {
		return Promise.resolve(null);
	}
}
function auroraShowProbe() {
	auroraHeaderProbe().then(function (h) {
		try {
			const box = el && el.previewError && el.previewError.querySelector('.pe2-tech');
			if (!box) return;
			box.textContent =
				box.textContent +
				'  |  Resposta HTTP desta pagina: COOP=' +
				((h && h.coop) || '(ausente)') +
				' · COEP=' +
				((h && h.coep) || '(ausente)') +
				' · CORP=' +
				((h && h.corp) || '(ausente)');
		} catch (e) {
			ignorarErro(e, 'auroraShowProbe');
		}
	});
}
function recheckServerMode() {
	const p = activeProject();
	if (!p) {
		toast('Sem projeto', 'Importe um projeto primeiro', '');
		return;
	}
	const s = auroraServerSupport();
	p.blocked = auroraShouldBlock(p.detect);
	if (s.ok) {
		hidePreviewError();
		toast('Modo Servidor real liberado', 'Isolamento ativo — iniciando o servidor…', 'ok');
		try {
			tryAutoRun(p);
		} catch (e) {
			ignorarErro(e, 'recheckServerMode');
		}
		return;
	}
	auroraHeaderProbe().then(function (h) {
		if (s.fixable) {
			toast(
				'Ainda bloqueado',
				`COOP=${(h && h.coop) || 'ausente'} · COEP=${(h && h.coep) || 'ausente'} — confira o vercel.json na raiz do deploy e abra a URL numa aba propria`,
				'err',
			);
			showBuildBlockedError(p);
		} else {
			toast(
				'Modo Runtime',
				'Este navegador nao suporta o Modo Servidor real — o preview continua funcionando em Runtime',
				'ok',
			);
			dismissPreviewError();
		}
	});
}
function showBuildBlockedError(proj) {
	const d = (proj && proj.detect) || {};
	const cmds =
		d.commands && d.commands.length ? d.commands.slice() : ['npm install', 'npm run build'];
	const fw = d.framework ? ` <b>(${esc(d.framework)})</b>` : '';
	const s = auroraServerSupport(),
		e = s.env;
	const diag = `crossOriginIsolated=${e.iso} · SharedArrayBuffer=${e.sab ? 'sim' : 'nao'} · protocolo=${e.proto} \
· iframe=${e.inFrame ? 'sim' : 'nao'} · online=${e.online ? 'sim' : 'nao'} · UA=${e.ua}`;
	const actions = [
		{ label: 'Verificar novamente', onclick: 'recheckServerMode()' },
		{ label: 'Continuar no Modo Runtime', onclick: 'dismissPreviewError()', primary: true },
	];
	if (!e.online) {
		showPreviewError({
			level: 'warn',
			title: 'Este projeto precisa de build (npm) e você está offline',
			cause: `O projeto${fw} usa uma toolchain Node/npm. Sem internet não dá para instalar as dependências nem buscar os pacotes em esm.sh.`,
			steps: [
				'Conecte-se à internet e clique em <b>Verificar novamente</b>, <b>ou</b>',
				'Rode o build no seu terminal e importe a pasta de saída (ex.: <code>dist/</code>).',
			],
			commands: cmds,
			foot: 'Depois de gerar a pasta de saída, arraste-a aqui ou use <b>Importar → pasta</b>.',
			details: diag,
			actions: actions,
		});
		return;
	}
	if (!s.fixable) {
		showPreviewError({
			level: 'warn',
			title: 'Modo Servidor real indisponível neste navegador — seguindo em Modo Runtime',
			cause: `O projeto${fw} tem toolchain npm. ${esc(s.why)}`,
			steps: [
				'Clique em <b>Continuar no Modo Runtime</b>: o Synapse compila JSX/TS aqui mesmo e resolve as dependências via esm.sh. Isso cobre a maioria dos apps React/Vite sem servidor nenhum.',
				'Se você quer <b>npm de verdade</b> (WebContainers), abra este mesmo site no <b>Chrome, Edge ou Firefox de um computador</b>, em uma aba própria — nunca dentro de iframe/embed.',
				'Não adianta mexer nos headers do deploy por causa disto: o diagnóstico abaixo mostra exatamente o que o navegador recebeu.',
			],
			foot: 'O <b>Modo Runtime</b> não roda scripts de build (Tailwind CLI, geradores, SSR). Se o seu app depende disso, gere o <code>dist/</code> no computador e importe a pasta pronta.',
			details: diag,
			actions: actions,
		});
		auroraShowProbe();
		return;
	}
	showPreviewError({
		level: 'warn',
		title: 'Modo Servidor real desligado — os headers COOP/COEP não chegaram nesta página',
		cause: `O projeto${fw} precisa rodar comandos (build). ${esc(s.why)}`,
		steps: [
			'<b>1.</b> Na <b>Vercel</b>, o <code>vercel.json</code> tem que estar na <b>raiz do ' +
				'deploy</b> (junto do <code>package.json</code>, ou na raiz da pasta que você arrasta). ' +
				'Dentro de <code>dist/</code> ele é <b>ignorado</b> — é o erro mais comum.',
			'<b>2.</b> Use exatamente o conteúdo do bloco abaixo (botão <b>Copiar</b>).',
			'<b>3.</b> Na <b>Netlify</b> ou <b>Cloudflare Pages</b>, o arquivo é o <code>_headers</code> <i>dentro da pasta publicada</i>: primeira linha <code>/*</code> e os headers indentados com 2 espaços.',
			'<b>4.</b> Refaça o deploy, abra a URL <b>direto numa aba</b> e digite <code>crossOriginIsolated</code> no console — precisa retornar <code>true</code>.',
			'<b>5.</b> Se o isolamento não ligar, troque <code>credentialless</code> por <code>require-corp</code> (mais rígido: recursos externos precisam mandar CORP/CORS).',
			'Depois é só clicar em <b>Verificar novamente</b> — não precisa reimportar o projeto.',
		],
		commands: [
			'{',
			'  "headers": [{',
			'    "source": "/(.*)",',
			'    "headers": [',
			'      { "key": "Cross-Origin-Opener-Policy",   "value": "same-origin" },',
			'      { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" },',
			'      { "key": "Cross-Origin-Resource-Policy", "value": "cross-origin" }',
			'    ]',
			'  }]',
			'}',
		],
		foot: 'Sem servidor nenhum: o <b>Modo Runtime</b> (botão ao lado) já roda a maioria dos apps React/Vite compilando JSX/TS e puxando as dependências de esm.sh.',
		details: diag,
		actions: actions,
	});
	auroraShowProbe();
}
