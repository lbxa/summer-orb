import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MiniOrb } from './MiniOrb';

export interface MiniOrbHandle {
  destroy(): void;
}

export interface MountMiniOrbOptions {
  sizePx?: number;
}

export function mountMiniOrb(
  target: HTMLElement,
  options: MountMiniOrbOptions = {},
): MiniOrbHandle {
  const mountNode = document.createElement('div');
  target.appendChild(mountNode);

  const root: Root = createRoot(mountNode);
  root.render(createElement(MiniOrb, { sizePx: options.sizePx }));

  return {
    destroy() {
      root.unmount();
      mountNode.remove();
    },
  };
}
