(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SYNAPSE_TOOLCHAIN_ARCHIVE = api;
})(globalThis, function () {
    'use strict';
    async function unpack(input) {
      if (!(input instanceof Uint8Array) || input.length > 8388608) throw new Error('Invalid compiler archive.');
      const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
      const files = new Map();
      const names = new Set();
      let offset = 0;
      let total = 0;
      while (offset + 4 <= input.length && view.getUint32(offset, true) === 0x04034b50) {
        if (offset + 30 > input.length || names.size >= 256) throw new Error('Invalid compiler archive header.');
        const flags = view.getUint16(offset + 6, true);
        const method = view.getUint16(offset + 8, true);
        const packedSize = view.getUint32(offset + 18, true);
        const size = view.getUint32(offset + 22, true);
        const nameSize = view.getUint16(offset + 26, true);
        const extraSize = view.getUint16(offset + 28, true);
        const start = offset + 30 + nameSize + extraSize;
        if (flags & 9 || ![0, 8].includes(method) || start + packedSize > input.length || (total += size) > 8388608) throw new Error('Unsupported or oversized compiler archive.');
        const name = new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(offset + 30, offset + 30 + nameSize));
        const path = name.replace(/\/$/, '');
        if (!/^usr(?:\/(?:bin|include|lib)(?:\/.*)?)?$/.test(path) || path.split('/').some((part) => !part || part === '.' || part === '..') || /[\\\x00-\x1f]/.test(name) || names.has(path)) throw new Error('Unsafe compiler archive path.');
        names.add(path);
        if (!name.endsWith('/')) {
          const packed = input.subarray(start, start + packedSize);
          let content;
          if (method === 0) content = packed.slice();
          else {
            const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
            content = new Uint8Array(size);
            let position = 0;
            try {
              while (true) {
                const item = await reader.read();
                if (item.done) break;
                if (position + item.value.length > size) throw new Error('Compiler archive expands beyond declared size.');
                content.set(item.value, position);
                position += item.value.length;
              }
              if (position !== size) throw new Error('Truncated compiler archive entry.');
            } finally { await reader.cancel().catch(() => {}); }
          }
          if (content.length !== size) throw new Error('Compiler archive size mismatch.');
          files.set('/' + path, content);
        }
        offset = start + packedSize;
      }
      if (offset + 4 > input.length || view.getUint32(offset, true) !== 0x02014b50 || !files.has('/usr/bin/cc')) throw new Error('Incomplete compiler archive.');
      return files;
    }
    return { unpack };
});
