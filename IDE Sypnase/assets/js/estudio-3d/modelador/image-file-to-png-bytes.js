'use strict';

const IMPORTED_TEXTURE_MAX_SIDE = 2048;

function decodeImageFile(file) {
  return new Promise((resolve, reject) => {
      const address = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(address);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(address);
        reject(new Error('image could not be decoded'));
      };
      image.src = address;
  });
}

function pngBytesFromCanvas(canvas) {
  return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('png conversion failed'));
            return;
          }
          blob
          .arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch(() => reject(new Error('png conversion failed')));
        }, 'image/png');
  });
}

async function imageFileToPngBytes(file) {
  const image = await decodeImageFile(file);
  const sourceWidth = image.naturalWidth || 0;
  const sourceHeight = image.naturalHeight || 0;
  if (!sourceWidth || !sourceHeight) throw new Error('image has no pixels');
  const scale = Math.min(1, IMPORTED_TEXTURE_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas is unavailable');
  context.drawImage(image, 0, 0, width, height);
  const bytes = await pngBytesFromCanvas(canvas);
  canvas.width = 1;
  canvas.height = 1;
  return bytes;
}
