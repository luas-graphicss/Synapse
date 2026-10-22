export const HOSTS_CONFIAVEIS = Object.freeze([
	'api.notion.com',
	'github.com',
	'api.github.com',
	'codeload.github.com',
	'raw.githubusercontent.com',
	'gist.githubusercontent.com',
	'objects.githubusercontent.com',
	'release-assets.githubusercontent.com',
	'api.polyhaven.com',
	'dl.polyhaven.org',
	'ambientcg.com',
	'api.poly.pizza',
	'poly.pizza',
	'api.sketchfab.com',
	'sketchfab.com',
	'media.sketchfab.com',
	'cdn.jsdelivr.net',
	'unpkg.com',
	'esm.sh',
	'cdnjs.cloudflare.com',
	'registry.npmjs.org',
	'fonts.googleapis.com',
	'fonts.gstatic.com',
	'huggingface.co',
	'openrouter.ai',
	'api.openai.com',
	'api.anthropic.com',
	'generativelanguage.googleapis.com',
]);

export const MAX_REDIRECIONAMENTOS = 5;

const HOST_INTERNO = /^(localhost|.+\.localhost|.+\.local|.+\.internal|.+\.home\.arpa)$/i;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-f:.]+$/i;

export function ehIpv4(valor) {
	const m = IPV4.exec(valor);
	return !!m && m.slice(1).every((octeto) => Number(octeto) <= 255);
}

export function ehIpv6(valor) {
	return valor.includes(':') && IPV6.test(valor);
}

export function ehIp(valor) {
	return ehIpv4(valor) || ehIpv6(valor);
}

export function ipPrivado(ip) {
	const valor = String(ip || '').toLowerCase();
	if (ehIpv4(valor)) {
		const [a, b] = valor.split('.').map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			a >= 224
		);
	}
	if (ehIpv6(valor)) {
		if (valor === '::' || valor === '::1') return true;
		if (/^(fe[89ab]|f[cd]|ff)/.test(valor)) return true;
		const mapeado = valor.match(/^(?:0:0:0:0:0:ffff|::ffff):(\d+\.\d+\.\d+\.\d+)$/);
		if (mapeado) return ipPrivado(mapeado[1]);
		if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(valor)) return true;
	}
	return false;
}

function normalizarHost(host) {
	return String(host || '')
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, '')
		.replace(/\.$/, '');
}

function hostCasa(host, regra) {
	if (regra === '*') return true;
	if (regra.startsWith('*.')) return host.endsWith(regra.slice(1));
	return host === regra || host.endsWith('.' + regra);
}

export function listaDeHosts(valor) {
	return String(valor || '')
		.split(',')
		.map(normalizarHost)
		.filter(Boolean);
}

export function criarPoliticaDeRede(opcoes = {}) {
	const extras = listaDeHosts(opcoes.hostsExtras);
	const confiaveis = [...HOSTS_CONFIAVEIS, ...extras];
	const resolver = opcoes.resolver || null;
	const buscar = opcoes.fetch || globalThis.fetch;

	function hostConfiavel(host) {
		const h = normalizarHost(host);
		if (!h || HOST_INTERNO.test(h)) return false;
		if (ehIp(h)) return !ipPrivado(h) && extras.includes('*');
		return confiaveis.some((regra) => hostCasa(h, regra));
	}

	function avaliarUrl(valor) {
		let url;
		try {
			url = new URL(String(valor || ''));
		} catch {
			return { ok: false, motivo: 'url invalida' };
		}
		if (url.protocol !== 'http:' && url.protocol !== 'https:')
			return { ok: false, motivo: 'url invalida: use http(s)' };
		if (url.username || url.password)
			return { ok: false, motivo: 'url com credenciais embutidas nao e permitida' };
		const host = normalizarHost(url.hostname);
		if (!hostConfiavel(host))
			return {
				ok: false,
				motivo: `host fora da lista confiavel: ${host} (acrescente em FETCH_HOSTS para liberar)`,
			};
		return { ok: true, url, host };
	}

	async function hostResolveSeguro(host) {
		if (ehIp(host)) return !ipPrivado(host);
		if (!resolver) return true;
		let enderecos;
		try {
			enderecos = await resolver(host);
		} catch {
			return false;
		}
		return enderecos.length > 0 && enderecos.every((endereco) => !ipPrivado(endereco));
	}

	async function buscarConfiavel(valor, init = {}) {
		let atual = String(valor || '');
		let metodo = String(init.method || 'GET').toUpperCase();
		let corpo = init.body;
		for (let salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto++) {
			const avaliacao = avaliarUrl(atual);
			if (!avaliacao.ok) throw new Error(avaliacao.motivo);
			if (!(await hostResolveSeguro(avaliacao.host)))
				throw new Error(`host resolve para endereco privado ou nao resolve: ${avaliacao.host}`);
			const resposta = await buscar(avaliacao.url, {
				...init,
				method: metodo,
				body: metodo === 'GET' || metodo === 'HEAD' ? undefined : corpo,
				redirect: 'manual',
			});
			const destino = resposta.headers.get('location');
			if (resposta.status >= 300 && resposta.status < 400 && destino) {
				try {
					if (resposta.body) await resposta.body.cancel();
				} catch {}
				atual = new URL(destino, avaliacao.url).href;
				if (resposta.status !== 307 && resposta.status !== 308) {
					metodo = 'GET';
					corpo = undefined;
				}
				continue;
			}
			return resposta;
		}
		throw new Error(`redirecionamentos demais (limite ${MAX_REDIRECIONAMENTOS})`);
	}

	return { hostConfiavel, avaliarUrl, hostResolveSeguro, buscarConfiavel, extras, confiaveis };
}
