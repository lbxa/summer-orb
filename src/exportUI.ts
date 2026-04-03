import type { ExportFormat } from './encoder';
import { supportsWebM } from './encoder';

export interface ExportUIEvents {
  onRecord(): void;
  onStop(): void;
}

export interface ExportUIHandle {
  setState(state: 'idle' | 'recording' | 'encoding' | 'ready'): void;
  setProgress(frameCount: number): void;
  setDownload(blob: Blob, filename: string): void;
  getSelectedFormat(): ExportFormat;
  destroy(): void;
}

export function createExportUI(
  container: HTMLElement,
  events: ExportUIEvents,
): ExportUIHandle {
  const bar = document.createElement('div');
  bar.className = 'export-bar';

  const recordBtn = document.createElement('button');
  recordBtn.className = 'export-btn export-btn--record';
  recordBtn.textContent = 'Record';
  recordBtn.addEventListener('click', events.onRecord);

  const stopBtn = document.createElement('button');
  stopBtn.className = 'export-btn export-btn--stop';
  stopBtn.textContent = 'Stop';
  stopBtn.style.display = 'none';
  stopBtn.addEventListener('click', events.onStop);

  const formatSelect = document.createElement('select');
  formatSelect.className = 'export-select';
  const apngOpt = document.createElement('option');
  apngOpt.value = 'apng';
  apngOpt.textContent = 'APNG (transparent)';
  formatSelect.appendChild(apngOpt);

  if (supportsWebM()) {
    const webmOpt = document.createElement('option');
    webmOpt.value = 'webm';
    webmOpt.textContent = 'WebM (no alpha)';
    formatSelect.appendChild(webmOpt);
  }

  const status = document.createElement('span');
  status.className = 'export-status';

  const downloadBtn = document.createElement('a');
  downloadBtn.className = 'export-btn export-btn--download';
  downloadBtn.textContent = 'Download';
  downloadBtn.style.display = 'none';

  bar.append(recordBtn, stopBtn, formatSelect, status, downloadBtn);
  container.appendChild(bar);

  let downloadUrl: string | null = null;

  const handle: ExportUIHandle = {
    setState(state) {
      recordBtn.style.display = state === 'idle' || state === 'ready' ? '' : 'none';
      stopBtn.style.display = state === 'recording' ? '' : 'none';
      formatSelect.disabled = state === 'recording' || state === 'encoding';
      downloadBtn.style.display = state === 'ready' ? '' : 'none';

      if (state === 'encoding') {
        status.textContent = 'Encoding\u2026';
      } else if (state === 'idle' || state === 'ready') {
        status.textContent = '';
      }
    },

    setProgress(frameCount) {
      status.textContent = `${frameCount} frames`;
    },

    setDownload(blob, filename) {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
      downloadBtn.setAttribute('href', downloadUrl);
      downloadBtn.setAttribute('download', filename);
    },

    getSelectedFormat(): ExportFormat {
      return formatSelect.value as ExportFormat;
    },

    destroy() {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      bar.remove();
    },
  };

  return handle;
}
