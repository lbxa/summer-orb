import type { ExportableVoiceOrbHandle } from './voiceOrbScene';
import { OrbRecorder } from './recorder';
import { encodeAPNG, encodeWebM } from './encoder';
import { createExportUI } from './exportUI';

export interface ExportModuleHandle {
  destroy(): void;
}

export function initExportModule(
  handle: ExportableVoiceOrbHandle,
  container: HTMLElement,
): ExportModuleHandle {
  const recorder = new OrbRecorder(handle);
  let finishing = false;

  const ui = createExportUI(container, {
    onRecord() {
      ui.setState('recording');
      recorder.startRecording(
        (count) => ui.setProgress(count),
        () => finishRecording(),
      );
    },
    onStop() {
      finishRecording();
    },
  });

  async function finishRecording(): Promise<void> {
    if (finishing) return;
    finishing = true;
    ui.setState('encoding');

    const data = await recorder.stopRecording();
    const format = ui.getSelectedFormat();

    const blob =
      format === 'webm'
        ? await encodeWebM(data)
        : encodeAPNG(data);

    const ext = format === 'webm' ? 'webm' : 'apng';
    ui.setDownload(blob, `orb-export.${ext}`);
    ui.setState('ready');
    finishing = false;
  }

  return {
    destroy() {
      if (recorder.isRecording) {
        recorder.stopRecording().catch(() => undefined);
      }
      ui.destroy();
    },
  };
}
