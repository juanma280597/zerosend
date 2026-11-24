import { PDFDocument } from 'pdf-lib';
import { formatBytes, safeBaseName } from './image-utils';
import { FileProblem, MAX_PDF_BYTES, MAX_PDF_PAGES, MAX_PDF_TOTAL_BYTES, parseRanges, pdfBlob, readPdf } from './pdf-utils';
import { toolUI } from './tool-ui';

export function initMergeTool(root: HTMLElement) {
  const ui = toolUI(root);
  const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-process]')!;
  let files: File[] = [];
  let working = false;

  function draw(focusIndex?: number, actionIndex = 0) {
    ui.clear();
    list.replaceChildren();
    files.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'file-row';
      const name = document.createElement('span');
      name.textContent = file.name;
      const actions = document.createElement('div');
      for (const delta of [-1, 1]) {
        const move = document.createElement('button');
        move.type = 'button';
        move.textContent = delta === -1 ? '↑' : '↓';
        move.setAttribute('aria-label', `Move PDF ${index + 1} ${delta === -1 ? 'up' : 'down'}`);
        move.className = 'icon-button';
        move.disabled = index + delta < 0 || index + delta >= files.length;
        move.addEventListener('click', () => {
          if (working) return;
          const next = index + delta;
          [files[index], files[next]] = [files[next]!, files[index]!];
          draw(next, delta === -1 ? 0 : 1);
        });
        actions.append(move);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'text-button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove PDF ${index + 1}`);
      remove.addEventListener('click', () => {
        if (working) return;
        files.splice(index, 1);
        draw(Math.min(index, files.length - 1), 2);
      });
      actions.append(remove);
      row.append(name, actions);
      list.append(row);
    });
    button.classList.toggle('hidden', files.length < 2);
    button.disabled = files.length < 2;
    ui.message(files.length ? `${files.length} PDF${files.length === 1 ? '' : 's'} selected. Choose at least two to merge.` : 'Choose at least two PDFs.');
    if (focusIndex !== undefined) {
      const row = list.children[focusIndex];
      const candidate = row?.querySelectorAll<HTMLButtonElement>('button')[actionIndex];
      if (candidate && !candidate.disabled) candidate.focus();
      else if (row) row.querySelector<HTMLButtonElement>('.text-button')?.focus();
      else input.focus();
    }
  }

  input.addEventListener('change', () => {
    if (working) return;
    files = Array.from(input.files ?? []);
    input.value = ''; // Release FileList; keep only the removable selection above.
    const invalid = files.some((file) => !file.size || file.size > MAX_PDF_BYTES || (file.type && !['application/pdf', 'application/octet-stream'].includes(file.type)));
    const tooLarge = files.reduce((sum, file) => sum + file.size, 0) > MAX_PDF_TOTAL_BYTES;
    if (invalid || tooLarge) {
      files = [];
      draw();
      ui.message(tooLarge ? 'Choose PDFs totaling no more than 100 MiB.' : 'Choose non-empty PDF files no larger than 50 MiB each.', true);
      return;
    }
    draw();
  });

  button.addEventListener('click', async () => {
    if (working || files.length < 2) return;
    working = true;
    ui.clear();
    ui.busy(true);
    ui.message('Merging PDFs locally…');
    const revision = ui.revision();
    try {
      const output = await PDFDocument.create();
      for (const file of files) {
        const source = await readPdf(file);
        if (!ui.isCurrent(revision)) return;
        if (output.getPageCount() + source.getPageCount() > MAX_PDF_PAGES) {
          throw new FileProblem('Merge at most 2000 pages at a time.');
        }
        const copied = await output.copyPages(source, source.getPageIndices());
        copied.forEach((page) => output.addPage(page));
      }
      const blob = await pdfBlob(output);
      if (!ui.isCurrent(revision)) return;
      root.querySelector('[data-count]')!.textContent = String(files.length);
      root.querySelector('[data-pages]')!.textContent = String(output.getPageCount());
      root.querySelector('[data-size]')!.textContent = formatBytes(blob.size);
      ui.show(blob, 'zerosend-merged.pdf');
      ui.message('Done. The merged PDF was created in your browser.');
    } catch (error) {
      if (!ui.isCurrent(revision)) return;
      ui.message(error instanceof FileProblem ? error.message : 'These PDFs could not be merged. Try smaller, undamaged PDFs without encryption.', true);
    } finally {
      working = false;
      ui.busy(false);
    }
  });
  window.addEventListener('pagehide', () => {
    files = [];
    draw();
  });
}

export function initSplitTool(root: HTMLElement) {
  const ui = toolUI(root);
  const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
  const controls = root.querySelector<HTMLElement>('[data-controls]')!;
  const ranges = root.querySelector<HTMLInputElement>('[data-ranges]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-process]')!;
  let selected: { pdf: PDFDocument; filename: string } | null = null;
  let working = false;

  input.addEventListener('change', async () => {
    if (working) return;
    ui.clear();
    controls.classList.add('hidden');
    selected = null;
    root.querySelector('[data-name]')!.textContent = '';
    root.querySelector('[data-total]')!.textContent = '';
    const file = input.files?.[0];
    input.value = '';
    if (!file) { ui.message('Choose a PDF to begin.'); return; }
    working = true;
    ui.busy(true);
    ui.message('Reading PDF locally…');
    const revision = ui.revision();
    try {
      const pdf = await readPdf(file);
      if (!ui.isCurrent(revision)) return;
      selected = { pdf, filename: file.name };
      const total = pdf.getPageCount();
      root.querySelector('[data-name]')!.textContent = file.name;
      root.querySelector('[data-total]')!.textContent = String(total);
      ranges.value = `1-${Math.min(total, MAX_PDF_PAGES)}`;
      controls.classList.remove('hidden');
      ui.message(`Ready. ${total} pages found.`);
    } catch (error) {
      if (!ui.isCurrent(revision)) return;
      ui.message(error instanceof FileProblem ? error.message : 'This PDF could not be read. Try a smaller, undamaged file.', true);
    } finally { working = false; ui.busy(false); }
  });
  ranges.addEventListener('input', () => { ui.clear(); ranges.removeAttribute('aria-invalid'); });
  button.addEventListener('click', async () => {
    if (!selected || working) return;
    ui.clear();
    let pages: number[];
    try {
      pages = parseRanges(ranges.value, selected.pdf.getPageCount());
      ranges.removeAttribute('aria-invalid');
    } catch (error) {
      ranges.setAttribute('aria-invalid', 'true');
      ui.message(error instanceof FileProblem ? error.message : 'Enter valid pages or ranges.', true);
      ranges.focus();
      return;
    }
    working = true;
    ui.busy(true);
    ui.message('Extracting pages locally…');
    const revision = ui.revision();
    try {
      const output = await PDFDocument.create();
      const copied = await output.copyPages(selected.pdf, pages);
      copied.forEach((page) => output.addPage(page));
      const blob = await pdfBlob(output);
      if (!ui.isCurrent(revision)) return;
      root.querySelector('[data-count]')!.textContent = String(pages.length);
      root.querySelector('[data-size]')!.textContent = formatBytes(blob.size);
      ui.show(blob, `${safeBaseName(selected.filename)}-pages.pdf`);
      ui.message('Done. The extracted PDF was created in your browser.');
    } catch {
      if (!ui.isCurrent(revision)) return;
      ui.message('These pages could not be extracted. Try fewer pages or an undamaged PDF without encryption.', true);
    } finally { working = false; ui.busy(false); }
  });
  window.addEventListener('pagehide', () => {
    selected = null;
    controls.classList.add('hidden');
    root.querySelector('[data-name]')!.textContent = '';
    root.querySelector('[data-total]')!.textContent = '';
    ui.message('Choose a PDF to begin.');
  });
}
