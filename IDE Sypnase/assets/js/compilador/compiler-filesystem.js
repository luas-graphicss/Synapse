(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SYNAPSE_COMPILER_FILESYSTEM = api;
})(globalThis, function () {
    'use strict';
    const maximumBytes = 16777216;
    function normalize(value) {
      const segments = [];
      if (typeof value !== 'string' || /[\\\x00-\x1f]/.test(value)) throw new Error('Invalid compiler filesystem path.');
      for (const part of value.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
          if (!segments.length) throw new Error('Filesystem path escapes its root.');
          segments.pop();
        } else segments.push(part);
      }
      return '/' + segments.join('/');
    }
    function create(initialFiles, standardWasi) {
      const files = new Map();
      const directories = new Set(['/', '/tmp', '/output', '/project']);
      const descriptors = new Map([[3, { path: '/', directory: true }]]);
      let nextDescriptor = 4;
      let allocatedBytes = 0;
      let memory;
      for (const [rawPath, bytes] of initialFiles) {
        const path = normalize(rawPath);
        if (!(bytes instanceof Uint8Array) || files.has(path) || (allocatedBytes += bytes.length) > maximumBytes) throw new Error('Compiler filesystem exceeds its limit or has duplicate files.');
        files.set(path, { bytes: bytes.slice(), size: bytes.length });
        let parent = path.slice(0, path.lastIndexOf('/'));
        while (parent) {
          directories.add(parent);
          parent = parent.slice(0, parent.lastIndexOf('/'));
        }
      }
      const data = () => new DataView(memory.buffer);
      function range(pointer, size) {
        if (!Number.isInteger(pointer) || !Number.isInteger(size) || pointer < 0 || size < 0 || pointer + size > memory.buffer.byteLength) throw new Error('Invalid WASI memory range.');
        return new Uint8Array(memory.buffer, pointer, size);
      }
      const writable = (path) => path.startsWith('/tmp/') || path.startsWith('/output/');
      function resolvePath(descriptor, pointer, length) {
        const directory = descriptors.get(descriptor);
        if (!directory?.directory) throw new Error('Invalid directory descriptor.');
        const path = new TextDecoder('utf-8', { fatal: true }).decode(range(pointer, length));
        return normalize(path.startsWith('/') ? path : directory.path + '/' + path);
      }
      function stat(path, pointer) {
        const file = files.get(path);
        const directory = directories.has(path);
        if (!file && !directory) return 44;
        range(pointer, 64).fill(0);
        data().setUint8(pointer + 16, directory ? 3 : 4);
        data().setBigUint64(pointer + 24, 1n, true);
        data().setBigUint64(pointer + 32, BigInt(file?.size || 0), true);
        return 0;
      }
      function vectors(pointer, count) {
        if (!Number.isInteger(count) || count < 0 || count > 1024) throw new Error('Invalid WASI vector count.');
        range(pointer, count * 8);
        return Array.from({ length: count }, (_, index) => range(data().getUint32(pointer + index * 8, true), data().getUint32(pointer + index * 8 + 4, true)));
      }
      const implementations = {
        fd_prestat_get(descriptor, pointer) {
          if (descriptor !== 3) return 8;
          range(pointer, 8).fill(0);
          data().setUint32(pointer + 4, 1, true);
          return 0;
        },
        fd_prestat_dir_name(descriptor, pointer, size) {
          if (descriptor !== 3) return 8;
          if (size < 1) return 28;
          range(pointer, 1)[0] = 47;
          return 0;
        },
        path_open(descriptor, lookupFlags, pointer, length, openFlags, rights, inherited, descriptorFlags, resultPointer) {
          const path = resolvePath(descriptor, pointer, length);
          range(resultPointer, 4);
          if (descriptors.size >= 512) return 33;
          if (openFlags & 2 || directories.has(path)) return 31;
          const mayWrite = Boolean(BigInt(rights) & 64n);
          if ((mayWrite || (openFlags & 9)) && !writable(path)) return 63;
          let file = files.get(path);
          if (file && (openFlags & 1) && (openFlags & 4)) return 20;
          if (!file) {
            if (!(openFlags & 1)) return 44;
            if (!directories.has(path.slice(0, path.lastIndexOf('/')) || '/')) return 44;
            file = { bytes: new Uint8Array(0), size: 0 };
            files.set(path, file);
          }
          if (openFlags & 8) file.size = 0;
          const opened = nextDescriptor++;
          descriptors.set(opened, { path, file, offset: descriptorFlags & 1 ? file.size : 0, mayWrite, append: Boolean(descriptorFlags & 1) });
          data().setUint32(resultPointer, opened, true);
          return 0;
        },
        fd_close(descriptor) {
          if (descriptor <= 2) return standardWasi.fd_close(descriptor);
          return descriptors.delete(descriptor) ? 0 : 8;
        },
        fd_read(descriptor, pointer, count, resultPointer) {
          if (descriptor <= 2) return standardWasi.fd_read(descriptor, pointer, count, resultPointer);
          const opened = descriptors.get(descriptor);
          if (!opened?.file) return 8;
          range(resultPointer, 4);
          let total = 0;
          for (const target of vectors(pointer, count)) {
            const length = Math.min(target.length, Math.max(0, opened.file.size - opened.offset));
            target.set(opened.file.bytes.subarray(opened.offset, opened.offset + length));
            opened.offset += length;
            total += length;
          }
          data().setUint32(resultPointer, total, true);
          return 0;
        },
        fd_write(descriptor, pointer, count, resultPointer) {
          if (descriptor <= 2) return standardWasi.fd_write(descriptor, pointer, count, resultPointer);
          const opened = descriptors.get(descriptor);
          if (!opened?.file) return 8;
          if (!opened.mayWrite || !writable(opened.path)) return 63;
          range(resultPointer, 4);
          const chunks = vectors(pointer, count);
          const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          if (opened.append) opened.offset = opened.file.size;
          const end = opened.offset + length;
          if (end > maximumBytes) return 27;
          const file = opened.file;
          if (end > file.bytes.length) {
            const capacity = Math.min(maximumBytes, Math.max(end, file.bytes.length * 2, 4096));
            if (allocatedBytes + capacity - file.bytes.length > maximumBytes) return 51;
            allocatedBytes += capacity - file.bytes.length;
            const bytes = new Uint8Array(capacity);
            bytes.set(file.bytes.subarray(0, file.size));
            file.bytes = bytes;
          }
          for (const chunk of chunks) {
            file.bytes.set(chunk, opened.offset);
            opened.offset += chunk.length;
          }
          file.size = Math.max(file.size, end);
          data().setUint32(resultPointer, length, true);
          return 0;
        },
        fd_seek(descriptor, offset, whence, resultPointer) {
          const opened = descriptors.get(descriptor);
          if (!opened?.file) return 8;
          if (![0, 1, 2].includes(whence)) return 28;
          const next = Number(offset) + (whence === 1 ? opened.offset : whence === 2 ? opened.file.size : 0);
          if (!Number.isSafeInteger(next) || next < 0 || next > maximumBytes) return 28;
          range(resultPointer, 8);
          opened.offset = next;
          data().setBigUint64(resultPointer, BigInt(next), true);
          return 0;
        },
        fd_filestat_get(descriptor, pointer) {
          const opened = descriptors.get(descriptor);
          return opened ? stat(opened.path, pointer) : 8;
        },
        path_filestat_get(descriptor, flags, pointer, length, resultPointer) {
          return stat(resolvePath(descriptor, pointer, length), resultPointer);
        },
        path_unlink_file(descriptor, pointer, length) {
          const path = resolvePath(descriptor, pointer, length);
          if (!writable(path)) return 63;
          return files.delete(path) ? 0 : 44;
        },
      };
      const wasiImport = { ...standardWasi };
      for (const [name, implementation] of Object.entries(implementations)) {
        wasiImport[name] = (...args) => {
          try { return implementation(...args); }
          catch (error) {
            if (error.wasiSaida || error.wasiTempo) throw error;
            return 28;
          }
        };
      }
      return {
        imports: { wasi_snapshot_preview1: wasiImport, wasi_unstable: wasiImport },
        bind(instance) { memory = instance.exports.memory; },
        read(path) {
          const file = files.get(normalize(path));
          if (!file) throw new Error('Compiler output is missing.');
          return file.bytes.slice(0, file.size);
        },
      };
    }
    return { create, normalize };
});
