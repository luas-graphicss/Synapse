(function (raiz, fabrica) {
	'use strict';
	const api = fabrica();
	if (typeof module === 'object' && module && module.exports) module.exports = api;
	else raiz.SYNAPSE_TOOLCHAINS = api;
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	const BD_NOME = 'synapse-toolchains';
	const BD_VERSAO = 1;
	const LOJA = 'recursos';

	const registro = {};
	const emVoo = {};

	function temIDB() {
		try {
			return typeof indexedDB !== 'undefined' && indexedDB !== null;
		} catch (e) {
			return false;
		}
	}

	function pedido(req) {
		return new Promise(function (ok, erro) {
			req.onsuccess = function () {
				ok(req.result);
			};
			req.onerror = function () {
				erro(req.error || new Error('IndexedDB falhou'));
			};
		});
	}

	let bdAberto = null;
	function abrirBD() {
		if (!temIDB()) return Promise.resolve(null);
		if (bdAberto) return bdAberto;
		bdAberto = new Promise(function (ok) {
			let req;
			try {
				req = indexedDB.open(BD_NOME, BD_VERSAO);
			} catch (e) {
				ok(null);
				return;
			}
			req.onupgradeneeded = function () {
				const bd = req.result;
				if (!bd.objectStoreNames.contains(LOJA)) bd.createObjectStore(LOJA, { keyPath: 'chave' });
			};
			req.onsuccess = function () {
				ok(req.result);
			};
			req.onerror = function () {
				ok(null);
			};
			req.onblocked = function () {
				ok(null);
			};
		});
		return bdAberto;
	}

	function comLoja(modo, fn) {
		return abrirBD().then(function (bd) {
			if (!bd) return null;
			return new Promise(function (ok, erro) {
				let tx;
				try {
					tx = bd.transaction(LOJA, modo);
				} catch (e) {
					ok(null);
					return;
				}
				const loja = tx.objectStore(LOJA);
				let res;
				try {
					res = fn(loja);
				} catch (e) {
					erro(e);
					return;
				}
				tx.oncomplete = function () {
					Promise.resolve(res).then(ok, erro);
				};
				tx.onerror = function () {
					erro(tx.error || new Error('transacao falhou'));
				};
				tx.onabort = function () {
					erro(tx.error || new Error('transacao abortada'));
				};
			}).catch(function () {
				return null;
			});
		});
	}

	function lerCache(chave) {
		return comLoja('readonly', function (loja) {
			return pedido(loja.get(chave));
		});
	}

	function gravarCache(chave, bytes, meta) {
		return comLoja('readwrite', function (loja) {
			return pedido(
				loja.put({
					chave: chave,
					dados: bytes.buffer,
					bytes: bytes.byteLength,
					quando: Date.now(),
					meta: meta || null,
				}),
			);
		});
	}

	function listarCache() {
		return comLoja('readonly', function (loja) {
			return pedido(loja.getAll());
		}).then(function (linhas) {
			if (!linhas) return [];
			const out = [];
			for (let i = 0; i < linhas.length; i++) {
				out.push({ chave: linhas[i].chave, bytes: linhas[i].bytes, quando: linhas[i].quando });
			}
			return out;
		});
	}

	function tamanhoCache() {
		return listarCache().then(function (l) {
			let t = 0;
			for (let i = 0; i < l.length; i++) t += l[i].bytes || 0;
			return t;
		});
	}

	function limparCache(prefixo) {
		if (!prefixo) {
			return comLoja('readwrite', function (loja) {
				return pedido(loja.clear());
			}).then(function () {
				return true;
			});
		}
		return comLoja('readonly', function (loja) {
			return pedido(loja.getAllKeys());
		}).then(function (chaves) {
			if (!chaves || !chaves.length) return true;
			const alvos = [];
			for (let i = 0; i < chaves.length; i++) {
				if (String(chaves[i]).indexOf(prefixo) === 0) alvos.push(chaves[i]);
			}
			if (!alvos.length) return true;
			return comLoja('readwrite', function (loja) {
				let ultimo = null;
				for (let j = 0; j < alvos.length; j++) ultimo = pedido(loja['delete'](alvos[j]));
				return ultimo || Promise.resolve();
			}).then(function () {
				return true;
			});
		});
	}

	function temSubtle() {
		try {
			return (
				typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function'
			);
		} catch (e) {
			return false;
		}
	}

	function sha256hex(bytes) {
		if (!temSubtle()) return Promise.resolve(null);
		const ab =
			bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
				? bytes.buffer
				: bytes.slice().buffer;
		return crypto.subtle.digest('SHA-256', ab).then(function (d) {
			let v = new Uint8Array(d),
				s = '';
			for (let i = 0; i < v.length; i++) s += (v[i] < 16 ? '0' : '') + v[i].toString(16);
			return s;
		});
	}

	function abortado(sinal) {
		return !!(sinal && sinal.aborted);
	}

	function erroAbort() {
		const e = new Error('Carga cancelada');
		e.nome = 'Cancelado';
		e.cancelado = true;
		return e;
	}

	const ESPERA_MAX_MS = 20000;

	function baixarUma(url, sinal, aoBytes, esperaMs) {
		const limite = esperaMs || ESPERA_MAX_MS;
		const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
		let travou = false;
		let relogio = null;

		function rearmar() {
			if (!ctrl) return;
			if (relogio) clearTimeout(relogio);
			relogio = setTimeout(function () {
				travou = true;
				try {
					ctrl.abort();
				} catch (e) {
					ignorarErro(e, 'rearmar');
				}
			}, limite);
		}
		function parar() {
			if (relogio) {
				clearTimeout(relogio);
				relogio = null;
			}
		}

		if (ctrl && sinal) {
			if (sinal.aborted) {
				try {
					ctrl.abort();
				} catch (e) {
					ignorarErro(e, 'baixarUma');
				}
			} else if (typeof sinal.addEventListener === 'function') {
				sinal.addEventListener('abort', function () {
					try {
						ctrl.abort();
					} catch (e) {
						ignorarErro(e, 'baixarUma');
					}
				});
			}
		}
		rearmar();

		function traduzir(e) {
			if (!travou) return e;
			const t = new Error(`Tempo esgotado (${Math.round(limite / 1000)}s sem resposta) em ${url}`);
			t.travou = true;
			return t;
		}

		return fetch(url, { signal: ctrl ? ctrl.signal : sinal, credentials: 'omit', mode: 'cors' })
			.then(function (r) {
				if (!r.ok) {
					parar();
					throw new Error(`HTTP ${r.status} em ${url}`);
				}

				if (!r.body || typeof r.body.getReader !== 'function') {
					return r.arrayBuffer().then(function (ab) {
						parar();
						const b = new Uint8Array(ab);
						if (aoBytes) aoBytes(b.byteLength, true);
						return b;
					});
				}

				const leitor = r.body.getReader();
				const pedacos = [];
				let total = 0;

				return (function puxar() {
					return leitor.read().then(function (p) {
						if (p.done) {
							parar();
							let saida = new Uint8Array(total),
								pos = 0;
							for (let i = 0; i < pedacos.length; i++) {
								saida.set(pedacos[i], pos);
								pos += pedacos[i].byteLength;
							}
							return saida;
						}
						pedacos.push(p.value);
						total += p.value.byteLength;
						rearmar();
						if (aoBytes) aoBytes(total, false);
						if (abortado(sinal)) {
							try {
								leitor.cancel();
							} catch (e) {
								ignorarErro(e, 'puxar');
							}
							throw erroAbort();
						}
						return puxar();
					});
				})();
			})
			.catch(function (e) {
				parar();
				throw traduzir(e);
			});
	}

	function baixarComEspelhos(urls, sinal, aoBytes) {
		const falhas = [];
		let i = 0;
		function tentar() {
			if (abortado(sinal)) return Promise.reject(erroAbort());
			if (i >= urls.length) {
				return Promise.reject(new Error('Todos os espelhos falharam: ' + falhas.join(' | ')));
			}
			const url = urls[i++];
			return baixarUma(url, sinal, aoBytes).catch(function (e) {
				if (e && e.cancelado) throw e;
				if (abortado(sinal)) throw erroAbort();
				falhas.push(e && e.message ? e.message : String(e));
				if (aoBytes) aoBytes(0, false);
				return tentar();
			});
		}
		return tentar();
	}

	function registrar(def) {
		if (!def || !def.id) throw new Error('toolchain precisa de id');
		if (!def.versao) throw new Error(`toolchain ${def.id} precisa de versao`);
		if (!def.recursos || !def.recursos.length)
			throw new Error(`toolchain ${def.id} precisa de recursos`);
		registro[def.id] = def;
		return def;
	}

	function obter(id) {
		return registro[id] || null;
	}

	function listar() {
		const out = [];
		for (let k in registro)
			if (Object.prototype.hasOwnProperty.call(registro, k)) out.push(registro[k]);
		return out;
	}

	function prefixoDe(def) {
		return def.id + '@' + def.versao + '/';
	}

	function estaEmCache(id) {
		const def = typeof id === 'string' ? obter(id) : id;
		if (!def) return Promise.resolve(false);
		const pre = prefixoDe(def);
		let faltando = 0;
		const checagens = def.recursos.map(function (r) {
			return lerCache(pre + r.nome).then(function (linha) {
				if (!linha) faltando++;
			});
		});
		return Promise.all(checagens).then(function () {
			return faltando === 0;
		});
	}

	function carregar(id, opcoes) {
		opcoes = opcoes || {};
		const def = typeof id === 'string' ? obter(id) : id;
		if (!def) return Promise.reject(new Error('Toolchain desconhecido: ' + id));

		const chaveVoo = def.id + '@' + def.versao;
		if (!opcoes.ignorarCache && emVoo[chaveVoo]) return emVoo[chaveVoo];

		const sinal = opcoes.sinal || null;
		const aoProgresso = typeof opcoes.aoProgresso === 'function' ? opcoes.aoProgresso : null;
		const pre = prefixoDe(def);
		const t0 = Date.now();

		let totalEstimado = 0;
		for (let i = 0; i < def.recursos.length; i++) totalEstimado += def.recursos[i].bytes || 1048576;

		const progresso = {};
		const tamanhoReal = {};
		let todosDoCache = true;
		let pctMax = 0;

		function totalAtual() {
			let soma = 0;
			for (let j = 0; j < def.recursos.length; j++) {
				const rr = def.recursos[j];
				soma += Object.prototype.hasOwnProperty.call(tamanhoReal, rr.nome)
					? tamanhoReal[rr.nome]
					: rr.bytes || 1048576;
			}
			return soma;
		}

		function avisar(fase, recurso) {
			if (!aoProgresso) return;
			let soma = 0;
			for (let k in progresso)
				if (Object.prototype.hasOwnProperty.call(progresso, k)) soma += progresso[k];
			const total = Math.max(totalAtual(), soma);
			const pct = total > 0 ? Math.min(100, Math.round((soma / total) * 100)) : 0;
			if (fase === 'pronto') pctMax = 100;
			else if (pct > pctMax) pctMax = pct;
			try {
				aoProgresso({
					fase: fase,
					recurso: recurso || null,
					carregado: soma,
					total: total,
					pct: fase === 'pronto' ? 100 : pctMax,
				});
			} catch (e) {
				ignorarErro(e, 'avisar');
			}
		}

		function umRecurso(r) {
			const chave = pre + r.nome;
			progresso[r.nome] = 0;

			function daRede() {
				todosDoCache = false;
				avisar('baixando', r.nome);
				const urls = r.urls && r.urls.length ? r.urls : [r.url];
				return baixarComEspelhos(urls, sinal, function (bytes) {
					progresso[r.nome] = bytes;
					avisar('baixando', r.nome);
				})
					.then(function (bytes) {
						if (!r.sha256) return { bytes: bytes, hash: null };
						avisar('verificando', r.nome);
						return sha256hex(bytes).then(function (h) {
							if (h && h.toLowerCase() !== String(r.sha256).toLowerCase()) {
								throw new Error(`Integridade falhou em ${r.nome}: esperava ${r.sha256}, veio ${h}`);
							}
							return { bytes: bytes, hash: h };
						});
					})
					.then(function (res) {
						progresso[r.nome] = res.bytes.byteLength;
						tamanhoReal[r.nome] = res.bytes.byteLength;
						avisar('baixando', r.nome);
						return gravarCache(chave, res.bytes, { sha256: res.hash, url: urls[0] }).then(
							function () {
								return res.bytes;
							},
						);
					});
			}

			if (opcoes.ignorarCache) return daRede();

			return lerCache(chave).then(function (linha) {
				if (linha && linha.dados) {
					const b = new Uint8Array(linha.dados);
					progresso[r.nome] = b.byteLength;
					tamanhoReal[r.nome] = b.byteLength;
					avisar('cache', r.nome);
					return b;
				}
				return daRede();
			});
		}

		const p = (function () {
			const arquivos = {};
			let cadeia = Promise.resolve();
			def.recursos.forEach(function (r) {
				cadeia = cadeia.then(function () {
					if (abortado(sinal)) throw erroAbort();
					return umRecurso(r).then(function (bytes) {
						arquivos[r.nome] = bytes;
					});
				});
			});
			return cadeia.then(function () {
				avisar('pronto', null);
				return {
					id: def.id,
					versao: def.versao,
					nome: def.nome || def.id,
					arquivos: arquivos,
					doCache: todosDoCache,
					ms: Date.now() - t0,
				};
			});
		})();

		if (!opcoes.ignorarCache) {
			emVoo[chaveVoo] = p;
			p.then(
				function () {
					if (emVoo[chaveVoo] === p) delete emVoo[chaveVoo];
				},
				function () {
					if (emVoo[chaveVoo] === p) delete emVoo[chaveVoo];
				},
			);
		}
		return p;
	}

	return {
		registrar: registrar,
		obter: obter,
		listar: listar,
		carregar: carregar,
		estaEmCache: estaEmCache,
		cache: {
			listar: listarCache,
			tamanho: tamanhoCache,
			limpar: limparCache,
		},
		_sha256hex: sha256hex,
	};
});
