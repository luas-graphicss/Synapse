'use strict';
(function installZipStreamReader(root) {
	if (root.SynapseZipStream) return;

	const SIGNATURE_END = 0x06054b50;
	const SIGNATURE_ZIP64_LOCATOR = 0x07064b50;
	const SIGNATURE_ZIP64_END = 0x06064b50;
	const SIGNATURE_CENTRAL = 0x02014b50;
	const TAIL_BYTES = 22 + 65535 + 20;
	const DEFAULT_CONCURRENCY = 4;
	let workerUrl = '';
	let workerUnavailable = false;

	function zipGuard() {
		if (!root.SynapseZipGuard) throw new Error('ZIP: verificador de seguranca indisponivel.');
		return root.SynapseZipGuard;
	}

	function readUint64(view, offset) {
		return view.getUint32(offset, true) + view.getUint32(offset + 4, true) * 4294967296;
	}

	async function readRange(blob, start, end) {
		return new Uint8Array(await blob.slice(start, end).arrayBuffer());
	}

	function decodeName(bytes) {
		if (root.Core && typeof root.Core.utf8Decode === 'function') return root.Core.utf8Decode(bytes);
		return new TextDecoder('utf-8').decode(bytes);
	}

	function isTextName(name) {
		try {
			return !!(root.Core && root.Core.isTextFile(name));
		} catch {
			return false;
		}
	}

	function findEndRecord(view, length) {
		for (let index = length - 22; index >= 0; index--) {
			if (view.getUint32(index, true) !== SIGNATURE_END) continue;
			if (index + 22 + view.getUint16(index + 20, true) <= length) return index;
		}
		return -1;
	}

	function readZip64Extra(view, start, length, wanted) {
		const found = {};
		const end = start + length;
		let cursor = start;
		while (cursor + 4 <= end) {
			const id = view.getUint16(cursor, true);
			const size = view.getUint16(cursor + 2, true);
			if (id === 1) {
				let field = cursor + 4;
				for (const key of wanted) {
					if (field + 8 > cursor + 4 + size) break;
					found[key] = readUint64(view, field);
					field += 8;
				}
				break;
			}
			cursor += 4 + size;
		}
		return found;
	}

	function parseDirectory(directory, count, shift) {
		const view = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);
		const entries = [];
		let offset = 0;
		for (let index = 0; index < count && offset + 46 <= directory.length; index++) {
			if (view.getUint32(offset, true) !== SIGNATURE_CENTRAL) break;
			const flags = view.getUint16(offset + 8, true);
			const nameLength = view.getUint16(offset + 28, true);
			const extraLength = view.getUint16(offset + 30, true);
			const commentLength = view.getUint16(offset + 32, true);
			const extraStart = offset + 46 + nameLength;
			const entry = {
				name: decodeName(directory.subarray(offset + 46, extraStart)),
				method: view.getUint16(offset + 10, true),
				compSize: view.getUint32(offset + 20, true),
				size: view.getUint32(offset + 24, true),
				localOff: view.getUint32(offset + 42, true),
				encrypted: (flags & 1) === 1,
			};
			const wanted = [];
			if (entry.size === 0xffffffff) wanted.push('size');
			if (entry.compSize === 0xffffffff) wanted.push('compSize');
			if (entry.localOff === 0xffffffff) wanted.push('localOff');
			if (wanted.length) Object.assign(entry, readZip64Extra(view, extraStart, extraLength, wanted));
			entry.localOff += shift;
			entries.push(entry);
			offset = extraStart + extraLength + commentLength;
		}
		return entries;
	}

	async function readDirectory(blob) {
		const size = blob.size;
		const tailStart = Math.max(0, size - TAIL_BYTES);
		const tail = await readRange(blob, tailStart, size);
		const tailView = new DataView(tail.buffer);
		const endIndex = findEndRecord(tailView, tail.length);
		if (endIndex < 0) throw new Error('ZIP inválido: EOCD não encontrado');
		let count = tailView.getUint16(endIndex + 10, true);
		let directorySize = tailView.getUint32(endIndex + 12, true);
		let directoryOffset = tailView.getUint32(endIndex + 16, true);
		let directoryEnd = tailStart + endIndex;
		const locator = endIndex - 20;
		const wantsZip64 =
			count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff;
		if (wantsZip64 && locator >= 0 && tailView.getUint32(locator, true) === SIGNATURE_ZIP64_LOCATOR) {
			const recordOffset = readUint64(tailView, locator + 8);
			const record = await readRange(blob, recordOffset, recordOffset + 56);
			const recordView = new DataView(record.buffer);
			if (record.length < 56 || recordView.getUint32(0, true) !== SIGNATURE_ZIP64_END)
				throw new Error('ZIP64 inválido: registro final ausente');
			count = readUint64(recordView, 32);
			directorySize = readUint64(recordView, 40);
			directoryOffset = readUint64(recordView, 48);
			directoryEnd = recordOffset;
		}
		const guard = zipGuard();
		if (count > guard.maximumEntries)
			throw new Error(`ZIP: arquivo com ${count} entradas acima do limite de ${guard.maximumEntries}.`);
		const shift = Math.max(0, directoryEnd - (directoryOffset + directorySize));
		const start = directoryOffset + shift;
		if (start + directorySize > size) throw new Error('ZIP inválido: diretório central fora do arquivo');
		const directory = await readRange(blob, start, start + directorySize);
		return { entries: parseDirectory(directory, count, shift), directoryStart: start };
	}

	function nextOffsetAfter(offsets, value, fallback) {
		let low = 0;
		let high = offsets.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (offsets[middle] <= value) low = middle + 1;
			else high = middle;
		}
		return low < offsets.length ? offsets[low] : fallback;
	}

	function planJobs(directory) {
		const guard = zipGuard();
		const offsets = [...new Set(directory.entries.map((entry) => entry.localOff))].sort((a, b) => a - b);
		const skipped = [];
		const jobs = [];
		for (const entry of guard.safeEntries(directory.entries)) {
			if (entry.name.endsWith('/')) continue;
			if (entry.encrypted)
				throw new Error(`ZIP: "${entry.name}" está protegido por senha, e isso não é suportado.`);
			if (entry.method !== 0 && entry.method !== 8)
				throw new Error(`ZIP: método ${entry.method} não suportado (${entry.name})`);
			const limit = guard.limitFor(entry.name);
			if (entry.size > limit) {
				skipped.push({ name: entry.name, size: entry.size, limit });
				continue;
			}
			guard.checkDeclaredSize(entry);
			jobs.push({
				index: jobs.length,
				name: entry.name,
				method: entry.method,
				compSize: entry.compSize,
				size: entry.size,
				localOff: entry.localOff,
				end: nextOffsetAfter(offsets, entry.localOff, directory.directoryStart),
				limit,
				textHint: isTextName(entry.name),
			});
		}
		return { jobs: jobs.slice().sort((a, b) => a.localOff - b.localOff), skipped, total: jobs.length };
	}

	function createInflater() {
		const LOCAL_SIGNATURE = 0x04034b50;
		const SPAN_BYTES = 8 * 1024 * 1024;
		const BATCH_ITEMS = 32;
		const BATCH_BYTES = 8 * 1024 * 1024;
		const SAMPLE_BYTES = 4096;

		function tryDecode(label, bytes, fatal) {
			try {
				return new TextDecoder(label, { fatal }).decode(bytes);
			} catch {
				return null;
			}
		}

		function decodeText(bytes) {
			const strict = tryDecode('utf-8', bytes, true);
			if (strict !== null) return strict;
			const legacy = tryDecode('windows-1252', bytes, false);
			return legacy !== null ? legacy : new TextDecoder('utf-8').decode(bytes);
		}

		function looksLikeText(bytes) {
			const length = bytes.length;
			if (!length) return false;
			const sampleLength = Math.min(length, SAMPLE_BYTES);
			let control = 0;
			for (let index = 0; index < sampleLength; index++) {
				const value = bytes[index];
				if (value === 0) return false;
				if (value < 9 || (value > 13 && value < 32 && value !== 27)) control++;
			}
			if (control / sampleLength > 0.05) return false;
			const sample = decodeText(bytes.subarray(0, sampleLength));
			if (!sample) return false;
			let replacement = 0;
			for (let index = 0; index < sample.length; index++)
				if (sample.charCodeAt(index) === 0xfffd) replacement++;
			return replacement / Math.max(1, sample.length) <= 0.02;
		}

		function describe(job, bytes) {
			const base = { index: job.index, name: job.name, bytes: bytes.length, decoded: true };
			if (!job.textHint && !looksLikeText(bytes))
				return Object.assign(base, { isText: false, text: null, data: bytes });
			const text = decodeText(bytes);
			return Object.assign(base, {
				isText: true,
				text,
				data: text.indexOf('\uFFFD') !== -1 ? bytes : null,
			});
		}

		function exactBytes(parts, total) {
			if (parts.length === 1 && parts[0].byteOffset === 0 && parts[0].byteLength === parts[0].buffer.byteLength)
				return parts[0];
			const out = new Uint8Array(total);
			let offset = 0;
			for (const part of parts) {
				out.set(part, offset);
				offset += part.length;
			}
			return out;
		}

		async function collect(stream, job) {
			const reader = stream.getReader();
			const parts = [];
			let total = 0;
			for (;;) {
				const step = await reader.read();
				if (step.done) break;
				total += step.value.length;
				if (total > job.limit) {
					await reader.cancel();
					throw new Error(`ZIP: "${job.name}" passou do limite permitido ao descompactar.`);
				}
				parts.push(step.value);
			}
			return exactBytes(parts, total);
		}

		function inflate(stream, job) {
			return collect(stream.pipeThrough(new DecompressionStream('deflate-raw')), job);
		}

		function dataOffset(buffer, offset, job) {
			if (offset + 30 > buffer.length) throw new Error(`ZIP: cabeçalho local truncado (${job.name})`);
			const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 30);
			if (view.getUint32(0, true) !== LOCAL_SIGNATURE)
				throw new Error(`ZIP: cabeçalho local inválido (${job.name})`);
			return offset + 30 + view.getUint16(26, true) + view.getUint16(28, true);
		}

		function checkBounds(dataEnd, limitEnd, job) {
			if (dataEnd > limitEnd) throw new Error(`ZIP: dados sobrepostos ou truncados em "${job.name}"`);
		}

		async function inflateLarge(blob, job) {
			const header = new Uint8Array(await blob.slice(job.localOff, job.localOff + 30).arrayBuffer());
			const view = new DataView(header.buffer);
			if (header.length < 30 || view.getUint32(0, true) !== LOCAL_SIGNATURE)
				throw new Error(`ZIP: cabeçalho local inválido (${job.name})`);
			const start = job.localOff + 30 + view.getUint16(26, true) + view.getUint16(28, true);
			checkBounds(start + job.compSize, job.end, job);
			const slice = blob.slice(start, start + job.compSize);
			if (job.method === 0) {
				if (job.compSize > job.limit) throw new Error(`ZIP: "${job.name}" passou do limite permitido.`);
				return new Uint8Array(await slice.arrayBuffer());
			}
			return inflate(slice.stream(), job);
		}

		async function inflateSpan(blob, span, deliver) {
			const first = span[0].localOff;
			const buffer = new Uint8Array(await blob.slice(first, span[span.length - 1].end).arrayBuffer());
			for (const job of span) {
				const start = dataOffset(buffer, job.localOff - first, job);
				const end = start + job.compSize;
				checkBounds(end, job.end - first, job);
				const compressed = buffer.subarray(start, end);
				const bytes =
					job.method === 0 ? compressed.slice() : await inflate(new Blob([compressed]).stream(), job);
				deliver(job, bytes);
			}
		}

		function buildTasks(jobs) {
			const tasks = [];
			let span = [];
			let spanBytes = 0;
			const closeSpan = () => {
				if (span.length) tasks.push({ span });
				span = [];
				spanBytes = 0;
			};
			for (const job of jobs) {
				const length = job.end - job.localOff;
				if (length > SPAN_BYTES) {
					closeSpan();
					tasks.push({ job });
					continue;
				}
				const contiguous = span.length && span[span.length - 1].end === job.localOff;
				if (span.length && (!contiguous || spanBytes + length > SPAN_BYTES)) closeSpan();
				span.push(job);
				spanBytes += length;
			}
			closeSpan();
			return tasks;
		}

		async function run(blob, jobs, concurrency, emit) {
			const tasks = buildTasks(jobs);
			let batch = [];
			let batchBytes = 0;
			let transfer = [];
			const flush = () => {
				if (!batch.length) return;
				const items = batch;
				const buffers = transfer;
				batch = [];
				transfer = [];
				batchBytes = 0;
				emit(items, buffers);
			};
			const deliver = (job, bytes) => {
				const item = describe(job, bytes);
				batch.push(item);
				if (item.data) transfer.push(item.data.buffer);
				batchBytes += item.bytes;
				if (batch.length >= BATCH_ITEMS || batchBytes >= BATCH_BYTES) flush();
			};
			let cursor = 0;
			const lane = async () => {
				while (cursor < tasks.length) {
					const task = tasks[cursor++];
					if (task.job) deliver(task.job, await inflateLarge(blob, task.job));
					else await inflateSpan(blob, task.span, deliver);
				}
			};
			await Promise.all(Array.from({ length: Math.max(1, concurrency) }, lane));
			flush();
		}

		return { run };
	}

	function workerBootstrap(factory) {
		const inflater = factory();
		self.onmessage = async (event) => {
			const message = event.data || {};
			if (message.type !== 'start') return;
			if (typeof DecompressionStream === 'undefined' || typeof TextDecoder === 'undefined') {
				self.postMessage({ type: 'error', environment: true, message: 'Worker sem DecompressionStream.' });
				return;
			}
			try {
				await inflater.run(message.blob, message.jobs, message.concurrency, (items, buffers) =>
					self.postMessage({ type: 'items', items }, buffers),
				);
				self.postMessage({ type: 'done' });
			} catch (error) {
				self.postMessage({ type: 'error', message: String((error && error.message) || error) });
			}
		};
	}

	function createWorkerUrl() {
		if (!workerUrl) {
			const source = `(${workerBootstrap.toString()})(${createInflater.toString()});`;
			workerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
		}
		return workerUrl;
	}

	function environmentError(message) {
		return Object.assign(new Error(message), { environment: true });
	}

	function runInWorker(blob, jobs, concurrency, onItems) {
		return new Promise((resolve, reject) => {
			let worker;
			let received = false;
			let settled = false;
			try {
				worker = new Worker(createWorkerUrl());
			} catch (error) {
				reject(environmentError(String((error && error.message) || error)));
				return;
			}
			const finish = (error) => {
				if (settled) return;
				settled = true;
				worker.terminate();
				if (error) reject(error);
				else resolve();
			};
			worker.onmessage = (event) => {
				const message = event.data || {};
				if (message.type === 'items') {
					received = true;
					try {
						onItems(message.items);
					} catch (error) {
						finish(error);
					}
				} else if (message.type === 'done') finish(null);
				else if (message.type === 'error')
					finish(
						message.environment && !received
							? environmentError(message.message)
							: new Error(message.message),
					);
			};
			worker.onerror = (event) => {
				if (event && typeof event.preventDefault === 'function') event.preventDefault();
				const message = 'O worker de descompactação falhou.';
				finish(received ? new Error(message) : environmentError(message));
			};
			worker.postMessage({ type: 'start', blob, jobs, concurrency });
		});
	}

	async function read(blob, options) {
		const settings = options || {};
		const guard = zipGuard();
		guard.checkArchiveSize(blob.size);
		const plan = planJobs(await readDirectory(blob));
		const results = new Array(plan.total);
		const budget = guard.createExpansionBudget();
		const concurrency = Math.max(1, Math.min(8, settings.concurrency || DEFAULT_CONCURRENCY));
		let done = 0;
		let bytes = 0;
		const onItems = (items) => {
			for (const item of items) {
				budget.add(item.name, item.bytes);
				results[item.index] = item;
				done++;
				bytes += item.bytes;
			}
			if (typeof settings.onProgress === 'function')
				settings.onProgress({ done, total: plan.total, bytes });
		};
		let finished = false;
		if (!workerUnavailable && typeof Worker === 'function' && typeof URL.createObjectURL === 'function') {
			try {
				await runInWorker(blob, plan.jobs, concurrency, onItems);
				finished = true;
			} catch (error) {
				if (!error || !error.environment) throw error;
				workerUnavailable = true;
			}
		}
		if (!finished) {
			if (typeof DecompressionStream === 'undefined')
				throw new Error(
					'Seu navegador não suporta DecompressionStream para descompactar .zip. Use Chrome/Edge/Firefox recentes.',
				);
			await createInflater().run(blob, plan.jobs, concurrency, (items) => onItems(items));
		}
		return { entries: results.filter(Boolean), skipped: plan.skipped };
	}

	root.SynapseZipStream = Object.freeze({ read, inspect: readDirectory });
})(window);
