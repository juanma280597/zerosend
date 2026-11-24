export type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;
export const MAX_IMAGE_DIMENSION = 8192;

export function validateDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error('Enter whole-number width and height values of at least 1 pixel.');
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
    throw new Error('Images must be at most 8192 pixels per side and 16 megapixels in total. Try a smaller image.');
  }
}

export async function validateImage(file: File, converterOnly = false): Promise<string> {
  if (!file.size) throw new Error('This file is empty. Choose a JPG, PNG or WebP image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image no larger than 25 MiB.');
  let header: Uint8Array;
  try { header = new Uint8Array(await file.slice(0, 12).arrayBuffer()); }
  catch { throw new Error('This file could not be read. Select it again from your device.'); }
  const matches = (bytes: number[], offset = 0) => bytes.every((byte, index) => header[offset + index] === byte);
  const mime = matches([0xff, 0xd8, 0xff]) ? 'image/jpeg'
    : matches([137, 80, 78, 71, 13, 10, 26, 10]) ? 'image/png'
    : matches([82, 73, 70, 70]) && matches([87, 69, 66, 80], 8) ? 'image/webp' : '';
  if (!mime || (converterOnly && mime === 'image/webp')) {
    throw new Error(converterOnly ? 'Choose a valid JPG or PNG image.' : 'Choose a valid JPG, PNG or WebP image.');
  }
  if (file.type && file.type !== 'application/octet-stream' && file.type !== mime) {
    throw new Error('The file contents do not match its image type. Choose an original JPG, PNG or WebP.');
  }
  return mime;
}

export async function loadImage(file: File): Promise<LoadedImage> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      try { validateDimensions(bitmap.width, bitmap.height); }
      catch (error) { bitmap.close(); throw error; }
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Images must')) throw error;
      // Some mobile browsers expose ImageBitmap but cannot decode every supported image.
      // Try the local <img> decoder before reporting a decode error.
    }
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The browser could not decode this image.'));
      img.src = url;
    });
    validateDimensions(img.naturalWidth, img.naturalHeight);
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      dispose: () => { img.removeAttribute('src'); URL.revokeObjectURL(url); },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export function renderImage(source: LoadedImage, width: number, height: number): HTMLCanvasElement {
  validateDimensions(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) { canvas.width = canvas.height = 0; throw new Error('Canvas is unavailable in this browser.'); }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  try { context.drawImage(source.source, 0, 0, width, height); }
  catch { canvas.width = canvas.height = 0; throw new Error('This image could not be drawn. Try a smaller image.'); }
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality = 0.82): Promise<Blob> {
  if (type === 'image/jpeg') {
    const context = canvas.getContext('2d')!;
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'source-over';
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || !blob.size) reject(new Error('The browser could not encode this image. Try a smaller image.'));
        else if (blob.type !== type) reject(new Error('This browser cannot create the selected format. Try another format or browser.'));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

export function safeBaseName(name: string): string {
  const index = name.lastIndexOf('.');
  return (index > 0 ? name.slice(0, index) : name).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[.\-]+|[.\-]+$/g, '').slice(0, 100) || 'zerosend-file';
}

export function fileExtensionForMime(mime: string): string {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}
