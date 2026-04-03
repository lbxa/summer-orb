import './style.css';
import { createVoiceOrbScene } from './voiceOrbScene';
import { initExportModule } from './exportModule';
import { mountMiniOrb } from './components/MiniOrb';

const container = document.getElementById('app');
const button = document.getElementById('enable-mic');
const errorEl = document.getElementById('error-message');
const overlay = document.getElementById('ui-overlay');
const contextRow = document.getElementById('context-row');
const contextText = document.getElementById('context-text');
const contextOrbSlot = document.getElementById('context-orb-slot');

if (!container || !button || !errorEl || !overlay) {
  throw new Error('Required DOM elements are missing');
}

const orb = createVoiceOrbScene({ container, enableExport: true });
const exportHandle = initExportModule(orb, container);
const miniOrbHandle = contextOrbSlot ? mountMiniOrb(contextOrbSlot, { sizePx: 44 }) : null;

function handleResize(): void {
  if (!container) {
    return;
  }
  const { clientWidth, clientHeight } = container;
  orb.resize(clientWidth, clientHeight);
}

window.addEventListener('resize', handleResize);

button.addEventListener('click', async () => {
  button.setAttribute('disabled', 'true');
  button.textContent = 'Starting...';
  try {
    await orb.start();
    button.classList.add('hidden');
    overlay.classList.add('hidden');
    if (contextText) {
      contextText.textContent = 'Loading context...';
    }
    contextRow?.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    errorEl.textContent = 'Microphone access failed. The orb will animate without audio.';
    errorEl.classList.remove('hidden');
    overlay.classList.add('passive');
    if (contextText) {
      contextText.textContent = 'Listening without microphone...';
    }
    contextRow?.classList.remove('hidden');
  }
});

handleResize();

window.addEventListener('beforeunload', () => {
  miniOrbHandle?.destroy();
});
