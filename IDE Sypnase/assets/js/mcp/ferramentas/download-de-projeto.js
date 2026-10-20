(function registerProjectDownload(root) {
	'use strict';

	if (typeof MCP_TOOLS === 'undefined' || MCP_TOOLS.some((tool) => tool.name === 'download_project'))
		return;

	const MEGABYTE = 1048576;
	const CHUNK_UNIT = 196608;
	const DEFAULT_CHUNK_MB = 2;
	const MAX_CHUNK_UNITS = 16;
	const DEFAULT_WAIT_MS = 15000;
	const MAX_WAIT_MS = 18000;
	const IDLE_TTL_MS = 600000;
	const MAX_BUNDLES = 3;
	const MAX_ENTRIES = 65535;
	const MAX_ZIP_BYTES = 4294967295;
	const MAX_INFLIGHT_BYTES = 96 * MEGABYTE;
	const SAMPLE_BYTES = 131072;
	const INCOMPRESSIBLE = new Set([
		'png',
		'jpg',
		'jpeg',
		'jfif',
		'gif',
		'webp',
		'avif',
		'heic',
		'heif',
		'mp4',
		'm4v',
		'mov',
		'webm',
		'mkv',
		'avi',
		'mp3',
		'm4a',
		'aac',
		'ogg',
		'oga',
		'opus',
		'flac',
		'zip',
		'gz',
		'tgz',
		'bz2',
		'xz',
		'7z',
		'rar',
		'br',
		'zst',
		'lz4',
		'sx',
		'jar',
		'apk',
		'aab',
		'ipa',
		'docx',
		'xlsx',
		'pptx',
		'odt',
		'ods',
		'odp',
		'woff',
		'woff2',
		'ktx2',
		'basis',
		'drc',
		'splat',
		'spz',
	]);
	const PYTHON_DOWNLOADER = String.raw`import argparse
import base64
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait

DEFAULTS = json.loads(__DEFAULTS_JSON__)

parser = argparse.ArgumentParser(description="Baixa um projeto aberto no Synapse para esta maquina.")
parser.add_argument("--url", default=DEFAULTS["url"])
parser.add_argument("--project", default=DEFAULTS["project"])
parser.add_argument("--out", default=DEFAULTS["out"])
parser.add_argument("--agent", default=DEFAULTS["agent"])
parser.add_argument("--parallel", type=int, default=6)
parser.add_argument("--chunk-mb", type=float, default=DEFAULTS["chunk_mb"])
parser.add_argument("--include", action="append", default=None)
parser.add_argument("--exclude", action="append", default=None)
parser.add_argument("--binaries", choices=["sim", "nao"], default="sim" if DEFAULTS["binaries"] else "nao")
parser.add_argument("--max-file-mb", type=float, default=DEFAULTS["max_file_mb"])
parser.add_argument("--keep-zip", action="store_true")
args = parser.parse_args()

if not args.url:
    raise SystemExit("Informe --url com a URL do MCP do Synapse.")

include = args.include if args.include is not None else DEFAULTS["include"]
exclude = args.exclude if args.exclude is not None else DEFAULTS["exclude"]


class ToolError(Exception):
    pass


counter = [0]
counter_lock = threading.Lock()


def rpc(arguments):
    with counter_lock:
        counter[0] += 1
        number = counter[0]
    body = dict(arguments)
    body["agent"] = args.agent
    body["project"] = args.project
    payload = {
        "jsonrpc": "2.0",
        "id": "dl-%d-%d" % (os.getpid(), number),
        "method": "tools/call",
        "params": {"name": "download_project", "arguments": body},
    }
    request = urllib.request.Request(
        args.url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
    )
    with urllib.request.urlopen(request, timeout=75) as response:
        raw = response.read().decode("utf-8").strip()
    if raw.startswith("event:") or raw.startswith("data:"):
        raw = [line[5:].strip() for line in raw.splitlines() if line.startswith("data:")][-1]
    message = json.loads(raw)
    if message.get("error"):
        raise RuntimeError(message["error"].get("message", "erro do relay"))
    result = message.get("result") or {}
    texts = [item.get("text", "") for item in result.get("content", []) if item.get("type") == "text"]
    if result.get("isError"):
        raise ToolError(texts[0] if texts else "erro da ferramenta")
    return texts


def call(arguments, attempts=10):
    delay = 0.8
    for attempt in range(attempts):
        try:
            return rpc(arguments)
        except ToolError:
            raise
        except urllib.error.HTTPError as error:
            if error.code in (400, 401, 403, 404, 405) or attempt + 1 == attempts:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, RuntimeError, ValueError):
            if attempt + 1 == attempts:
                raise
        time.sleep(delay)
        delay = min(delay * 1.6, 6.0)


def slug(name):
    return re.sub(r"[^A-Za-z0-9._-]+", "-", str(name)).strip("-.") or "projeto"


started = time.time()
request = {"action": "start", "chunk_mb": args.chunk_mb, "binaries": args.binaries == "sim"}
if include:
    request["include"] = include
if exclude:
    request["exclude"] = exclude
if args.max_file_mb:
    request["max_file_mb"] = args.max_file_mb
status = json.loads(call(request)[-1])
bundle = status["id"]
chunk_bytes = status["chunk_bytes"]
total = status.get("chunks")
target = os.path.abspath(args.out or slug(status["project"]))
archive_path = target + ".synapse.zip"
workers = max(1, args.parallel)
print(
    "Synapse: pacote %s com %d arquivo(s) e %.1f MB de origem; baixando com %d conexoes."
    % (bundle, status["files"], status["raw_bytes"] / 1048576.0, workers),
    flush=True,
)


def fetch(index):
    while True:
        texts = call({"action": "chunk", "id": bundle, "index": index})
        meta = json.loads(texts[-2])
        if meta.get("pending"):
            continue
        if meta.get("eof"):
            return index, None, meta
        data = base64.b64decode(texts[-1])
        if len(data) != meta["bytes"]:
            raise RuntimeError("chunk %d veio com %d bytes (esperado %d)" % (index, len(data), meta["bytes"]))
        return index, data, meta


expected = status["zip_bytes"] if status["state"] == "ready" else None
received = 0
next_index = 0
stop = False
with open(archive_path, "wb") as handle, ThreadPoolExecutor(max_workers=workers) as pool:
    running = set()
    while True:
        while not stop and len(running) != workers and (total is None or total > next_index):
            running.add(pool.submit(fetch, next_index))
            next_index += 1
        if not running:
            break
        done, running = wait(running, return_when=FIRST_COMPLETED)
        for future in done:
            index, data, meta = future.result()
            if meta.get("chunks"):
                total = meta["chunks"]
            if meta.get("state") == "ready" and meta.get("zip_bytes"):
                expected = meta["zip_bytes"]
            if data is None:
                stop = True
                continue
            handle.seek(index * chunk_bytes)
            handle.write(data)
            received += len(data)

if expected is None:
    expected = json.loads(call({"action": "status", "id": bundle, "wait_ms": 0})[-1])["zip_bytes"]
size = os.path.getsize(archive_path)
if size != expected:
    raise SystemExit("Download incompleto: %d de %d bytes. Rode de novo." % (size, expected))
os.makedirs(target, exist_ok=True)
with zipfile.ZipFile(archive_path) as archive:
    count = len(archive.infolist())
    archive.extractall(target)
try:
    call({"action": "release", "id": bundle}, attempts=2)
except Exception:
    pass
if not args.keep_zip:
    os.remove(archive_path)
elapsed = max(time.time() - started, 0.001)
print(
    "Synapse: %d entrada(s) extraidas em %s | %.1f MB transferidos em %.1fs (%.1f MB/s)"
    % (count, target, size / 1048576.0, elapsed, size / 1048576.0 / elapsed),
    flush=True,
)
`;
	const bundles = new Map();
	let sequence = 0;
	let encoderPool = null;

	function createCompressor() {
		const table = new Uint32Array(256);
		for (let value = 0; value < 256; value++) {
			let crc = value;
			for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
			table[value] = crc >>> 0;
		}

		function crc32(bytes) {
			let crc = 0xffffffff;
			for (let index = 0; index < bytes.length; index++)
				crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
			return (crc ^ 0xffffffff) >>> 0;
		}

		async function deflate(bytes) {
			const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
			return new Uint8Array(await new Response(stream).arrayBuffer());
		}

		async function worthCompressing(bytes, sampleBytes) {
			if (bytes.length <= sampleBytes * 4) return true;
			const start = Math.floor((bytes.length - sampleBytes) / 2);
			const sample = bytes.subarray(start, start + sampleBytes);
			const packed = await deflate(sample);
			return packed.length < sample.length * 0.92;
		}

		async function bytesOf(job) {
			if (typeof job.text === 'string') return new TextEncoder().encode(job.text);
			if (job.blob) return new Uint8Array(await job.blob.arrayBuffer());
			return job.bytes || new Uint8Array(0);
		}

		async function encode(job) {
			const bytes = await bytesOf(job);
			const crc = crc32(bytes);
			let method = 0;
			let data = bytes;
			const compressible =
				typeof CompressionStream === 'function' && bytes.length >= 64 && job.mode !== 'store';
			if (compressible && (job.mode === 'deflate' || (await worthCompressing(bytes, job.sampleBytes)))) {
				const packed = await deflate(bytes);
				if (packed.length < bytes.length) {
					method = 8;
					data = packed;
				}
			}
			return { id: job.id, crc, size: bytes.length, method, data };
		}

		return { encode };
	}

	function encoderBootstrap(factory) {
		const compressor = factory();
		self.onmessage = async (event) => {
			const job = event.data || {};
			try {
				const result = await compressor.encode(job);
				self.postMessage(result, [result.data.buffer]);
			} catch (error) {
				self.postMessage({ id: job.id, error: String((error && error.message) || error) });
			}
		};
	}

	function createEncoderPool() {
		const size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
		const inline = createCompressor();
		const queue = [];
		const slots = [];
		let disabled = typeof Worker !== 'function' || typeof CompressionStream !== 'function';
		let url = '';
		let idleTimer = 0;

		function workerUrl() {
			if (!url) {
				const source = `(${encoderBootstrap.toString()})(${createCompressor.toString()});`;
				url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
			}
			return url;
		}

		function runInline(task) {
			inline.encode(task.job).then(task.resolve, task.reject);
		}

		function retire(slot) {
			const index = slots.indexOf(slot);
			if (index !== -1) slots.splice(index, 1);
			slot.worker.terminate();
			if (!slots.length) disabled = true;
		}

		function spawn() {
			const slot = { worker: new Worker(workerUrl()), task: null };
			slot.worker.onmessage = (event) => {
				const result = event.data || {};
				const task = slot.task;
				slot.task = null;
				if (task) {
					if (result.error) task.reject(new Error(result.error));
					else task.resolve(result);
				}
				pump();
			};
			slot.worker.onerror = (event) => {
				if (event && typeof event.preventDefault === 'function') event.preventDefault();
				const task = slot.task;
				slot.task = null;
				retire(slot);
				if (task) runInline(task);
				pump();
			};
			slots.push(slot);
			return slot;
		}

		function shutdown() {
			for (const slot of slots.splice(0)) slot.worker.terminate();
		}

		function pump() {
			clearTimeout(idleTimer);
			while (queue.length && !disabled) {
				let slot = slots.find((candidate) => !candidate.task);
				if (!slot && slots.length < size) {
					try {
						slot = spawn();
					} catch {
						disabled = !slots.length;
						break;
					}
				}
				if (!slot) break;
				const task = queue.shift();
				slot.task = task;
				slot.worker.postMessage(task.job);
			}
			if (disabled) while (queue.length) runInline(queue.shift());
			if (!queue.length && slots.every((slot) => !slot.task)) idleTimer = setTimeout(shutdown, 60000);
		}

		return {
			capacity: size,
			encode(job) {
				return new Promise((resolve, reject) => {
					queue.push({ job, resolve, reject });
					pump();
				});
			},
		};
	}

	function encoders() {
		if (!encoderPool) encoderPool = createEncoderPool();
		return encoderPool;
	}

	function extensionOf(path) {
		const base = path.slice(path.lastIndexOf('/') + 1);
		const dot = base.lastIndexOf('.');
		return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
	}

	function byteSize(text, data) {
		if (data) return data instanceof Blob ? data.size : data.byteLength || data.length || 0;
		return typeof text === 'string' ? text.length : 0;
	}

	function exactBytes(data) {
		const view =
			data instanceof Uint8Array
				? data
				: ArrayBuffer.isView(data)
					? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
					: new Uint8Array(data);
		return view.byteOffset === 0 && view.byteLength === view.buffer.byteLength ? view : view.slice();
	}

	function jobFor(item, id) {
		const job = { id, sampleBytes: SAMPLE_BYTES, mode: 'deflate' };
		if (item.data) {
			job.mode = INCOMPRESSIBLE.has(extensionOf(item.path)) ? 'store' : 'auto';
			if (item.data instanceof Blob) job.blob = item.data;
			else job.bytes = exactBytes(item.data);
		} else job.text = typeof item.text === 'string' ? item.text : '';
		return job;
	}

	function globToRegExp(pattern) {
		let glob = String(pattern || '')
			.trim()
			.replace(/\\/g, '/')
			.replace(/^\.\//, '')
			.replace(/^\/+/, '');
		if (!glob) return null;
		if (glob.endsWith('/')) glob += '**';
		const anchored = glob.includes('/');
		let source = '';
		for (let index = 0; index < glob.length; index++) {
			const char = glob[index];
			if (char === '*' && glob[index + 1] === '*') {
				if (glob[index + 2] === '/') {
					source += '(?:.*/)?';
					index += 2;
				} else {
					source += '.*';
					index += 1;
				}
			} else if (char === '*') source += '[^/]*';
			else if (char === '?') source += '[^/]';
			else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
		}
		return new RegExp(anchored ? `^${source}(?:/.*)?$` : `(?:^|/)${source}(?:/|$)`);
	}

	function listOf(value) {
		let list = value;
		if (typeof list === 'string' && list.trim().startsWith('[')) {
			try {
				list = JSON.parse(list);
			} catch {
				list = [value];
			}
		}
		if (!Array.isArray(list)) list = list ? String(list).split(',') : [];
		return list
			.map((item) => String(item).trim())
			.filter(Boolean)
			.slice(0, 64);
	}

	function normalizeFilters(input) {
		const chunkMb = Number(input.chunk_mb);
		const units = Math.round(((chunkMb > 0 ? chunkMb : DEFAULT_CHUNK_MB) * MEGABYTE) / CHUNK_UNIT);
		const maxFileMb = Number(input.max_file_mb);
		return {
			include: listOf(input.include),
			exclude: listOf(input.exclude),
			binaries: !(input.binaries === false || /^(false|0|nao|não|no)$/i.test(String(input.binaries))),
			maxFileMb: maxFileMb > 0 ? maxFileMb : 0,
			chunkBytes: Math.max(1, Math.min(MAX_CHUNK_UNITS, units)) * CHUNK_UNIT,
		};
	}

	function planBundle(project, filters) {
		const include = filters.include.map(globToRegExp).filter(Boolean);
		const exclude = filters.exclude.map(globToRegExp).filter(Boolean);
		const limit = filters.maxFileMb > 0 ? filters.maxFileMb * MEGABYTE : Infinity;
		const accepts = (path) =>
			(!include.length || include.some((rule) => rule.test(path))) &&
			!exclude.some((rule) => rule.test(path));
		const files = [];
		const skipped = [];
		const parents = new Set();
		let filtered = 0;
		let rawBytes = 0;
		for (const path of [...project.files.keys()].sort()) {
			const file = project.files.get(path);
			if (!file) continue;
			if (!accepts(path)) {
				filtered++;
				continue;
			}
			if (!filters.binaries && !file.isText) {
				skipped.push({ path, reason: 'binario' });
				continue;
			}
			const size = byteSize(file.text, file.data);
			if (size > limit) {
				skipped.push({ path, reason: 'max_file_mb', bytes: size });
				continue;
			}
			files.push({ path, text: file.text, data: file.data, size });
			rawBytes += size;
			for (let slash = path.indexOf('/'); slash !== -1; slash = path.indexOf('/', slash + 1))
				parents.add(path.slice(0, slash));
		}
		const dirs = [];
		if (project.emptyDirs)
			for (const dir of [...project.emptyDirs].sort())
				if (!parents.has(dir) && accepts(dir + '/')) dirs.push(dir);
		if (files.length + dirs.length > MAX_ENTRIES)
			throw new Error(
				`O projeto tem ${files.length + dirs.length} entradas e o limite por pacote e ${MAX_ENTRIES}. Use include/exclude para dividir o download.`,
			);
		return { files, dirs, skipped, filtered, rawBytes };
	}

	function directoryKey(project) {
		return project.emptyDirs ? [...project.emptyDirs].sort().join('\n') : '';
	}

	function snapshotOf(project) {
		const refs = new Map();
		project.files.forEach((file, path) => refs.set(path, file ? [file.text, file.data] : null));
		return { refs, dirs: directoryKey(project) };
	}

	function isCurrent(bundle) {
		const project = bundle.project;
		if (!State.projects.includes(project) || project.files.size !== bundle.snapshot.refs.size) return false;
		if (directoryKey(project) !== bundle.snapshot.dirs) return false;
		for (const [path, ref] of bundle.snapshot.refs) {
			const file = project.files.get(path);
			if (!file || !ref || file.data !== ref[1] || file.text !== ref[0]) return false;
		}
		return true;
	}

	function dosStamp(date) {
		return {
			date: (((date.getFullYear() - 1980) & 0x7f) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
			time: (date.getHours() << 11) | (date.getMinutes() << 5) | ((date.getSeconds() / 2) | 0),
		};
	}

	function notify(bundle) {
		for (const wake of bundle.waiters.splice(0)) wake();
	}

	async function waitUntil(bundle, satisfied, waitMs) {
		const deadline = Date.now() + waitMs;
		while (!satisfied() && bundle.state === 'building') {
			const remaining = deadline - Date.now();
			if (remaining <= 0) break;
			await new Promise((resolve) => {
				const timer = setTimeout(resolve, remaining);
				bundle.waiters.push(() => {
					clearTimeout(timer);
					resolve();
				});
			});
		}
		return satisfied();
	}

	function createZipWriter(bundle) {
		const encoder = new TextEncoder();
		const stamp = dosStamp(new Date());
		const central = [];

		function append(parts) {
			const blob = new Blob(parts);
			if (bundle.size + blob.size > MAX_ZIP_BYTES)
				throw new Error(
					'O pacote passou de 4 GB. Use include/exclude ou max_file_mb para dividir o download.',
				);
			bundle.parts.push(blob);
			bundle.size += blob.size;
			notify(bundle);
		}

		function localHeader(name, method, crc, compressed, size) {
			const bytes = new Uint8Array(30 + name.length);
			const view = new DataView(bytes.buffer);
			view.setUint32(0, 0x04034b50, true);
			view.setUint16(4, 20, true);
			view.setUint16(6, 0x0800, true);
			view.setUint16(8, method, true);
			view.setUint16(10, stamp.time, true);
			view.setUint16(12, stamp.date, true);
			view.setUint32(14, crc, true);
			view.setUint32(18, compressed, true);
			view.setUint32(22, size, true);
			view.setUint16(26, name.length, true);
			bytes.set(name, 30);
			return bytes;
		}

		function centralHeader(entry) {
			const bytes = new Uint8Array(46 + entry.name.length);
			const view = new DataView(bytes.buffer);
			view.setUint32(0, 0x02014b50, true);
			view.setUint16(4, 0x0314, true);
			view.setUint16(6, 20, true);
			view.setUint16(8, 0x0800, true);
			view.setUint16(10, entry.method, true);
			view.setUint16(12, stamp.time, true);
			view.setUint16(14, stamp.date, true);
			view.setUint32(16, entry.crc, true);
			view.setUint32(20, entry.compressed, true);
			view.setUint32(24, entry.size, true);
			view.setUint16(28, entry.name.length, true);
			view.setUint32(38, entry.directory ? 0x41ed0010 : 0x81a40000, true);
			view.setUint32(42, entry.offset, true);
			bytes.set(entry.name, 46);
			return bytes;
		}

		return {
			addFile(path, result) {
				const name = encoder.encode(path);
				const offset = bundle.size;
				append([localHeader(name, result.method, result.crc, result.data.length, result.size), result.data]);
				central.push({
					name,
					method: result.method,
					crc: result.crc,
					compressed: result.data.length,
					size: result.size,
					offset,
					directory: false,
				});
			},
			addDirectory(path) {
				const name = encoder.encode(path.replace(/\/+$/, '') + '/');
				const offset = bundle.size;
				append([localHeader(name, 0, 0, 0, 0)]);
				central.push({ name, method: 0, crc: 0, compressed: 0, size: 0, offset, directory: true });
			},
			finish() {
				const records = central.map(centralHeader);
				const directorySize = records.reduce((total, record) => total + record.length, 0);
				const directoryOffset = bundle.size;
				const padding = (3 - ((directoryOffset + directorySize + 22) % 3)) % 3;
				const end = new Uint8Array(22 + padding);
				const view = new DataView(end.buffer);
				view.setUint32(0, 0x06054b50, true);
				view.setUint16(8, central.length, true);
				view.setUint16(10, central.length, true);
				view.setUint32(12, directorySize, true);
				view.setUint32(16, directoryOffset, true);
				view.setUint16(20, padding, true);
				end.fill(32, 22);
				append([...records, end]);
				bundle.complete = true;
			},
		};
	}

	async function build(bundle, plan) {
		const writer = createZipWriter(bundle);
		const pool = encoders();
		const running = new Set();
		let runningBytes = 0;
		let failure = null;
		let jobId = 0;
		for (const item of plan.files) {
			while (
				running.size &&
				(running.size >= pool.capacity * 2 || runningBytes + item.size > MAX_INFLIGHT_BYTES)
			)
				await Promise.race(running);
			if (failure || bundle.released) break;
			runningBytes += item.size;
			const task = pool
				.encode(jobFor(item, ++jobId))
				.then((result) => {
					if (bundle.released) return;
					writer.addFile(item.path, result);
					bundle.packedFiles++;
					bundle.packedBytes += result.size;
				})
				.catch((error) => {
					failure = failure || error;
				})
				.finally(() => {
					running.delete(task);
					runningBytes -= item.size;
				});
			running.add(task);
		}
		await Promise.all(running);
		if (failure) throw failure;
		if (bundle.released) throw new Error('o pacote foi liberado antes de terminar');
		for (const dir of plan.dirs) writer.addDirectory(dir);
		writer.finish();
	}

	function releaseBundle(bundle) {
		bundle.released = true;
		bundle.parts = [];
		bundle.view = null;
		bundles.delete(bundle.id);
		notify(bundle);
	}

	function prune() {
		const now = Date.now();
		const settled = [...bundles.values()]
			.filter((bundle) => bundle.state !== 'building')
			.sort((a, b) => a.lastAccess - b.lastAccess);
		for (const bundle of settled) {
			if (now - bundle.lastAccess > IDLE_TTL_MS || bundles.size > MAX_BUNDLES) releaseBundle(bundle);
		}
	}

	function formatBytes(bytes) {
		const guard = root.SynapseZipGuard;
		return guard ? guard.formatMegabytes(bytes) : `${(bytes / MEGABYTE).toFixed(1)} MB`;
	}

	function createBundle(project, filters, key) {
		const plan = planBundle(project, filters);
		const bundle = {
			id: `dl-${Date.now().toString(36)}-${(++sequence).toString(36)}`,
			key,
			project,
			projectId: String(project.id),
			projectName: String(project.name || project.id),
			snapshot: snapshotOf(project),
			state: 'building',
			error: '',
			released: false,
			complete: false,
			parts: [],
			view: null,
			viewParts: 0,
			size: 0,
			chunkBytes: filters.chunkBytes,
			files: plan.files.length,
			dirs: plan.dirs.length,
			skipped: plan.skipped,
			filtered: plan.filtered,
			rawBytes: plan.rawBytes,
			packedFiles: 0,
			packedBytes: 0,
			createdAt: Date.now(),
			readyAt: 0,
			lastAccess: Date.now(),
			waiters: [],
		};
		bundles.set(bundle.id, bundle);
		build(bundle, plan).then(
			() => {
				bundle.state = 'ready';
				bundle.readyAt = Date.now();
				notify(bundle);
				try {
					mcpLog(
						'ok',
						`download_project: "${bundle.projectName}" empacotado (${bundle.files} arquivo(s), ${formatBytes(bundle.size)}) em ${bundle.readyAt - bundle.createdAt} ms`,
					);
				} catch (error) {
					ignorarErro(error, 'download_project');
				}
			},
			(error) => {
				bundle.state = 'error';
				bundle.error = String((error && error.message) || error);
				bundle.parts = [];
				bundle.view = null;
				notify(bundle);
			},
		);
		return bundle;
	}

	function startOrReuse(project, filters) {
		prune();
		const key = JSON.stringify([String(project.id), filters]);
		for (const bundle of bundles.values()) {
			if (bundle.key === key && bundle.state !== 'error' && isCurrent(bundle)) {
				bundle.lastAccess = Date.now();
				return bundle;
			}
		}
		return createBundle(project, filters, key);
	}

	function bundleById(id) {
		const bundle = bundles.get(String(id || ''));
		if (!bundle)
			throw new Error(
				`Pacote "${id || ''}" nao existe ou expirou (expira apos 10 min sem uso). Chame download_project com action=start.`,
			);
		bundle.lastAccess = Date.now();
		return bundle;
	}

	function latestBundleOf(project) {
		let latest = null;
		for (const bundle of bundles.values())
			if (bundle.project === project && (!latest || bundle.createdAt > latest.createdAt)) latest = bundle;
		if (!latest) throw new Error('Nenhum pacote ativo para este projeto. Chame action=start.');
		latest.lastAccess = Date.now();
		return latest;
	}

	function chunkCount(bundle) {
		return Math.max(1, Math.ceil(bundle.size / bundle.chunkBytes));
	}

	function metaOf(bundle) {
		const ready = bundle.state === 'ready';
		return {
			id: bundle.id,
			state: bundle.state,
			error: bundle.error || null,
			project: bundle.projectName,
			project_id: bundle.projectId,
			files: bundle.files,
			empty_dirs: bundle.dirs,
			packed_files: bundle.packedFiles,
			raw_bytes: bundle.rawBytes,
			zip_bytes: bundle.size,
			chunk_bytes: bundle.chunkBytes,
			chunks: ready ? chunkCount(bundle) : null,
			chunks_ready: ready ? chunkCount(bundle) : Math.floor(bundle.size / bundle.chunkBytes),
			progress: ready
				? 1
				: Math.min(0.999, Math.round((bundle.packedBytes / Math.max(1, bundle.rawBytes)) * 1000) / 1000),
			elapsed_ms: (bundle.readyAt || Date.now()) - bundle.createdAt,
			skipped: bundle.skipped.length,
			skipped_sample: bundle.skipped.slice(0, 20),
			filtered: bundle.filtered,
			format: 'zip; cada chunk e base64 padrao sem padding; concatene os chunks na ordem dos indices',
		};
	}

	function summaryOf(bundle) {
		if (bundle.state === 'ready')
			return `Pacote ${bundle.id} pronto: ${bundle.files} arquivo(s), ${formatBytes(bundle.rawBytes)} de origem, zip de ${formatBytes(bundle.size)} em ${chunkCount(bundle)} chunk(s). Baixe pela sandbox (action=script); nunca leia chunks pelo cliente MCP.`;
		if (bundle.state === 'error') return `Pacote ${bundle.id} falhou: ${bundle.error}`;
		return `Pacote ${bundle.id} empacotando: ${bundle.packedFiles}/${bundle.files} arquivo(s). Os chunks prontos ja podem ser baixados enquanto o resto termina.`;
	}

	function reply(summary, meta, payload) {
		const items = [
			{ type: 'text', text: summary },
			{ type: 'text', text: JSON.stringify(meta) },
		];
		if (payload !== undefined) items.push({ type: 'text', text: payload });
		return { __content: items };
	}

	function sliceOf(bundle, start, end) {
		if (!bundle.view || bundle.viewParts !== bundle.parts.length) {
			bundle.view = new Blob(bundle.parts, { type: 'application/zip' });
			bundle.viewParts = bundle.parts.length;
		}
		return bundle.view.slice(start, end);
	}

	async function blobToBase64(blob) {
		if (typeof Uint8Array.prototype.toBase64 === 'function')
			return new Uint8Array(await blob.arrayBuffer()).toBase64();
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const url = String(reader.result || '');
				resolve(url.slice(url.indexOf(',') + 1));
			};
			reader.onerror = () => reject(reader.error || new Error('falha ao ler o pacote'));
			reader.readAsDataURL(blob);
		});
	}

	function ensureUsable(bundle) {
		if (bundle.state === 'error') throw new Error(`O pacote ${bundle.id} falhou: ${bundle.error}`);
		if (bundle.released) throw new Error(`O pacote ${bundle.id} foi liberado. Chame action=start de novo.`);
	}

	async function serveChunk(bundle, index, waitMs) {
		const start = index * bundle.chunkBytes;
		await waitUntil(bundle, () => bundle.size >= start + bundle.chunkBytes, waitMs);
		ensureUsable(bundle);
		const ready = bundle.state === 'ready';
		if (!ready && bundle.size < start + bundle.chunkBytes)
			return reply(
				`chunk ${index} ainda nao esta pronto; repita a mesma chamada`,
				{ index, pending: true, state: bundle.state, chunks_ready: Math.floor(bundle.size / bundle.chunkBytes) },
				'',
			);
		if (ready && start >= bundle.size)
			return reply(
				`chunk ${index} esta alem do fim do pacote`,
				{ index, eof: true, state: 'ready', chunks: chunkCount(bundle), zip_bytes: bundle.size },
				'',
			);
		const end = Math.min(start + bundle.chunkBytes, bundle.size);
		const payload = await blobToBase64(sliceOf(bundle, start, end));
		return reply(
			`chunk ${index}${ready ? ' de ' + chunkCount(bundle) : ''} (${end - start} bytes)`,
			{
				index,
				bytes: end - start,
				offset: start,
				state: bundle.state,
				chunks: ready ? chunkCount(bundle) : null,
				zip_bytes: ready ? bundle.size : null,
			},
			payload,
		);
	}

	function publicUrl() {
		try {
			if (typeof mcpPublicUrl === 'function' && typeof MCP !== 'undefined' && MCP.sid && MCP.token)
				return mcpPublicUrl();
			return '';
		} catch {
			return '';
		}
	}

	function slugOf(name) {
		return (
			String(name || 'projeto')
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^A-Za-z0-9._-]+/g, '-')
				.replace(/^[-.]+|[-.]+$/g, '') || 'projeto'
		);
	}

	function scriptReply(project, filters, input, bundle) {
		const url = publicUrl();
		const out = String(input.out || `./${slugOf(project.name || project.id)}`);
		const defaults = {
			url,
			project: String(project.id),
			out,
			agent: String(input.agent || 'sandbox-download'),
			chunk_mb: Math.round((filters.chunkBytes / MEGABYTE) * 1000) / 1000,
			binaries: filters.binaries,
			max_file_mb: filters.maxFileMb,
			include: filters.include,
			exclude: filters.exclude,
		};
		const script = PYTHON_DOWNLOADER.replace('__DEFAULTS_JSON__', () =>
			JSON.stringify(JSON.stringify(defaults)),
		);
		const steps = [
			`Download do projeto "${project.name || project.id}" para a SUA sandbox. O pacote ${bundle.id} ja esta sendo preparado em segundo plano (${bundle.files} arquivo(s), ${formatBytes(bundle.rawBytes)}).`,
			'1) Salve o PROXIMO bloco de texto, sem alterar nada, como synapse_download.py no terminal da sua sandbox.',
			`2) Rode: python3 synapse_download.py --out ${out}`,
			'Opcoes: --parallel 8 (mais conexoes), --include "src/**", --exclude node_modules, --binaries nao (so codigo), --max-file-mb 50, --keep-zip. Requer apenas Python 3.8+ (biblioteca padrao).',
			url
				? 'A URL deste MCP ja esta embutida no script.'
				: 'Este editor nao informou a URL publica do MCP: passe --url com a mesma URL que voce usa para falar com este MCP.',
			'Sem Python: chame action=start, depois action=chunk com index 0..N-1 em paralelo; o ULTIMO item de texto de cada chunk e base64 padrao (sem padding) e o PENULTIMO e um JSON com bytes, chunks e eof. Concatene na ordem e descompacte o zip. Nunca leia chunks pelo seu cliente MCP: isso encheria o seu contexto.',
		].join('\n');
		return { __content: [{ type: 'text', text: steps }, { type: 'text', text: script }] };
	}

	function waitOf(value) {
		const number = Number(value);
		return Number.isFinite(number) ? Math.max(0, Math.min(MAX_WAIT_MS, number)) : DEFAULT_WAIT_MS;
	}

	function targetProject(input) {
		if (typeof mcpProj === 'function') return mcpProj(input);
		const project = typeof activeProject === 'function' ? activeProject() : null;
		if (!project) throw new Error('Nenhum projeto aberto.');
		return project;
	}

	function ensureSessionLoaded() {
		const store = root.SynapseSessionStore;
		if (store && store.stats && store.stats.loading)
			throw new Error('A sessao do editor ainda esta carregando. Repita em alguns segundos.');
	}

	async function run(args) {
		const input = args || {};
		const action = String(input.action || 'script')
			.trim()
			.toLowerCase();
		const waitMs = waitOf(input.wait_ms);
		if (action === 'chunk') {
			const index = Number(input.index);
			if (!Number.isInteger(index) || index < 0) throw new Error('Informe index (inteiro a partir de 0).');
			return serveChunk(bundleById(input.id), index, waitMs);
		}
		if (action === 'release') {
			if (input.id) {
				const bundle = bundles.get(String(input.id));
				if (bundle) releaseBundle(bundle);
				return reply('Pacote liberado.', { id: String(input.id), released: !!bundle });
			}
			const project = targetProject(input);
			const owned = [...bundles.values()].filter((bundle) => bundle.project === project);
			owned.forEach(releaseBundle);
			return reply(`${owned.length} pacote(s) liberado(s).`, { released: owned.map((bundle) => bundle.id) });
		}
		if (action === 'status') {
			const bundle = input.id ? bundleById(input.id) : latestBundleOf(targetProject(input));
			await waitUntil(bundle, () => bundle.state !== 'building', waitMs);
			return reply(summaryOf(bundle), metaOf(bundle));
		}
		if (action !== 'start' && action !== 'script')
			throw new Error(`acao "${action}" invalida. Use script, start, status, chunk ou release.`);
		ensureSessionLoaded();
		const project = targetProject(input);
		const filters = normalizeFilters(input);
		const bundle = startOrReuse(project, filters);
		if (action === 'script') return scriptReply(project, filters, input, bundle);
		await waitUntil(bundle, () => bundle.state !== 'building', waitMs);
		ensureUsable(bundle);
		return reply(summaryOf(bundle), metaOf(bundle));
	}

	setInterval(prune, 60000);

	MCP_TOOLS.push({
		name: 'download_project',
		title: 'Baixar o projeto inteiro para a sandbox do agente',
		desc: 'Baixa o projeto INTEIRO (todos os arquivos, texto e binarios) para a sandbox/terminal do agente de uma vez, em segundos: o editor empacota tudo num .zip em Web Workers (codigo comprimido, midia ja compactada vai sem recompressao) e entrega em chunks paralelos. Fluxo: 1) action=script devolve um script Python pronto (com a URL deste MCP) e ja comeca a empacotar; 2) salve e rode na sandbox: python3 synapse_download.py --out ./projeto. Acoes: script (padrao), start (cria ou reaproveita o pacote e espera ate wait_ms), status, chunk (index; o ULTIMO texto e base64 padrao sem padding, o PENULTIMO e JSON com bytes/chunks/eof/pending), release. Filtros: include/exclude (globs), binaries=false (so codigo), max_file_mb. Nunca leia chunks pelo seu cliente MCP: baixe pela sandbox.',
		schema: {
			type: 'object',
			properties: {
				action: {
					type: 'string',
					enum: ['script', 'start', 'status', 'chunk', 'release'],
					description: 'script (padrao) devolve o downloader pronto; start/status/chunk/release sao o protocolo usado por ele.',
				},
				id: { type: 'string', description: 'ID do pacote devolvido por start (status, chunk e release).' },
				index: { type: 'integer', minimum: 0, description: 'chunk: indice do chunk (0, 1, 2...).' },
				include: {
					type: 'array',
					items: { type: 'string' },
					description: 'Globs a incluir (ex.: ["src/**", "*.json"]). Vazio = projeto inteiro.',
				},
				exclude: {
					type: 'array',
					items: { type: 'string' },
					description: 'Globs a excluir (ex.: ["node_modules", "*.mp4"]).',
				},
				binaries: { type: 'boolean', description: 'false = so arquivos de texto/codigo (padrao true).' },
				max_file_mb: { type: 'number', description: 'Ignora arquivos maiores que isso, em MB.' },
				chunk_mb: { type: 'number', description: 'Tamanho de cada chunk em MB (0.2 a 3; padrao 2).' },
				wait_ms: {
					type: 'integer',
					minimum: 0,
					maximum: MAX_WAIT_MS,
					description: 'Quanto esperar o pacote ou o chunk ficar pronto (padrao 15000).',
				},
				out: { type: 'string', description: 'script: pasta de destino na sandbox (padrao ./nome-do-projeto).' },
				agent: { type: 'string', description: 'Seu nome de agente. Use sempre o mesmo em todas as chamadas.' },
				project: { type: 'string', description: 'ID ou nome do projeto. Omita para usar o ativo.' },
			},
		},
		run,
	});

	if (typeof MCP_INSTRUCTIONS !== 'undefined')
		MCP_INSTRUCTIONS +=
			'\n\nDOWNLOAD DO PROJETO INTEIRO PARA A SANDBOX: download_project com action=script devolve um script Python pronto (ja com a URL deste MCP) e ja comeca a empacotar o projeto em segundo plano. Salve e rode no terminal da sua sandbox (python3 synapse_download.py --out ./projeto) para receber TODOS os arquivos de uma vez, inclusive projetos pesados, em segundos (zip feito em Web Workers e chunks paralelos). Filtros: include/exclude (globs), binaries=false (so codigo), max_file_mb. Nunca leia os chunks pelo seu cliente MCP.';

	root.SynapseProjectDownload = Object.freeze({
		state: () =>
			[...bundles.values()].map((bundle) => ({
				id: bundle.id,
				project: bundle.projectName,
				state: bundle.state,
				zip_bytes: bundle.size,
				files: bundle.files,
			})),
	});
})(window);
