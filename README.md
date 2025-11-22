## 1. Goal

Implement a web demo of a real time, voice reactive 3D "AI orb" that:

* Listens to microphone audio.
* Analyses amplitude and frequency spectrum in real time.
* Visualizes audio as a glowing, living blue orb.
* Feels like a hybrid of Jarvis and Siri, but with a unique visual identity.
* Runs in a single, fully typed TypeScript Three.js scene file that is concise and clean.

---

## 2. Tech Stack

**Runtime**

* Browser, desktop first.
* Modern Chromium and WebKit.

**Core**

* TypeScript.
* Three.js for 3D rendering.
* Web Audio API for audio input and analysis.

**Dev setup**

* Use Vite or a minimal bundler.
* Output a simple `index.html` that mounts the orb.

---

## 3. Files and Structure

Create these files:

1. `src/voiceOrbScene.ts`

   * Single, fully typed TypeScript file.
   * No `any`. No implicit `any`.
   * Contains all 3D and audio logic and the main exported setup function.

2. `src/main.ts`

   * Minimal bootstrapping.
   * Imports `createVoiceOrbScene` from `voiceOrbScene.ts`.
   * Attaches to a container div and starts the animation.

3. `index.html`

   * `<div id="app"></div>` container.
   * Start button to request mic access and start visualization.

Focus the spec on `voiceOrbScene.ts`.

---

## 4. Visual Design of the Orb

### 4.1 Overall composition

Orb should look like a blue, semi abstract, dynamic entity:

* Core sphere:

  * Smooth, slightly refractive.
  * Deep blue base color with subtle gradient.
* Outer shell:

  * Slightly larger, transparent or additive blending.
  * Pulses and ripples with audio.
* Energy field:

  * Small particles orbiting in a shell around the orb.
  * Particles brightness responds to high frequency content.
* Directional drift:

  * Orb position or tilt reacts to spectral centroid to simulate "turning toward" the voice.

### 4.2 Color palette

All blue or blue adjacent. No other hues.

Use a few named constants:

* `BASE_BLUE`: `#0f4c81`
* `HIGHLIGHT_BLUE`: `#4fc3f7`
* `CORE_GLOW_BLUE`: `#1e88e5`
* `PARTICLE_BLUE`: `#80d8ff`

Use HSL internally if helpful for subtle shifts:

* Base hue around 205 to 215.
* Saturation in the 60 to 90 range.
* Lightness between 20 and 70.

No warm colors.

### 4.3 Material and shading

Implement custom shaders via `ShaderMaterial`:

* Vertex shader:

  * Supports displacement along normals based on:

    * Low frequency amplitude.
    * A 3D noise field over position and time.
* Fragment shader:

  * Radial gradient from center to edge.
  * Fresnel like rim highlight.
  * Color intensity boosted by audio amplitude.
  * Optional bloom hint via bright falloff in shader color (actual bloom handled in post).

Outer shell:

* Slightly larger radius.
* Higher transparency.
* Stronger rim light, weaker center.

Particles:

* `Points` based on `BufferGeometry`.
* Simple fragment shader or `PointsMaterial` with size attenuated by distance.
* Color brightness modulated by high frequency energies.

---

## 5. Audio Pipeline

### 5.1 Capture

* Use `navigator.mediaDevices.getUserMedia({ audio: true })`.
* Create `AudioContext`.
* Connect stream to `MediaStreamAudioSourceNode`.
* Attach to `AnalyserNode`.

### 5.2 Analyser configuration

* `fftSize`: 2048.
* `smoothingTimeConstant`: 0.7.
* Use both:

  * `getByteTimeDomainData` for amplitude.
  * `getByteFrequencyData` for spectrum.

### 5.3 Derived metrics per frame

Compute:

* `amplitudeRMS`: root mean square of time domain data.
* `normalizedAmplitude`: `amplitudeRMS` mapped to [0, 1] with clamping.
* `frequencyBands`:

  * Low: 0 to 250 Hz.
  * Mid: 250 to 2000 Hz.
  * High: 2000 Hz to Nyquist.
  * Each as average magnitude, normalized to [0, 1].
* `spectralCentroid`:

  * Weighted average of frequency bins.
  * Normalize to [0, 1].

Provide a typed structure:

```ts
interface AudioMetrics {
  amplitude: number; // 0 to 1
  lowBand: number;   // 0 to 1
  midBand: number;   // 0 to 1
  highBand: number;  // 0 to 1
  spectralCentroid: number; // 0 to 1
}
```

All metrics should be smoothed frame to frame (simple exponential smoothing).

---

## 6. Animation Mappings

On each animation frame:

1. Update `AudioMetrics`.
2. Map metrics to orb properties.

### 6.1 Geometry

* Core scale:

  * Base scale: `1.0`.
  * Add `normalizedAmplitude * 0.3`.
  * Use smooth interpolation to avoid jitter.

* Surface displacement:

  * Vertex shader receives:

    * `uLowBand`, `uMidBand`, `uHighBand`.
    * `uTime`.
  * Displacement amplitude:

    * Base noise amplitude.
    * Plus `lowBand` contribution.
  * High band adds sharper micro ripples.

### 6.2 Color and glow

* Core color intensity:

  * Brightness = base plus `amplitude * factor`.
* Rim intensity:

  * Boosted by `highBand`.
* Hue variation:

  * Slightly adjust lightness and saturation based on `spectralCentroid`.
  * Hue stays within blue, do not cross to green or purple.

Shader uniforms, typed:

```ts
interface OrbShaderUniforms {
  uTime: { value: number };
  uAmplitude: { value: number };
  uLowBand: { value: number };
  uMidBand: { value: number };
  uHighBand: { value: number };
  uSpectralCentroid: { value: number };
  uBaseColor: { value: THREE.Color };
}
```

### 6.3 Orb movement

* Position offset:

  * Map `spectralCentroid` to a target horizontal angle around the camera or to x and y offsets.
  * Example:

    * `targetX = (spectralCentroid - 0.5) * maxOffset`.
    * `targetY = (midBand - 0.5) * maxOffset`.

* Use linear interpolation from current position to target.

* Idle motion:

  * When amplitude is near zero, fall back to a slow, small circular idle drift driven by `uTime`.

### 6.4 Particles

* Particle size:

  * Base size plus `highBand` influence.
* Particle opacity:

  * Fade with amplitude.
* Optional radial pulsation driven by `midBand`.

---

## 7. Scene and Camera

### 7.1 Scene setup

* Create `THREE.Scene`.

* Background:

  * Very dark blue to black gradient or solid.
  * Example: `#020814`.

* Camera:

  * `PerspectiveCamera`.
  * FOV around 45 degrees.
  * Position slightly in front, for example `(0, 0, 4)`.

* Renderer:

  * Antialias enabled.
  * Device pixel ratio capped at 2.

* Lighting:

  * Minimal, since most light is from shaders.
  * Use a dim `AmbientLight` and one `PointLight` behind the orb to add subtle depth if needed.

### 7.2 Post processing (optional but preferred)

* Add simple bloom via `EffectComposer` and `UnrealBloomPass`.
* Keep parameters subtle so orb remains readable.

---

## 8. Interaction and State

Define orb states:

* `idle`: no audio or low amplitude.
* `listening`: mic on, moderate amplitude.
* `speaking`: high amplitude bursts.

State machine rules:

* Use amplitude thresholds with hysteresis.
* State influences:

  * Idle: softer motion, lower glow.
  * Listening: moderate deformation and glow.
  * Speaking: stronger deformation, brighter particles, more movement.

Optional:

```ts
type OrbState = "idle" | "listening" | "speaking";
```

State should be derived inside `VoiceOrbController`.

---

## 9. TypeScript API in `voiceOrbScene.ts`

Implement a main function that can be called from `main.ts`:

```ts
export interface VoiceOrbSceneOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
}

export interface VoiceOrbSceneHandle {
  start(): Promise<void>; // requests mic access and starts audio + render loop
  stop(): void; // stops audio and animation
  resize(width: number, height: number): void;
  dispose(): void; // cleans up all resources
}

export function createVoiceOrbScene(
  options: VoiceOrbSceneOptions
): VoiceOrbSceneHandle;
```

Design:

* Internally create a class with full typing. For example:

```ts
class VoiceOrbController implements VoiceOrbSceneHandle {
  // Fully typed fields for scene, camera, renderer, audio, metrics
}
```

Constraints:

* No `any`.
* Use strict compiler options: `"strict": true`.

---

## 10. Performance and Quality

* Aim for 60 FPS on a mid tier laptop.
* Use requestAnimationFrame loop.
* Avoid excessive allocations per frame.
* Reuse arrays for analyser data.
* Expose a simple `resize` method that updates camera aspect and renderer size.

---

## 11. UX of the Demo

* `index.html`:

  * Centered orb canvas.
  * A single "Enable microphone" button overlay before audio starts.
  * After permission granted, hide the button and show orb.

* If mic permission fails:

  * Display a short error message.
  * Orb should remain in idle, purely procedural animation mode.

---

This spec is ready to hand to an AI coding agent. The main implementation target is a single, strictly typed TypeScript file `voiceOrbScene.ts` that wires Three.js rendering with Web Audio metrics and maps them to a blue, audio reactive orb visualization.
