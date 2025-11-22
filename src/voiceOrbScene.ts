import {
  AmbientLight,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  HemisphereLight,
  MathUtils,
  PerspectiveCamera,
  Mesh,
  Points,
  PointsMaterial,
  PointLight,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Uniform,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface VoiceOrbSceneOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
}

export type OrbState = 'idle' | 'listening' | 'speaking';

export interface VoiceOrbSceneHandle {
  start(): Promise<void>;
  stop(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const BASE_BLUE = new Color('#0b6eea');
const HIGHLIGHT_BLUE = new Color('#7acbff');
const CORE_GLOW_BLUE = new Color('#1a8cff');
const PARTICLE_BLUE = new Color('#8fd7ff');
const BACKGROUND_COLOR = new Color('#ffffff');

interface OrbUniforms {
  uTime: Uniform<number>;
  uAmplitude: Uniform<number>;
  uBassAmplitude: Uniform<number>;
  uSpectrumTilt: Uniform<number>;
  uBaseColor: Uniform<Color>;
  uHighlightColor: Uniform<Color>;
}

interface OrbStateThresholds {
  listening: number;
  speaking: number;
  falloff: number;
}

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uBassAmplitude;
  uniform float uSpectrumTilt;
  varying float vRipple;

  // Simple 3D noise based on IQ's classic hash
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    float noiseScale = 1.2;
    float time = uTime * 0.4;
    float displacement = snoise(normal * noiseScale + time) * 0.12;
    float fineRipples = snoise(normal * 6.0 + time * 1.8) * 0.025;
    float radial = length(position.xy);
    float wave = sin(radial * 6.0 - time * 3.0 + uSpectrumTilt * 2.0) * 0.05;
    float bassPush = uBassAmplitude * 0.45;
    float spectrumLean = uSpectrumTilt * 0.12;
    float surfaceFlow = displacement + fineRipples + wave;
    vec3 warpedPosition = position + normal * (surfaceFlow + bassPush + spectrumLean);

    vec4 mvPosition = modelViewMatrix * vec4(warpedPosition, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vPosition = mvPosition.xyz;
    vRipple = surfaceFlow;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uAmplitude;
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;
  varying float vRipple;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - dot(vNormal, viewDir), 2.4);
    float specular = pow(max(dot(reflect(-viewDir, vNormal), vec3(0.0, 1.0, 0.5)), 0.0), 32.0);
    float rippleTint = clamp(vRipple * 4.0 + 0.5, 0.0, 1.0);
    float depthFade = pow(1.0 - clamp(length(vPosition.xy) / 2.6, 0.0, 1.0), 1.4);
    float glow = mix(0.5, 1.1, uAmplitude);
    vec3 color = mix(uBaseColor, uHighlightColor, fresnel + rippleTint * 0.35);
    color += vec3(0.08, 0.11, 0.2) * specular;
    color *= (depthFade + fresnel * 1.35) * glow;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const shellFragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vRipple;
  uniform float uAmplitude;
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;

  void main() {
    float fresnel = pow(1.0 - dot(vNormal, normalize(-vPosition)), 3.0);
    float rim = mix(0.4, 1.0, fresnel);
    float rippleEdge = clamp(vRipple * 4.0 + 0.5, 0.0, 1.0);
    float opacity = mix(0.15, 0.38, uAmplitude + fresnel * 0.5 + rippleEdge * 0.15);
    vec3 color = mix(uBaseColor, uHighlightColor, rim + rippleEdge * 0.2);
    gl_FragColor = vec4(color * (rim + uAmplitude), opacity);
  }
`;

class VoiceOrbController implements VoiceOrbSceneHandle {
  private readonly container: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly clock: Clock;

  private readonly coreMaterial: ShaderMaterial;
  private readonly shellMaterial: ShaderMaterial;
  private readonly particleMaterial: PointsMaterial;

  private readonly analyser: AnalyserNode;
  private readonly audioContext: AudioContext;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioStream: MediaStream | null = null;

  private readonly dataArray: Uint8Array;
  private readonly freqArray: Uint8Array;

  private state: OrbState = 'idle';
  private readonly thresholds: OrbStateThresholds = {
    listening: 0.05,
    speaking: 0.12,
    falloff: 0.02,
  };

  private frameId: number | null = null;
  private isRunning = false;

  constructor(options: VoiceOrbSceneOptions) {
    this.container = options.container;
    const width = options.width ?? this.container.clientWidth || 800;
    const height = options.height ?? this.container.clientHeight || 600;

    this.scene = new Scene();
    this.scene.background = BACKGROUND_COLOR.clone();

    this.camera = new PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 4);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new Vector2(width, height), 0.8, 0.6, 0.75);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);

    this.clock = new Clock();

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;
    this.dataArray = new Uint8Array(this.analyser.fftSize);
    this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);

    const orbUniforms: OrbUniforms = {
      uTime: new Uniform(0),
      uAmplitude: new Uniform(0),
      uBassAmplitude: new Uniform(0),
      uSpectrumTilt: new Uniform(0),
      uBaseColor: new Uniform(BASE_BLUE.clone()),
      uHighlightColor: new Uniform(CORE_GLOW_BLUE.clone()),
    };

    this.coreMaterial = new ShaderMaterial({
      uniforms: orbUniforms,
      vertexShader,
      fragmentShader,
      transparent: false,
    });

    this.shellMaterial = new ShaderMaterial({
      uniforms: {
        ...orbUniforms,
        uBaseColor: new Uniform(BASE_BLUE.clone()),
        uHighlightColor: new Uniform(HIGHLIGHT_BLUE.clone()),
      },
      vertexShader,
      fragmentShader: shellFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.particleMaterial = new PointsMaterial({
      size: 0.035,
      color: PARTICLE_BLUE,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.setupSceneObjects();
    this.setupLights();
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.sourceNode = this.audioContext.createMediaStreamSource(this.audioStream);
      this.sourceNode.connect(this.analyser);
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.isRunning = true;
      this.clock.start();
      this.animate();
    } catch (error) {
      // Fallback to idle animation only
      console.error('Microphone access denied or unavailable', error);
      this.isRunning = true;
      this.clock.start();
      this.animate();
    }
  }

  public stop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.isRunning = false;
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  public dispose(): void {
    this.stop();
    this.renderer.dispose();
    this.coreMaterial.dispose();
    this.shellMaterial.dispose();
    this.particleMaterial.dispose();
    this.scene.clear();
    this.audioContext.close().catch(() => undefined);
  }

  private setupSceneObjects(): void {
    const coreGeometry = new SphereGeometry(1, 192, 192);
    const core = new Mesh(coreGeometry, this.coreMaterial);
    this.scene.add(core);

    const shellGeometry = new SphereGeometry(1.08, 192, 192);
    const shell = new Mesh(shellGeometry, this.shellMaterial);
    this.scene.add(shell);

    const particleGeometry = new BufferGeometry();
    const particleCount = 420;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const direction = new Vector3().randomDirection();
      const radius = 1.35 + Math.random() * 0.25;
      const pos = direction.multiplyScalar(radius);
      positions.set([pos.x, pos.y, pos.z], i * 3);
    }
    particleGeometry.setAttribute('position', new BufferAttribute(positions, 3));
    const particles = new Points(particleGeometry, this.particleMaterial);
    this.scene.add(particles);
  }

  private setupLights(): void {
    const ambient = new AmbientLight('#7fb2ff', 0.75);
    const fill = new HemisphereLight('#dff0ff', '#9ab6ff', 0.85);
    const backLight = new PointLight('#3f7fff', 1.35, 12);
    backLight.position.set(-3, 2, -2);
    const keyLight = new PointLight('#8bc5ff', 1.15, 14);
    keyLight.position.set(3, 1.5, 2);
    this.scene.add(ambient);
    this.scene.add(fill);
    this.scene.add(backLight);
    this.scene.add(keyLight);
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;

    const amplitude = this.computeAmplitude();
    const bass = this.computeBassEnergy();
    const spectrumTilt = this.computeSpectrumTilt();
    this.updateState(amplitude);
    this.updateUniforms(elapsed, amplitude, bass, spectrumTilt);
    this.updateCamera(delta, spectrumTilt);
    this.updateParticles(amplitude, spectrumTilt, delta);

    this.composer.render();
  };

  private computeAmplitude(): number {
    if (!this.isRunning || !this.sourceNode) {
      return 0.02 + Math.sin(this.clock.elapsedTime * 0.6) * 0.01;
    }
    this.analyser.getByteTimeDomainData(this.dataArray);
    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i += 1) {
      const val = (this.dataArray[i] - 128) / 128;
      sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length);
    return MathUtils.clamp(rms, 0, 1);
  }

  private computeBassEnergy(): number {
    if (!this.isRunning || !this.sourceNode) {
      return 0.05;
    }
    this.analyser.getByteFrequencyData(this.freqArray);
    const binCount = Math.max(1, Math.floor(this.freqArray.length * 0.08));
    let sum = 0;
    for (let i = 0; i < binCount; i += 1) {
      sum += this.freqArray[i] / 255;
    }
    return sum / binCount;
  }

  private computeSpectrumTilt(): number {
    if (!this.isRunning || !this.sourceNode) {
      return Math.sin(this.clock.elapsedTime * 0.3) * 0.2;
    }
    this.analyser.getByteFrequencyData(this.freqArray);
    let weightedSum = 0;
    let total = 0;
    for (let i = 0; i < this.freqArray.length; i += 1) {
      const value = this.freqArray[i] / 255;
      weightedSum += value * i;
      total += value;
    }
    if (total === 0) return 0;
    const centroid = weightedSum / total;
    const normalized = centroid / this.freqArray.length;
    return MathUtils.clamp((normalized - 0.5) * 2, -1, 1);
  }

  private updateState(amplitude: number): void {
    const { listening, speaking, falloff } = this.thresholds;
    if (this.state === 'idle' && amplitude > listening) {
      this.state = 'listening';
    } else if (this.state === 'listening' && amplitude > speaking) {
      this.state = 'speaking';
    } else if (this.state === 'speaking' && amplitude < speaking - falloff) {
      this.state = 'listening';
    } else if (this.state === 'listening' && amplitude < listening - falloff) {
      this.state = 'idle';
    }
  }

  private updateUniforms(time: number, amplitude: number, bass: number, tilt: number): void {
    const intensity = this.getStateIntensity();
    this.coreMaterial.uniforms.uTime.value = time;
    this.coreMaterial.uniforms.uAmplitude.value = amplitude * intensity + 0.02;
    this.coreMaterial.uniforms.uBassAmplitude.value = bass * intensity;
    this.coreMaterial.uniforms.uSpectrumTilt.value = tilt;

    this.shellMaterial.uniforms.uTime.value = time * 0.8;
    this.shellMaterial.uniforms.uAmplitude.value = amplitude * (0.8 + intensity * 0.4);
    this.shellMaterial.uniforms.uBassAmplitude.value = bass * 0.5;
    this.shellMaterial.uniforms.uSpectrumTilt.value = tilt * 0.5;

    this.bloomPass.strength = 0.8 + amplitude * 0.9 * intensity;
  }

  private updateCamera(delta: number, tilt: number): void {
    const targetX = tilt * 0.35;
    const targetY = Math.sin(this.clock.elapsedTime * 0.22) * 0.12;
    this.camera.position.x = MathUtils.damp(this.camera.position.x, targetX, 3, delta);
    this.camera.position.y = MathUtils.damp(this.camera.position.y, targetY, 3, delta);
    this.camera.lookAt(0, 0, 0);
  }

  private updateParticles(amplitude: number, tilt: number, delta: number): void {
    const pulse = 1 + amplitude * 0.6;
    const sizeBase = 0.035 + amplitude * 0.02;
    this.particleMaterial.size = MathUtils.damp(this.particleMaterial.size, sizeBase, 5, delta);
    const hueShift = MathUtils.clamp(0.1 * amplitude + tilt * 0.05, -0.2, 0.2);
    const newColor = PARTICLE_BLUE.clone().offsetHSL(hueShift, 0, amplitude * 0.1);
    this.particleMaterial.color.copy(newColor);
    this.particleMaterial.opacity = 0.4 + amplitude * 0.6;
    this.scene.rotation.y += delta * 0.1 * pulse;
  }

  private getStateIntensity(): number {
    switch (this.state) {
      case 'speaking':
        return 1.4;
      case 'listening':
        return 1.0;
      default:
        return 0.6;
    }
  }
}

export function createVoiceOrbScene(options: VoiceOrbSceneOptions): VoiceOrbSceneHandle {
  return new VoiceOrbController(options);
}
