import { createVoiceOrbScene } from "./voiceOrbScene";

const container = document.getElementById("app");

if (!container) {
  throw new Error("Missing #app container for orb demo");
}

const orb = createVoiceOrbScene({ container });

window.addEventListener("resize", () => {
  orb.resize(window.innerWidth, window.innerHeight);
});

declare global {
  interface Window {
    __summerOrb?: typeof orb;
  }
}

window.__summerOrb = orb;
