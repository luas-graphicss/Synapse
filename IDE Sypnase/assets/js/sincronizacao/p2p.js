(function () {
	'use strict';
	const SY = { peer: null, conn: null, code: '', lib: null, busy: false };
	const PEERJS_CDNS = [
		'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
		'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
	];

	function q(s) {
		return document.querySelector(s);
	}
	function say(where, html) {
		const e = q(where);
		if (e) e.innerHTML = html;
	}
	function bar(sel, pct) {
		const b = q(sel);
		if (!b) return;
		if (pct == null) {
			b.classList.remove('on');
			b.firstChild.style.width = '0';
			return;
		}
		b.classList.add('on');
		b.firstChild.style.width = Math.max(0, Math.min(100, pct)) + '%';
	}
	function beep(t, m, k) {
		try {
			if (typeof toast === 'function') toast(t, m, k || '');
		} catch (e) {
			ignorarErro(e, 'beep');
		}
	}

	function loadPeer() {
		if (SY.lib) return SY.lib;
		if (window.Peer) return (SY.lib = Promise.resolve(window.Peer));
		SY.lib = new Promise(function (res, rej) {
			let i = 0;
			(function next() {
				if (i >= PEERJS_CDNS.length)
					return rej(
						new Error('nao foi possivel carregar a biblioteca de conexao (sem internet?)'),
					);
				carregarScriptExterno(PEERJS_CDNS[i++]).then(
					() => (window.Peer ? res(window.Peer) : next()),
					() => next(),
				);
			})();
		});
		return SY.lib;
	}

	function pack(pd) {
		const bufs = [];
		function walk(v) {
			if (v instanceof ArrayBuffer) {
				bufs.push(new Uint8Array(v));
				return { __bin: bufs.length - 1 };
			}
			if (ArrayBuffer.isView(v)) {
				bufs.push(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)));
				return { __bin: bufs.length - 1 };
			}
			if (Array.isArray(v)) {
				return v.map(walk);
			}
			if (v && typeof v === 'object') {
				const o = {};
				for (let k in v) {
					if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = walk(v[k]);
				}
				return o;
			}
			return v;
		}
		const meta = walk(pd);
		const sizes = bufs.map(function (b) {
			return b.length;
		});
		const head = new TextEncoder().encode(JSON.stringify({ v: 1, meta: meta, sizes: sizes }));
		const total =
			8 +
			head.length +
			sizes.reduce(function (a, b) {
				return a + b;
			}, 0);
		const out = new Uint8Array(total),
			dv = new DataView(out.buffer);
		dv.setUint32(0, 0x41555230);
		dv.setUint32(4, head.length);
		out.set(head, 8);
		let off = 8 + head.length;
		for (let i = 0; i < bufs.length; i++) {
			out.set(bufs[i], off);
			off += bufs[i].length;
		}
		return out.buffer;
	}
	function unpack(ab) {
		const u = new Uint8Array(ab),
			dv = new DataView(ab);
		if (u.length < 8 || dv.getUint32(0) !== 0x41555230)
			throw new Error('pacote invalido ou corrompido');
		const hl = dv.getUint32(4);
		const obj = JSON.parse(new TextDecoder().decode(u.subarray(8, 8 + hl)));
		let bufs = [],
			off = 8 + hl;
		for (let i = 0; i < obj.sizes.length; i++) {
			bufs.push(u.slice(off, off + obj.sizes[i]).buffer);
			off += obj.sizes[i];
		}
		function walk(v) {
			if (v && typeof v === 'object' && typeof v.__bin === 'number') return bufs[v.__bin];
			if (Array.isArray(v)) return v.map(walk);
			if (v && typeof v === 'object') {
				const o = {};
				for (let k in v) {
					if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = walk(v[k]);
				}
				return o;
			}
			return v;
		}
		return walk(obj.meta);
	}
	function fmt(n) {
		if (n < 1024) return n + ' B';
		if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
		return (n / 1048576).toFixed(2) + ' MB';
	}
	function snapshotAtivo() {
		if (typeof activeProject !== 'function' || typeof recSerProj !== 'function')
			throw new Error('funcoes do editor nao encontradas');
		const p = activeProject();
		if (!p) throw new Error('nenhum projeto aberto');
		return recSerProj(p);
	}
	function abrirPacote(pd, rotulo) {
		if (!pd) throw new Error('pacote vazio');
		try {
			delete pd.id;
		} catch (e) {
			ignorarErro(e, 'abrirPacote');
		}
		if (typeof recOpen === 'function') return recOpen([pd]);
		if (typeof recRestoreProjData === 'function') {
			const pr = recRestoreProjData(pd, rotulo || 'espelhado');
			if (pr) {
				try {
					renderAll();
					switchProject(pr.id);
				} catch (e) {
					ignorarErro(e, 'abrirPacote');
				}
			}
			return pr;
		}
		throw new Error('funcao de restauracao nao encontrada');
	}

	function publicar() {
		const code = (q('#syCodeHost').value || '')
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9]/g, '');
		if (code.length < 4) {
			say('#syStSend', 'Use um codigo com pelo menos 4 caracteres.');
			return;
		}
		q('#syCodeHost').value = code;
		try {
			snapshotAtivo();
		} catch (e) {
			say('#syStSend', 'Erro: ' + e.message);
			return;
		}
		say('#syStSend', 'Conectando...');
		q('#syPub').disabled = true;
		loadPeer()
			.then(function (Peer) {
				parar(true);
				SY.code = code;
				SY.peer = new Peer('aurorasync-' + code, { debug: 0 });
				SY.peer.on('open', function () {
					q('#syStop').disabled = false;
					say(
						'#syStSend',
						`Publicado como <b>${code}</b>. Digite esse codigo no outro aparelho. Mantenha esta aba aberta.`,
					);
					beep('Codigo ativo', code + ' - mantenha esta aba aberta', 'ok');
				});
				SY.peer.on('error', function (e) {
					q('#syPub').disabled = false;
					const t = (e && e.type) || 'erro';
					say(
						'#syStSend',
						'Falha: ' + (t === 'unavailable-id' ? 'esse codigo ja esta em uso, escolha outro.' : t),
					);
				});
				SY.peer.on('connection', function (c) {
					c.on('open', function () {
						enviar(c);
					});
				});
			})
			.catch(function (e) {
				q('#syPub').disabled = false;
				say('#syStSend', 'Falha: ' + e.message);
			});
	}

	function enviar(c) {
		let buf;
		try {
			buf = pack(snapshotAtivo());
		} catch (e) {
			try {
				c.send({ t: 'err', m: e.message });
				c.close();
			} catch (_e) {
				ignorarErro(_e, 'enviar');
			}
			say('#syStSend', 'Erro ao preparar: ' + e.message);
			return;
		}
		let pd_nome;
		try {
			pd_nome = activeProject().name;
		} catch (e) {
			pd_nome = 'projeto';
		}
		c.send({ t: 'meta', name: pd_nome, bytes: buf.byteLength });
		say('#syStSend', `Enviando <b>${fmt(buf.byteLength)}</b>...`);
		let CH = 64 * 1024,
			off = 0;
		(function step() {
			try {
				const dc = c.dataChannel;
				if (dc && dc.bufferedAmount > 2 * 1024 * 1024) {
					setTimeout(step, 40);
					return;
				}
				const fim = Math.min(off + CH, buf.byteLength);
				c.send(buf.slice(off, fim));
				off = fim;
				bar('#syBarSend', (off / buf.byteLength) * 100);
				if (off < buf.byteLength) {
					setTimeout(step, 0);
					return;
				}
				c.send({ t: 'end' });
				say(
					'#syStSend',
					`Enviado <b>${fmt(buf.byteLength)}</b> com sucesso. Codigo <b>${SY.code}</b> continua ativo.`,
				);
				beep('Enviado', 'Projeto espelhado no outro aparelho', 'ok');
				setTimeout(function () {
					bar('#syBarSend', null);
				}, 1600);
			} catch (e) {
				say('#syStSend', 'Erro durante o envio: ' + e.message);
				bar('#syBarSend', null);
			}
		})();
	}

	function parar(silencioso) {
		try {
			if (SY.peer) SY.peer.destroy();
		} catch (e) {
			ignorarErro(e, 'parar');
		}
		SY.peer = null;
		const b = q('#syStop'),
			p = q('#syPub');
		if (b) b.disabled = true;
		if (p) p.disabled = false;
		if (!silencioso) {
			say('#syStSend', 'Compartilhamento encerrado. O codigo nao funciona mais.');
			bar('#syBarSend', null);
		}
	}

	function baixar() {
		const code = (q('#syCodeGuest').value || '')
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9]/g, '');
		if (code.length < 4) {
			say('#syStRecv', 'Digite o codigo completo.');
			return;
		}
		q('#syCodeGuest').value = code;
		q('#syGet').disabled = true;
		say('#syStRecv', `Procurando <b>${code}</b>...`);
		loadPeer()
			.then(function (Peer) {
				const peer = new Peer({ debug: 0 });
				let partes = [],
					esperado = 0,
					nome = 'projeto',
					recebido = 0,
					pronto = false;
				function fim(msg, ok) {
					q('#syGet').disabled = false;
					say('#syStRecv', msg);
					if (!ok) bar('#syBarRecv', null);
					try {
						peer.destroy();
					} catch (e) {
						ignorarErro(e, 'fim');
					}
				}
				const timeout = setTimeout(function () {
					if (!pronto)
						fim('Sem resposta. Confira o codigo e se a outra aba esta aberta e publicada.', false);
				}, 20000);
				peer.on('error', function (e) {
					clearTimeout(timeout);
					fim(
						'Falha: ' +
							(e && e.type === 'peer-unavailable'
								? 'codigo nao encontrado.'
								: (e && e.type) || 'erro de conexao'),
						false,
					);
				});
				peer.on('open', function () {
					const c = peer.connect('aurorasync-' + code, { reliable: true });
					c.on('open', function () {
						pronto = true;
						clearTimeout(timeout);
						say('#syStRecv', 'Conectado. Recebendo...');
					});
					c.on('error', function () {
						clearTimeout(timeout);
						fim('Erro na conexao.', false);
					});
					c.on('data', function (d) {
						if (d && d.t === 'err') {
							clearTimeout(timeout);
							fim('O outro aparelho respondeu: ' + d.m, false);
							return;
						}
						if (d && d.t === 'meta') {
							esperado = d.bytes;
							nome = d.name || nome;
							say('#syStRecv', `Recebendo <b>${nome}</b> (${fmt(esperado)})...`);
							return;
						}
						if (d && d.t === 'end') {
							try {
								const total = partes.reduce(function (a, b) {
									return a + b.byteLength;
								}, 0);
								if (esperado && total !== esperado)
									throw new Error(`transferencia incompleta (${fmt(total)} de ${fmt(esperado)})`);
								let all = new Uint8Array(total),
									o = 0;
								for (let i = 0; i < partes.length; i++) {
									all.set(new Uint8Array(partes[i]), o);
									o += partes[i].byteLength;
								}
								abrirPacote(unpack(all.buffer), nome);
								bar('#syBarRecv', 100);
								fim(`Projeto <b>${nome}</b> espelhado com sucesso (${fmt(total)}).`, true);
								beep('Baixado', nome + ' espelhado byte a byte', 'ok');
								setTimeout(function () {
									bar('#syBarRecv', null);
									fechar();
								}, 1200);
							} catch (e) {
								fim('Falha ao abrir: ' + e.message, false);
							}
							return;
						}
						const ab = d instanceof ArrayBuffer ? d : d && d.buffer ? d.buffer : null;
						if (!ab) return;
						partes.push(ab);
						recebido += ab.byteLength;
						if (esperado) bar('#syBarRecv', (recebido / esperado) * 100);
					});
				});
			})
			.catch(function (e) {
				q('#syGet').disabled = false;
				say('#syStRecv', 'Falha: ' + e.message);
			});
	}

	const AURORA_URL_TTL = 600000;
	function gerarAuroraUrl() {
		const pd = snapshotAtivo();
		const buf = pack(pd);
		const url = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
		setTimeout(function () {
			try {
				URL.revokeObjectURL(url);
			} catch (e) {
				ignorarErro(e, 'gerarAuroraUrl');
			}
		}, AURORA_URL_TTL);
		return {
			url: url,
			bytes: buf.byteLength,
			nome: (pd.name || 'projeto').replace(/[^\w.-]+/g, '_') + '.aurora',
		};
	}
	function exportar() {
		try {
			const g = gerarAuroraUrl();
			const a = document.createElement('a');
			a.href = g.url;
			a.download = g.nome;
			a.rel = 'noopener';
			document.body.appendChild(a);
			a.click();
			a.remove();
			say(
				'#syStSend',
				`Arquivo salvo (${fmt(g.bytes)}). Envie por WhatsApp, AirDrop ou e-mail e abra com "Abrir .aurora".`,
			);
		} catch (e) {
			say('#syStSend', 'Erro: ' + e.message);
		}
	}
	function copiarTextoLegado(txt) {
		try {
			const ta = document.createElement('textarea');
			ta.value = txt;
			ta.setAttribute('readonly', '');
			ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
			document.body.appendChild(ta);
			ta.focus();
			ta.select();
			ta.setSelectionRange(0, txt.length);
			let ok = false;
			try {
				ok = document.execCommand('copy');
			} catch (e) {
				ignorarErro(e, 'copiarTextoLegado');
			}
			ta.remove();
			return !!ok;
		} catch (e) {
			return false;
		}
	}
	function copiarTexto(txt) {
		if (navigator.clipboard && window.isSecureContext) {
			return navigator.clipboard.writeText(txt).then(
				function () {
					return true;
				},
				function () {
					return copiarTextoLegado(txt);
				},
			);
		}
		return Promise.resolve(copiarTextoLegado(txt));
	}
	function copiarLinkAurora() {
		try {
			const g = gerarAuroraUrl();
			copiarTexto(g.url).then(function (ok) {
				if (ok) {
					say(
						'#syStSend',
						`Link de download de <b>${g.nome}</b> (${fmt(g.bytes)}) copiado. Cole neste mesmo navegador para baixar — vale por 10 minutos com esta aba aberta.`,
					);
					beep('Link copiado', 'Link do arquivo .aurora na area de transferencia', 'ok');
				} else {
					say(
						'#syStSend',
						`Nao consegui copiar automaticamente. Selecione e copie: <b>${g.url}</b>`,
					);
				}
			});
		} catch (e) {
			say('#syStSend', 'Erro: ' + e.message);
		}
	}
	function importar(f) {
		const r = new FileReader();
		r.onload = function () {
			try {
				abrirPacote(unpack(r.result), f.name.replace(/\.aurora$/i, ''));
				say('#syStRecv', 'Projeto aberto a partir do arquivo.');
				beep('Aberto', 'Projeto restaurado do arquivo .aurora', 'ok');
				setTimeout(fechar, 900);
			} catch (e) {
				say('#syStRecv', 'Falha ao abrir: ' + e.message);
			}
		};
		r.onerror = function () {
			say('#syStRecv', 'Nao foi possivel ler o arquivo.');
		};
		r.readAsArrayBuffer(f);
	}

	function abrir() {
		q('#syncBack').classList.add('on');
		q('#syncModal').classList.add('on');
		setTimeout(function () {
			const i = q('#syPaneSend').classList.contains('on') ? q('#syCodeHost') : q('#syCodeGuest');
			if (i) i.focus();
		}, 60);
	}
	function fechar() {
		q('#syncBack').classList.remove('on');
		q('#syncModal').classList.remove('on');
	}
	function gerar() {
		let A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
			s = '';
		const r = new Uint32Array(9);
		(window.crypto || window.msCrypto).getRandomValues(r);
		for (let i = 0; i < 9; i++) s += A[r[i] % A.length];
		q('#syCodeHost').value = s;
		say(
			'#syStSend',
			`Codigo gerado. Clique em Publicar e passe <b>${s}</b> para o outro aparelho.`,
		);
	}

	function init() {
		const btn = document.getElementById('syncBtn');
		if (btn) btn.addEventListener('click', abrir);
		q('#syncClose').addEventListener('click', fechar);
		q('#syncBack').addEventListener('click', fechar);
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && q('#syncModal').classList.contains('on')) fechar();
		});
		Array.prototype.forEach.call(document.querySelectorAll('.sy-tab'), function (t) {
			t.addEventListener('click', function () {
				Array.prototype.forEach.call(document.querySelectorAll('.sy-tab'), function (x) {
					x.classList.remove('on');
				});
				t.classList.add('on');
				q('#syPaneSend').classList.toggle('on', t.dataset.pane === 'send');
				q('#syPaneRecv').classList.toggle('on', t.dataset.pane === 'recv');
			});
		});
		q('#syGen').addEventListener('click', gerar);
		q('#syPub').addEventListener('click', publicar);
		q('#syStop').addEventListener('click', function () {
			parar(false);
		});
		q('#syGet').addEventListener('click', baixar);
		q('#syExport').addEventListener('click', exportar);
		q('#syCopyLink').addEventListener('click', copiarLinkAurora);
		q('#syImport').addEventListener('click', function () {
			q('#syFile').click();
		});
		q('#syFile').addEventListener('change', function (e) {
			if (e.target.files && e.target.files[0]) importar(e.target.files[0]);
			e.target.value = '';
		});
		q('#syCodeHost').addEventListener('keydown', function (e) {
			if (e.key === 'Enter') publicar();
		});
		q('#syCodeGuest').addEventListener('keydown', function (e) {
			if (e.key === 'Enter') baixar();
		});
		window.addEventListener('beforeunload', function () {
			try {
				if (SY.peer) SY.peer.destroy();
			} catch (e) {
				ignorarErro(e, 'init');
			}
		});
		window.AuroraSync = {
			abrir: abrir,
			publicar: publicar,
			baixar: baixar,
			exportar: exportar,
			copiarLink: copiarLinkAurora,
			pack: pack,
			unpack: unpack,
		};
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
