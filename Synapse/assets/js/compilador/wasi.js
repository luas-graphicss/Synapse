(function (raiz, fabrica) {
	'use strict';
	const api = fabrica();
	if (typeof module === 'object' && module && module.exports) module.exports = api;
	else raiz.SYNAPSE_WASI = api;
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	const ENC = new TextEncoder();

	const OK = 0;
	const EBADF = 8;
	const EINVAL = 28;
	const ENOSYS = 52;
	const ESPIPE = 70;

	function Saida(codigo) {
		this.codigo = codigo;
		this.wasiSaida = true;
	}

	function Tempo(ms) {
		this.ms = ms;
		this.wasiTempo = true;
	}

	function criar(opcoes) {
		const o = opcoes || {};
		const args = o.args || ['programa'];
		const env = o.env || {};
		const aoSair = typeof o.aoSair === 'function' ? o.aoSair : null;
		const limiteMs = typeof o.limiteMs === 'number' && o.limiteMs > 0 ? o.limiteMs : 0;

		const entrada = ENC.encode(typeof o.stdin === 'string' ? o.stdin : '');
		let posEntrada = 0;

		const decodificadores = { 1: new TextDecoder('utf-8'), 2: new TextDecoder('utf-8') };

		const pendente = { 1: '', 2: '' };

		let inst = null;
		let memoriaRef = null;
		let inicio = 0;
		let estourou = false;

		function mem() {
			if (memoriaRef) return memoriaRef;
			if (inst && inst.exports && inst.exports.memory) return inst.exports.memory;
			return null;
		}
		function dv() {
			const m = mem();
			if (!m) throw new Error('wasm sem memoria exportada');
			return new DataView(m.buffer);
		}
		function u8() {
			const m = mem();
			if (!m) throw new Error('wasm sem memoria exportada');
			return new Uint8Array(m.buffer);
		}

		function emitir(fd, texto) {
			const alvo = fd === 2 ? o.stderr : o.stdout;
			if (typeof alvo === 'function') alvo(texto);
		}

		function checarTempo() {
			if (!limiteMs || !inicio) return;
			if (Date.now() - inicio > limiteMs) {
				estourou = true;
				throw new Tempo(limiteMs);
			}
		}

		function escreverBytes(fd, bytes) {
			if (fd !== 1 && fd !== 2) return;
			let texto;
			try {
				texto = decodificadores[fd].decode(bytes, { stream: true });
			} catch (e) {
				texto = new TextDecoder('utf-8').decode(bytes);
			}
			if (!texto) return;

			let buf = pendente[fd] + texto;
			const corte = buf.lastIndexOf('\n');
			if (corte >= 0) {
				emitir(fd, buf.slice(0, corte + 1));
				buf = buf.slice(corte + 1);
			}
			pendente[fd] = buf;
			if (pendente[fd].length > 8192) {
				emitir(fd, pendente[fd]);
				pendente[fd] = '';
			}
		}

		function descarregar() {
			for (let fd = 1; fd <= 2; fd++) {
				let resto = '';
				try {
					resto = decodificadores[fd].decode();
				} catch (e) {
					resto = '';
				}
				if (resto) pendente[fd] += resto;
				if (pendente[fd]) {
					emitir(fd, pendente[fd]);
					pendente[fd] = '';
				}
			}
		}

		function lerIovs(ptr, qtd) {
			const d = dv();
			const lista = [];
			for (let i = 0; i < qtd; i++) {
				const base = ptr + i * 8;
				lista.push({ ptr: d.getUint32(base, true), len: d.getUint32(base + 4, true) });
			}
			return lista;
		}

		function fd_write(fd, iovsPtr, iovsQtd, escritosPtr) {
			try {
				if (fd !== 1 && fd !== 2) return EBADF;
				checarTempo();
				const iovs = lerIovs(iovsPtr, iovsQtd);
				const bytes = u8();
				const limite = bytes.length;
				let total = 0;
				let i;

				for (i = 0; i < iovs.length; i++) total += iovs[i].len;
				const junto = new Uint8Array(total);
				let pos = 0;
				for (i = 0; i < iovs.length; i++) {
					const it = iovs[i];
					if (!it.len) continue;
					const fim = Math.min(limite, it.ptr + it.len);
					if (it.ptr < limite) junto.set(bytes.subarray(it.ptr, fim), pos);
					pos += it.len;
				}
				if (total) escreverBytes(fd, junto);
				dv().setUint32(escritosPtr, total, true);
				return OK;
			} catch (e) {
				if (e && (e.wasiSaida || e.wasiTempo)) throw e;
				return EINVAL;
			}
		}

		function fd_read(fd, iovsPtr, iovsQtd, lidosPtr) {
			try {
				if (fd !== 0) return EBADF;
				checarTempo();
				const iovs = lerIovs(iovsPtr, iovsQtd);
				const bytes = u8();
				let total = 0;
				for (let i = 0; i < iovs.length; i++) {
					const it = iovs[i];
					if (!it.len) continue;
					const resta = entrada.length - posEntrada;
					if (resta <= 0) break;
					const n = Math.min(resta, it.len);
					bytes.set(entrada.subarray(posEntrada, posEntrada + n), it.ptr);
					posEntrada += n;
					total += n;
					if (n < it.len) break;
				}
				dv().setUint32(lidosPtr, total, true);
				return OK;
			} catch (e) {
				if (e && (e.wasiSaida || e.wasiTempo)) throw e;
				return EINVAL;
			}
		}

		function args_sizes_get(qtdPtr, tamPtr) {
			let bytes = 0;
			for (let i = 0; i < args.length; i++) bytes += ENC.encode(args[i]).length + 1;
			const d = dv();
			d.setUint32(qtdPtr, args.length, true);
			d.setUint32(tamPtr, bytes, true);
			return OK;
		}

		function args_get(ponteirosPtr, dadosPtr) {
			const d = dv();
			const bytes = u8();
			let cursor = dadosPtr;
			for (let i = 0; i < args.length; i++) {
				d.setUint32(ponteirosPtr + i * 4, cursor, true);
				const b = ENC.encode(args[i]);
				bytes.set(b, cursor);
				cursor += b.length;
				bytes[cursor] = 0;
				cursor += 1;
			}
			return OK;
		}

		function chavesEnv() {
			const lista = [];
			for (let k in env)
				if (Object.prototype.hasOwnProperty.call(env, k)) lista.push(k + '=' + env[k]);
			return lista;
		}

		function environ_sizes_get(qtdPtr, tamPtr) {
			const lista = chavesEnv();
			let bytes = 0;
			for (let i = 0; i < lista.length; i++) bytes += ENC.encode(lista[i]).length + 1;
			const d = dv();
			d.setUint32(qtdPtr, lista.length, true);
			d.setUint32(tamPtr, bytes, true);
			return OK;
		}

		function environ_get(ponteirosPtr, dadosPtr) {
			const lista = chavesEnv();
			const d = dv();
			const bytes = u8();
			let cursor = dadosPtr;
			for (let i = 0; i < lista.length; i++) {
				d.setUint32(ponteirosPtr + i * 4, cursor, true);
				const b = ENC.encode(lista[i]);
				bytes.set(b, cursor);
				cursor += b.length;
				bytes[cursor] = 0;
				cursor += 1;
			}
			return OK;
		}

		function agoraNs(id) {
			if (id === 0) return BigInt(Date.now()) * 1000000n;
			if (typeof performance !== 'undefined' && performance.now) {
				const us = Math.round(performance.now() * 1000);
				return BigInt(us) * 1000n;
			}
			return BigInt(Date.now()) * 1000000n;
		}

		function clock_time_get(id, precisao, saidaPtr) {
			try {
				dv().setBigUint64(saidaPtr, agoraNs(id | 0), true);
				return OK;
			} catch (e) {
				return EINVAL;
			}
		}

		function clock_res_get(id, saidaPtr) {
			dv().setBigUint64(saidaPtr, 1000n, true);
			return OK;
		}

		function random_get(ptr, tam) {
			const alvo = u8().subarray(ptr, ptr + tam);
			const c = typeof crypto !== 'undefined' ? crypto : null;
			if (c && c.getRandomValues) {
				for (let off = 0; off < tam; off += 65536) {
					c.getRandomValues(alvo.subarray(off, Math.min(tam, off + 65536)));
				}
			} else {
				for (let i = 0; i < tam; i++) alvo[i] = (Math.random() * 256) | 0;
			}
			return OK;
		}

		function fd_fdstat_get(fd, saidaPtr) {
			if (fd < 0 || fd > 2) return EBADF;
			const d = dv();
			d.setUint8(saidaPtr, 2);
			d.setUint8(saidaPtr + 1, 0);
			d.setUint16(saidaPtr + 2, 0, true);
			d.setBigUint64(saidaPtr + 8, 0xffffffffffffffffn, true);
			d.setBigUint64(saidaPtr + 16, 0xffffffffffffffffn, true);
			return OK;
		}

		function fd_seek(fd) {
			if (fd >= 0 && fd <= 2) return ESPIPE;
			return EBADF;
		}

		function poll_oneoff(subsPtr, eventosPtr, qtd, qtdSaidaPtr) {
			try {
				checarTempo();
				const d = dv();
				let n = 0;
				for (let i = 0; i < qtd; i++) {
					const sub = subsPtr + i * 48;
					const evt = eventosPtr + n * 32;
					const userdata = d.getBigUint64(sub, true);
					const tag = d.getUint8(sub + 8);

					d.setBigUint64(evt, userdata, true);
					d.setUint16(evt + 8, OK, true);
					d.setUint8(evt + 10, tag);
					d.setUint8(evt + 11, 0);

					if (tag === 1 || tag === 2) {
						const disp = tag === 1 ? Math.max(0, entrada.length - posEntrada) : 8192;
						d.setBigUint64(evt + 16, BigInt(disp), true);
						d.setUint16(evt + 24, 0, true);
					} else {
						d.setBigUint64(evt + 16, 0n, true);
						d.setUint16(evt + 24, 0, true);
					}
					n++;
				}
				d.setUint32(qtdSaidaPtr, n, true);
				return OK;
			} catch (e) {
				if (e && (e.wasiSaida || e.wasiTempo)) throw e;
				return EINVAL;
			}
		}

		function proc_exit(codigo) {
			throw new Saida(codigo | 0);
		}

		function sched_yield() {
			try {
				checarTempo();
			} catch (e) {
				throw e;
			}
			return OK;
		}

		function naoSuportado() {
			return ENOSYS;
		}
		function semArquivos() {
			return EBADF;
		}

		const wasiImport = {
			fd_write: fd_write,
			fd_read: fd_read,
			fd_close: function () {
				return OK;
			},
			fd_seek: fd_seek,
			fd_fdstat_get: fd_fdstat_get,
			fd_fdstat_set_flags: function () {
				return OK;
			},
			fd_fdstat_set_rights: function () {
				return OK;
			},
			fd_prestat_get: semArquivos,
			fd_prestat_dir_name: semArquivos,
			fd_filestat_get: naoSuportado,
			fd_filestat_set_size: naoSuportado,
			fd_filestat_set_times: naoSuportado,
			fd_readdir: naoSuportado,
			fd_sync: function () {
				return OK;
			},
			fd_tell: naoSuportado,
			fd_pread: naoSuportado,
			fd_pwrite: naoSuportado,
			fd_renumber: naoSuportado,
			fd_advise: function () {
				return OK;
			},
			fd_allocate: naoSuportado,
			fd_datasync: function () {
				return OK;
			},
			path_open: naoSuportado,
			path_filestat_get: naoSuportado,
			path_create_directory: naoSuportado,
			path_remove_directory: naoSuportado,
			path_unlink_file: naoSuportado,
			path_rename: naoSuportado,
			path_readlink: naoSuportado,
			path_symlink: naoSuportado,
			path_link: naoSuportado,
			path_filestat_set_times: naoSuportado,
			args_sizes_get: args_sizes_get,
			args_get: args_get,
			environ_sizes_get: environ_sizes_get,
			environ_get: environ_get,
			clock_time_get: clock_time_get,
			clock_res_get: clock_res_get,
			random_get: random_get,
			proc_exit: proc_exit,
			proc_raise: naoSuportado,
			sched_yield: sched_yield,
			poll_oneoff: poll_oneoff,
			sock_accept: naoSuportado,
			sock_recv: naoSuportado,
			sock_send: naoSuportado,
			sock_shutdown: naoSuportado,
		};

		const imports = {
			wasi_snapshot_preview1: wasiImport,
			wasi_unstable: wasiImport,
		};

		return {
			imports: imports,
			wasiImport: wasiImport,

			vincular: function (instancia, memoriaExterna) {
				inst = instancia;
				if (memoriaExterna) memoriaRef = memoriaExterna;
				return this;
			},

			rodar: function (instancia) {
				if (instancia) inst = instancia;
				if (!inst) throw new Error('nenhuma instancia wasm vinculada');
				const ex = inst.exports;
				let codigo = 0;
				inicio = Date.now();
				estourou = false;
				try {
					if (typeof ex._initialize === 'function') ex._initialize();
					if (typeof ex._start === 'function') ex._start();
					else if (typeof ex.main === 'function') codigo = ex.main(0, 0) | 0;
					else throw new Error('wasm sem _start nem main');
				} catch (e) {
					if (e && e.wasiSaida) codigo = e.codigo;
					else if (e && e.wasiTempo) {
						descarregar();
						const err = new Error(`O programa passou de ${e.ms}ms e foi interrompido`);
						err.tempoEsgotado = true;
						err.wasiTempo = true;
						err.ms = e.ms;
						if (aoSair) aoSair(null);
						throw err;
					} else {
						descarregar();
						throw e;
					}
				}
				descarregar();
				if (aoSair) aoSair(codigo);
				return codigo;
			},

			get tempoEsgotado() {
				return estourou;
			},

			descarregar: descarregar,
		};
	}

	return { criar: criar, Saida: Saida, Tempo: Tempo };
});
