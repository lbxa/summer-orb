import type { ExportableVoiceOrbHandle } from './voiceOrbScene';

export interface RecordedFrames {
  frames: Uint8Array[];
  width: number;
  height: number;
  fps: number;
}

const MAX_FRAMES = 90;
const YIELD_INTERVAL = 5;

export class OrbRecorder {
  private readonly handle: ExportableVoiceOrbHandle;
  private readonly fps: number;
  private recording = false;
  private frames: Uint8Array[] = [];
  private capturePromise: Promise<void> | null = null;

  constructor(handle: ExportableVoiceOrbHandle, fps = 30) {
    this.handle = handle;
    this.fps = fps;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  startRecording(
    onProgress?: (frameCount: number) => void,
    onAutoStop?: () => void,
  ): void {
    if (this.recording) return;
    this.frames = [];
    this.recording = true;
    this.handle.pauseAnimation();
    this.handle.setTransparentBackground(true);
    this.capturePromise = this.captureLoop(onProgress, onAutoStop);
  }

  async stopRecording(): Promise<RecordedFrames> {
    this.recording = false;
    if (this.capturePromise) {
      await this.capturePromise;
      this.capturePromise = null;
    }
    this.handle.setTransparentBackground(false);
    this.handle.resumeAnimation();
    const canvas = this.handle.getCanvas();
    return {
      frames: this.frames,
      width: canvas.width,
      height: canvas.height,
      fps: this.fps,
    };
  }

  private async captureLoop(
    onProgress?: (frameCount: number) => void,
    onAutoStop?: () => void,
  ): Promise<void> {
    const canvas = this.handle.getCanvas();
    const { width, height } = canvas;
    const scratch = new OffscreenCanvas(width, height);
    const ctx = scratch.getContext('2d', { willReadFrequently: true })!;

    while (this.recording && this.frames.length < MAX_FRAMES) {
      const idx = this.frames.length;
      this.handle.renderAtTime(idx / this.fps, 1 / this.fps);

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(canvas, 0, 0);
      const rgba = ctx.getImageData(0, 0, width, height);
      this.frames.push(new Uint8Array(rgba.data.buffer));

      onProgress?.(this.frames.length);

      if (idx % YIELD_INTERVAL === YIELD_INTERVAL - 1) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    if (this.frames.length >= MAX_FRAMES && this.recording) {
      this.recording = false;
      onAutoStop?.();
    }
  }
}
