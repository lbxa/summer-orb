import './style.css';
import { createVoiceOrbScene } from './voiceOrbScene';

const container = document.getElementById('app');
const button = document.getElementById('enable-mic');
const errorEl = document.getElementById('error-message');
const overlay = document.getElementById('ui-overlay');

if (!container || !button || !errorEl || !overlay) {
  throw new Error('Required DOM elements are missing');
}

const orb = createVoiceOrbScene({ container });

function handleResize(): void {
  const { clientWidth, clientHeight } = container;
  orb.resize(clientWidth, clientHeight);
}

window.addEventListener('resize', handleResize);

button.addEventListener('click', async () => {
  button.setAttribute('disabled', 'true');
  button.textContent = 'Starting...';
  try {
    await orb.start();
    overlay.classList.add('hidden');
  } catch (error) {
    console.error(error);
    errorEl.textContent = 'Microphone access failed. The orb will animate without audio.';
    errorEl.classList.remove('hidden');
    overlay.classList.add('passive');
  }
});

handleResize();
