'use strict';

function mod3dSourceBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  }
  return btoa(binary);
}

function mod3dSourceFromBase64(value) {
  mod3dSourceAssert(
    typeof value === 'string' &&
    value.length <= MOD3D_SOURCE_FILE_MAX_BYTES &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value),
    'Invalid compressed source',
  );
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function mod3dReadBoundedStream(stream, limit) {
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.length;
      mod3dSourceAssert(length <= limit, 'Decompressed source limit exceeded');
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function mod3dEncodeSource(source, options = {}) {
  mod3dValidateSourceDocument(source);
  const text = JSON.stringify(source);
  const bytes = new TextEncoder().encode(text);
  mod3dSourceAssert(bytes.length <= MOD3D_SOURCE_MAX_BYTES, 'Editable source limit exceeded');
  if (
    options.compress !== false &&
    bytes.length >= 4096 &&
    typeof CompressionStream === 'function'
  ) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressed = await mod3dReadBoundedStream(stream, MOD3D_SOURCE_FILE_MAX_BYTES);
    const wrapper = JSON.stringify({
        format: MOD3D_SOURCE_FORMAT,
        version: MOD3D_SOURCE_VERSION,
        encoding: 'gzip-base64',
        byteLength: bytes.length,
        checksum: mod3dResumoDosBytes(bytes),
        data: mod3dSourceBase64(compressed),
    });
    if (wrapper.length < text.length && wrapper.length <= MOD3D_SOURCE_FILE_MAX_BYTES) {
      return wrapper;
    }
  }
  mod3dSourceAssert(
    bytes.length <= MOD3D_SOURCE_FILE_MAX_BYTES,
    'Source is too large without compression',
  );
  return text;
}

async function mod3dDecodeSource(text) {
  mod3dSourceAssert(
    typeof text === 'string' &&
    new TextEncoder().encode(text).length <= MOD3D_SOURCE_FILE_MAX_BYTES,
    'Editable source file limit exceeded',
  );
  let source = JSON.parse(text);
  if (source && source.encoding) {
    mod3dSourceAssert(
      source.format === MOD3D_SOURCE_FORMAT &&
      source.version === MOD3D_SOURCE_VERSION &&
      source.encoding === 'gzip-base64',
      'Unsupported source encoding or version',
    );
    mod3dSourceInteger(source.byteLength, 1, MOD3D_SOURCE_MAX_BYTES, 'uncompressed size');
    mod3dSourceAssert(
      typeof DecompressionStream === 'function',
      'This browser cannot open compressed sources. Use a browser with gzip decompression support.',
    );
    const input = mod3dSourceFromBase64(source.data);
    const bytes = await mod3dReadBoundedStream(
      new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip')),
      source.byteLength,
    );
    mod3dSourceAssert(
      bytes.length === source.byteLength && mod3dResumoDosBytes(bytes) === source.checksum,
      'Source checksum mismatch',
    );
    source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  return mod3dValidateSourceDocument(source);
}
