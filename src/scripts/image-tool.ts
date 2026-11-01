import { canvasToBlob, fileExtensionForMime, formatBytes, loadImage, renderImage, safeBaseName, validateDimensions, validateImage } from './image-utils';
import type { LoadedImage } from './image-utils';
import { toolUI } from './tool-ui';

export function initImageTool(root: HTMLElement, mode: 'compress' | 'webp' | 'resize') {
  const ui = toolUI(root);
  const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
  const controls = root.querySelector<HTMLElement>('[data-controls]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-process]')!;
  const quality = root.querySelector<HTMLInputElement>('[data-quality]')!;
  const qualityOutput = root.querySelector<HTMLOutputElement>('[data-quality-output]')!;
  const format = root.querySelector<HTMLSelectElement>('[data-format]');
  const width = root.querySelector<HTMLInputElement>('[data-width]');
  const height = root.querySelector<HTMLInputElement>('[data-height]');
  const lock = root.querySelector<HTMLInputElement>('[data-lock]');
  let selected: { file: File; mime: string; width: number; height: number } | null = null;
  let working = false;

  function updateQuality() {
    qualityOutput.value = `${quality.value}%`;
    quality.disabled = (format?.value === 'same' || !format) ? selected?.mime === 'image/png' && mode !== 'webp' : format.value === 'image/png';
  }
  quality.addEventListener('input', updateQuality);
  controls.addEventListener('input', () => ui.clear());
  format?.addEventListener('change', () => { ui.clear(); updateQuality(); });
  input.addEventListener('change', async () => {
    if (working) return;
    selected = null;
    ui.clear();
    controls.classList.add('hidden');
    const file = input.files?.[0];
    if (!file) { ui.message('Choose an image to begin.'); return; }
    working = true;
    ui.busy(true);
    ui.message('Reading image locally…');
    const revision = ui.revision();
    let image: LoadedImage | undefined;
    try {
      const mime = await validateImage(file, mode === 'webp');
      try { image = await loadImage(file); }
      catch { throw new Error('This image could not be decoded or exceeds the image limits. Choose a smaller, undamaged JPG, PNG or WebP.'); }
      if (!ui.isCurrent(revision)) return;
      selected = { file, mime, width: image.width, height: image.height };
      if (width && height) { width.value = String(image.width); height.value = String(image.height); }
      controls.classList.remove('hidden');
      ui.message(`Ready. Original dimensions: ${image.width} × ${image.height}px.`);
    } catch (error) {
      if (!ui.isCurrent(revision)) return;
      ui.message(error instanceof Error ? error.message : 'This image could not be read. Select it again.', true);
      input.value = '';
    } finally {
      image?.dispose();
      working = false;
      ui.busy(false);
      updateQuality();
    }
  });

  width?.addEventListener('input', () => {
    if (lock?.checked && selected && Number(width.value) > 0) {
      height!.value = String(Math.max(1, Math.round(Number(width.value) * selected.height / selected.width)));
    }
  });
  height?.addEventListener('input', () => {
    if (lock?.checked && selected && Number(height.value) > 0) {
      width!.value = String(Math.max(1, Math.round(Number(height.value) * selected.width / selected.height)));
    }
  });
  lock?.addEventListener('change', () => {
    ui.clear();
    if (lock.checked && selected && Number(width!.value) > 0) {
      height!.value = String(Math.max(1, Math.round(Number(width!.value) * selected.height / selected.width)));
    }
  });

  button.addEventListener('click', async () => {
    if (!selected || working) return;
    const source = selected;
    ui.clear();
    let image: LoadedImage | undefined;
    let canvas: HTMLCanvasElement | undefined;
    working = true;
    ui.busy(true);
    ui.message('Processing image locally…');
    const revision = ui.revision();
    try {
      const w = width ? Number(width.value) : source.width;
      const h = height ? Number(height.value) : source.height;
      validateDimensions(w, h);
      image = await loadImage(source.file);
      canvas = renderImage(image, w, h);
      image.dispose();
      image = undefined;
      const mime = mode === 'webp' ? 'image/webp' : format && format.value !== 'same' ? format.value : source.mime;
      const blob = await canvasToBlob(canvas, mime, Number(quality.value) / 100);
      if (!ui.isCurrent(revision)) return;
      const set = (selector: string, value: string) => { const element = root.querySelector(selector); if (element) element.textContent = value; };
      set('[data-original-size]', formatBytes(source.file.size));
      set('[data-result-size]', formatBytes(blob.size));
      const delta = (source.file.size - blob.size) / source.file.size * 100;
      set('[data-saving]', `${delta >= 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)}%`);
      set('[data-original-dim]', `${source.width} × ${source.height}`);
      set('[data-result-dim]', `${w} × ${h}`);
      const suffix = mode === 'resize' ? `-${w}x${h}` : mode === 'compress' ? '-compressed' : '';
      ui.show(blob, `${safeBaseName(source.file.name)}${suffix}.${fileExtensionForMime(blob.type)}`);
      ui.message('Done. Inspect the locally created result before downloading.');
    } catch (error) {
      if (!ui.isCurrent(revision)) return;
      ui.message(error instanceof Error && /^(Enter |Images must|This browser|The browser|Canvas |This image could not be drawn)/.test(error.message)
        ? error.message : 'This image could not be processed. Try a smaller, undamaged image.', true);
    } finally {
      image?.dispose();
      if (canvas) canvas.width = canvas.height = 0;
      working = false;
      ui.busy(false);
      updateQuality();
    }
  });
  window.addEventListener('pagehide', () => {
    selected = null;
    input.value = '';
    controls.classList.add('hidden');
    ui.message('Choose an image to begin.');
  });
}
