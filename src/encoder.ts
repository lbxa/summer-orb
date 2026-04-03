import UPNG from 'upng-js';
import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import type { RecordedFrames } from './recorder';

export type ExportFormat = 'apng' | 'webm';

export function supportsWebM(): boolean {
  return typeof VideoEncoder !== 'undefined';
}

export function encodeAPNG(data: RecordedFrames): Blob {
  const { frames, width, height, fps } = data;
  const delayMs = Math.round(1000 / fps);
  const delays = new Array<number>(frames.length).fill(delayMs);
  const buffers = frames.map((f) => f.buffer as ArrayBuffer);
  const png = UPNG.encode(buffers, width, height, 0, delays);
  const blob = new Blob([png], { type: 'image/apng' });
  console.log(`[export] APNG: ${frames.length} frames, ${width}x${height}, ${(blob.size / 1024).toFixed(0)} KB`);
  return blob;
}

export async function encodeWebM(data: RecordedFrames): Promise<Blob> {
  if (!supportsWebM()) throw new Error('VideoEncoder not available');

  const { frames, width, height, fps } = data;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'V_VP9', width, height },
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error', e),
  });

  encoder.configure({
    codec: 'vp09.00.10.08',
    width,
    height,
    bitrate: 5_000_000,
  });

  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d')!;

  for (let i = 0; i < frames.length; i++) {
    const clamped = new Uint8ClampedArray(frames[i].buffer as ArrayBuffer);
    ctx.putImageData(new ImageData(clamped, width), 0, 0);

    const vf = new VideoFrame(offscreen, {
      timestamp: Math.round((i / fps) * 1_000_000),
    });
    encoder.encode(vf, { keyFrame: i % 30 === 0 });
    vf.close();
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  return new Blob([target.buffer], { type: 'video/webm' });
}
