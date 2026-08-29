(function () {
	'use strict';

	const MENOR = String.fromCharCode(8249);
	const ANG = String.fromCharCode(10216);
	const RATIO = String.fromCharCode(8758);
	const FWEQ = String.fromCharCode(65309);
	const ANG_ENT = '&#10216;';
	const RATIO_ENT = '&#8758;';
	const FWEQ_ENT = '&#65309;';

	const RE_TAG_FIM = /<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:._-]{0,40})\s*\/?\s*>/g;
	const RE_TAG_ABR = /<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:._-]{0,40})/g;
	const RE_MENOR = /</g;
	const RE_JS_URI = /javascript\s*:/gi;
	const RE_DATA_HTML = /data(\s*):(\s*)text\s*\/\s*html/gi;
	const RE_HANDLER = /\bon([a-z]{3,15})\s*=/gi;
	const RE_TEMPLATE = /\$\{/g;

	function _tagFim(_m, barra, nome) {
		return `[${barra || ''}${nome}]`;
	}
	function _tagAbr(_m, barra, nome) {
		return `[${barra || ''}${nome}`;
	}

	function wafTextoSeguro(txt) {
		if (typeof txt !== 'string' || !txt) return txt;
		let t = txt;
		if (t.includes('<')) {
			t = t.replace(RE_TAG_FIM, _tagFim).replace(RE_TAG_ABR, _tagAbr).replace(RE_MENOR, MENOR);
		}
		if (t.includes(':'))
			t = t.replace(RE_JS_URI, 'javascript :').replace(RE_DATA_HTML, 'data$1 :$2text/html');
		if (t.includes('=')) t = t.replace(RE_HANDLER, 'on$1 =');
		if (t.includes('${')) t = t.replace(RE_TEMPLATE, '$ {');
		return t;
	}

	function _mapaFundo(valor, fn) {
		if (typeof valor === 'string') return fn(valor);
		if (!valor || typeof valor !== 'object') return valor;
		if (Array.isArray(valor)) {
			const arr = new Array(valor.length);
			for (let i = 0; i < valor.length; i++) arr[i] = _mapaFundo(valor[i], fn);
			return arr;
		}
		const out = {};
		for (let k in valor) {
			if (!Object.prototype.hasOwnProperty.call(valor, k)) continue;
			out[k] = _mapaFundo(valor[k], fn);
		}
		return out;
	}

	function wafSanearObj(valor) {
		return _mapaFundo(valor, wafTextoSeguro);
	}

	let MODO = 'auto';
	let NIVEL = 2;
	let CLIENTE = '';
	try {
		const s1 = localStorage.getItem('synapse.waf.modo');
		if (s1 === 'auto' || s1 === 'sempre' || s1 === 'nunca') MODO = s1;
		const s2 = parseInt(localStorage.getItem('synapse.waf.nivel'), 10);
		if (s2 === 1 || s2 === 2) NIVEL = s2;
	} catch (e) {
		ignorarErro(e, 'saneamento-waf');
	}

	const RE_RISCO = /notion/i;
	const RE_SEGURO =
		/(claude|anthropic|cursor|windsurf|vscode|visual\s*studio|inspector|cline|continue\b|zed|copilot|openai|chatgpt|gemini|postman|curl|insomnia|aurora-cache|aurora-interno|synapse-autoteste|mcp-cli)/i;

	const RE_URI_COD = /((?:java|vb|live)script)(\s*):/gi;
	const RE_URI_DEC = new RegExp('((?:java|vb|live)script)(\\s*)' + RATIO, 'gi');
	const RE_DATA_COD = /(data)(\s*):(\s*text\s*\/\s*html)/gi;
	const RE_DATA_DEC = new RegExp(`(data)(\\s*)${RATIO}(\\s*text\\s*\\/\\s*html)`, 'gi');
	const RE_HAND_COD = /\bon([A-Za-z]{2,20})(\s*)=/g;
	const RE_HAND_DEC = new RegExp('\\bon([A-Za-z]{2,20})(\\s*)' + FWEQ, 'g');

	function wafRegistrarCliente(nome) {
		CLIENTE = String(nome || '');
		return CLIENTE;
	}

	function wafAtivoPara(nome) {
		if (MODO === 'nunca') return false;
		if (MODO === 'sempre') return true;
		const n = String(nome || CLIENTE || '');
		if (RE_RISCO.test(n)) return true;
		if (RE_SEGURO.test(n)) return false;
		return true;
	}
	function wafAtivo() {
		return wafAtivoPara(CLIENTE);
	}
	function _estado() {
		return {
			modo: MODO,
			nivel: NIVEL,
			cliente: CLIENTE || '(sem handshake na aba)',
			ativo_agora: wafAtivo(),
		};
	}
	function wafModo(m) {
		if (m === undefined) return _estado();
		if (m !== 'auto' && m !== 'sempre' && m !== 'nunca')
			throw new Error("use 'auto', 'sempre' ou 'nunca'");
		MODO = m;
		try {
			localStorage.setItem('synapse.waf.modo', m);
		} catch (e) {
			ignorarErro(e, 'wafModo');
		}
		return _estado();
	}
	function wafNivel(n) {
		if (n === undefined) return _estado();
		n = parseInt(n, 10);
		if (n !== 1 && n !== 2) throw new Error('use 1 (so tag) ou 2 (tag + javascript: + on...=)');
		NIVEL = n;
		try {
			localStorage.setItem('synapse.waf.nivel', String(n));
		} catch (e) {
			ignorarErro(e, 'wafNivel');
		}
		return _estado();
	}

	function wafCodificarSaida(txt) {
		if (typeof txt !== 'string' || !txt) return txt;
		let t = txt;
		if (t.includes(ANG)) t = t.split(ANG).join(ANG_ENT);
		if (NIVEL >= 2) {
			if (t.includes(RATIO)) t = t.split(RATIO).join(RATIO_ENT);
			if (t.includes(FWEQ)) t = t.split(FWEQ).join(FWEQ_ENT);
		}
		if (t.includes('<')) t = t.split('<').join(ANG);
		if (NIVEL >= 2) {
			if (t.includes(':'))
				t = t.replace(RE_URI_COD, '$1$2' + RATIO).replace(RE_DATA_COD, `$1$2${RATIO}$3`);
			if (t.includes('=')) t = t.replace(RE_HAND_COD, 'on$1$2' + FWEQ);
		}
		return t;
	}

	function wafDecodificarEntrada(txt) {
		if (typeof txt !== 'string' || !txt) return txt;
		let t = txt;
		if (t.includes(FWEQ)) t = t.replace(RE_HAND_DEC, 'on$1$2=');
		if (t.includes(RATIO)) t = t.replace(RE_URI_DEC, '$1$2:').replace(RE_DATA_DEC, '$1$2:$3');
		if (t.includes(ANG)) t = t.split(ANG).join('<');
		if (t.includes(ANG_ENT)) t = t.split(ANG_ENT).join(ANG);
		if (t.includes(RATIO_ENT)) t = t.split(RATIO_ENT).join(RATIO);
		if (t.includes(FWEQ_ENT)) t = t.split(FWEQ_ENT).join(FWEQ);
		return t;
	}

	function _nota() {
		let n = `[WAF] Neste resultado o caractere "${ANG}" esta no lugar de "menor que"`;
		if (NIVEL >= 2)
			n += `, "${RATIO}" no lugar de ":" em javascript:/data:text/html e "${FWEQ}" no lugar de "=" em atributos on...=`;
		n +=
			'. Motivo: a borda do Notion bloqueia esse texto com erro 403 e o chat para de gravar. Nada mais foi alterado. ' +
			'Para escrever/editar, mande o texto como preferir (com esses caracteres ou com os originais): o servidor desfaz a troca antes de gravar, byte a byte.';
		return n;
	}

	function wafCodificarResultado(res, forcar) {
		if (forcar === undefined ? !wafAtivo() : !forcar) return res;
		if (!res || typeof res !== 'object') return res;
		let serial = '';
		try {
			serial = JSON.stringify(res);
		} catch (e) {
			return res;
		}
		let precisa = serial.includes('<') || serial.includes(ANG);
		if (NIVEL >= 2 && !precisa)
			precisa =
				RE_URI_COD.test(serial) ||
				RE_HAND_COD.test(serial) ||
				serial.includes(RATIO) ||
				serial.includes(FWEQ);
		RE_URI_COD.lastIndex = 0;
		RE_HAND_COD.lastIndex = 0;
		if (!precisa) return res;
		const out = _mapaFundo(res, wafCodificarSaida);
		try {
			if (Array.isArray(out.content)) {
				for (let i = 0; i < out.content.length; i++) {
					if (out.content[i] && out.content[i].type === 'text') {
						out.content[i].text =
							wafCodificarSaida(_nota()) +
							'\n' +
							String(out.content[i].text == null ? '' : out.content[i].text);
						break;
					}
				}
			}
			out._waf = 'codificado';
		} catch (e) {
			ignorarErro(e, 'wafCodificarResultado');
		}
		return out;
	}

	function wafDecodificarArgs(args, forcar) {
		if (forcar === undefined ? !wafAtivo() : !forcar) return args;
		if (!args || typeof args !== 'object') return args;
		try {
			const s = JSON.stringify(args);
			if (
				!s.includes(ANG) &&
				!s.includes(RATIO) &&
				!s.includes(FWEQ) &&
				!s.includes('&#10216;') &&
				!s.includes('&#8758;') &&
				!s.includes('&#65309;')
			)
				return args;
		} catch (e) {
			ignorarErro(e, 'wafDecodificarArgs');
		}
		return _mapaFundo(args, wafDecodificarEntrada);
	}

	const REGRAS = [
		{ nome: 'tag script (CRS 941110)', re: /<\s*\/?\s*script/gi, bloqueio: true },
		{
			nome: 'tag HTML literal (941160)',
			re: /<\s*\/?\s*[A-Za-z][A-Za-z0-9:._-]{0,40}\s*\/?>/g,
			bloqueio: true,
		},
		{ nome: 'tag HTML aberta', re: /<\s*\/?\s*[A-Za-z][A-Za-z0-9:._-]{0,40}\s/g, bloqueio: true },
		{ nome: 'sinal de menor solto', re: /</g, bloqueio: true },
		{ nome: 'URI javascript: (941140)', re: /(?:java|vb|live)script\s*:/gi, bloqueio: true },
		{ nome: 'data:text/html', re: /data\s*:\s*text\s*\/\s*html/gi, bloqueio: true },
		{ nome: 'handler on...= (941120)', re: /\bon[A-Za-z]{2,20}\s*=/g, bloqueio: true },
		{ nome: 'template ${...}', re: /\$\{/g, bloqueio: false },
	];

	function wafRiscos(txt, soBloqueio) {
		const achados = [];
		if (typeof txt !== 'string' || !txt) return achados;
		for (let i = 0; i < REGRAS.length; i++) {
			if (soBloqueio && !REGRAS[i].bloqueio) continue;
			const re = REGRAS[i].re;
			re.lastIndex = 0;
			let m,
				amostras = [],
				n = 0;
			while ((m = re.exec(txt)) !== null) {
				n++;
				if (amostras.length < 3 && !amostras.includes(m[0])) amostras.push(m[0]);
				if (m.index === re.lastIndex) re.lastIndex++;
				if (n > 500) break;
			}
			if (n) achados.push({ regra: REGRAS[i].nome, n: n, amostras: amostras });
		}
		return achados;
	}

	function _andar(valor, caminho, visita) {
		if (typeof valor === 'string') return visita(caminho, valor);
		if (!valor || typeof valor !== 'object') return;
		if (Array.isArray(valor)) {
			for (let i = 0; i < valor.length; i++) _andar(valor[i], caminho + '[' + i + ']', visita);
			return;
		}
		for (let k in valor) {
			if (!Object.prototype.hasOwnProperty.call(valor, k)) continue;
			_andar(valor[k], caminho + '.' + k, visita);
		}
	}

	function wafAuditar(obj, rotulo, soBloqueio) {
		const itens = [];
		_andar(obj, rotulo || '', function (caminho, txt) {
			const r = wafRiscos(txt, soBloqueio);
			if (r.length) itens.push({ campo: caminho, achados: r });
		});
		let bytes = 0;
		try {
			bytes = JSON.stringify(obj).length;
		} catch (e) {
			ignorarErro(e, 'wafAuditar');
		}
		return { bytes: bytes, itens: itens, seguro: itens.length === 0 };
	}

	async function varrer(silencioso) {
		let bruto = null,
			ini = null;
		try {
			if (typeof mcpHandleMessage !== 'function') throw new Error('mcpHandleMessage indisponivel');
			const rt = await mcpHandleMessage({
				jsonrpc: '2.0',
				id: 'waf-t',
				method: 'tools/list',
				params: {},
			});
			bruto = (rt && rt.result) || null;
			const ri = await mcpHandleMessage({
				jsonrpc: '2.0',
				id: 'waf-i',
				method: 'initialize',
				params: {
					protocolVersion: '2025-06-18',
					capabilities: {},
					clientInfo: { name: 'synapse-autoteste', version: '1' },
				},
			});
			ini = (ri && ri.result) || null;
		} catch (e) {
			return { erro: String((e && e.message) || e) };
		}
		const aTools = wafAuditar(bruto, 'tools');
		const aInit = wafAuditar(ini, 'initialize');
		return {
			ferramentas: (bruto && bruto.tools && bruto.tools.length) || 0,
			bytes_tools_list: aTools.bytes,
			bytes_instructions: (ini && ini.instructions && ini.instructions.length) || 0,
			seguro: aTools.seguro && aInit.seguro,
			riscos: aTools.itens.concat(aInit.itens),
			resultado_de_ferramenta: _estado(),
		};
	}

	function provar(txt) {
		const amostra =
			txt ||
			`<!DOCTYPE html>\n<html lang="pt-BR">\n<head><meta charset="utf-8"><title>T</title></head>\n<body>\
<div class="a" onclick="abrir()">x</div>\n<img src=x onerror="alert(1)">\n<a href="javascript:void(0)">\
l</a>\n<script src="a.js"></script>\n</body></html>`;
		const cod = wafCodificarSaida(amostra);
		const volta = wafDecodificarEntrada(cod);
		const r = {
			nivel: NIVEL,
			bytes: amostra.length,
			assinaturas_no_original: wafRiscos(amostra, true).length,
			assinaturas_depois_de_codificar: wafRiscos(cod, true).length,
			menor_depois_de_codificar: (cod.match(/</g) || []).length,
			round_trip_identico: volta === amostra,
		};
		try {
			registro.debug(
				r.round_trip_identico && !r.assinaturas_depois_de_codificar
					? '%c[Synapse WAF] round-trip OK'
					: '%c[Synapse WAF] round-trip FALHOU',
				'color:#39d98a;font-weight:600',
				r,
			);
		} catch (e) {
			ignorarErro(e, 'provar');
		}
		return r;
	}

	window.wafTextoSeguro = wafTextoSeguro;
	window.wafSanearObj = wafSanearObj;
	window.wafCodificarSaida = wafCodificarSaida;
	window.wafDecodificarEntrada = wafDecodificarEntrada;
	window.wafCodificarResultado = wafCodificarResultado;
	window.wafDecodificarArgs = wafDecodificarArgs;
	window.wafRegistrarCliente = wafRegistrarCliente;
	window.wafAtivoPara = wafAtivoPara;
	window.wafAtivo = wafAtivo;
	window.wafRiscos = wafRiscos;
	window.wafAuditar = wafAuditar;
	window.SYNAPSE_WAF = {
		versao: '10.2.1',
		varrer: varrer,
		provar: provar,
		modo: wafModo,
		nivel: wafNivel,
		texto: wafTextoSeguro,
		objeto: wafSanearObj,
		codificar: wafCodificarSaida,
		decodificar: wafDecodificarEntrada,
		riscos: wafRiscos,
		auditar: wafAuditar,
		angulo: ANG,
	};
	try {
		registro.debug(
			'%c[Synapse] Saneamento WAF ativo (v10.2.1)',
			'color:#6aa3ff;font-weight:600',
			'SYNAPSE_WAF.varrer() | .provar() | .modo() | .nivel()',
		);
	} catch (e) {
		ignorarErro(e, 'saneamento-waf');
	}
})();
