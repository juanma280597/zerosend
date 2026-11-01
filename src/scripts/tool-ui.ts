/** Local-only UI state. Never log or forward file-derived values. */
export function toolUI(root: HTMLElement) {
  const result = root.querySelector<HTMLElement>('[data-result]')!;
  const download = root.querySelector<HTMLAnchorElement>('[data-download]')!;
  const preview = root.querySelector<HTMLImageElement>('[data-preview]');
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  let url = '';
  let revision = 0;
  const disabledStates = new Map<HTMLInputElement | HTMLButtonElement | HTMLSelectElement, boolean>();

  function clear() {
    result.classList.add('hidden');
    preview?.removeAttribute('src');
    download.removeAttribute('href');
    download.removeAttribute('download');
    if (url) URL.revokeObjectURL(url);
    url = '';
  }

  function show(blob: Blob, filename: string) {
    clear();
    url = URL.createObjectURL(blob);
    if (preview) preview.src = url;
    download.href = url;
    download.download = filename;
    result.classList.remove('hidden');
  }

  function busy(value: boolean) {
    root.setAttribute('aria-busy', String(value));
    if (value) {
      root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input, button, select')
        .forEach((control) => {
          if (!disabledStates.has(control)) disabledStates.set(control, control.disabled);
          control.disabled = true;
        });
    } else {
      disabledStates.forEach((disabled, control) => { control.disabled = disabled; });
      disabledStates.clear();
    }
  }

  function message(text: string, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }

  window.addEventListener('pagehide', () => { revision += 1; clear(); });
  return { clear, show, busy, message, revision: () => revision, isCurrent: (value: number) => value === revision };
}
