import {
  AmbientLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { EffectComposer, RenderPass } from "postprocessing";

export interface VoiceOrbSceneOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
}

export interface VoiceOrbSceneHandle {
  start(): Promise<void>;
  stop(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

class VoiceOrbController implements VoiceOrbSceneHandle {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.1, 100);
  private readonly renderer = new WebGLRenderer({ antialias: true });
  private readonly composer: EffectComposer;

  private animationHandle: number | null = null;
  private readonly container: HTMLElement;
  private isStarted = false;

  constructor(options: VoiceOrbSceneOptions) {
    this.container = options.container;
    this.camera.position.set(0, 0, 4);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);

    this.scene.add(new AmbientLight(0x0b1a2e, 0.25));

    const initialWidth = options.width ?? window.innerWidth;
    const initialHeight = options.height ?? window.innerHeight;
    this.resize(initialWidth, initialHeight);

    this.container.appendChild(this.renderer.domElement);
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    this.isStarted = true;
    this.renderer.setAnimationLoop(() => this.render());
  }

  stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;
    this.renderer.setAnimationLoop(null);
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
    this.composer.dispose();
    this.container.replaceChildren();
  }

  private render(): void {
    this.composer.render();
  }
}

export function createVoiceOrbScene(
  options: VoiceOrbSceneOptions,
): VoiceOrbSceneHandle {
  return new VoiceOrbController(options);
}
